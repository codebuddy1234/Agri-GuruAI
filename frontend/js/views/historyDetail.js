import { t, tf, formatDateTime } from "../i18n.js";
import { icon } from "../icons.js";
import {
  alertBox,
  appShell,
  esc,
  handleApiError,
  loadingBlock,
  requireAuth,
} from "../ui.js";
import { api } from "../api.js";
import { resultHtml } from "./result.js";

export function render(ctx) {
  if (!requireAuth(ctx.locale)) return "";
  return appShell(
    ctx.locale,
    "/history",
    `
    <div class="history-detail-page">
      <a class="back-link" href="#/${ctx.locale}/history">${icon("chevron-left", 18)} <span>${esc(t("common.back"))}</span></a>
      <div class="page-head">
        <h1 class="page-title">${esc(t("history.detailTitle"))}</h1>
      </div>
      <div id="detail-slot">${loadingBlock()}</div>
    </div>`,
  );
}

export async function mount(ctx) {
  if (!requireAuth(ctx.locale)) return;
  const slot = document.getElementById("detail-slot");
  const id = ctx.params[0];
  if (!id) {
    slot.innerHTML = alertBox("error", esc(t("common.somethingWentWrong")));
    return;
  }
  try {
    const prediction = await api.historyDetail(id);
    slot.innerHTML =
      `<p class="recorded-on">${esc(t("history.recordedOn"))} ${esc(formatDateTime(prediction.created_at))}</p>` +
      resultHtml(prediction, ctx.locale, false);
  } catch (err) {
    const msg = handleApiError(err, ctx.locale);
    slot.innerHTML = alertBox("error", msg || t("common.somethingWentWrong"));
  }
}
