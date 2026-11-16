import { t, cropName, formatDateTime } from "../i18n.js";
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
} from "../ui.js";
import { api } from "../api.js";

const PAGE_SIZE = 20;

export function render(ctx) {
  if (!requireAuth(ctx.locale)) return "";
  return appShell(
    ctx.locale,
    "/history",
    `
    <div class="history-page">
      <div class="page-head">
        <h1 class="page-title">${esc(t("history.title"))}</h1>
        <p class="page-subtitle">${esc(t("history.subtitle"))}</p>
      </div>
      <div id="history-alert"></div>
      ${card(`<div id="history-list">${loadingBlock()}</div>`)}
      <div id="load-more-slot"></div>
    </div>`,
  );
}

function itemHtml(locale, item) {
  const confidence =
    item.confidence != null ? `<span class="confidence-pill">${Math.round(item.confidence * 100)}%</span>` : "";
  return `
    <li>
      <a class="history-item" href="#/${locale}/history/${encodeURIComponent(item.id)}">
        <span class="history-icon">${icon("sprout", 20)}</span>
        <span class="history-info">
          <strong>${esc(cropName(item.recommended_crop))}</strong>
          <small>${esc(formatDateTime(item.created_at))}</small>
        </span>
        ${confidence}
        ${icon("chevron-right", 18)}
      </a>
    </li>`;
}

export async function mount(ctx) {
  if (!requireAuth(ctx.locale)) return;
  const listEl = document.getElementById("history-list");
  const alertEl = document.getElementById("history-alert");
  const moreSlot = document.getElementById("load-more-slot");
  let offset = 0;
  let hasMore = false;
  let loading = false;

  async function loadMore() {
    if (loading) return;
    loading = true;
    moreSlot.innerHTML = "";
    try {
      const res = await api.history(PAGE_SIZE, offset);
      const items = res.data || [];
      hasMore = !!(res.meta && res.meta.has_more);
      if (offset === 0) {
        if (!items.length) {
          listEl.innerHTML =
            `<p class="muted-text">${esc(t("history.empty"))}</p>` +
            `<a class="btn btn-primary" href="#/${ctx.locale}/crop-recommendation">${esc(t("history.emptyAction"))}</a>`;
          return;
        }
        listEl.innerHTML = `<ul class="history-items">${items
          .map((i) => itemHtml(ctx.locale, i))
          .join("")}</ul>`;
      } else {
        const ul = listEl.querySelector(".history-items");
        if (ul) ul.insertAdjacentHTML("beforeend", items.map((i) => itemHtml(ctx.locale, i)).join(""));
      }
      offset += items.length;
      if (hasMore) {
        moreSlot.innerHTML = button(t("history.loadMore"), {
          id: "load-more-btn",
          cls: "full-width",
        });
        document.getElementById("load-more-btn")?.addEventListener("click", loadMore);
      }
    } catch (err) {
      const msg = handleApiError(err, ctx.locale);
      alertEl.innerHTML = alertBox("error", msg || t("common.somethingWentWrong"));
      listEl.innerHTML = `<p class="muted-text">${esc(t("common.somethingWentWrong"))}</p>`;
    } finally {
      loading = false;
    }
  }

  await loadMore();
}
