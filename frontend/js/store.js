// Small shared-state module for data used by the authenticated shell.
import { api } from "./api.js";

export const state = {
  me: null,
  profile: null,
  modules: null,
};

export async function loadShared() {
  try {
    const [me, modules] = await Promise.all([api.me(), api.modules()]);
    state.me = me;
    state.modules = modules;
  } catch {
    /* individual views handle their own auth/errors */
  }
}

export function clearShared() {
  state.me = null;
  state.profile = null;
  state.modules = null;
}

export const DEFAULT_MODULES = [
  { key: "crop_recommendation", icon: "sprout", status: "available", route: "/crop-recommendation" },
  { key: "disease_detection", icon: "leaf", status: "available", route: "/disease-detection" },
  { key: "weather", icon: "cloud-sun", status: "available", route: "/weather" },
  { key: "market_prices", icon: "trending-up", status: "coming_soon", route: null },
  { key: "fertilizer", icon: "flask-conical", status: "available", route: "/fertilizer" },
  { key: "yield_prediction", icon: "bar-chart-3", status: "coming_soon", route: null },
  { key: "schemes", icon: "landmark", status: "coming_soon", route: null },
  { key: "expert_review", icon: "user-check", status: "coming_soon", route: null },
];
