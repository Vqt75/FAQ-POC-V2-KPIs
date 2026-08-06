from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
INDEX = ROOT / "index.html"
SERVER = ROOT / "server.js"
THEMES = ROOT / "themes"
CSS_FILE = THEMES / "rainbow-glass.css"
JS_FILE = THEMES / "rainbow-glass.js"

RAINBOW_CSS = r'''/*
  STORM — RAINBOW GLASS
  Surcouche visuelle de l'interface publique.

  Principes :
  - le thème actuel reste le thème par défaut ;
  - l'administration conserve toujours son apparence actuelle ;
  - Rainbow Glass utilise uniquement Roboto ;
  - aucune logique métier, API ou donnée n'est modifiée ici ;
  - les petits textes respectent un contraste WCAG AA sur les fonds clairs ;
  - le mouvement est réduit sur mobile et supprimé avec prefers-reduced-motion.
*/

body.theme-rainbow-glass {
  --rg-brand-primary: var(--sand, #c2af7e);
  --rg-brand-secondary: var(--teal, #087870);

  --rg-ink: #17202a;
  --rg-text-strong: rgba(23, 32, 42, 0.86);
  --rg-text-secondary: rgba(23, 32, 42, 0.72);
  --rg-text-muted: rgba(23, 32, 42, 0.68);
  --rg-text-soft: rgba(23, 32, 42, 0.65);

  /* Ces deux niveaux sont réservés aux ornements non textuels. */
  --rg-decorative: rgba(23, 32, 42, 0.45);
  --rg-decorative-faint: rgba(23, 32, 42, 0.28);

  --rg-line: rgba(41, 57, 72, 0.10);
  --rg-line-strong: rgba(41, 57, 72, 0.16);
  --rg-glass: rgba(255, 255, 255, 0.48);
  --rg-glass-strong: rgba(255, 255, 255, 0.72);

  --rg-shift-far: 0px;
  --rg-shift-mid: 0px;
  --rg-shift-near: 0px;
  --rg-prism-x: 35%;
  --rg-prism-opacity: 0.09;
  --rg-atmosphere-y: 0px;

  --nav-h: 88px;
}

body.theme-rainbow-glass:not(.storm-admin-open) {
  min-height: 100vh;
  color: var(--rg-ink);
  background:
    radial-gradient(
      circle at 88% 3%,
      color-mix(in srgb, var(--rg-brand-primary) 8%, transparent),
      transparent 30%
    ),
    radial-gradient(
      circle at 7% 68%,
      color-mix(in srgb, var(--rg-brand-secondary) 7%, transparent),
      transparent 36%
    ),
    linear-gradient(145deg, #f9fbfc 0%, #edf3f6 52%, #f8fafb 100%);
}

/* L'administration garde exactement le thème actuel. */
body.theme-rainbow-glass.storm-admin-open {
  --nav-h: 60px;
  background: var(--white, #fff);
}

/* =====================================================
   TYPOGRAPHIE — ROBOTO UNIQUEMENT DANS RAINBOW GLASS
===================================================== */

body.theme-rainbow-glass:not(.storm-admin-open) .nav,
body.theme-rainbow-glass:not(.storm-admin-open) .nav *,
body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin),
body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) *,
body.theme-rainbow-glass:not(.storm-admin-open) .lightbox,
body.theme-rainbow-glass:not(.storm-admin-open) .lightbox * {
  font-family:
    "Roboto",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Arial,
    sans-serif;
}

body.theme-rainbow-glass:not(.storm-admin-open) :where(
  .hero-title,
  .contact-title,
  .timeline-step,
  .mono,
  .plan-upload-note code,
  .kpi-bar-value
) {
  font-family:
    "Roboto",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Arial,
    sans-serif !important;
}

body.theme-rainbow-glass:not(.storm-admin-open) :where(
  .mono,
  .article-date,
  .milestone-date,
  .progress-pct
) {
  font-variant-numeric: tabular-nums;
}

/* =====================================================
   ACCESSIBILITÉ ET CONTRASTE
===================================================== */

body.theme-rainbow-glass:not(.storm-admin-open) :where(
  .nav-brand-sub,
  .nav-tab,
  .eyebrow,
  .loading-label,
  .result-eyebrow,
  .result-question,
  .article-date,
  .milestone-date,
  .timeline-label,
  .articles-header,
  .progress-pct,
  .plan-placeholder,
  .plan-placeholder-label,
  .person-role,
  .team-title,
  .section-separator,
  .form-note,
  .footer p
) {
  color: var(--rg-text-muted);
}

body.theme-rainbow-glass:not(.storm-admin-open) :where(
  .hero-desc,
  .contact-intro p,
  .result-note,
  .notfound-box p,
  .article-chapeau,
  .article-body-inner,
  .milestone-desc,
  .plan-comment,
  .plan-upload-note,
  .info-block p,
  .parella-text
) {
  color: var(--rg-text-secondary);
}

body.theme-rainbow-glass:not(.storm-admin-open) :where(
  .search-input,
  .form-input
)::placeholder {
  color: var(--rg-text-soft);
  opacity: 1;
}

body.theme-rainbow-glass:not(.storm-admin-open) a:focus-visible,
body.theme-rainbow-glass:not(.storm-admin-open) button:focus-visible,
body.theme-rainbow-glass:not(.storm-admin-open) input:focus-visible,
body.theme-rainbow-glass:not(.storm-admin-open) textarea:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--rg-brand-primary) 72%, #17202a);
  outline-offset: 3px;
  border-radius: 8px;
}

/* =====================================================
   COUCHES DE PROFONDEUR ET RÉFRACTION
===================================================== */

body.theme-rainbow-glass:not(.storm-admin-open) [data-rg-depth="far"] {
  transform: translate3d(0, var(--rg-shift-far), 0);
  will-change: transform;
}

body.theme-rainbow-glass:not(.storm-admin-open) [data-rg-depth="mid"] {
  transform: translate3d(0, var(--rg-shift-mid), 0);
  will-change: transform;
}

body.theme-rainbow-glass:not(.storm-admin-open) [data-rg-depth="near"] {
  transform: translate3d(0, var(--rg-shift-near), 0);
  will-change: transform;
}

body.theme-rainbow-glass:not(.storm-admin-open) [data-rg-glass] {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}

body.theme-rainbow-glass:not(.storm-admin-open) [data-rg-glass]::before {
  content: "";
  position: absolute;
  z-index: 0;
  top: -42px;
  left: calc(var(--rg-prism-x) + var(--rg-prism-phase, 0%) - 205px);
  width: 410px;
  height: 100px;
  pointer-events: none;
  transform: rotate(-17deg);
  opacity: var(--rg-prism-opacity);
  filter: blur(16px);
  background:
    linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in srgb, var(--rg-brand-primary) 34%, #a8c9ff) 24%,
      rgba(137, 205, 230, 0.62) 42%,
      rgba(183, 166, 226, 0.60) 61%,
      rgba(234, 187, 202, 0.34) 76%,
      transparent 100%
    );
}

body.theme-rainbow-glass:not(.storm-admin-open) [data-rg-glass]::after {
  content: "";
  position: absolute;
  z-index: 0;
  top: 0;
  left: 8%;
  right: 8%;
  height: 1px;
  pointer-events: none;
  background:
    linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.98),
      color-mix(in srgb, var(--rg-brand-primary) 18%, white),
      rgba(183, 166, 226, 0.34),
      transparent
    );
}

body.theme-rainbow-glass:not(.storm-admin-open) [data-rg-glass] > * {
  position: relative;
  z-index: 1;
}

/* =====================================================
   NAVIGATION
===================================================== */

body.theme-rainbow-glass:not(.storm-admin-open) .nav {
  top: 12px;
  width: calc(100% - 32px);
  max-width: 1240px;
  height: 64px;
  margin: 12px auto 0;
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 16px 20px 16px 20px;
  background: rgba(255, 255, 255, 0.58);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.96),
    0 18px 45px rgba(45, 61, 75, 0.08);
  backdrop-filter: blur(24px) saturate(138%);
  -webkit-backdrop-filter: blur(24px) saturate(138%);
}

body.theme-rainbow-glass:not(.storm-admin-open) .nav-inner {
  max-width: 100%;
  padding: 0 18px;
  gap: 30px;
}

body.theme-rainbow-glass:not(.storm-admin-open) .nav-brand {
  gap: 12px;
}

body.theme-rainbow-glass:not(.storm-admin-open) .nav-mark {
  position: relative;
  width: 29px;
  height: 29px;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--rg-line-strong);
  border-radius: 8px 13px 8px 13px;
  transform: none;
  background: rgba(255, 255, 255, 0.36);
}

body.theme-rainbow-glass:not(.storm-admin-open) .nav-mark:not(.has-logo)::after {
  content: "";
  position: absolute;
  width: 40px;
  height: 8px;
  left: -6px;
  top: 10px;
  transform: rotate(-34deg);
  opacity: 0.55;
  background:
    linear-gradient(
      90deg,
      transparent,
      var(--rg-brand-primary),
      color-mix(in srgb, var(--rg-brand-secondary) 46%, #8eb9dc),
      rgba(194, 153, 207, 0.80),
      transparent
    );
}

body.theme-rainbow-glass:not(.storm-admin-open) .nav-mark.has-logo {
  width: 31px;
  height: 31px;
  padding: 3px;
  border: 1px solid rgba(255, 255, 255, 0.80);
  border-radius: 9px 13px 9px 13px;
  background: rgba(255, 255, 255, 0.50);
}

body.theme-rainbow-glass:not(.storm-admin-open) .nav-brand-name {
  color: var(--rg-ink);
  font-size: 0.70rem;
  font-weight: 700;
  letter-spacing: 0.105em;
}

body.theme-rainbow-glass:not(.storm-admin-open) .nav-brand-sub {
  color: var(--rg-text-muted);
}

body.theme-rainbow-glass:not(.storm-admin-open) .nav-tab {
  padding: 0 14px;
  color: var(--rg-text-muted);
  font-size: 0.74rem;
  font-weight: 500;
}

body.theme-rainbow-glass:not(.storm-admin-open) .nav-tab:hover,
body.theme-rainbow-glass:not(.storm-admin-open) .nav-tab.active {
  color: var(--rg-ink);
}

body.theme-rainbow-glass:not(.storm-admin-open) .nav-indicator {
  bottom: 10px;
  height: 1px;
  border-radius: 999px;
  background:
    linear-gradient(
      90deg,
      var(--rg-brand-primary),
      color-mix(in srgb, var(--rg-brand-secondary) 44%, #89b6d8),
      rgba(188, 146, 203, 0.88)
    );
  box-shadow:
    0 0 10px color-mix(in srgb, var(--rg-brand-primary) 18%, transparent);
}

body.theme-rainbow-glass:not(.storm-admin-open) .admin-nav-btn {
  width: 34px;
  height: 34px;
  padding: 0;
  justify-content: center;
  border: 1px solid var(--rg-line);
  border-radius: 9px 12px 9px 12px;
  background: rgba(255, 255, 255, 0.30);
  color: var(--rg-text-muted);
}

body.theme-rainbow-glass:not(.storm-admin-open) .admin-nav-btn:hover {
  border-color: var(--rg-line-strong);
  background: rgba(255, 255, 255, 0.62);
  color: var(--rg-ink);
}

body.theme-rainbow-glass:not(.storm-admin-open) .admin-nav-btn span {
  display: none;
}

/* =====================================================
   HERO PUBLIC
===================================================== */

body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) {
  color: var(--rg-ink);
}

body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) > .hero {
  max-width: var(--max);
  margin: 18px auto 0;
  padding: 78px 64px 82px;
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 18px 24px 18px 24px;
  background: rgba(255, 255, 255, 0.31);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(18px) saturate(128%);
  -webkit-backdrop-filter: blur(18px) saturate(128%);
}

body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) .hero-inner {
  max-width: 760px;
}

body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) .eyebrow {
  color: var(--rg-text-muted);
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.13em;
}

body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) .eyebrow::before {
  width: 24px;
  background:
    linear-gradient(
      90deg,
      var(--rg-brand-primary),
      color-mix(in srgb, var(--rg-brand-secondary) 42%, #89b9d9),
      rgba(187, 146, 203, 0.88)
    );
}

body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) .hero-title {
  font-family:
    "Roboto",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Arial,
    sans-serif !important;
  font-size: clamp(3rem, 6vw, 4.7rem);
  font-weight: 400;
  line-height: 0.98;
  letter-spacing: -0.052em;
  color: var(--rg-ink);
}

body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) .hero-title .accent {
  color: transparent;
  background:
    linear-gradient(
      94deg,
      color-mix(in srgb, var(--rg-brand-primary) 78%, #668fa8),
      color-mix(in srgb, var(--rg-brand-secondary) 46%, #7caed0),
      rgba(171, 125, 186, 0.94)
    );
  -webkit-background-clip: text;
  background-clip: text;
}

body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) .hero-desc {
  max-width: 570px;
  color: var(--rg-text-secondary);
  font-size: 0.98rem;
  font-weight: 400;
  line-height: 1.72;
}

body.theme-rainbow-glass:not(.storm-admin-open) .hero--compact {
  padding-top: 66px !important;
  padding-bottom: 68px !important;
}

body.theme-rainbow-glass:not(.storm-admin-open) .hero--compact .hero-title {
  font-size: clamp(2.55rem, 5vw, 3.9rem) !important;
}

/* =====================================================
   FAQ — RECHERCHE LENTILLE
===================================================== */

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .search-panel {
  position: relative;
  z-index: 3;
  margin-top: -36px;
  padding: 0 64px;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .search-card {
  max-width: 780px;
  margin-left: 0;
  padding: 8px 8px 24px;
  border: 1px solid rgba(255, 255, 255, 0.90);
  border-radius: 14px 20px 14px 20px;
  background: rgba(255, 255, 255, 0.64);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.98),
    0 25px 62px rgba(46, 62, 77, 0.10);
  backdrop-filter: blur(25px) saturate(138%);
  -webkit-backdrop-filter: blur(25px) saturate(138%);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .search-card:focus-within {
  border-color: rgba(255, 255, 255, 0.98);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 1),
    0 30px 70px rgba(46, 62, 77, 0.13);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .search-row {
  gap: 8px;
  padding: 5px;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .search-input {
  height: 58px;
  padding: 0 20px;
  color: var(--rg-ink);
  font-size: 1rem;
  font-weight: 400;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .search-btn,
body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .btn-submit {
  border-radius: 8px 12px 8px 12px;
  background: var(--rg-ink);
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .search-btn {
  height: 48px;
  padding: 0 24px;
  transition: transform 160ms ease, background 160ms ease;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .search-btn:hover,
body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .btn-submit:hover {
  transform: translateY(-1px);
  background: #0d131a;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .search-btn:active {
  transform: scale(0.985);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .suggestions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 20px;
  margin-top: 8px;
  padding: 8px 20px 0;
  border-top: 1px solid var(--rg-line);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .suggestion {
  width: 100%;
  height: auto;
  padding: 13px 0;
  border: 0;
  border-bottom: 1px solid rgba(41, 57, 72, 0.07);
  border-radius: 0;
  background: transparent;
  color: var(--rg-text-secondary);
  text-align: left;
  font-size: 0.78rem;
  font-weight: 400;
  transition: color 160ms ease, padding-left 180ms ease;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .suggestion::after {
  content: "→";
  float: right;
  color: var(--rg-decorative);
  transition: transform 180ms ease, color 180ms ease;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .suggestion:hover {
  padding-left: 3px;
  border-color: rgba(41, 57, 72, 0.07);
  background: transparent;
  color: var(--rg-ink);
  transform: none;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .suggestion:hover::after {
  color: var(--rg-brand-primary);
  transform: translateX(3px);
}

/* =====================================================
   FAQ — RÉSULTATS ET CONTACT
===================================================== */

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .results-zone {
  margin-top: 52px;
  background: transparent;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .results-inner {
  max-width: 840px;
  padding: 0 40px;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .state-box {
  border: 1px solid rgba(255, 255, 255, 0.80);
  border-radius: 16px 21px 16px 21px;
  background: rgba(255, 255, 255, 0.50);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.90);
  backdrop-filter: blur(22px) saturate(130%);
  -webkit-backdrop-filter: blur(22px) saturate(130%);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .loading-box {
  padding: 58px 34px;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .result-box {
  padding: 48px 48px 54px;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .notfound-box {
  padding: 54px 40px;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .loading-track {
  background: var(--rg-line);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .loading-fill {
  background:
    linear-gradient(
      90deg,
      var(--rg-brand-primary),
      color-mix(in srgb, var(--rg-brand-secondary) 44%, #83bbdc),
      rgba(184, 145, 202, 0.90)
    );
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .result-answer {
  color: var(--rg-ink);
  font-size: 1.12rem;
  font-weight: 400;
  line-height: 1.76;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .result-note {
  padding: 12px 14px;
  border-left: 1px solid var(--rg-brand-primary);
  color: var(--rg-text-secondary);
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--rg-brand-primary) 5%, white),
      transparent
    );
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .status-confirmed {
  background: rgba(218, 235, 234, 0.82);
  color: #075e59;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .status-pending {
  background: rgba(245, 239, 217, 0.88);
  color: #765a00;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .contact-section {
  padding-top: 80px;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .contact-grid {
  gap: 60px;
  padding: 36px 40px;
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 16px 21px 16px 21px;
  background: rgba(255, 255, 255, 0.42);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.90);
  backdrop-filter: blur(18px) saturate(126%);
  -webkit-backdrop-filter: blur(18px) saturate(126%);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .contact-title {
  font-family:
    "Roboto",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Arial,
    sans-serif !important;
  font-size: 1.55rem;
  font-weight: 400;
  letter-spacing: -0.035em;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .form-input {
  border-bottom-color: var(--rg-line-strong);
  color: var(--rg-ink);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .form-input:focus {
  border-bottom-color: var(--rg-brand-primary);
}

/* =====================================================
   ACTUALITÉS
===================================================== */

body.theme-rainbow-glass:not(.storm-admin-open) #page-actu .timeline-block {
  gap: 44px;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-actu .timeline-side {
  padding: 28px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 15px 20px 15px 20px;
  background: rgba(255, 255, 255, 0.46);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.90);
  backdrop-filter: blur(18px) saturate(126%);
  -webkit-backdrop-filter: blur(18px) saturate(126%);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-actu .timeline-step {
  font-family:
    "Roboto",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Arial,
    sans-serif !important;
  font-size: 1.5rem;
  font-weight: 400;
  letter-spacing: -0.035em;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-actu .progress-fill {
  background:
    linear-gradient(
      90deg,
      var(--rg-brand-primary),
      color-mix(in srgb, var(--rg-brand-secondary) 42%, #87bad8),
      rgba(183, 145, 201, 0.88)
    );
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-actu .milestone-dot {
  border-color: color-mix(in srgb, var(--rg-brand-primary) 72%, #17202a);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-actu .milestone.current .milestone-dot {
  background: var(--rg-brand-primary);
  box-shadow:
    0 0 0 5px color-mix(in srgb, var(--rg-brand-primary) 12%, transparent);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-actu .milestone.future .milestone-label {
  color: var(--rg-text-muted);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-actu .article {
  margin-bottom: 10px;
  padding: 0 24px;
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 14px 18px 14px 18px;
  background: rgba(255, 255, 255, 0.36);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.80);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-actu .article-header-btn {
  padding: 26px 0;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-actu .article-title {
  color: var(--rg-ink);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-actu .article:hover .article-title {
  color: color-mix(in srgb, var(--rg-brand-primary) 72%, var(--rg-ink));
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-actu .article-chevron {
  border-color: var(--rg-line-strong);
  color: var(--rg-text-muted);
  background: rgba(255, 255, 255, 0.34);
}

/* =====================================================
   PLANS ET 3D
===================================================== */

body.theme-rainbow-glass:not(.storm-admin-open) #page-plans .filter-pill {
  border-color: rgba(255, 255, 255, 0.76);
  border-radius: 8px 11px 8px 11px;
  background: rgba(255, 255, 255, 0.46);
  color: var(--rg-text-secondary);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-plans .filter-pill:hover {
  border-color: var(--rg-line-strong);
  color: var(--rg-ink);
  transform: translateY(-1px);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-plans .filter-pill.active {
  border-color: var(--rg-ink);
  background: var(--rg-ink);
  color: #fff;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-plans .plans-grid {
  gap: 16px;
  background: transparent;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-plans .plan-card {
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 15px 20px 15px 20px;
  background: rgba(255, 255, 255, 0.48);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(14px) saturate(120%);
  -webkit-backdrop-filter: blur(14px) saturate(120%);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-plans .plan-visual {
  background: rgba(255, 255, 255, 0.30);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-plans .plan-type-badge {
  border: 1px solid rgba(255, 255, 255, 0.80);
  border-radius: 7px 10px 7px 10px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--rg-ink);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-plans .plan-more {
  color: color-mix(in srgb, var(--rg-brand-primary) 68%, var(--rg-ink));
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-plans .plan-upload-note {
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 12px 16px 12px 16px;
  background: rgba(255, 255, 255, 0.40);
  color: var(--rg-text-secondary);
}

/* =====================================================
   AMBASSADEURS ET ÉQUIPE
===================================================== */

body.theme-rainbow-glass:not(.storm-admin-open) #page-ambassadeurs .people-grid,
body.theme-rainbow-glass:not(.storm-admin-open) #page-equipe .team-grid {
  gap: 12px;
  background: transparent;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-ambassadeurs .person-card,
body.theme-rainbow-glass:not(.storm-admin-open) #page-equipe .team-card {
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 14px 18px 14px 18px;
  background: rgba(255, 255, 255, 0.45);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(14px) saturate(120%);
  -webkit-backdrop-filter: blur(14px) saturate(120%);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-ambassadeurs .person-card:hover,
body.theme-rainbow-glass:not(.storm-admin-open) #page-equipe .team-card:hover {
  background: rgba(255, 255, 255, 0.64);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-ambassadeurs .person-avatar,
body.theme-rainbow-glass:not(.storm-admin-open) #page-equipe .team-avatar {
  border-color: rgba(255, 255, 255, 0.78);
  border-radius: 10px 14px 10px 14px;
  background: rgba(255, 255, 255, 0.54);
  color: var(--rg-text-secondary);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-equipe .team-avatar.parella {
  background:
    color-mix(
      in srgb,
      var(--rg-brand-secondary) 9%,
      rgba(255, 255, 255, 0.58)
    );
  color: color-mix(in srgb, var(--rg-brand-secondary) 78%, var(--rg-ink));
}

/* =====================================================
   BLOCS COMMUNS
===================================================== */

body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) .info-block,
body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) .parella-intro {
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 14px 19px 14px 19px;
  background: rgba(255, 255, 255, 0.42);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(16px) saturate(122%);
  -webkit-backdrop-filter: blur(16px) saturate(122%);
}

body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) .tag-pill {
  border: 1px solid rgba(255, 255, 255, 0.64);
  background: rgba(255, 255, 255, 0.52);
  color: var(--rg-text-secondary);
}

body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) .status-neutral {
  background: rgba(255, 255, 255, 0.54);
  color: var(--rg-text-muted);
}

body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) .section-separator::after,
body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) .footer {
  border-color: var(--rg-line);
}

/* =====================================================
   FALLBACK SANS BACKDROP-FILTER
===================================================== */

@supports not (
  (backdrop-filter: blur(1px)) or
  (-webkit-backdrop-filter: blur(1px))
) {
  body.theme-rainbow-glass:not(.storm-admin-open) .nav,
  body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) > .hero,
  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .search-card,
  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .state-box,
  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .contact-grid,
  body.theme-rainbow-glass:not(.storm-admin-open) #page-actu .timeline-side,
  body.theme-rainbow-glass:not(.storm-admin-open) #page-actu .article,
  body.theme-rainbow-glass:not(.storm-admin-open) #page-plans .plan-card,
  body.theme-rainbow-glass:not(.storm-admin-open) #page-ambassadeurs .person-card,
  body.theme-rainbow-glass:not(.storm-admin-open) #page-equipe .team-card,
  body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) .info-block,
  body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) .parella-intro {
    background: rgba(250, 252, 253, 0.96);
  }
}

/* =====================================================
   RESPONSIVE
===================================================== */

@media (max-width: 860px) {
  body.theme-rainbow-glass {
    --nav-h: 84px;
  }

  body.theme-rainbow-glass:not(.storm-admin-open) .nav {
    top: 8px;
    width: calc(100% - 20px);
    margin-top: 8px;
  }

  body.theme-rainbow-glass:not(.storm-admin-open) .nav-inner {
    padding: 0 14px;
    gap: 18px;
  }

  body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) > .hero {
    margin-left: 10px;
    margin-right: 10px;
    padding: 64px 34px 68px;
  }

  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .search-panel {
    margin-top: -34px;
    padding: 0 30px;
  }

  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .contact-grid {
    padding: 30px;
  }
}

@media (max-width: 560px) {
  body.theme-rainbow-glass {
    --nav-h: 82px;
  }

  body.theme-rainbow-glass:not(.storm-admin-open) .nav {
    border-radius: 14px 17px 14px 17px;
  }

  body.theme-rainbow-glass:not(.storm-admin-open) .nav-brand-name {
    font-size: 0.64rem;
  }

  body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) > .hero {
    padding: 52px 24px 60px;
    border-radius: 16px 20px 16px 20px;
  }

  body.theme-rainbow-glass:not(.storm-admin-open) .page:not(#page-admin) .hero-title {
    font-size: clamp(2.65rem, 13vw, 3.7rem);
  }

  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .search-panel {
    padding: 0 18px;
  }

  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .suggestions {
    grid-template-columns: 1fr;
  }

  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .results-inner {
    padding: 0 18px;
  }

  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .result-box,
  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .loading-box,
  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .notfound-box {
    padding: 36px 24px 40px;
  }

  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .contact-grid {
    padding: 24px;
  }

  body.theme-rainbow-glass:not(.storm-admin-open) [data-rg-glass]::before {
    opacity: calc(var(--rg-prism-opacity) * 0.62);
  }
}

/* =====================================================
   RÉDUCTION DE MOUVEMENT
===================================================== */

@media (prefers-reduced-motion: reduce) {
  body.theme-rainbow-glass {
    --rg-shift-far: 0px !important;
    --rg-shift-mid: 0px !important;
    --rg-shift-near: 0px !important;
    --rg-atmosphere-y: 0px !important;
    --rg-prism-opacity: 0.06 !important;
  }

  body.theme-rainbow-glass [data-rg-depth] {
    transform: none !important;
    will-change: auto;
  }
}
'''

RAINBOW_JS = r'''/*
  STORM — RAINBOW GLASS MOTION
  Module visuel indépendant : aucun appel API, aucune donnée métier.
*/

(() => {
  "use strict";

  const body = document.body;
  if (!body) return;

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compactQuery = window.matchMedia("(max-width: 700px)");

  const depthGroups = {
    far: [
      ".page:not(#page-admin) > .hero",
      "#page-faq .contact-section"
    ],
    mid: [
      "#page-faq .results-zone",
      "#page-actu .timeline-block",
      "#page-plans .plans-grid",
      "#page-ambassadeurs .people-grid",
      "#page-equipe .team-grid"
    ],
    near: [
      "#page-faq .search-panel",
      "#page-actu .articles-block",
      "#page-plans .plans-toolbar"
    ]
  };

  const glassSelectors = [
    ".nav",
    ".page:not(#page-admin) > .hero",
    "#page-faq .search-card",
    "#page-faq .state-box",
    "#page-faq .contact-grid",
    "#page-actu .timeline-side",
    "#page-actu .article",
    "#page-plans .plan-card",
    "#page-plans .plan-upload-note",
    "#page-ambassadeurs .person-card",
    "#page-equipe .team-card",
    ".page:not(#page-admin) .parella-intro",
    ".page:not(#page-admin) .info-block"
  ];

  let glassIndex = 0;

  function markDepthTargets(root = document) {
    Object.entries(depthGroups).forEach(([depth, selectors]) => {
      selectors.forEach(selector => {
        root.querySelectorAll(selector).forEach(element => {
          if (element.closest("#page-admin")) return;
          if (element.classList.contains("reveal")) return;
          element.dataset.rgDepth = depth;
        });
      });
    });
  }

  function markGlassTargets(root = document) {
    glassSelectors.forEach(selector => {
      root.querySelectorAll(selector).forEach(element => {
        if (element.closest("#page-admin")) return;
        if (element.hasAttribute("data-rg-glass")) return;

        element.setAttribute("data-rg-glass", "");
        const phase = ((glassIndex * 13) % 34) - 17;
        element.style.setProperty("--rg-prism-phase", phase + "%");
        glassIndex += 1;
      });
    });
  }

  function refreshTargets(root = document) {
    markDepthTargets(root);
    markGlassTargets(root);
  }

  let targetScroll = window.scrollY;
  let smoothScroll = targetScroll;
  let previousTarget = targetScroll;
  let velocity = 0;
  let frameId = null;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function themeIsActive() {
    return body.classList.contains("theme-rainbow-glass") &&
      !body.classList.contains("storm-admin-open");
  }

  function getActivePageProgress() {
    const activePage = document.querySelector(".page.active:not(#page-admin)");
    if (!activePage) return 0;

    const rect = activePage.getBoundingClientRect();
    const availableTravel = Math.max(rect.height - window.innerHeight, 1);
    return clamp(-rect.top / availableTravel, 0, 1);
  }

  function resetMotion() {
    body.style.setProperty("--rg-shift-far", "0px");
    body.style.setProperty("--rg-shift-mid", "0px");
    body.style.setProperty("--rg-shift-near", "0px");
    body.style.setProperty("--rg-atmosphere-y", "0px");
    body.style.setProperty("--rg-prism-opacity", "0.06");
  }

  function renderMotion() {
    frameId = null;

    if (!themeIsActive() || reduceMotionQuery.matches) {
      resetMotion();
      return;
    }

    const mobileFactor = compactQuery.matches ? 0.36 : 1;

    smoothScroll += (targetScroll - smoothScroll) * 0.105;

    const scrollImpulse = targetScroll - previousTarget;
    velocity += (scrollImpulse - velocity) * 0.12;
    velocity *= 0.88;
    previousTarget = targetScroll;

    const progress = getActivePageProgress();
    const boundedVelocity = clamp(velocity, -34, 34);

    const far = clamp(
      ((progress - 0.5) * -18 + boundedVelocity * 0.13) * mobileFactor,
      -11,
      11
    );

    const mid = clamp(
      ((progress - 0.5) * -11 + boundedVelocity * 0.085) * mobileFactor,
      -7,
      7
    );

    const near = clamp(
      ((progress - 0.5) * -6 + boundedVelocity * 0.05) * mobileFactor,
      -4,
      4
    );

    const atmosphere = clamp(
      ((progress - 0.5) * -24) * mobileFactor,
      -14,
      14
    );

    const prismX = clamp(
      15 + progress * 70 + boundedVelocity * 0.42,
      10,
      90
    );

    const prismOpacity = clamp(
      0.085 + Math.abs(boundedVelocity) * 0.0065,
      0.085,
      0.28
    );

    body.style.setProperty("--rg-shift-far", far.toFixed(2) + "px");
    body.style.setProperty("--rg-shift-mid", mid.toFixed(2) + "px");
    body.style.setProperty("--rg-shift-near", near.toFixed(2) + "px");
    body.style.setProperty("--rg-atmosphere-y", atmosphere.toFixed(2) + "px");
    body.style.setProperty("--rg-prism-x", prismX.toFixed(2) + "%");
    body.style.setProperty("--rg-prism-opacity", prismOpacity.toFixed(3));

    const unsettled =
      Math.abs(targetScroll - smoothScroll) > 0.12 ||
      Math.abs(velocity) > 0.12;

    if (unsettled) {
      frameId = window.requestAnimationFrame(renderMotion);
    }
  }

  function requestMotionUpdate() {
    targetScroll = window.scrollY;
    if (!frameId) frameId = window.requestAnimationFrame(renderMotion);
  }

  window.addEventListener("scroll", requestMotionUpdate, { passive: true });
  window.addEventListener("resize", requestMotionUpdate, { passive: true });

  reduceMotionQuery.addEventListener?.("change", requestMotionUpdate);
  compactQuery.addEventListener?.("change", requestMotionUpdate);

  document.addEventListener("storm-theme-change", () => {
    refreshTargets();
    requestMotionUpdate();
  });

  if (window.MutationObserver) {
    const observer = new MutationObserver(mutations => {
      let shouldRefresh = false;

      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length) {
          shouldRefresh = true;
          break;
        }
      }

      if (shouldRefresh) {
        refreshTargets();
        requestMotionUpdate();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  refreshTargets();
  requestMotionUpdate();
})();
'''


def fail(message: str) -> None:
    print(f"ERREUR : {message}")
    sys.exit(1)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        fail(f"repère introuvable pour {label}. Le fichier a peut-être changé.")
    return text.replace(old, new, 1)


def patch_server(text: str) -> str:
    if "theme: 'default' // thème visuel public" not in text:
        text = replace_once(
            text,
            """  branding: {
    projectName: 'Projet XYZ',
    logoUrl: '' // vide = losange géométrique par défaut
  },""",
            """  branding: {
    projectName: 'Projet XYZ',
    logoUrl: '', // vide = losange géométrique par défaut
    theme: 'default' // thème visuel public : 'default' ou 'rainbow-glass'
  },""",
            "thème par défaut dans server.js"
        )

    if "const theme = raw?.theme === 'rainbow-glass'" not in text:
        text = replace_once(
            text,
            """function normalizeBranding(raw) {
  return {
    projectName: typeof raw?.projectName === 'string' && raw.projectName.trim() ? raw.projectName : defaultContent.branding.projectName,
    logoUrl: typeof raw?.logoUrl === 'string' ? raw.logoUrl : ''
  };
}""",
            """function normalizeBranding(raw) {
  const theme = raw?.theme === 'rainbow-glass' ? 'rainbow-glass' : 'default';
  return {
    projectName: typeof raw?.projectName === 'string' && raw.projectName.trim() ? raw.projectName : defaultContent.branding.projectName,
    logoUrl: typeof raw?.logoUrl === 'string' ? raw.logoUrl : '',
    theme
  };
}""",
            "normalisation du thème dans server.js"
        )

    return text


def patch_index(text: str) -> str:
    if 'href="/themes/rainbow-glass.css"' not in text:
        text = replace_once(
            text,
            "</head>",
            '  <link rel="stylesheet" href="/themes/rainbow-glass.css">\n</head>',
            "chargement du CSS Rainbow Glass"
        )

    if 'src="/themes/rainbow-glass.js"' not in text:
        text = replace_once(
            text,
            "</body>",
            '  <script src="/themes/rainbow-glass.js"></script>\n</body>',
            "chargement du JavaScript Rainbow Glass"
        )

    text = text.replace(
        "{ projectName: 'Projet XYZ', logoUrl: '' }",
        "{ projectName: 'Projet XYZ', logoUrl: '', theme: 'default' }"
    )

    if "function applyTheme(theme)" not in text:
        text = replace_once(
            text,
            """  // Applique le nom de projet et le logo personnalisés (identité visuelle
  // par client) — remplace le losange par défaut si un logo est fourni.
  function applyBranding(branding) {
    if (!branding) return;""",
            """  // Applique le thème public sans toucher à l'administration.
  // Le thème actuel reste la valeur par défaut.
  function applyTheme(theme) {
    const normalizedTheme = theme === 'rainbow-glass' ? 'rainbow-glass' : 'default';
    document.body.classList.toggle('theme-rainbow-glass', normalizedTheme === 'rainbow-glass');
    document.body.dataset.publicTheme = normalizedTheme;
    document.dispatchEvent(new CustomEvent('storm-theme-change', {
      detail: { theme: normalizedTheme }
    }));

    requestAnimationFrame(() => {
      const activeTab = document.querySelector('.nav-tab.active');
      if (activeTab) positionIndicator(activeTab);
    });
  }

  // Applique le nom de projet, le logo et le thème personnalisés.
  function applyBranding(branding) {
    if (!branding) return;
    applyTheme(branding.theme);""",
            "fonction applyTheme dans index.html"
        )

    if "document.body.classList.remove('storm-admin-open');\n      document.querySelectorAll(\".nav-tab\")" not in text:
        text = replace_once(
            text,
            """    tab.addEventListener("click", () => {
      document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));""",
            """    tab.addEventListener("click", () => {
      document.body.classList.remove('storm-admin-open');
      document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));""",
            "sortie de l'administration via la navigation"
        )

    if "function openAdminPage() {\n    document.body.classList.add('storm-admin-open');" not in text:
        text = replace_once(
            text,
            """  function openAdminPage() {
    document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));""",
            """  function openAdminPage() {
    document.body.classList.add('storm-admin-open');
    document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));""",
            "entrée dans l'administration"
        )

    if "function goToFaqPage() {\n    document.body.classList.remove('storm-admin-open');" not in text:
        text = replace_once(
            text,
            """  function goToFaqPage() {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));""",
            """  function goToFaqPage() {
    document.body.classList.remove('storm-admin-open');
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));""",
            "retour au site depuis l'administration"
        )

    if 'id="brandingThemeToggle"' not in text:
        text = replace_once(
            text,
            """                <input type="file" id="brandingLogoInput" accept="image/png,image/jpeg" style="display:none;">
              </div>
            </div>
          </div>
        </div>""",
            """                <input type="file" id="brandingLogoInput" accept="image/png,image/jpeg" style="display:none;">
              </div>
            </div>

            <div style="grid-column:1 / -1; margin-top:4px; padding-top:20px; border-top:1px solid var(--ink-08);">
              <label for="brandingThemeToggle" style="display:flex; align-items:flex-start; gap:14px; cursor:pointer;">
                <input
                  type="checkbox"
                  id="brandingThemeToggle"
                  ${branding.theme === 'rainbow-glass' ? 'checked' : ''}
                  style="width:20px; height:20px; margin-top:2px; flex:0 0 auto; accent-color:var(--ink);"
                >
                <span>
                  <strong style="display:block; font-size:0.9rem; margin-bottom:4px;">Activer le thème Rainbow Glass</strong>
                  <span id="brandingThemeHelp" style="display:block; font-size:0.78rem; color:var(--ink-50); line-height:1.55;">
                    ${branding.theme === 'rainbow-glass'
                      ? 'Rainbow Glass est sélectionné pour le site public. L’administration garde son apparence actuelle.'
                      : 'Le thème actuel est utilisé par défaut. Coche cette case pour appliquer Rainbow Glass au site public.'}
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>""",
            "case à cocher Rainbow Glass dans l'administration"
        )

    if "const themeToggle = document.getElementById('brandingThemeToggle');" not in text:
        text = replace_once(
            text,
            """      document.getElementById('brandingNameInput').addEventListener('input', e => {
        content.branding = content.branding || {};
        content.branding.projectName = e.target.value;
      });

      const logoInput = document.getElementById('brandingLogoInput');""",
            """      document.getElementById('brandingNameInput').addEventListener('input', e => {
        content.branding = content.branding || {};
        content.branding.projectName = e.target.value;
      });

      const themeToggle = document.getElementById('brandingThemeToggle');
      const themeHelp = document.getElementById('brandingThemeHelp');
      themeToggle.addEventListener('change', e => {
        content.branding = content.branding || {};
        content.branding.theme = e.target.checked ? 'rainbow-glass' : 'default';
        themeHelp.textContent = e.target.checked
          ? 'Rainbow Glass est sélectionné pour le site public. L’administration garde son apparence actuelle.'
          : 'Le thème actuel est utilisé par défaut. Coche cette case pour appliquer Rainbow Glass au site public.';
      });

      const logoInput = document.getElementById('brandingLogoInput');""",
            "comportement de la case à cocher Rainbow Glass"
        )

    return text


def main() -> None:
    if not INDEX.exists():
        fail("index.html introuvable. Place ce script à la racine du projet.")
    if not SERVER.exists():
        fail("server.js introuvable. Place ce script à la racine du projet.")

    index_text = INDEX.read_text(encoding="utf-8")
    server_text = SERVER.read_text(encoding="utf-8")

    patched_index = patch_index(index_text)
    patched_server = patch_server(server_text)

    THEMES.mkdir(exist_ok=True)
    CSS_FILE.write_text(RAINBOW_CSS, encoding="utf-8")
    JS_FILE.write_text(RAINBOW_JS, encoding="utf-8")
    INDEX.write_text(patched_index, encoding="utf-8")
    SERVER.write_text(patched_server, encoding="utf-8")

    print("Rainbow Glass installé avec succès.")
    print("Fichiers modifiés : index.html, server.js")
    print("Fichiers créés : themes/rainbow-glass.css, themes/rainbow-glass.js")
    print("Le thème actuel reste le thème par défaut.")
    print("Pour activer Rainbow Glass : Admin > Contenu public > cocher la case > Enregistrer.")


if __name__ == "__main__":
    main()