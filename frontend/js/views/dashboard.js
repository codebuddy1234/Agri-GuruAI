import { t, tf, cropName, formatDate } from "../i18n.js";
import { icon } from "../icons.js";
import {
  appShell,
  card,
  esc,
  handleApiError,
  loadingBlock,
  moduleCard,
  requireAuth,
} from "../ui.js";
import { api } from "../api.js";
import { state, DEFAULT_MODULES } from "../store.js";
import { STORAGE } from "../config.js";

export function render(ctx) {
  if (!requireAuth(ctx.locale)) return "";
  const modules = state.modules || DEFAULT_MODULES;
  return appShell(
    ctx.locale,
    "/dashboard",
    `
    <div class="dashboard">
      <div class="greeting-row">
        <div>
          <h1 class="page-title" id="dash-greeting">${esc(t("dashboard.greetingNoName"))}</h1>
          <p class="page-subtitle">${esc(t("dashboard.subtitle"))}</p>
        </div>
        <div class="location-chip" id="dash-location">
          ${icon("map-pin", 18)} <span>${esc(t("dashboard.locationNotSet"))}</span>
        </div>
      </div>

      <h2 class="section-title">${esc(t("dashboard.services"))}</h2>
      <div class="module-grid">
        ${modules.map((m) => moduleCard(ctx.locale, m)).join("")}
      </div>

      <div class="recent-card" id="recent-card">
        ${card(
          `<div class="card-head-row">
            <h2 class="card-title">${esc(t("dashboard.recentTitle"))}</h2>
            <a class="link-btn" href="#/${ctx.locale}/history">${esc(t("dashboard.viewAll"))} ${icon("arrow-right", 16)}</a>
          </div>
          <div id="recent-list">${loadingBlock()}</div>`,
        )}
      </div>
    </div>`,
  );
}

function readCachedLocation() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE.HOME_LOCATION) || "null");
  } catch {
    return null;
  }
}

export async function mount(ctx) {
  if (!requireAuth(ctx.locale)) return;

  const greeting = document.getElementById("dash-greeting");
  const locationEl = document.getElementById("dash-location");
  const recentList = document.getElementById("recent-list");

  let profile = null;
  try {
    profile = await api.getProfile();
    state.profile = profile;
    if (profile.full_name) {
      greeting.textContent = tf("dashboard.greeting", { name: profile.full_name });
    }
  } catch (err) {
    handleApiError(err, ctx.locale);
  }

  // Resolve a human-friendly place name.
  let place = "";
  try {
    if (profile && profile.latitude != null && profile.longitude != null) {
      const current = await api.weatherCurrent(profile.latitude, profile.longitude);
      if (current.place && current.place.name) place = current.place.name;
      if (!place) place = `${Number(profile.latitude).toFixed(2)}, ${Number(profile.longitude).toFixed(2)}`;
    } else {
      const cached = readCachedLocation();
      if (cached && cached.placeName) place = cached.placeName;
      else if (cached && cached.latitude != null)
        place = `${Number(cached.latitude).toFixed(2)}, ${Number(cached.longitude).toFixed(2)}`;
      else if (profile && (profile.village || profile.taluka || profile.district)) {
        place = [profile.village, profile.taluka, profile.district].filter(Boolean).join(", ");
      }
    }
  } catch {
    /* weather is best-effort for the location label */
  }
  if (place) {
    locationEl.innerHTML = `${icon("map-pin", 18)} <span>${esc(place)}</span>`;
  }

  try {
    const res = await api.history(3, 0);
    const items = res.data || [];
    if (!items.length) {
      recentList.innerHTML = `<p class="muted-text">${esc(t("dashboard.recentEmpty"))}</p>`;
      return;
    }
    recentList.innerHTML = `<ul class="recent-list">${items
      .map(
        (item) => `
        <li>
          <a class="recent-item" href="#/${ctx.locale}/history/${encodeURIComponent(item.id)}">
            <span class="recent-icon">${icon("sprout", 20)}</span>
            <span class="recent-info">
              <strong>${esc(cropName(item.recommended_crop))}</strong>
              <small>${esc(formatDate(item.created_at))}</small>
            </span>
            ${icon("chevron-right", 18)}
          </a>
        </li>`,
      )
      .join("")}</ul>`;
  } catch (err) {
    handleApiError(err, ctx.locale);
    recentList.innerHTML = `<p class="muted-text">${esc(t("common.somethingWentWrong"))}</p>`;
  }
}
