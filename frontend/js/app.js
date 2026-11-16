// Bootstrap: load shared data, start the router, wire global delegated events.
import { isLocale } from "./config.js";
import { api, tokenStore } from "./api.js";
import { loadShared, clearShared } from "./store.js";
import { currentPath, navigate, startRouter } from "./router.js";

async function boot() {
  if (tokenStore.access) {
    await loadShared();
  }
  startRouter();
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const switchBtn = target.closest("[data-locale-switch]");
  if (switchBtn) {
    const next = switchBtn.getAttribute("data-locale-switch");
    if (!isLocale(next)) return;
    const path = currentPath();
    const [pathPart, queryPart = ""] = path.split("?");
    const segments = pathPart.split("/").filter(Boolean);
    if (isLocale(segments[0])) segments[0] = next;
    else segments.unshift(next);
    const newPath = `/${segments.join("/")}${queryPart ? `?${queryPart}` : ""}`;
    if (tokenStore.access) {
      api.updateProfile({ preferred_language: next }).catch(() => {});
    }
    navigate(newPath, true);
    return;
  }

  if (target.closest("[data-logout]")) {
    api.logout();
    clearShared();
    const seg = currentPath().split("/").filter(Boolean);
    const locale = isLocale(seg[0]) ? seg[0] : "mr";
    navigate(`/${locale}`, true);
    return;
  }

  if (target.closest("[data-menu-toggle]")) {
    document.body.classList.toggle("drawer-open");
    return;
  }
  if (target.closest("[data-menu-close]")) {
    document.body.classList.remove("drawer-open");
    return;
  }
  if (target.closest(".sidebar a")) {
    document.body.classList.remove("drawer-open");
  }
});

boot();
