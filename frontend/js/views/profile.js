import { t } from "../i18n.js";
import { icon } from "../icons.js";
import {
  alertBox,
  appShell,
  button,
  card,
  esc,
  handleApiError,
  loadingBlock,
  requireAuth,
  selectField,
  textField,
} from "../ui.js";
import { api } from "../api.js";
import { navigate } from "../router.js";
import { LOCALE_NAMES } from "../config.js";

export function render(ctx) {
  if (!requireAuth(ctx.locale)) return "";
  return appShell(
    ctx.locale,
    "/profile",
    `
    <div class="profile-page">
      <div class="page-head">
        <h1 class="page-title">${esc(t("profile.title"))}</h1>
        <p class="page-subtitle">${esc(t("profile.subtitle"))}</p>
      </div>
      <div id="profile-alert"></div>
      <div id="profile-cards">${loadingBlock()}</div>
      <div id="farms-section"></div>
    </div>`,
  );
}

export async function mount(ctx) {
  if (!requireAuth(ctx.locale)) return;
  const alertEl = document.getElementById("profile-alert");
  const cardsEl = document.getElementById("profile-cards");
  const farmsEl = document.getElementById("farms-section");

  let profile;
  let farms = [];
  try {
    [profile, farms] = await Promise.all([api.getProfile(), api.listFarms().catch(() => [])]);
  } catch (err) {
    const msg = handleApiError(err, ctx.locale);
    cardsEl.innerHTML = alertBox("error", msg || t("common.somethingWentWrong"));
    return;
  }

  const langButtons = ["mr", "hi", "en"]
    .map(
      (l) =>
        `<button type="button" class="lang-choice ${profile.preferred_language === l ? "active" : ""}" ` +
        `data-lang-choice="${l}" aria-pressed="${profile.preferred_language === l}">${esc(LOCALE_NAMES[l])}</button>`,
    )
    .join("");

  cardsEl.innerHTML = `
    <form id="profile-form" novalidate>
      ${card(`
        <h2 class="card-title">${esc(t("profile.personalSection"))}</h2>
        <div class="form-grid-2">
          ${textField({ name: "full_name", label: esc(t("auth.fullName")), value: profile.full_name || "", required: true })}
        </div>`)}
      ${card(`
        <h2 class="card-title">${esc(t("profile.locationSection"))}</h2>
        <div class="form-grid-2">
          ${textField({ name: "district", label: esc(t("auth.district")), value: profile.district || "" })}
          ${textField({ name: "taluka", label: esc(t("auth.taluka")), value: profile.taluka || "" })}
          ${textField({ name: "village", label: esc(t("auth.village")), value: profile.village || "" })}
          ${textField({ name: "pincode", label: "PIN code", value: profile.pincode || "", min: 0 })}
        </div>`)}
      ${card(`
        <h2 class="card-title">${esc(t("profile.languageSection"))}</h2>
        <div class="lang-choices">${langButtons}</div>`)}
      <div class="form-actions">
        ${button(t("common.save"), { type: "submit", size: "lg", id: "profile-save", cls: "full-width" })}
      </div>
    </form>`;

  let selectedLang = profile.preferred_language;
  cardsEl.querySelectorAll("[data-lang-choice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedLang = btn.getAttribute("data-lang-choice");
      cardsEl.querySelectorAll("[data-lang-choice]").forEach((b) => {
        const active = b === btn;
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", String(active));
      });
    });
  });

  const form = document.getElementById("profile-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    alertEl.innerHTML = "";
    const v = (name) => form.elements[name].value.trim();
    const save = document.getElementById("profile-save");
    save.innerHTML = `<span class="spinner"></span><span>${esc(t("common.save"))}</span>`;
    save.disabled = true;
    try {
      const updated = await api.updateProfile({
        full_name: v("full_name"),
        district: v("district") || null,
        taluka: v("taluka") || null,
        village: v("village") || null,
        pincode: v("pincode") || null,
        preferred_language: selectedLang,
      });
      alertEl.innerHTML = alertBox("success", esc(t("profile.updated")));
      if (updated.preferred_language && updated.preferred_language !== ctx.locale) {
        navigate(`/${updated.preferred_language}/profile`, true);
      }
    } catch (err) {
      const msg = handleApiError(err, ctx.locale);
      alertEl.innerHTML = alertBox("error", msg || t("common.somethingWentWrong"));
    } finally {
      save.innerHTML = `<span>${esc(t("common.save"))}</span>`;
      save.disabled = false;
    }
  });

  // Farms section.
  function renderFarms(list) {
    const areaUnitNames = { acre: "Acre", guntha: "Guntha", hectare: "Hectare" };
    const farmList = list.length
      ? `<ul class="farm-list">${list
          .map(
            (f) =>
              `<li class="farm-item"><span class="farm-icon">${icon("leaf", 20)}</span>` +
              `<span><strong>${esc(f.name)}</strong><small>${esc(f.area_value)} ${esc(areaUnitNames[f.area_unit] || f.area_unit)}</small></span></li>`,
          )
          .join("")}</ul>`
      : `<p class="muted-text">${esc(t("profile.noFarms"))}</p>`;

    farmsEl.innerHTML = card(
      `<div class="card-head-row"><h2 class="card-title">${esc(t("profile.farmsSection"))}</h2>` +
        `<button class="link-btn" id="toggle-farm-form">${icon("plus", 16)} ${esc(t("profile.addFarm"))}</button></div>` +
        farmList +
        `<form id="farm-form" class="farm-form" hidden>
          <div class="form-grid-2">
            ${textField({ name: "name", label: esc(t("profile.farmName")), required: true })}
            ${textField({ name: "area_value", label: esc(t("profile.farmArea")), type: "number", min: 0 })}
          </div>
          ${selectField({
            name: "area_unit",
            label: esc(t("profile.farmArea")),
            options: ["acre", "guntha", "hectare"].map((u) => ({ value: u, label: areaUnitNames[u] })),
            value: "acre",
          })}
          <div class="form-grid-2">
            ${textField({ name: "soil_type", label: esc(t("profile.soilType")) })}
            ${textField({ name: "irrigation_source", label: esc(t("profile.irrigation")) })}
          </div>
          ${button(t("profile.addFarm"), { type: "submit", cls: "btn-sm", id: "farm-submit" })}
        </form>`,
    );

    document.getElementById("toggle-farm-form")?.addEventListener("click", () => {
      const f = document.getElementById("farm-form");
      if (f) f.hidden = !f.hidden;
    });

    document.getElementById("farm-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const f = document.getElementById("farm-form");
      const submit = document.getElementById("farm-submit");
      const v = (name) => f.elements[name].value.trim();
      submit.disabled = true;
      try {
        const created = await api.createFarm({
          name: v("name"),
          area_value: Number(v("area_value")),
          area_unit: f.elements.area_unit.value,
          soil_type: v("soil_type") || undefined,
          irrigation_source: v("irrigation_source") || undefined,
        });
        renderFarms([created, ...list]);
      } catch (err) {
        const msg = handleApiError(err, ctx.locale);
        alertEl.innerHTML = alertBox("error", msg || t("common.somethingWentWrong"));
        submit.disabled = false;
      }
    });
  }

  renderFarms(farms || []);
}
