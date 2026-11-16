import { t, tf } from "../i18n.js";
import { icon } from "../icons.js";
import {
  alertBox,
  appShell,
  button,
  card,
  esc,
  handleApiError,
  numberField,
  requireAuth,
  selectField,
} from "../ui.js";
import { api } from "../api.js";
import { STORAGE } from "../config.js";
import { navigate } from "../router.js";

const FIELDS = [
  { name: "nitrogen", section: "soil", unit: "", min: 0, max: 200, step: 1 },
  { name: "phosphorus", section: "soil", unit: "", min: 0, max: 200, step: 1 },
  { name: "potassium", section: "soil", unit: "", min: 0, max: 250, step: 1 },
  { name: "ph", section: "soil", unit: "pH", min: 0, max: 14, step: 0.1 },
  { name: "temperature", section: "weather", unit: "°C", min: 0, max: 55, step: 0.1 },
  { name: "humidity", section: "weather", unit: "%", min: 0, max: 100, step: 0.1 },
  { name: "rainfall", section: "weather", unit: "mm", min: 0, max: 500, step: 0.1 },
];

function fieldHtml(f) {
  return numberField({
    name: f.name,
    label: esc(t(`crop.${f.name}`)),
    help: esc(t(`crop.${f.name}Help`)),
    unit: f.unit,
    min: f.min,
    max: f.max,
    step: f.step,
    hint: tf("crop.acceptedRange", { min: f.min, max: f.max }),
  });
}

export function render(ctx) {
  if (!requireAuth(ctx.locale)) return "";
  return appShell(
    ctx.locale,
    "/crop-recommendation",
    `
    <div class="crop-page">
      <div class="page-head">
        <h1 class="page-title with-icon">${icon("sprout", 28)} ${esc(t("crop.title"))}</h1>
        <p class="page-subtitle">${esc(t("crop.subtitle"))}</p>
      </div>
      <div id="crop-alert"></div>
      <form id="crop-form" novalidate>
        ${card(
          `<div class="npk-warning">
            ${alertBox(
              "warning",
              esc(t("crop.npkUnitWarningTitle")),
              esc(t("crop.npkUnitWarningBody")),
            )}
          </div>
          <h2 class="card-title">${esc(t("crop.soilSection"))}</h2>
          <div class="form-grid-2">
            ${FIELDS.filter((f) => f.section === "soil").map(fieldHtml).join("")}
          </div>`,
        )}
        ${card(
          `<h2 class="card-title">${esc(t("crop.weatherSection"))}</h2>
          <div class="form-grid-2">
            ${FIELDS.filter((f) => f.section === "weather").map(fieldHtml).join("")}
          </div>`,
        )}
        <div id="farm-card-slot"></div>
        <div class="form-actions">
          ${button(t("crop.submit"), {
            type: "submit",
            size: "lg",
            id: "crop-submit",
            cls: "full-width",
          })}
        </div>
      </form>
    </div>`,
  );
}

export async function mount(ctx) {
  if (!requireAuth(ctx.locale)) return;
  const form = document.getElementById("crop-form");
  const alertBoxEl = document.getElementById("crop-alert");
  const submit = document.getElementById("crop-submit");
  const farmSlot = document.getElementById("farm-card-slot");
  if (!form) return;

  // Optional farm selector — failure is tolerated.
  try {
    const farms = await api.listFarms();
    if (farms && farms.length) {
      farmSlot.innerHTML = card(
        `<h2 class="card-title">${esc(t("crop.linkFarm"))}</h2>` +
          selectField({
            name: "farm_id",
            label: esc(t("crop.linkFarm")),
            options: [
              { value: "", label: t("crop.noFarm") },
              ...farms.map((f) => ({ value: f.id, label: f.name })),
            ],
          }),
      );
    }
  } catch {
    /* farms are optional */
  }

  function clearErrors() {
    alertBoxEl.innerHTML = "";
    form.querySelectorAll(".field-error").forEach((el) => el.remove());
    form.querySelectorAll(".input-error").forEach((el) => el.classList.remove("input-error"));
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();

    const values = {};
    let firstInvalid = null;
    for (const f of FIELDS) {
      const input = form.elements[f.name];
      const raw = input.value.trim();
      const num = Number(raw);
      let error = "";
      if (raw === "" || Number.isNaN(num)) error = t("errors.INVALID_INPUT");
      else if (num < f.min || num > f.max) error = tf("crop.acceptedRange", { min: f.min, max: f.max });
      if (error) {
        input.classList.add("input-error");
        const p = document.createElement("p");
        p.className = "field-error";
        p.setAttribute("role", "alert");
        p.textContent = error;
        input.closest(".field")?.appendChild(p);
        if (!firstInvalid) firstInvalid = input;
      } else {
        values[f.name] = num;
      }
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const farmId = form.elements.farm_id ? form.elements.farm_id.value : "";
    const body = { ...values, farm_id: farmId || null };

    submit.innerHTML = `<span class="spinner"></span><span>${esc(t("crop.submitting"))}</span>`;
    submit.disabled = true;
    try {
      const prediction = await api.predict(body);
      try {
        window.sessionStorage.setItem(STORAGE.LAST_PREDICTION, JSON.stringify(prediction));
      } catch {
        /* session storage unavailable */
      }
      navigate(`/${ctx.locale}/crop-recommendation/result?id=${encodeURIComponent(prediction.id)}`, true);
    } catch (err) {
      const msg = handleApiError(err, ctx.locale);
      if (msg) alertBoxEl.innerHTML = alertBox("error", msg);
      submit.innerHTML = `<span>${esc(t("crop.submit"))}</span>`;
      submit.disabled = false;
    }
  });
}
