import { t, conditionLabel, formatDate } from "../i18n.js";
import { icon } from "../icons.js";
import {
  alertBox,
  appShell,
  button,
  card,
  esc,
  handleApiError,
  loadingBlock,
  numberField,
  requireAuth,
  textField,
} from "../ui.js";
import { api } from "../api.js";
import { STORAGE } from "../config.js";

export function render(ctx) {
  if (!requireAuth(ctx.locale)) return "";
  return appShell(
    ctx.locale,
    "/weather",
    `
    <div class="weather-page">
      <div class="page-head">
        <h1 class="page-title with-icon">${icon("cloud-sun", 28)} ${esc(t("weather.title"))}</h1>
        <p class="page-subtitle">${esc(t("weather.subtitle"))}</p>
      </div>
      <div id="weather-alert"></div>

      ${card(`
        <div class="location-bar">
          <div class="location-line" id="weather-location">
            ${icon("map-pin", 20)} <span>${esc(t("common.loading"))}</span>
          </div>
          <div id="home-btn-slot"></div>
        </div>
        <div class="farm-buttons" id="farm-buttons"></div>
      `)}

      <div id="weather-content">${loadingBlock()}</div>

      ${card(`
        <div class="weather-tools">
          <div class="tool-block">
            <h2 class="card-title">${esc(t("weather.useFarm"))}</h2>
            <form id="coords-form" novalidate>
              <div class="form-grid-2">
                ${numberField({ name: "latitude", label: esc(t("weather.latitude")), step: "any", required: true })}
                ${numberField({ name: "longitude", label: esc(t("weather.longitude")), step: "any", required: true })}
              </div>
              ${button(t("weather.checkWeather"), { type: "submit", id: "coords-submit", cls: "btn-sm" })}
            </form>
          </div>
          <div class="tool-block">
            <h2 class="card-title">${esc(t("weather.addressTitle"))}</h2>
            <form id="search-form" novalidate>
              ${textField({
                name: "place",
                label: esc(t("weather.address")),
                placeholder: esc(t("weather.addressPlaceholder")),
              })}
              ${button(t("weather.search"), { type: "submit", id: "search-submit", cls: "btn-sm" })}
            </form>
            <div id="search-results" class="search-results"></div>
          </div>
        </div>
      `)}
    </div>`,
  );
}

function storeHome(lat, lon, label, placeName) {
  try {
    window.localStorage.setItem(
      STORAGE.HOME_LOCATION,
      JSON.stringify({ latitude: lat, longitude: lon, label, placeName }),
    );
  } catch {
    /* ignore */
  }
}
function readHome() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE.HOME_LOCATION) || "null");
  } catch {
    return null;
  }
}
function placeLabel(place) {
  if (!place) return "";
  return [place.name, place.region, place.country].filter(Boolean).join(", ");
}

export async function mount(ctx) {
  if (!requireAuth(ctx.locale)) return;
  const alertEl = document.getElementById("weather-alert");
  const locationEl = document.getElementById("weather-location");
  const homeBtnSlot = document.getElementById("home-btn-slot");
  const contentEl = document.getElementById("weather-content");
  const farmButtons = document.getElementById("farm-buttons");
  if (!contentEl) return;

  let profile = null;
  let farms = [];
  try {
    [profile, farms] = await Promise.all([api.getProfile(), api.listFarms().catch(() => [])]);
  } catch (err) {
    handleApiError(err, ctx.locale);
  }

  // Farm shortcut buttons.
  const farmsWithCoords = (farms || []).filter(
    (f) => f.latitude != null && f.longitude != null,
  );
  if (farmsWithCoords.length) {
    farmButtons.innerHTML =
      `<span class="farm-buttons-label">${esc(t("weather.useFarm"))}:</span>` +
      farmsWithCoords
        .map(
          (f, i) =>
            `<button class="chip-btn" data-farm="${i}">${icon("map-pin", 14)} ${esc(f.name)}</button>`,
        )
        .join("");
    farmButtons.querySelectorAll("[data-farm]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const f = farmsWithCoords[Number(btn.getAttribute("data-farm"))];
        load(f.latitude, f.longitude, t("weather.useFarm"), t("weather.unknownPlace"));
      });
    });
  }

  async function load(lat, lon, sourceKey, placeName) {
    contentEl.innerHTML = loadingBlock();
    alertEl.innerHTML = "";
    try {
      const [current, forecast] = await Promise.all([
        api.weatherCurrent(lat, lon),
        api.weatherForecast(lat, lon, 7),
      ]);
      const resolvedPlace = placeName || placeLabel(current.place) || t("weather.unknownPlace");
      locationEl.innerHTML =
        `${icon("map-pin", 20)} <strong>${esc(resolvedPlace)}</strong>` +
        `<span class="location-source"> · ${esc(sourceKey)}</span>` +
        `<small class="location-coords">${Number(lat).toFixed(3)}, ${Number(lon).toFixed(3)}</small>`;

      if (sourceKey === t("weather.sourceProfile")) {
        homeBtnSlot.innerHTML =
          `<span class="saved-home">${icon("check-circle", 16)} ${esc(t("weather.savedHome"))}</span>`;
      } else {
        homeBtnSlot.innerHTML =
          `<button class="btn btn-outline btn-sm" id="save-home">${icon("map-pin", 16)} ${esc(t("weather.saveHome"))}</button>` +
          `<p class="field-help">${esc(t("weather.homeHint"))}</p>`;
        document.getElementById("save-home")?.addEventListener("click", async () => {
          const btn = document.getElementById("save-home");
          btn.innerHTML = `<span class="spinner"></span><span>${esc(t("weather.savingHome"))}</span>`;
          btn.disabled = true;
          try {
            await api.updateProfile({ latitude: lat, longitude: lon });
            storeHome(lat, lon, t("weather.sourceProfile"), resolvedPlace);
            homeBtnSlot.innerHTML =
              `<span class="saved-home">${icon("check-circle", 16)} ${esc(t("weather.savedHome"))}</span>`;
          } catch (err) {
            const msg = handleApiError(err, ctx.locale);
            alertEl.innerHTML = alertBox("error", msg || t("common.somethingWentWrong"));
            btn.innerHTML = `${icon("map-pin", 16)} ${esc(t("weather.saveHome"))}`;
            btn.disabled = false;
          }
        });
      }

      const c = current.current;
      const days = forecast.days || [];
      contentEl.innerHTML = `
        ${card(`
          <div class="current-weather">
            <div class="current-main">
              <div class="current-temp">${Math.round(c.temperature_c)}<span>°C</span></div>
              <p class="current-condition">${esc(conditionLabel(c.condition.key))}</p>
              <p class="current-place">${esc(resolvedPlace)}</p>
            </div>
            <div class="stat-tiles">
              <div class="stat-tile">${icon("thermometer", 20)}<div><small>${esc(t("weather.feelsLike"))}</small><strong>${Math.round(c.feels_like_c)}°C</strong></div></div>
              <div class="stat-tile">${icon("droplets", 20)}<div><small>${esc(t("weather.humidity"))}</small><strong>${Math.round(c.humidity_pct)}%</strong></div></div>
              <div class="stat-tile">${icon("umbrella", 20)}<div><small>${esc(t("weather.rainfall"))}</small><strong>${Number(c.precipitation_mm).toFixed(1)} mm</strong></div></div>
              <div class="stat-tile">${icon("wind", 20)}<div><small>${esc(t("weather.windKmh"))}</small><strong>${Number(c.wind_kmh).toFixed(1)}</strong></div></div>
            </div>
          </div>`)}
        ${card(`
          <h2 class="card-title">${esc(t("weather.forecastTitle"))}</h2>
          <ul class="forecast-list">
            ${days
              .map(
                (d) => `
              <li class="forecast-day">
                <span class="forecast-date">${esc(formatDate(d.date))}</span>
                <span class="forecast-cond">${icon("cloud-sun", 18)} ${esc(conditionLabel(d.condition.key))}</span>
                <span class="forecast-rain">${icon("umbrella", 16)} ${d.rain_chance_pct != null ? `${d.rain_chance_pct}%` : "—"}</span>
                <span class="forecast-temps"><strong>${Math.round(d.temp_max_c)}°</strong> / ${Math.round(d.temp_min_c)}°</span>
              </li>`,
              )
              .join("")}
          </ul>`)}
      `;
      storeHome(lat, lon, sourceKey, resolvedPlace);
    } catch (err) {
      const msg = handleApiError(err, ctx.locale);
      contentEl.innerHTML = alertBox("error", msg || t("common.somethingWentWrong"));
    }
  }

  // Manual coordinates form.
  const coordsForm = document.getElementById("coords-form");
  coordsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const lat = Number(coordsForm.elements.latitude.value);
    const lon = Number(coordsForm.elements.longitude.value);
    if (
      coordsForm.elements.latitude.value === "" ||
      coordsForm.elements.longitude.value === "" ||
      Number.isNaN(lat) ||
      Number.isNaN(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      alertEl.innerHTML = alertBox("error", esc(t("weather.invalidCoords")));
      return;
    }
    load(lat, lon, t("weather.sourceManual"), t("weather.unknownPlace"));
  });

  // Place search.
  const searchForm = document.getElementById("search-form");
  const searchResults = document.getElementById("search-results");
  searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = searchForm.elements.place.value.trim();
    if (name.length < 2) return;
    searchResults.innerHTML = `<span class="muted-text">${esc(t("common.loading"))}</span>`;
    try {
      const places = await api.weatherSearch(name);
      if (!places.length) {
        searchResults.innerHTML = `<p class="muted-text">${esc(t("weather.noResults"))}</p>`;
        return;
      }
      searchResults.innerHTML = places
        .map(
          (p, i) =>
            `<button class="search-result" data-place="${i}">${icon("map-pin", 16)} ${esc(placeLabel(p))}</button>`,
        )
        .join("");
      searchResults.querySelectorAll("[data-place]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const p = places[Number(btn.getAttribute("data-place"))];
          load(p.latitude, p.longitude, t("weather.sourceManual"), p.name);
        });
      });
    } catch (err) {
      const msg = handleApiError(err, ctx.locale);
      alertEl.innerHTML = alertBox("error", msg || t("common.somethingWentWrong"));
      searchResults.innerHTML = "";
    }
  });

  // Initial location: profile → farm → device cache → browser GPS → prompt manual.
  if (profile && profile.latitude != null && profile.longitude != null) {
    await load(profile.latitude, profile.longitude, t("weather.sourceProfile"), placeLabel(null));
    return;
  }
  if (farmsWithCoords.length) {
    const f = farmsWithCoords[0];
    await load(f.latitude, f.longitude, t("weather.useFarm"), f.name || t("weather.unknownPlace"));
    return;
  }
  const cached = readHome();
  if (cached && cached.latitude != null) {
    await load(
      cached.latitude,
      cached.longitude,
      cached.label || t("weather.sourceManual"),
      cached.placeName || t("weather.unknownPlace"),
    );
    return;
  }
  if (navigator.geolocation) {
    locationEl.innerHTML = `${icon("map-pin", 20)} <span>${esc(t("common.loading"))}</span>`;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        load(
          pos.coords.latitude,
          pos.coords.longitude,
          t("weather.sourceGps"),
          t("weather.unknownPlace"),
        ),
      () => {
        contentEl.innerHTML = alertBox("info", esc(t("weather.manualTitle")));
      },
      { timeout: 8000 },
    );
  } else {
    contentEl.innerHTML = alertBox("info", esc(t("weather.manualTitle")));
  }
}
