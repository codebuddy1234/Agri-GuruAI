import { t, tf, formatPercent } from "../i18n.js";
import { icon } from "../icons.js";
import {
  alertBox,
  appShell,
  button,
  card,
  esc,
  handleApiError,
  requireAuth,
} from "../ui.js";
import { api } from "../api.js";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 10 * 1024 * 1024;

function prettyDiseaseLabel(raw) {
  if (!raw) return "";
  if (raw === "healthy") return "Crop — healthy";
  if (raw.includes("___")) {
    const [crop, disease] = raw.split("___");
    return `${crop}: ${disease.replace(/_/g, " ")}`;
  }
  return raw.replace(/_/g, " ");
}

export function render(ctx) {
  if (!requireAuth(ctx.locale)) return "";
  return appShell(
    ctx.locale,
    "/disease-detection",
    `
    <div class="disease-page">
      <div class="page-head">
        <h1 class="page-title with-icon">${icon("stethoscope", 28)} ${esc(t("disease.title"))}</h1>
        <p class="page-subtitle">${esc(t("disease.subtitle"))}</p>
      </div>
      <div id="disease-alert"></div>
      ${card(`
        <form id="disease-form" novalidate>
          <input type="file" id="leaf-file" name="image" accept="${ACCEPT}" hidden />
          <button type="button" class="dropzone" id="dropzone">
            <span class="dropzone-icon">${icon("upload", 30)}</span>
            <strong>${esc(t("disease.choosePhoto"))}</strong>
            <small>${esc(t("disease.photoHelp"))}</small>
          </button>
          <div id="file-info" class="file-info" hidden>
            <img id="file-preview" alt="${esc(t("disease.previewAlt"))}" />
            <div>
              <p id="file-name" class="file-name"></p>
              <p id="file-size" class="file-size"></p>
            </div>
          </div>
          ${button(t("disease.submit"), {
            type: "submit",
            size: "lg",
            id: "disease-submit",
            cls: "full-width",
          })}
        </form>
      `)}
      <div id="disease-result"></div>
    </div>`,
  );
}

export function mount(ctx) {
  if (!requireAuth(ctx.locale)) return;
  const form = document.getElementById("disease-form");
  const fileInput = document.getElementById("leaf-file");
  const dropzone = document.getElementById("dropzone");
  const fileInfo = document.getElementById("file-info");
  const preview = document.getElementById("file-preview");
  const nameEl = document.getElementById("file-name");
  const sizeEl = document.getElementById("file-size");
  const submit = document.getElementById("disease-submit");
  const alertEl = document.getElementById("disease-alert");
  const resultEl = document.getElementById("disease-result");
  if (!form) return;

  let objectUrl = null;
  let previewUrl = null;

  dropzone.addEventListener("click", () => fileInput.click());
  fileInfo.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    resultEl.innerHTML = "";
    alertEl.innerHTML = "";
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      fileInfo.hidden = true;
      dropzone.hidden = false;
      return;
    }
    if (file.size > MAX_BYTES) {
      alertEl.innerHTML = alertBox("error", esc(t("disease.tooLarge")));
      fileInput.value = "";
      fileInfo.hidden = true;
      dropzone.hidden = false;
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    preview.src = objectUrl;
    previewUrl = objectUrl;
    nameEl.textContent = file.name;
    sizeEl.textContent = `${(file.size / 1024).toFixed(0)} KB`;
    fileInfo.hidden = false;
    dropzone.hidden = true;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    alertEl.innerHTML = "";
    resultEl.innerHTML = "";
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      alertEl.innerHTML = alertBox("warning", esc(t("disease.choosePhoto")));
      return;
    }
    if (file.size > MAX_BYTES) {
      alertEl.innerHTML = alertBox("error", esc(t("disease.tooLarge")));
      return;
    }

    submit.innerHTML = `<span class="spinner"></span><span>${esc(t("disease.analyzing"))}</span>`;
    submit.disabled = true;
    try {
      const result = await api.diseasePredict(file);
      const c = Number(result.confidence || 0);
      if (c <= 0.65) {
        resultEl.innerHTML = card(
          alertBox("warning", esc(t("disease.notRecognizable")), esc(t("disease.notRecognizableBody"))),
        );
        return;
      }
      const alts = result.alternatives || [];
      let modelLine = "";
      try {
        const info = await api.diseaseModelInfo();
        modelLine = `<p class="model-info">${esc(
          tf("disease.modelInfo", { name: info.model_name, version: info.model_version }),
        )}</p>`;
      } catch {
        modelLine = `<p class="model-info">${esc(
          t("disease.modelInfo")
            .replace("{name}", result.model_name || "")
            .replace("{version}", result.model_version || ""),
        )}</p>`;
      }
      resultEl.innerHTML = card(
        `<h2 class="card-title">${esc(t("disease.resultTitle"))}</h2>
        <div class="diagnosis-name">${esc(prettyDiseaseLabel(result.disease))}</div>
        <div class="confidence-head">
          <span>${esc(t("disease.confidence"))}</span>
          <strong>${Math.round(c * 100)}%</strong>
        </div>
        <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100"
             aria-valuenow="${Math.round(c * 100)}">
          <div class="meter-fill" style="width:${Math.max(c * 100, 2)}%"></div>
        </div>
        <h3 class="sub-title">${esc(t("disease.alternativesTitle"))}</h3>
        <div class="alt-list">
          ${
            alts.length
              ? alts
                  .map(
                    (a) =>
                      `<span class="alt-pill">${esc(prettyDiseaseLabel(a.label))} <small>${esc(
                        formatPercent(a.probability),
                      )}</small></span>`,
                  )
                  .join("")
              : `<span class="muted-text">—</span>`
          }
        </div>
        ${modelLine}
        <div class="disclaimer-slot">${alertBox("info", esc(t("disease.disclaimerTitle")), esc(t("disease.disclaimerBody")))}</div>`,
      );
    } catch (err) {
      const msg = handleApiError(err, ctx.locale);
      alertEl.innerHTML = alertBox("error", msg || t("common.somethingWentWrong"));
    } finally {
      submit.innerHTML = `<span>${esc(t("disease.submit"))}</span>`;
      submit.disabled = false;
    }
  });
}
