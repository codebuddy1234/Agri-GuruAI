import { t } from "../i18n.js";
import { icon } from "../icons.js";
import {
  alertBox,
  appShell,
  button,
  card,
  esc,
  selectField,
  textField,
} from "../ui.js";

const BASE_NPK = {
  rice: [100, 50, 50],
  wheat: [120, 60, 40],
  maize: [120, 60, 40],
  cotton: [100, 50, 50],
  sugarcane: [250, 115, 115],
  vegetables: [80, 40, 40],
};
const SOIL_ADJUST = {
  loamy: [0, 0, 0],
  clayey: [-10, 0, 10],
  sandy: [10, 10, 0],
  black: [-10, 0, 0],
  red: [10, 10, 10],
};
const STAGE_SPLIT = {
  basal: [0.5, 0.25, 0.25],
  vegetative: [0.25, 0.5, 0.25],
  flowering: [0.25, 0.25, 0.5],
};

export function render(ctx) {
  const crops = Object.keys(BASE_NPK).map((k) => ({
    value: k,
    label: t(`fertilizerAdvice.crops.${k}`),
  }));
  const soils = Object.keys(SOIL_ADJUST).map((k) => ({
    value: k,
    label: t(`fertilizerAdvice.soils.${k}`),
  }));
  const stages = Object.keys(STAGE_SPLIT).map((k) => ({
    value: k,
    label: t(`fertilizerAdvice.stages.${k}`),
  }));

  return appShell(
    ctx.locale,
    "/fertilizer",
    `
    <div class="fertilizer-page">
      <div class="page-head">
        <h1 class="page-title with-icon">${icon("flask-conical", 28)} ${esc(t("fertilizerAdvice.title"))}</h1>
        <p class="page-subtitle">${esc(t("fertilizerAdvice.subtitle"))}</p>
      </div>
      ${card(`
        <form id="fert-form" novalidate>
          <div class="form-grid-2">
            ${selectField({ name: "crop", label: esc(t("fertilizerAdvice.cropLabel")), options: crops, value: "rice" })}
            ${selectField({ name: "soil", label: esc(t("fertilizerAdvice.soilLabel")), options: soils, value: "loamy" })}
          </div>
          <div class="form-grid-2">
            ${selectField({ name: "stage", label: esc(t("fertilizerAdvice.stageLabel")), options: stages, value: "basal" })}
            ${textField({ name: "area", label: esc(t("fertilizerAdvice.areaLabel")), type: "number", min: 0 })}
          </div>
          ${button(t("fertilizerAdvice.getAdvice"), { type: "submit", id: "fert-submit", cls: "full-width", size: "lg" })}
        </form>
      `)}
      <div id="fert-result"></div>
    </div>`,
  );
}

export function mount() {
  const form = document.getElementById("fert-form");
  const result = document.getElementById("fert-result");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const crop = form.elements.crop.value;
    const soil = form.elements.soil.value;
    const stage = form.elements.stage.value;
    const base = BASE_NPK[crop] || BASE_NPK.rice;
    const adjust = SOIL_ADJUST[soil] || SOIL_ADJUST.loamy;
    const split = STAGE_SPLIT[stage] || STAGE_SPLIT.basal;
    const total = [base[0] + adjust[0], base[1] + adjust[1], base[2] + adjust[2]].map((n) =>
      Math.max(0, n),
    );
    const stageValues = total.map((n, i) => n * split[i]);
    const areaRaw = Number(form.elements.area.value);
    const hasArea = form.elements.area.value !== "" && !Number.isNaN(areaRaw) && areaRaw > 0;

    const tiles = [
      { label: "N", value: stageValues[0] },
      { label: "P₂O₅", value: stageValues[1] },
      { label: "K₂O", value: stageValues[2] },
    ];
    const tips = ["soilTest", "split", "water", "organic"];

    result.innerHTML = `
      <h2 class="section-title">${esc(t("fertilizerAdvice.resultTitle"))}</h2>
      ${card(`
        <h3 class="card-title">${esc(t("fertilizerAdvice.npkTitle"))} <small class="unit-note">kg/ha</small></h3>
        <div class="npk-tiles">
          ${tiles
            .map(
              (tile) => `
            <div class="npk-tile">
              <span class="npk-label">${esc(tile.label)}</span>
              <strong>${esc(tile.value.toFixed(1))}</strong>
              <small>kg/ha</small>
              ${hasArea ? `<em>${esc((tile.value * areaRaw).toFixed(1))} kg for ${esc(areaRaw)} ha</em>` : ""}
            </div>`,
            )
            .join("")}
        </div>

        <h3 class="sub-title">${esc(t("fertilizerAdvice.timingTitle"))}</h3>
        <ul class="tips-list">
          ${tiles
            .map(
              (tile) =>
                `<li>${icon("leaf", 16)} <span><strong>${esc(tile.label)}</strong> — ${esc(
                  tile.value.toFixed(1),
                )} kg/ha ${hasArea ? `(${esc((tile.value * areaRaw).toFixed(1))} kg total)` : ""}</span></li>`,
            )
            .join("")}
        </ul>

        <h3 class="sub-title">${esc(t("fertilizerAdvice.tipsTitle"))}</h3>
        <ul class="tips-list">
          ${tips
            .map(
              (k) =>
                `<li>${icon("check-circle", 16)} <span>${esc(t(`fertilizerAdvice.tips.${k}`))}</span></li>`,
            )
            .join("")}
        </ul>

        <div class="disclaimer-slot">
          ${alertBox("info", esc(t("fertilizerAdvice.disclaimerTitle")), esc(t("fertilizerAdvice.disclaimerBody")))}
        </div>
      `)}
    `;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
