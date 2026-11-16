// API client — mirrors the original Next.js lib/api-client.ts.
// Envelope handling, token storage, automatic refresh and multipart upload.

import { API_BASE_URL, STORAGE } from "./config.js";

export class ApiClientError extends Error {
  constructor(code, message, status, details = [], requestId = null) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }

  fieldErrors() {
    const out = {};
    for (const d of this.details) {
      if (d.field && !(d.field in out)) out[d.field] = d.message;
    }
    return out;
  }
}

function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* blocked storage: session will not persist */
  }
}
function safeRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const tokenStore = {
  get access() {
    return safeGet(STORAGE.ACCESS);
  },
  get refresh() {
    return safeGet(STORAGE.REFRESH);
  },
  set(tokens) {
    safeSet(STORAGE.ACCESS, tokens.access_token);
    safeSet(STORAGE.REFRESH, tokens.refresh_token);
  },
  clear() {
    safeRemove(STORAGE.ACCESS);
    safeRemove(STORAGE.REFRESH);
  },
};

async function request(path, options = {}) {
  const { method = "GET", body, auth = true, _retried = false } = options;
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = tokenStore.access;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError("NETWORK", "Cannot reach the server.", 0);
  }

  if (response.status === 401 && auth && !_retried && tokenStore.refresh) {
    if (await tryRefresh()) {
      return request(path, { ...options, _retried: true });
    }
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError(
      "INTERNAL_ERROR",
      "The server returned an unreadable response.",
      response.status,
    );
  }

  if (!response.ok) {
    const err = payload && payload.error;
    throw new ApiClientError(
      (err && err.code) || "INTERNAL_ERROR",
      (err && err.message) || "Request failed.",
      response.status,
      (err && err.details) || [],
      (err && err.request_id) || null,
    );
  }
  return payload;
}

async function tryRefresh() {
  const refresh_token = tokenStore.refresh;
  if (!refresh_token) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    });
    if (!res.ok) {
      tokenStore.clear();
      return false;
    }
    const data = await res.json();
    tokenStore.set(data.data.tokens);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  async register(input) {
    const res = await request("/auth/register", {
      method: "POST",
      body: input,
      auth: false,
    });
    tokenStore.set(res.data.tokens);
    return res.data;
  },

  async login(email, password) {
    const res = await request("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    tokenStore.set(res.data.tokens);
    return res.data;
  },

  logout() {
    tokenStore.clear();
  },

  async me() {
    const res = await request("/auth/me");
    return res.data;
  },

  async getProfile() {
    const res = await request("/farmer/profile");
    return res.data;
  },

  async updateProfile(patch) {
    const res = await request("/farmer/profile", { method: "PUT", body: patch });
    return res.data;
  },

  async listFarms() {
    const res = await request("/farmer/farms");
    return res.data;
  },

  async createFarm(input) {
    const res = await request("/farmer/farms", { method: "POST", body: input });
    return res.data;
  },

  async predict(input) {
    const res = await request("/crop-recommendation/predict", {
      method: "POST",
      body: input,
    });
    return res.data.prediction;
  },

  async history(limit = 20, offset = 0) {
    return request(`/crop-recommendation/history?limit=${limit}&offset=${offset}`);
  },

  async historyDetail(id) {
    const res = await request(`/crop-recommendation/history/${encodeURIComponent(id)}`);
    return res.data.prediction;
  },

  async modules() {
    const res = await request("/modules");
    return res.data;
  },

  async diseasePredict(image) {
    const doFetch = async () => {
      const form = new FormData();
      form.append("image", image, image.name);
      const headers = {};
      const token = tokenStore.access;
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetch(`${API_BASE_URL}/disease-detection/predict`, {
        method: "POST",
        headers,
        body: form,
      });
    };

    let response;
    try {
      response = await doFetch();
    } catch {
      throw new ApiClientError("NETWORK", "Cannot reach the server.", 0);
    }
    if (response.status === 401 && tokenStore.refresh) {
      if (await tryRefresh()) {
        try {
          response = await doFetch();
        } catch {
          throw new ApiClientError("NETWORK", "Cannot reach the server.", 0);
        }
      }
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ApiClientError(
        "INTERNAL_ERROR",
        "The server returned an unreadable response.",
        response.status,
      );
    }
    if (!response.ok) {
      const err = payload && payload.error;
      throw new ApiClientError(
        (err && err.code) || "INTERNAL_ERROR",
        (err && err.message) || "Request failed.",
        response.status,
        (err && err.details) || [],
        (err && err.request_id) || null,
      );
    }
    return payload.data;
  },

  async diseaseModelInfo() {
    const res = await request("/disease-detection/model-info");
    return res.data;
  },

  async weatherCurrent(latitude, longitude) {
    const res = await request(
      `/weather/current?latitude=${latitude}&longitude=${longitude}`,
    );
    return res.data;
  },

  async weatherForecast(latitude, longitude, days = 7) {
    const res = await request(
      `/weather/forecast?latitude=${latitude}&longitude=${longitude}&days=${days}`,
    );
    return res.data;
  },

  async weatherSearch(name) {
    const res = await request(`/weather/search?name=${encodeURIComponent(name)}`);
    return res.data.places;
  },
};
