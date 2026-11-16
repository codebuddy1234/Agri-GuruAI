import { t } from "../i18n.js";
import { icon } from "../icons.js";
import { alertBox, authHeader, button, card, esc, textField } from "../ui.js";
import { api, ApiClientError } from "../api.js";
import { navigate } from "../router.js";
import { loadShared } from "../store.js";

export function render(ctx) {
  const locale = ctx.locale;
  return `
  ${authHeader(locale, false)}
  <main class="auth-page">
    <div class="auth-card-wrap">
      ${card(`
        <div class="auth-head">
          <div class="auth-logo">${icon("sprout", 28)}</div>
          <h1 class="auth-title">${esc(t("auth.registerTitle"))}</h1>
          <p class="auth-subtitle">${esc(t("auth.registerSubtitle"))}</p>
        </div>
        <div id="auth-alert"></div>
        <form id="register-form" novalidate>
          <div class="form-stack">
            ${textField({ name: "full_name", label: esc(t("auth.fullName")), required: true, autocomplete: "name" })}
            ${textField({ name: "email", label: esc(t("auth.email")), type: "email", required: true, autocomplete: "email" })}
            ${textField({
              name: "password",
              label: esc(t("auth.password")),
              type: "password",
              required: true,
              autocomplete: "new-password",
              help: esc(t("auth.passwordHint")),
            })}
            <div class="form-grid-2">
              ${textField({ name: "mobile", label: esc(t("auth.mobile")), type: "tel", autocomplete: "tel" })}
              ${textField({ name: "district", label: esc(t("auth.district")) })}
            </div>
            ${textField({ name: "taluka", label: esc(t("auth.taluka")) })}
          </div>
          ${button(t("common.register"), {
            type: "submit",
            size: "lg",
            cls: "full-width auth-submit",
            id: "register-submit",
          })}
        </form>
        <p class="auth-foot">${esc(t("auth.hasAccount"))}
          <a href="#/${locale}/login">${esc(t("common.signIn"))}</a>
        </p>
      `, "auth-card")}
    </div>
  </main>`;
}

export function mount(ctx) {
  const form = document.getElementById("register-form");
  const alertBoxEl = document.getElementById("auth-alert");
  const submit = document.getElementById("register-submit");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    alertBoxEl.innerHTML = "";
    form.querySelectorAll(".field-error").forEach((el) => el.remove());
    form.querySelectorAll(".input-error").forEach((el) => el.classList.remove("input-error"));

    const value = (name) => form.elements[name].value.trim();
    const payload = {
      email: value("email"),
      password: form.elements.password.value,
      full_name: value("full_name"),
      mobile: value("mobile") || undefined,
      district: value("district") || undefined,
      taluka: value("taluka") || undefined,
      preferred_language: ctx.locale,
    };
    submit.innerHTML = `<span class="spinner"></span><span>${esc(t("auth.creating"))}</span>`;
    submit.disabled = true;

    try {
      await api.register(payload);
      await loadShared();
      navigate(`/${ctx.locale}/dashboard`, true);
    } catch (err) {
      const translated = err instanceof ApiClientError ? t(`errors.${err.code}`) : "";
      const msg =
        translated && translated !== `errors.${err && err.code}`
          ? translated
          : t("common.somethingWentWrong");
      alertBoxEl.innerHTML = alertBox("error", msg);
      if (err instanceof ApiClientError) {
        for (const [field, message] of Object.entries(err.fieldErrors())) {
          const input = form.elements[field];
          if (input) {
            input.classList.add("input-error");
            const p = document.createElement("p");
            p.className = "field-error";
            p.setAttribute("role", "alert");
            p.textContent = message;
            input.closest(".field")?.appendChild(p);
          }
        }
      }
      submit.innerHTML = `<span>${esc(t("common.register"))}</span>`;
      submit.disabled = false;
    }
  });
}
