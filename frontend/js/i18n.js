// Lightweight i18n: loads the same locale JSON files the Next.js app used,
// exposes a dotted-path translator and the formatting helpers.

import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from "./config.js";

const cache = new Map();
let currentLocale = DEFAULT_LOCALE;
let dictionary = {};

function readInitialLocale() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const first = hash.split(/[/?]/)[0];
  return isLocale(first) ? first : DEFAULT_LOCALE;
}

currentLocale = readInitialLocale();

export async function loadLocale(locale) {
  if (!isLocale(locale)) locale = DEFAULT_LOCALE;
  if (!cache.has(locale)) {
    const res = await fetch(`./locales/${locale}.json`);
    if (!res.ok) throw new Error(`Could not load locale ${locale}`);
    cache.set(locale, await res.json());
  }
  currentLocale = locale;
  dictionary = cache.get(locale);
  document.documentElement.lang = locale;
  document.title = t("common.appName");
  return dictionary;
}

export function getLocale() {
  return currentLocale;
}

export function getDict() {
  return dictionary;
}

function lookup(dict, path) {
  return path.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) return acc[key];
    return undefined;
  }, dict);
}

/** Translate a dotted key. Falls back to English, then to the key itself. */
export function t(path, dict = dictionary) {
  const value = lookup(dict, path);
  if (value !== undefined) return value;
  const en = cache.get("en");
  if (en && en !== dict) {
    const fallback = lookup(en, path);
    if (fallback !== undefined) return fallback;
  }
  return path;
}

/** Translate and replace {placeholders}. */
export function tf(path, vars = {}, dict = dictionary) {
  const template = String(t(path, dict));
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`,
  );
}

export function cropName(key, dict = dictionary) {
  return lookup(dict, `crops.${key}`) || key;
}

export function conditionLabel(key, dict = dictionary) {
  return lookup(dict, `weather.conditions.${key}`) || String(key).replace(/_/g, " ");
}

function intlLocale() {
  return INTL_LOCALE[currentLocale] || "en-IN-u-nu-latn";
}

export function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(intlLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(intlLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatPercent(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat(intlLocale(), {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat(intlLocale(), {
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}
