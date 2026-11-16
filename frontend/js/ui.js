// Shared UI render helpers. Everything returns an HTML string so views stay
// declarative; event wiring happens in each view's mount() function.

import { icon, MODULE_ICONS } from "./icons.js";
import { t, tf, getLocale } from "./i18n.js";
import { state } from "./store.js";
import { navigate } from "./router.js";
import { api, tokenStore } from "./api.js";

export function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function alertBox(tone, title, bodyHtml = "", extraClass = "") {
  const icons = { info: "info", warning: "alert-triangle", error: "x-circle", success: "check-circle" };
  const role = tone === "error" ? 'role="alert"' : 'role="status"';
  return (
    `<div class="alert alert-${tone} ${extraClass}" ${role}>` +
    `<span class="alert-icon">${icon(icons[tone] || "info", 20)}</span>` +
    `<div class="alert-body">${title ? `<p class="alert-title">${title}</p>` : ""}` +
    `${bodyHtml ? `<div class="alert-text">${bodyHtml}</div>` : ""}</div></div>`
  );
}

export function button(label, opts = {}) {
  const {
    variant = "primary",
    size = "md",
    type = "button",
    id = "",
    cls = "",
    loading = false,
    disabled = false,
    attrs = "",
  } = opts;
  return (
    `<button type="${type}" class="btn btn-${variant} btn-${size} ${cls}" ` +
    `id="${id}" ${loading ? 'aria-busy="true" disabled' : ""} ` +
    `${disabled ? "disabled" : ""} ${attrs}>` +
    `${loading ? '<span class="spinner"></span>' : ""}<span>${label}</span></button>`
  );
}

export function card(innerHtml, cls = "") {
  return `<div class="card ${cls}">${innerHtml}</div>`;
}

export function pageHeader(title, subtitle = "", backHref = "") {
  const back = backHref
    ? `<a class="back-link" href="${backHref}">${icon("chevron-left", 18)} <span>${esc(t("common.back"))}</span></a>`
    : "";
  return (
    `${back}<div class="page-head"><h1 class="page-title">${title}</h1>` +
    `${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ""}</div>`
  );
}

export function numberField(opts) {
  const {
    name,
    label,
    value = "",
    unit = "",
    help = "",
    hint = "",
    error = "",
    min,
    max,
    step,
    required = true,
  } = opts;
  return (
    `<div class="field" data-field="${esc(name)}">` +
    `<label class="field-label" for="${esc(name)}">${label}${required ? ' <span class="req">*</span>' : ""}</label>` +
    (help ? `<p class="field-help">${help}</p>` : "") +
    `<div class="input-wrap">` +
    `<input class="input ${error ? "input-error" : ""}" type="number" inputmode="decimal" ` +
    `id="${esc(name)}" name="${esc(name)}" value="${esc(value)}" ` +
    `min="${min ?? ""}" max="${max ?? ""}" step="${step ?? "any"}" ` +
    `${error ? 'aria-invalid="true"' : ""}>` +
    (unit ? `<span class="input-unit">${esc(unit)}</span>` : "") +
    `</div>` +
    (hint ? `<p class="field-hint">${hint}</p>` : "") +
    (error ? `<p class="field-error" role="alert">${error}</p>` : "") +
    `</div>`
  );
}

export function textField(opts) {
  const {
    name,
    label,
    type = "text",
    value = "",
    placeholder = "",
    help = "",
    error = "",
    required = false,
    autocomplete = "",
    min,
    max,
  } = opts;
  return (
    `<div class="field" data-field="${esc(name)}">` +
    `<label class="field-label" for="${esc(name)}">${label}${required ? ' <span class="req">*</span>' : ""}</label>` +
    (help ? `<p class="field-help">${help}</p>` : "") +
    `<input class="input ${error ? "input-error" : ""}" type="${type}" ` +
    `id="${esc(name)}" name="${esc(name)}" value="${esc(value)}" ` +
    `placeholder="${esc(placeholder)}" autocomplete="${autocomplete}" ` +
    `min="${min ?? ""}" max="${max ?? ""}" ${error ? 'aria-invalid="true"' : ""}>` +
    (error ? `<p class="field-error" role="alert">${error}</p>` : "") +
    `</div>`
  );
}

export function selectField(opts) {
  const { name, label, options = [], value = "", help = "" } = opts;
  return (
    `<div class="field" data-field="${esc(name)}">` +
    `<label class="field-label" for="${esc(name)}">${label}</label>` +
    (help ? `<p class="field-help">${help}</p>` : "") +
    `<select class="input select" id="${esc(name)}" name="${esc(name)}">` +
    options
      .map(
        (o) =>
          `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? "selected" : ""}>${esc(o.label)}</option>`,
      )
      .join("") +
    `</select></div>`
  );
}

export function languageSwitcher(locale) {
  const locales = ["mr", "hi", "en"];
  const names = { mr: "मराठी", hi: "हिंदी", en: "English" };
  return (
    `<div class="lang-switch" role="group" aria-label="${esc(t("common.language"))}">` +
    `<span class="lang-globe">${icon("globe", 16)}</span>` +
    locales
      .map(
        (l) =>
          `<button type="button" class="lang-pill ${l === locale ? "active" : ""}" ` +
          `data-locale-switch="${l}" aria-pressed="${l === locale}">${names[l]}</button>`,
      )
      .join("") +
    `</div>`
  );
}

/** Sticky header used on the public auth pages. */
export function authHeader(locale, showAccount = false) {
  return (
    `<header class="topbar"><div class="topbar-inner topbar-narrow">` +
    `<a class="brand" href="#/${locale}"><span class="brand-mark">${icon("sprout", 22)}</span>` +
    `<span class="brand-name">${esc(t("common.appName"))}</span></a>` +
    `<div class="topbar-actions">${languageSwitcher(locale)}` +
    (showAccount
      ? `<a class="icon-btn" href="#/${locale}/profile" title="${esc(t("dashboard.profile"))}">${icon("user", 20)}</a>` +
        `<button class="icon-btn" data-logout title="${esc(t("common.signOut"))}">${icon("log-out", 20)}</button>`
      : "") +
    `</div></div></header>`
  );
}

function sideNavItem(locale, item, activePath) {
  const meta = t(`modules.${item.key}`);
  const title = typeof meta === "object" ? meta.title : item.key;
  const iconName = MODULE_ICONS[item.icon] || "sprout";
  const available = item.status === "available" && item.route;
  const active = available && activePath === item.route;
  if (available) {
    return (
      `<a class="nav-item ${active ? "active" : ""}" href="#/${locale}${item.route}">` +
      `<span class="nav-icon">${icon(iconName, 20)}</span><span class="nav-label">${esc(title)}</span></a>`
    );
  }
  return (
    `<span class="nav-item disabled" aria-disabled="true">` +
    `<span class="nav-icon">${icon(iconName, 20)}</span>` +
    `<span class="nav-label">${esc(title)}</span>` +
    `<span class="nav-lock">${icon("lock", 14)}</span></span>`
  );
}

function sidebarInner(locale, activePath) {
  const modules = state.modules || [];
  return (
    `<a class="brand sidebar-brand" href="#/${locale}/dashboard">` +
    `<span class="brand-mark">${icon("sprout", 22)}</span>` +
    `<span class="brand-name">${esc(t("common.appName"))}</span></a>` +
    `<nav class="side-nav" aria-label="Main">` +
    `<a class="nav-item ${activePath === "/dashboard" ? "active" : ""}" href="#/${locale}/dashboard">` +
    `<span class="nav-icon">${icon("house", 20)}</span>` +
    `<span class="nav-label">${esc(t("dashboard.home"))}</span></a>` +
    `<p class="nav-divider">${esc(t("dashboard.services"))}</p>` +
    modules.map((m) => sideNavItem(locale, m, activePath)).join("") +
    `</nav>` +
    `<div class="sidebar-foot">${icon("leaf", 16)} <span>${esc(t("common.tagline"))}</span></div>`
  );
}

/**
 * Full protected-page layout: topbar, fixed sidebar, mobile drawer, main area.
 * `activePath` is the module route (e.g. "/dashboard") used for the active nav item.
 */
export function appShell(locale, activePath, contentHtml) {
  return (
    `<div class="app-shell">` +
    `<header class="topbar topbar-app"><div class="topbar-inner">` +
    `<button class="icon-btn menu-btn" data-menu-toggle aria-label="${esc(t("dashboard.menu"))}">${icon("menu", 22)}</button>` +
    `<a class="brand mobile-brand" href="#/${locale}/dashboard"><span class="brand-mark">${icon("sprout", 20)}</span>` +
    `<span class="brand-name">${esc(t("common.appName"))}</span></a>` +
    `<div class="topbar-actions">${languageSwitcher(locale)}` +
    `<a class="icon-btn" href="#/${locale}/profile" title="${esc(t("dashboard.profile"))}">${icon("user", 20)}</a>` +
    `<button class="icon-btn" data-logout title="${esc(t("common.signOut"))}">${icon("log-out", 20)}</button>` +
    `</div></div></header>` +
    `<aside class="sidebar" id="sidebar">${sidebarInner(locale, activePath)}</aside>` +
    `<div class="drawer-backdrop" data-menu-close></div>` +
    `<main class="main-content"><div class="content-wrap">${contentHtml}</div></main>` +
    `</div>`
  );
}

export function moduleCard(locale, item) {
  const meta = t(`modules.${item.key}`);
  const title = typeof meta === "object" ? meta.title : item.key;
  const desc = typeof meta === "object" ? meta.description : "";
  const iconName = MODULE_ICONS[item.icon] || "sprout";
  const available = item.status === "available" && item.route;
  const statusPill = available
    ? `<span class="status-pill available">${esc(t("common.availableNow"))}</span>`
    : `<span class="status-pill soon">${esc(t("common.comingSoon"))}</span>`;
  const inner =
    `<div class="module-icon ${available ? "" : "muted"}">${icon(iconName, 22)}</div>` +
    `<h3 class="module-title">${esc(title)}</h3>` +
    `<p class="module-desc">${esc(desc)}</p>` +
    `<div class="module-foot">${statusPill}` +
    (available
      ? `<span class="module-go">${icon("arrow-right", 18)}</span>`
      : `<span class="module-lock">${icon("lock", 16)}</span>`) +
    `</div>`;
  if (available) {
    return `<a class="module-card" href="#/${locale}${item.route}">${inner}</a>`;
  }
  return `<div class="module-card unavailable" aria-disabled="true">${inner}</div>`;
}

/** Translate an API error code, and redirect to login on 401. */
export function translateError(err, fallbackKey = "common.somethingWentWrong") {
  const fallback = t(fallbackKey);
  if (err && err.code) {
    const translated = t(`errors.${err.code}`, undefined);
    if (translated !== `errors.${err.code}`) return translated;
  }
  return fallback;
}

export function handleApiError(err, locale, fallbackKey) {
  if (err && err.status === 401) {
    api.logout();
    navigate(`/${locale}/login`);
    return;
  }
  return translateError(err, fallbackKey);
}

export function requireAuth(locale) {
  if (!tokenStore.access) {
    navigate(`/${locale}/login`, true);
    return false;
  }
  return true;
}

export function loadingBlock(label = "") {
  return (
    `<div class="loading-block"><span class="spinner dark"></span>` +
    `<span>${esc(label || t("common.loading"))}</span></div>`
  );
}
