from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent
INDEX_FILE = ROOT / "index.html"
CSS_FILE = ROOT / "themes" / "rainbow-glass.css"
JS_FILE = ROOT / "themes" / "rainbow-glass.js"

V4_MARKER = "STORM RAINBOW GLASS — PERFORMANCE V4"
V2_START = "/* =====================================================\n   STORM RAINBOW GLASS — COMPOSITION V2\n===================================================== */"
V3_START = "/* =====================================================\n   STORM RAINBOW GLASS — FAQ MOTION V3"

V2_JS_OPTIMIZED = r'''/* =====================================================
   STORM RAINBOW GLASS — COMPOSITION V2
   VERSION OPTIMISÉE V4

   - aucune seconde requête vers /api/content ;
   - aucune reconstruction au retour de focus ;
   - aucun MutationObserver global ;
   - chaque page est enrichie seulement quand cela est utile.
===================================================== */

(() => {
  "use strict";

  const body = document.body;
  if (!body) return;

  const ICONS = {
    faq: `<svg viewBox="0 0 24 24"><ellipse cx="10" cy="11" rx="6.5" ry="5.5"></ellipse><ellipse cx="14.5" cy="12.5" rx="5.2" ry="6.8"></ellipse><path d="M8.2 16.1 6.4 20l4.4-2.7"></path></svg>`,
    actu: `<svg viewBox="0 0 24 24"><path d="M6 5.5h9.5A2.5 2.5 0 0 1 18 8v10.5H8.5A2.5 2.5 0 0 1 6 16z"></path><path d="M9 9h6M9 12h6M9 15h3.5"></path><path d="M18 8.5h1.5v8a2 2 0 0 1-2 2"></path></svg>`,
    plans: `<svg viewBox="0 0 24 24"><path d="m4.5 7 5-2.2 5 2.2 5-2.2v12.5l-5 2.2-5-2.2-5 2.2z"></path><path d="M9.5 4.8v12.5M14.5 7v12.5"></path><ellipse cx="15" cy="10" rx="2.8" ry="4.2"></ellipse></svg>`,
    ambassadeurs: `<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3.2"></circle><circle cx="16.5" cy="10.5" r="2.6"></circle><path d="M3.8 19c.6-3.3 2.4-5 5.2-5s4.6 1.7 5.2 5"></path><path d="M14 15.3c2.8-.7 5 .7 6.1 3.7"></path></svg>`,
    equipe: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.4"></circle><path d="M5.5 19c.8-4 3-6 6.5-6s5.7 2 6.5 6"></path><ellipse cx="12" cy="12" rx="8.2" ry="5.6"></ellipse></svg>`,
    progress: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5"></circle><path d="M12 4.5a7.5 7.5 0 0 1 7.2 5.4"></path><path d="m12 12 4.8-3"></path><circle cx="12" cy="12" r="1.2"></circle></svg>`,
    article: `<svg viewBox="0 0 24 24"><ellipse cx="10.4" cy="12" rx="6.2" ry="8"></ellipse><ellipse cx="14.2" cy="12" rx="5.4" ry="7"></ellipse><path d="M8.5 8.5h5.5M8.5 12h6.5M8.5 15.5h4"></path></svg>`
  };

  let cachedContent = window.__stormPublicContent || null;
  let scheduledFrame = 0;
  let lastHomeSignature = "";

  function isActive() {
    return body.classList.contains("theme-rainbow-glass") &&
      !body.classList.contains("storm-admin-open");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function text(selector, root = document) {
    return root.querySelector(selector)?.textContent?.trim() || "";
  }

  function snapshotFromDom() {
    const planningStep = document.getElementById("planningStep");
    const stepParts = planningStep
      ? planningStep.innerHTML.split(/<br\s*\/?\s*>/i).map(part => part.replace(/<[^>]*>/g, "").trim())
      : [];

    const percentText = text("#planningPct").replace(/[^0-9]/g, "");
    const percent = Number(percentText);

    const articles = Array.from(document.querySelectorAll("#page-actu #articlesList .article"))
      .map(article => ({
        id: article.dataset.article || "",
        tag: text(".tag-pill", article),
        date: text(".article-date", article),
        title: text(".article-title", article)
      }))
      .filter(article => article.id || article.title);

    const ambassadors = Array.from(document.querySelectorAll("#page-ambassadeurs .person-card"))
      .map(card => ({
        initials: text(".person-avatar", card),
        name: text(".person-name", card)
      }))
      .filter(person => person.initials || person.name);

    return {
      progress: {
        stepLine1: stepParts[0] || "Étape 3",
        stepLine2: stepParts[1] || "sur 6",
        percent: Number.isFinite(percent) ? percent : 42
      },
      articles,
      ambassadors
    };
  }

  function getContentSnapshot() {
    const dom = snapshotFromDom();
    const source = cachedContent || {};

    return {
      ...source,
      progress: dom.progress,
      articles: dom.articles.length ? dom.articles : (Array.isArray(source.articles) ? source.articles : []),
      ambassadors: dom.ambassadors.length ? dom.ambassadors : (Array.isArray(source.ambassadors) ? source.ambassadors : [])
    };
  }

  function addGlass(element, phase = 0) {
    if (!element) return;
    element.setAttribute("data-rg-glass", "");
    element.style.setProperty("--rg-prism-phase", `${phase}%`);
  }

  function emitDomUpdated(root = document) {
    document.dispatchEvent(new CustomEvent("storm-rg-dom-updated", {
      detail: { root }
    }));
  }

  function navigate(pageId) {
    document.querySelector(`.nav-tab[data-page="${pageId}"]`)?.click();
  }

  function openArticle(articleId) {
    navigate("actu");
    window.setTimeout(() => {
      const safeId = window.CSS?.escape
        ? CSS.escape(String(articleId))
        : String(articleId).replace(/"/g, '\\"');

      const article = document.querySelector(
        `#page-actu .article[data-article="${safeId}"]`
      );
      if (!article) return;

      const button = article.querySelector(".article-header-btn");
      if (button && !article.classList.contains("open")) button.click();
      article.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }

  function getProgress(content) {
    const raw = content?.progress || {};
    const percent = Number(raw.percent);
    return {
      line1: raw.stepLine1 || "Étape 3",
      line2: raw.stepLine2 || "sur 6",
      percent: Number.isFinite(percent)
        ? Math.max(0, Math.min(100, Math.round(percent)))
        : 42
    };
  }

  function getAmbassadors(content) {
    return Array.isArray(content?.ambassadors)
      ? content.ambassadors.filter(item => item && (item.initials || item.name))
      : [];
  }

  function createRail(content) {
    const progress = getProgress(content);
    const ambassadors = getAmbassadors(content).slice(0, 4);

    const rail = document.createElement("aside");
    rail.className = "rg2-home-rail";
    rail.setAttribute("aria-label", "Aperçu du projet");
    addGlass(rail, 10);

    rail.innerHTML = `
      <div class="rg2-rail-section">
        <div class="rg2-kicker-row">
          <div class="rg2-kicker">Avancement du projet</div>
          <div class="rg2-icon">${ICONS.progress}</div>
        </div>
        <div class="rg2-progress-title">${escapeHtml(progress.line1)}<br>${escapeHtml(progress.line2)}</div>
        <div class="rg2-copy">Suivez les étapes franchies et les prochains jalons du projet.</div>
        <div class="rg2-progress-track"><span class="rg2-progress-fill" style="width:${progress.percent}%"></span></div>
        <div class="rg2-progress-meta"><span>Progression</span><strong>${progress.percent} %</strong></div>
        <button type="button" class="rg2-link" data-rg2-target="actu">Voir le calendrier <span>→</span></button>
      </div>

      <div class="rg2-rail-section">
        <div class="rg2-kicker">Vos ambassadeurs</div>
        <div class="rg2-avatar-stack">
          ${ambassadors.length
            ? ambassadors.map(person => `<span class="rg2-mini-avatar" title="${escapeHtml(person.name)}">${escapeHtml(person.initials || "?")}</span>`).join("")
            : '<span class="rg2-mini-avatar">—</span>'}
        </div>
        <div class="rg2-copy">Des collègues relais, disponibles pour faire circuler les questions et les retours.</div>
        <button type="button" class="rg2-link" data-rg2-target="ambassadeurs">Découvrir le réseau <span>→</span></button>
      </div>
    `;

    rail.querySelectorAll("[data-rg2-target]").forEach(button => {
      button.addEventListener("click", () => navigate(button.dataset.rg2Target));
    });

    return rail;
  }

  function createFeatured(content) {
    const articles = Array.isArray(content?.articles)
      ? content.articles.slice(0, 2)
      : [];

    const panel = document.createElement("section");
    panel.className = "rg2-stream-panel";
    addGlass(panel, -8);

    panel.innerHTML = `
      <div class="rg2-panel-header">
        <div class="rg2-panel-title">À la une</div>
        <div class="rg2-panel-meta">${articles.length} publication${articles.length > 1 ? "s" : ""}</div>
      </div>
      <div class="rg2-featured-grid">
        ${articles.length
          ? articles.map((article, index) => `
              <button type="button" class="rg2-featured-card" data-rg2-article="${escapeHtml(article.id)}">
                <span>
                  <span class="rg2-card-index">0${index + 1}</span>
                  <span class="rg2-featured-tag">${escapeHtml(article.tag || "Actualité")}</span>
                  <span class="rg2-featured-title">${escapeHtml(article.title || "")}</span>
                  <span class="rg2-featured-date">${escapeHtml(article.date || "")}</span>
                </span>
                <span class="rg2-card-arrow">↗</span>
              </button>
            `).join("")
          : '<div class="rg2-copy">Aucune publication n’est encore disponible.</div>'}
      </div>
    `;

    panel.querySelectorAll("[data-rg2-article]").forEach(card => {
      card.addEventListener("click", () => openArticle(card.dataset.rg2Article));
    });

    return panel;
  }

  function createExplore() {
    const panel = document.createElement("section");
    panel.className = "rg2-stream-panel";
    addGlass(panel, 8);

    const links = [
      ["plans", "Plans & 3D", "Explorer les espaces et les documents visuels."],
      ["ambassadeurs", "Ambassadeurs", "Identifier les relais proches de votre équipe."],
      ["equipe", "Équipe projet", "Retrouver les personnes qui pilotent la démarche."]
    ];

    panel.innerHTML = `
      <div class="rg2-panel-header">
        <div class="rg2-panel-title">À explorer</div>
        <div class="rg2-panel-meta">Accès directs</div>
      </div>
      <div class="rg2-explore-list">
        ${links.map(([id, name, copy]) => `
          <button type="button" class="rg2-explore-link" data-rg2-target="${id}">
            <span class="rg2-icon">${ICONS[id]}</span>
            <span>
              <span class="rg2-explore-name">${name}</span>
              <span class="rg2-explore-copy">${copy}</span>
            </span>
            <span>→</span>
          </button>
        `).join("")}
      </div>
    `;

    panel.querySelectorAll("[data-rg2-target]").forEach(button => {
      button.addEventListener("click", () => navigate(button.dataset.rg2Target));
    });

    return panel;
  }

  function teardownHome() {
    const composition = document.getElementById("rg2HomeComposition");
    document.getElementById("rg2HomeStream")?.remove();

    if (!composition) return;

    const page = composition.parentElement;
    const hero = composition.querySelector(".rg2-home-main > .hero");
    const search = composition.querySelector(".rg2-home-main > .search-panel");

    if (page && hero && search) {
      page.insertBefore(hero, composition);
      page.insertBefore(search, composition);
    }

    composition.remove();
  }

  function homeSignature(content) {
    const progress = getProgress(content);
    const articles = Array.isArray(content?.articles) ? content.articles.slice(0, 2) : [];
    const ambassadors = getAmbassadors(content).slice(0, 4);
    return JSON.stringify({ progress, articles, ambassadors });
  }

  function buildHome(content, force = false) {
    const page = document.getElementById("page-faq");
    if (!page) return;

    const signature = homeSignature(content);
    const existing = document.getElementById("rg2HomeComposition");
    if (existing && !force && signature === lastHomeSignature) return;

    teardownHome();

    const hero = Array.from(page.children).find(child => child.classList?.contains("hero"));
    const search = Array.from(page.children).find(child => child.classList?.contains("search-panel"));
    if (!hero || !search) return;

    const composition = document.createElement("div");
    composition.id = "rg2HomeComposition";
    composition.className = "rg2-home-composition";

    const main = document.createElement("div");
    main.className = "rg2-home-main";

    page.insertBefore(composition, hero);
    composition.appendChild(main);
    main.appendChild(hero);
    main.appendChild(search);
    composition.appendChild(createRail(content));

    const stream = document.createElement("div");
    stream.id = "rg2HomeStream";
    stream.className = "rg2-home-stream";
    stream.appendChild(createFeatured(content));
    stream.appendChild(createExplore());

    composition.insertAdjacentElement("afterend", stream);
    lastHomeSignature = signature;

    emitDomUpdated(page);
    document.dispatchEvent(new CustomEvent("storm-rg-home-ready"));
  }

  function addNavIcons() {
    const map = {
      faq: ICONS.faq,
      actu: ICONS.actu,
      plans: ICONS.plans,
      ambassadeurs: ICONS.ambassadeurs,
      equipe: ICONS.equipe
    };

    document.querySelectorAll(".nav-tab[data-page]").forEach(tab => {
      if (tab.querySelector(".rg2-nav-icon")) return;
      const icon = map[tab.dataset.page];
      if (!icon) return;

      const span = document.createElement("span");
      span.className = "rg2-nav-icon";
      span.innerHTML = icon;
      tab.prepend(span);
    });
  }

  function enhanceArticles() {
    const root = document.getElementById("articlesList");
    if (!root) return;

    const articles = Array.from(root.querySelectorAll(".article"));
    articles.forEach((article, index) => {
      article.classList.toggle("rg2-article-primary", index === 0);
      article.classList.toggle("rg2-article-secondary", index !== 0);
      addGlass(article, ((index * 11) % 28) - 14);

      const button = article.querySelector(".article-header-btn");
      if (!button) return;

      let orbit = button.querySelector(".rg2-article-orbit");
      if (index === 0 && !orbit) {
        orbit = document.createElement("span");
        orbit.className = "rg2-article-orbit";
        orbit.innerHTML = ICONS.article;
        button.appendChild(orbit);
      }
      if (index !== 0) orbit?.remove();
    });

    emitDomUpdated(root);
  }

  function enhancePlans() {
    const root = document.querySelector("#page-plans .plans-grid");
    if (!root) return;
    root.querySelectorAll(".plan-card").forEach((card, index) => {
      addGlass(card, ((index * 9) % 30) - 15);
    });
    emitDomUpdated(root);
  }

  function enhanceProfiles(pageId, selector) {
    const root = document.querySelector(`#page-${pageId} ${selector}`);
    if (!root) return;
    const cardSelector = pageId === "ambassadeurs" ? ".person-card" : ".team-card";
    root.querySelectorAll(cardSelector).forEach((card, index) => {
      card.classList.toggle("rg2-profile-featured", index < 2);
      addGlass(card, ((index * 7) % 30) - 15);
    });
    emitDomUpdated(root);
  }

  function enhancePage(pageId) {
    if (!isActive()) return;
    if (pageId === "actu") enhanceArticles();
    if (pageId === "plans") enhancePlans();
    if (pageId === "ambassadeurs") enhanceProfiles("ambassadeurs", ".people-grid");
    if (pageId === "equipe") enhanceProfiles("equipe", ".team-grid");
  }

  function removeEnhancements() {
    teardownHome();
    lastHomeSignature = "";
    document.querySelectorAll(".rg2-nav-icon,.rg2-article-orbit").forEach(item => item.remove());
    document.querySelectorAll(".rg2-article-primary,.rg2-article-secondary,.rg2-profile-featured").forEach(item => {
      item.classList.remove("rg2-article-primary", "rg2-article-secondary", "rg2-profile-featured");
    });
  }

  function applyEnhancements(forceHome = false) {
    if (!isActive()) {
      removeEnhancements();
      return;
    }

    const content = getContentSnapshot();
    addNavIcons();
    buildHome(content, forceHome);

    const activePage = document.querySelector(".page.active")?.id?.replace(/^page-/, "");
    if (activePage) enhancePage(activePage);
  }

  function scheduleApply(forceHome = false) {
    if (scheduledFrame) cancelAnimationFrame(scheduledFrame);
    scheduledFrame = requestAnimationFrame(() => {
      scheduledFrame = 0;
      applyEnhancements(forceHome);
    });
  }

  document.addEventListener("storm-public-content-ready", event => {
    cachedContent = event.detail?.content || window.__stormPublicContent || cachedContent;
    scheduleApply(true);
  });

  document.addEventListener("storm-theme-change", () => {
    scheduleApply(false);
  });

  document.querySelectorAll(".nav-tab[data-page]").forEach(tab => {
    tab.addEventListener("click", () => {
      const pageId = tab.dataset.page;
      requestAnimationFrame(() => {
        if (!isActive()) return;
        if (pageId === "faq") {
          buildHome(getContentSnapshot(), false);
          document.dispatchEvent(new CustomEvent("storm-rg-home-ready"));
        } else {
          enhancePage(pageId);
        }
      });
    });
  });

  function init() {
    cachedContent = window.__stormPublicContent || cachedContent;
    if (cachedContent) {
      scheduleApply(false);
    } else {
      /* Filet de sécurité : aucun fetch supplémentaire. */
      window.setTimeout(() => scheduleApply(false), 350);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();'''

V3_JS_OPTIMIZED = r'''/* =====================================================
   STORM RAINBOW GLASS — FAQ MOTION V3
   VERSION OPTIMISÉE V4
===================================================== */

(() => {
  "use strict";

  const body = document.body;
  if (!body) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let stateObservers = [];
  let closeTimer = 0;
  let hasAutoScrolledForCurrentOpen = false;

  function isRainbowActive() {
    return body.classList.contains("theme-rainbow-glass") &&
      !body.classList.contains("storm-admin-open");
  }

  function getResultsZone() {
    return document.querySelector("#page-faq > .results-zone");
  }

  function placeResultsBeforeFeatured() {
    if (!isRainbowActive()) return;

    const page = document.getElementById("page-faq");
    const composition = document.getElementById("rg2HomeComposition");
    const stream = document.getElementById("rg2HomeStream");
    const results = getResultsZone();

    if (!page || !composition || !results) return;

    results.classList.add("rg3-inline-results");

    if (stream && results.nextElementSibling !== stream) {
      page.insertBefore(results, stream);
    } else if (!stream && composition.nextElementSibling !== results) {
      composition.insertAdjacentElement("afterend", results);
    }
  }

  function visibleStateExists(results) {
    return Array.from(results.querySelectorAll(".state-box"))
      .some(box => box.classList.contains("is-visible"));
  }

  function scrollAnswerIntoView(results) {
    if (reduceMotion.matches || hasAutoScrolledForCurrentOpen) return;

    const rect = results.getBoundingClientRect();
    const answerIsOutsideComfortZone =
      rect.top > window.innerHeight * 0.70 ||
      rect.bottom < 110;

    if (answerIsOutsideComfortZone) {
      hasAutoScrolledForCurrentOpen = true;
      window.setTimeout(() => {
        results.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    }
  }

  function syncResultState() {
    const results = getResultsZone();
    if (!results) return;

    if (!isRainbowActive()) {
      results.classList.remove("rg3-inline-results", "rg3-result-open");
      hasAutoScrolledForCurrentOpen = false;
      return;
    }

    placeResultsBeforeFeatured();

    if (visibleStateExists(results)) {
      window.clearTimeout(closeTimer);
      results.classList.add("rg3-result-open");
      scrollAnswerIntoView(results);
      return;
    }

    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      if (!visibleStateExists(results)) {
        results.classList.remove("rg3-result-open");
        hasAutoScrolledForCurrentOpen = false;
      }
    }, 460);
  }

  function observeResults() {
    stateObservers.forEach(observer => observer.disconnect());
    stateObservers = [];

    const results = getResultsZone();
    if (!results) return;

    results.querySelectorAll(".state-box").forEach(box => {
      const observer = new MutationObserver(syncResultState);
      observer.observe(box, {
        attributes: true,
        attributeFilter: ["class", "style"]
      });
      stateObservers.push(observer);
    });

    syncResultState();
  }

  function refresh() {
    requestAnimationFrame(() => {
      placeResultsBeforeFeatured();
      observeResults();
    });
  }

  document.addEventListener("storm-rg-home-ready", refresh);
  document.addEventListener("storm-theme-change", refresh);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }
})();'''

V4_CSS = r'''
/* =====================================================
   STORM RAINBOW GLASS — PERFORMANCE V4
===================================================== */

/* Un calque GPU permanent n'est pas nécessaire pour ce bloc. */
body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .rg2-home-stream {
  will-change: auto;
}

/* Isolation des gros panneaux pour limiter la zone à repeindre. */
body.theme-rainbow-glass:not(.storm-admin-open) :where(
  .rg2-home-composition,
  .rg2-home-stream,
  .rg2-home-rail,
  .rg2-stream-panel,
  #page-faq > .results-zone.rg3-inline-results
) {
  contain: layout paint;
}

/* Les contenus hors écran sont préparés seulement lorsqu'ils approchent du viewport. */
body.theme-rainbow-glass:not(.storm-admin-open) :where(
  #page-faq .contact-section,
  #page-actu .articles-block,
  #page-plans .plans-grid,
  #page-ambassadeurs .people-grid,
  #page-equipe .team-grid
) {
  content-visibility: auto;
  contain-intrinsic-size: auto 520px;
}

/* Réduction du coût des filtres sur petits écrans. */
@media (max-width: 700px) {
  body.theme-rainbow-glass:not(.storm-admin-open) :where(
    .rg2-home-rail,
    .rg2-stream-panel,
    #page-faq > .results-zone.rg3-inline-results .state-box,
    #page-actu .article,
    #page-plans .plan-card,
    #page-ambassadeurs .person-card,
    #page-equipe .team-card
  ) {
    backdrop-filter: blur(13px) saturate(118%);
    -webkit-backdrop-filter: blur(13px) saturate(118%);
  }
}
'''


def fail(message: str) -> None:
    print(f"ERREUR : {message}")
    sys.exit(1)


def patch_index(text: str) -> tuple[str, bool]:
    if "storm-public-content-ready" in text and "window.__stormPublicContent = content" in text:
        return text, False

    pattern = re.compile(
        r"(\s+renderMilestonesFront\(content\.milestones, content\.progress\);\s*\n"
        r"\s+renderArticlesFront\(content\.articles\);)(\s*\n\s+trackVisit\(\);)",
        re.MULTILINE,
    )

    replacement = (
        r"\1\n"
        r"    window.__stormPublicContent = content;\n"
        r"    document.dispatchEvent(new CustomEvent('storm-public-content-ready', {\n"
        r"      detail: { content }\n"
        r"    }));\2"
    )

    patched, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        fail(
            "Je n'ai pas trouvé le bloc de chargement initial dans index.html. "
            "Le fichier a peut-être changé depuis la dernière version."
        )

    return patched, True


def replace_v2_and_v3(js: str) -> str:
    v2_pos = js.find(V2_START)
    if v2_pos < 0:
        fail("Bloc JavaScript V2 introuvable dans themes/rainbow-glass.js.")

    v3_pos = js.find(V3_START, v2_pos + len(V2_START))
    if v3_pos < 0:
        fail("Bloc JavaScript V3 introuvable dans themes/rainbow-glass.js.")

    before_v2 = js[:v2_pos].rstrip()
    v3_block = js[v3_pos:]

    # Le bloc V3 est le dernier IIFE du fichier dans la version installée.
    # On le remplace entièrement par la version optimisée.
    optimized = (
        before_v2
        + "\n\n"
        + V2_JS_OPTIMIZED.strip()
        + "\n\n"
        + V3_JS_OPTIMIZED.strip()
        + "\n"
    )
    return optimized


def optimize_motion_observer(js: str) -> str:
    old = r'''  if (window.MutationObserver) {
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
  requestMotionUpdate();'''

    new = r'''  document.addEventListener("storm-rg-dom-updated", event => {
    const root = event.detail?.root;
    refreshTargets(root instanceof Element ? root : document);
    requestMotionUpdate();
  });

  document.addEventListener("storm-rg-home-ready", () => {
    refreshTargets(document.getElementById("page-faq") || document);
    requestMotionUpdate();
  });

  refreshTargets();
  requestMotionUpdate();'''

    if old not in js:
        fail("Le MutationObserver global du module de mouvement est introuvable.")
    return js.replace(old, new, 1)


def main() -> None:
    for path in (INDEX_FILE, CSS_FILE, JS_FILE):
        if not path.exists():
            fail(f"Fichier introuvable : {path.relative_to(ROOT)}")

    index_text = INDEX_FILE.read_text(encoding="utf-8")
    css_text = CSS_FILE.read_text(encoding="utf-8")
    js_text = JS_FILE.read_text(encoding="utf-8")

    if V4_MARKER in css_text:
        print("La correction Performance V4 est déjà installée.")
        return

    patched_index, index_changed = patch_index(index_text)
    patched_js = replace_v2_and_v3(js_text)
    patched_js = optimize_motion_observer(patched_js)
    patched_css = css_text.rstrip() + "\n\n" + V4_CSS.strip() + "\n"

    INDEX_FILE.write_text(patched_index, encoding="utf-8")
    JS_FILE.write_text(patched_js, encoding="utf-8")
    CSS_FILE.write_text(patched_css, encoding="utf-8")

    print("Rainbow Glass Performance V4 installé avec succès.")
    print("")
    print("Optimisations appliquées :")
    print("- suppression de la requête /api/content en double ;")
    print("- suppression des reconstructions au retour de focus ;")
    print("- suppression des MutationObserver globaux ;")
    print("- enrichissement des pages uniquement au moment utile ;")
    print("- conservation de À la une, des icônes et de la motion FAQ.")
    print("")
    print("Fichiers modifiés :")
    print("- index.html" if index_changed else "- index.html : déjà prêt")
    print("- themes/rainbow-glass.js")
    print("- themes/rainbow-glass.css")
    print("")
    print("Redémarre le serveur puis recharge avec Ctrl+Shift+R.")


if __name__ == "__main__":
    main()
