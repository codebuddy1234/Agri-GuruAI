import { HERO_SLIDES } from "../config.js";
import { t } from "../i18n.js";
import { icon } from "../icons.js";
import { alertBox, esc, languageSwitcher } from "../ui.js";

const FEATURES = [
  { key: "crop_recommendation", icon: "sprout", route: "/crop-recommendation" },
  { key: "disease_detection", icon: "stethoscope", route: "/disease-detection" },
  { key: "weather", icon: "cloud-sun", route: "/weather" },
  { key: "fertilizer", icon: "leaf", route: "/fertilizer" },
];

const STEPS = [
  { num: 1, icon: "clipboard-list", title: "step1Title", body: "step1Body" },
  { num: 2, icon: "search", title: "step2Title", body: "step2Body" },
  { num: 3, icon: "history", title: "step3Title", body: "step3Body" },
];

export function render(ctx) {
  const locale = ctx.locale;
  return `
  <div class="landing">
    <header class="landing-header">
      <div class="landing-header-inner">
        <a class="brand" href="#/${locale}">
          <span class="brand-mark">${icon("sprout", 22)}</span>
          <span class="brand-name">${esc(t("common.appName"))}</span>
        </a>
        <nav class="landing-nav">
          <button class="nav-link" data-scroll="features">${esc(t("landing.navFeatures"))}</button>
          <button class="nav-link" data-scroll="how">${esc(t("landing.navHow"))}</button>
        </nav>
        <div class="landing-actions">
          <span class="desktop-lang">${languageSwitcher(locale)}</span>
          <a class="link-btn" href="#/${locale}/login">${esc(t("common.signIn"))}</a>
          <a class="btn btn-primary btn-sm" href="#/${locale}/register">${esc(t("landing.getStarted"))}</a>
        </div>
      </div>
      <div class="mobile-lang-row">${languageSwitcher(locale)}</div>
    </header>

    <main>
      <section class="hero">
        <div class="hero-blob"></div>
        <div class="hero-inner">
          <div class="hero-copy animate-fade-up">
            <span class="badge-pill">${icon("check-circle", 16)} ${esc(t("landing.badge"))}</span>
            <h1 class="hero-title">${esc(t("landing.heroTitle"))}</h1>
            <p class="hero-subtitle">${esc(t("landing.heroSubtitle"))}</p>
            <div class="hero-cta">
              <a class="btn btn-primary btn-lg" href="#/${locale}/register">${esc(t("landing.getStarted"))} ${icon("arrow-right", 18)}</a>
              <a class="btn btn-outline btn-lg" href="#/${locale}/login">${esc(t("landing.haveAccount"))}</a>
            </div>
            <ul class="trust-list">
              ${["trust1", "trust2", "trust3"]
                .map(
                  (k) =>
                    `<li>${icon("check-circle", 18)} <span>${esc(t(`landing.${k}`))}</span></li>`,
                )
                .join("")}
            </ul>
          </div>
          <div class="hero-carousel" id="hero-carousel">
            <div class="carousel-track">
              ${HERO_SLIDES.map(
                (s, i) => `
                <div class="carousel-slide ${i === 0 ? "active" : ""}" data-slide="${i}">
                  <img src="${s.src}" alt="" />
                  <div class="carousel-overlay"></div>
                  <div class="carousel-caption">
                    <h3>${esc(t(`landing.${s.titleKey}`))}</h3>
                    <p>${esc(t(`landing.${s.bodyKey}`))}</p>
                  </div>
                </div>`,
              ).join("")}
            </div>
            <button class="carousel-arrow prev" data-carousel-prev aria-label="${esc(t("landing.carouselPrev"))}">${icon("chevron-left", 22)}</button>
            <button class="carousel-arrow next" data-carousel-next aria-label="${esc(t("landing.carouselNext"))}">${icon("chevron-right", 22)}</button>
            <div class="carousel-dots">
              ${HERO_SLIDES.map(
                (_, i) =>
                  `<button class="carousel-dot ${i === 0 ? "active" : ""}" data-dot="${i}" aria-label="Slide ${i + 1}"></button>`,
              ).join("")}
            </div>
          </div>
        </div>
      </section>

      <section class="stats-section">
        <dl class="stats-grid">
          ${[1, 2, 3, 4]
            .map(
              (n) =>
                `<div class="stat"><dt>${esc(t(`landing.stat${n}Value`))}</dt><dd>${esc(t(`landing.stat${n}Label`))}</dd></div>`,
            )
            .join("")}
        </dl>
      </section>

      <section class="section" id="features">
        <div class="section-head">
          <h2>${esc(t("landing.featuresTitle"))}</h2>
          <p>${esc(t("landing.featuresSubtitle"))}</p>
        </div>
        <div class="feature-grid">
          ${FEATURES.map((f) => {
            const meta = t(`modules.${f.key}`);
            return `
            <a class="feature-card" href="#/${locale}${f.route}">
              <div class="feature-icon">${icon(f.icon, 22)}</div>
              <h3>${esc(meta.title)}</h3>
              <p>${esc(meta.description)}</p>
              <span class="feature-link">${esc(t("landing.getStarted"))} ${icon("arrow-right", 16)}</span>
            </a>`;
          }).join("")}
        </div>
      </section>

      <section class="section how-section" id="how">
        <div class="section-head"><h2>${esc(t("landing.howItWorksTitle"))}</h2></div>
        <div class="steps-grid">
          ${STEPS.map(
            (s) => `
            <div class="step-card">
              <div class="step-num">${s.num}</div>
              <div class="step-icon">${icon(s.icon, 24)}</div>
              <h3>${esc(t(`landing.${s.title}`))}</h3>
              <p>${esc(t(`landing.${s.body}`))}</p>
            </div>`,
          ).join("")}
        </div>
        <div class="how-note">
          ${alertBox("warning", esc(t("landing.honestyTitle")), esc(t("landing.honestyBody")))}
        </div>
      </section>

      <section class="cta-section">
        <div class="cta-deco">${icon("sprout", 180)}</div>
        <div class="cta-inner">
          <h2>${esc(t("landing.ctaTitle"))}</h2>
          <p>${esc(t("landing.ctaBody"))}</p>
          <a class="btn btn-secondary btn-lg" href="#/${locale}/register">${esc(t("landing.ctaButton"))}</a>
        </div>
      </section>
    </main>

    <footer class="landing-footer">
      <div class="footer-grid">
        <div>
          <a class="brand" href="#/${locale}"><span class="brand-mark">${icon("sprout", 20)}</span><span class="brand-name">${esc(t("common.appName"))}</span></a>
          <p class="footer-tagline">${esc(t("landing.footerTagline"))}</p>
        </div>
        <div>
          <h4>${esc(t("landing.footerServicesTitle"))}</h4>
          ${FEATURES.map(
            (f) => `<a href="#/${locale}${f.route}">${esc(t(`modules.${f.key}.title`))}</a>`,
          ).join("")}
        </div>
        <div>
          <h4>${esc(t("landing.footerHelpTitle"))}</h4>
          <a href="#/${locale}/register">${esc(t("common.register"))}</a>
          <a href="#/${locale}/login">${esc(t("common.signIn"))}</a>
          <a href="#/${locale}/dashboard">${esc(t("dashboard.home"))}</a>
        </div>
        <div>
          <h4>${esc(t("landing.footerContactTitle"))}</h4>
          <p class="footer-contact">${icon("map-pin", 16)} ${esc(t("landing.footerContactAddress"))}</p>
          <p class="footer-contact">${icon("mail", 16)} support@agriguru.ai</p>
        </div>
      </div>
      <div class="footer-bottom">
        <span>${esc(t("landing.footerRights"))}</span>
        <span>${esc(t("landing.footerNote"))}</span>
      </div>
    </footer>
  </div>`;
}

export function mount(ctx) {
  const root = document.querySelector(".landing");
  if (!root) return;

  root.querySelectorAll("[data-scroll]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const el = document.getElementById(btn.getAttribute("data-scroll"));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const slides = [...root.querySelectorAll(".carousel-slide")];
  const dots = [...root.querySelectorAll(".carousel-dot")];
  if (!slides.length) return;
  let index = 0;
  let timer = null;

  function show(i) {
    index = (i + slides.length) % slides.length;
    slides.forEach((s, n) => s.classList.toggle("active", n === index));
    dots.forEach((d, n) => d.classList.toggle("active", n === index));
  }
  function start() {
    stop();
    timer = setInterval(() => show(index + 1), 5000);
  }
  function stop() {
    if (timer) clearInterval(timer);
  }

  root.querySelector("[data-carousel-prev]")?.addEventListener("click", () => show(index - 1));
  root.querySelector("[data-carousel-next]")?.addEventListener("click", () => show(index + 1));
  dots.forEach((d) => d.addEventListener("click", () => show(Number(d.getAttribute("data-dot")))));
  const carousel = root.querySelector("#hero-carousel");
  carousel?.addEventListener("mouseenter", stop);
  carousel?.addEventListener("mouseleave", start);
  start();
}
