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
          <h1 class="auth-title">${esc(t("auth.loginTitle"))}</h1>
          <p class="auth-subtitle">${esc(t("auth.loginSubtitle"))}</p>
        </div>
        <div id="auth-alert"></div>
        <form id="login-form" novalidate>
          <div class="form-stack">
            ${textField({
              name: "email",
              label: esc(t("auth.email")),
              type: "email",
              autocomplete: "email",
              required: true,
            })}
            ${textField({
              name: "password",
              label: esc(t("auth.password")),
              type: "password",
              autocomplete: "current-password",
              required: true,
            })}
          </div>
          ${button(t("common.signIn"), {
            type: "submit",
            size: "lg",
            cls: "full-width auth-submit",
            id: "login-submit",
          })}
        </form>
        <p class="auth-foot">${esc(t("auth.noAccount"))}
          <a href="#/${locale}/register">${esc(t("common.register"))}</a>
        </p>
      `, "auth-card")}
    </div>
  </main>`;
}

export function mount(ctx) {
  const form = document.getElementById("login-form");
  const alertBoxEl = document.getElementById("auth-alert");
  const submit = document.getElementById("login-submit");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    alertBoxEl.innerHTML = "";
    form.querySelectorAll(".field-error").forEach((el) => el.remove());
    form.querySelectorAll(".input-error").forEach((el) => el.classList.remove("input-error"));

    const email = form.email.value.trim();
    const password = form.password.value;
    submit.innerHTML = `<span class="spinner"></span><span>${esc(t("auth.signingIn"))}</span>`;
    submit.disabled = true;

    try {
      const result = await api.login(email, password);
      await loadShared();
      const lang = (result.profile && result.profile.preferred_language) || ctx.locale;
      navigate(`/${lang}/dashboard`, true);
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
      submit.innerHTML = `<span>${esc(t("common.signIn"))}</span>`;
      submit.disabled = false;
    }
  });
}
