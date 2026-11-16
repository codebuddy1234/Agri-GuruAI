// Hash-based SPA router. Hash routing keeps the app deployable on any static
// file server (no rewrite rules) while preserving locale and query strings.

import { DEFAULT_LOCALE, isLocale } from "./config.js";
import { loadLocale, getLocale } from "./i18n.js";
import { tokenStore } from "./api.js";

import * as landing from "./views/landing.js";
import * as login from "./views/login.js";
import * as register from "./views/register.js";
import * as dashboard from "./views/dashboard.js";
import * as crop from "./views/crop.js";
import * as result from "./views/result.js";
import * as disease from "./views/disease.js";
import * as weather from "./views/weather.js";
import * as fertilizer from "./views/fertilizer.js";
import * as historyView from "./views/history.js";
import * as historyDetail from "./views/historyDetail.js";
import * as profile from "./views/profile.js";

const ROUTES = [
  { test: (s) => s.length === 1, view: landing, name: "landing", auth: false },
  { test: (s) => s[1] === "login", view: login, name: "login", auth: false },
  { test: (s) => s[1] === "register", view: register, name: "register", auth: false },
  { test: (s) => s[1] === "dashboard", view: dashboard, name: "dashboard", auth: true },
  { test: (s) => s[1] === "crop-recommendation" && !s[2], view: crop, name: "crop", auth: true },
  { test: (s) => s[1] === "crop-recommendation" && s[2] === "result", view: result, name: "result", auth: true },
  { test: (s) => s[1] === "disease-detection", view: disease, name: "disease", auth: true },
  { test: (s) => s[1] === "weather", view: weather, name: "weather", auth: true },
  { test: (s) => s[1] === "fertilizer", view: fertilizer, name: "fertilizer", auth: false },
  { test: (s) => s[1] === "history" && !s[2], view: historyView, name: "history", auth: true },
  { test: (s) => s[1] === "history" && !!s[2], view: historyDetail, name: "historyDetail", auth: true },
  { test: (s) => s[1] === "profile", view: profile, name: "profile", auth: true },
];

/** Navigate to a path like `/mr/dashboard?x=1` (no leading #). */
export function navigate(path, replace = false) {
  const target = `#${path.startsWith("/") ? path : `/${path}`}`;
  if (replace) {
    history.replaceState(null, "", target);
    handleRoute();
  } else {
    window.location.hash = target;
  }
}

export function currentPath() {
  return window.location.hash.replace(/^#/, "") || "/";
}

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [pathPart, queryPart = ""] = raw.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const query = {};
  for (const pair of queryPart.split("&")) {
    if (!pair) continue;
    const [k, v = ""] = pair.split("=");
    query[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return { segments, query };
}

let current = null;

async function handleRoute() {
  const { segments, query } = parseHash();
  let locale = segments[0];
  if (!isLocale(locale)) {
    locale = DEFAULT_LOCALE;
    // Re-render under the default locale and stop this pass, otherwise the
    // stale (empty) segment list falls through to the 404 branch below.
    navigate(`/${locale}`, true);
    return;
  }
  await loadLocale(locale);

  const route = ROUTES.find((r) => r.test(segments)) || null;
  const activePath = segments.length > 1 ? `/${segments.slice(1).join("/")}` : "";

  if (!route) {
    document.getElementById("app").innerHTML =
      `<div class="not-found"><h1>404</h1><a href="#/${locale}/dashboard">Home</a></div>`;
    return;
  }

  if (route.auth && !tokenStore.access) {
    navigate(`/${locale}/login`, true);
    return;
  }

  const ctx = {
    locale,
    params: segments.slice(2),
    query,
    segments,
    activePath,
    routeName: route.name,
  };
  current = ctx;

  const app = document.getElementById("app");
  app.innerHTML = typeof route.view.render === "function" ? route.view.render(ctx) : "";
  window.scrollTo(0, 0);
  if (typeof route.view.mount === "function") {
    try {
      await route.view.mount(ctx);
    } catch (err) {
      console.error("[AgriGuru] view error", err);
    }
  }
}

export function getCurrentRoute() {
  return current;
}

export function startRouter() {
  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}
