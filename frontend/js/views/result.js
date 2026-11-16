import { t, tf, cropName, formatPercent, formatNumber } from "../i18n.js";
import { icon } from "../icons.js";
import {
  alertBox,
  appShell,
  card,
  esc,
  handleApiError,
  loadingBlock,
  requireAuth,
} from "../ui.js";
import { api } from "../api.js";
import { STORAGE } from "../config.js";
import { navigate } from "../router.js";

const UNITS = {
  nitrogen: "",
  phosphorus: "",
  potassium: "",
  temperature: "°C",
  humidity: "%",
  ph: "",
  rainfall: "mm",
};

function confidenceBand(c) {
  if (c >= 0.8) return "high";
  if (c >= 0.55) return "medium";
  return "low";
}

/** Shared presentational card, reused by the history detail page. */
export function resultHtml(prediction, locale, showSaved = false) {
  const band = confidenceBand(Number(prediction.confidence || 0));
  const cropLabel = cropName(prediction.recommended_crop);
  const alts = prediction.alternatives || [];
  const inputs = prediction.inputs || {};
  const outOfRange = prediction.out_of_training_range || [];

  return `
    <div class="result-card">
      <div class="result-hero band-${band}">
        <div class="result-hero-top">
          ${showSaved ? `<span class="saved-pill">${icon("check-circle", 16)} ${esc(t("result.saved"))}</span>` : ""}
          <span class="result-eyebrow">${esc(t("result.title"))}</span>
        </div>
        <h1 class="result-crop">${esc(cropLabel)}</h1>
        <div class="confidence-block">
          <div class="confidence-head">
            <span>${esc(t("result.confidence"))}</span>
            <strong>${esc(formatPercent(prediction.confidence))}</strong>
          </div>
          <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100"
               aria-valuenow="${Math.round(Number(prediction.confidence || 0) * 100)}">
            <div class="meter-fill" style="width:${Math.max(Number(prediction.confidence || 0) * 100, 2)}%"></div>
          </div>
          <p class="confidence-note">${esc(t(`result.confidence${band.charAt(0).toUpperCase() + band.slice(1)}`))}</p>
        </div>
      </div>

      <div class="result-body">
        ${outOfRange.length
          ? alertBox(
              "warning",
              esc(t("result.outOfRangeTitle")),
              esc(
                tf("result.outOfRangeBody", {
                  fields: outOfRange.map((f) => esc(t(`crop.${f}`) !== `crop.${f}` ? t(`crop.${f}`) : f)).join(", "),
                }),
              ),
            )
          : ""}

        ${card(
          `<h2 class="card-title">${esc(t("result.alternativesTitle"))}</h2>` +
            (alts.length
              ? `<div class="alt-list">${alts
                  .map(
                    (a) =>
                      `<span class="alt-pill">${esc(cropName(a.crop))} <small>${esc(formatPercent(a.probability))}</small></span>`,
                  )
                  .join("")}</div>`
              : `<p class="muted-text">${esc(t("result.noAlternatives"))}</p>`),
        )}

        ${card(
          `<h2 class="card-title">${esc(t("result.whyTitle"))}</h2>
          <p class="why-body">${esc(
            tf("result.whyBody", {
              nitrogen: inputs.nitrogen ?? "—",
              phosphorus: inputs.phosphorus ?? "—",
              potassium: inputs.potassium ?? "—",
              temperature: inputs.temperature ?? "—",
              humidity: inputs.humidity ?? "—",
              ph: inputs.ph ?? "—",
              rainfall: inputs.rainfall ?? "—",
              crop: cropLabel,
            }),
          )}</p>
          <h3 class="sub-title">${esc(t("result.yourInputs"))}</h3>
          <dl class="input-grid">
            ${Object.keys(UNITS)
              .filter((k) => inputs[k] !== undefined)
              .map(
                (k) =>
                  `<div class="input-cell"><dt>${esc(t(`crop.${k}`))}</dt>` +
                  `<dd>${esc(formatNumber(inputs[k], 1))} ${esc(UNITS[k])}</dd></div>`,
              )
              .join("")}
          </dl>`,
        )}

        ${alertBox("info", esc(t("result.disclaimerTitle")), esc(t("result.disclaimerBody")))}

        <p class="model-info">${esc(
          tf("result.modelInfo", {
            version: prediction.model_version,
            algorithm: prediction.algorithm || "—",
          }),
        )}</p>

        <div class="result-actions">
          <a class="btn btn-primary btn-lg" href="#/${locale}/crop-recommendation">${esc(t("result.newRecommendation"))}</a>
          <a class="btn btn-outline btn-lg" href="#/${locale}/history">${esc(t("result.viewHistory"))}</a>
        </div>
      </div>
    </div>`;
}

export function render(ctx) {
  if (!requireAuth(ctx.locale)) return "";
  return appShell(
    ctx.locale,
    "/crop-recommendation",
    `<div class="result-page"><div id="result-slot">${loadingBlock()}</div></div>`,
  );
}

export async function mount(ctx) {
  if (!requireAuth(ctx.locale)) return;
  const slot = document.getElementById("result-slot");
  const id = ctx.query.id;
  if (!id) {
    navigate(`/${ctx.locale}/crop-recommendation`, true);
    return;
  }

  let prediction = null;
  let fromStorage = false;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(STORAGE.LAST_PREDICTION) || "null");
    if (stored && stored.id === id) {
      prediction = stored;
      fromStorage = true;
    }
  } catch {
    /* ignore */
  }
  if (!prediction) {
    try {
      prediction = await api.historyDetail(id);
    } catch (err) {
      const msg = handleApiError(err, ctx.locale);
      slot.innerHTML = alertBox("error", msg || t("common.somethingWentWrong"));
      return;
    }
  }
  slot.innerHTML = resultHtml(prediction, ctx.locale, fromStorage);
}
