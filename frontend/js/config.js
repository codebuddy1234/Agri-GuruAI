// Central runtime configuration for the vanilla frontend.
// Override the API base URL at build/deploy time by editing this value or by
// setting window.AGRIGURU_API_BASE_URL before the modules load (e.g. from a
// small <script> in index.html). This replaces Next.js' NEXT_PUBLIC_API_BASE_URL.

export const API_BASE_URL =
  (typeof window !== "undefined" && window.AGRIGURU_API_BASE_URL) ||
  "http://localhost:8000/api/v1";

export const STORAGE = {
  ACCESS: "agriguru.access_token",
  REFRESH: "agriguru.refresh_token",
  HOME_LOCATION: "agriguru.home_location",
  LAST_PREDICTION: "agriguru.last_prediction",
};

export const LOCALES = ["mr", "hi", "en"];
export const DEFAULT_LOCALE = "mr";
export const LOCALE_NAMES = { mr: "मराठी", hi: "हिंदी", en: "English" };
export const INTL_LOCALE = {
  mr: "mr-IN-u-nu-latn",
  hi: "hi-IN-u-nu-latn",
  en: "en-IN-u-nu-latn",
};

export function isLocale(value) {
  return LOCALES.includes(value);
}

// Hero carousel images (unchanged from the original frontend).
export const HERO_SLIDES = [
  {
    src: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=70",
    titleKey: "slide1Title",
    bodyKey: "slide1Body",
  },
  {
    src: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=1200&q=70",
    titleKey: "slide2Title",
    bodyKey: "slide2Body",
  },
  {
    src: "https://images.unsplash.com/photo-1560493676-04071c5f467b?auto=format&fit=crop&w=1200&q=70",
    titleKey: "slide3Title",
    bodyKey: "slide3Body",
  },
];
