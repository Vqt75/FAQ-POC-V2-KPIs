/*
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

/* =====================================================
   STORM RAINBOW GLASS — COMPOSITION V2
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

  let cachedContent = null;
  let refreshPromise = null;
  let mutationFrame = null;

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

  async function fetchContent() {
    try {
      const response = await fetch("/api/content", { cache: "no-store" });
      if (!response.ok) throw new Error("Contenu indisponible");
      cachedContent = await response.json();
    } catch (error) {
      console.warn("Rainbow Glass V2 : chargement du contenu impossible.", error);
      cachedContent = cachedContent || {};
    }
    return cachedContent;
  }

  function refreshContent() {
    if (!refreshPromise) {
      refreshPromise = fetchContent().finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  function addGlass(element, phase = 0) {
    if (!element) return;
    element.setAttribute("data-rg-glass", "");
    element.style.setProperty("--rg-prism-phase", `${phase}%`);
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
    }, 140);
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
    const fromApi = Array.isArray(content?.ambassadors)
      ? content.ambassadors.filter(item => item && (item.initials || item.name))
      : [];
    if (fromApi.length) return fromApi;

    return Array.from(document.querySelectorAll("#page-ambassadeurs .person-card"))
      .map(card => ({
        initials: card.querySelector(".person-avatar")?.textContent?.trim() || "",
        name: card.querySelector(".person-name")?.textContent?.trim() || ""
      }));
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

  function buildHome(content) {
    const page = document.getElementById("page-faq");
    if (!page) return;

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
    const articles = Array.from(document.querySelectorAll("#page-actu #articlesList .article"));
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
  }

  function enhancePlans() {
    document.querySelectorAll("#page-plans .plan-card").forEach((card, index) => {
      addGlass(card, ((index * 9) % 30) - 15);
    });
  }

  function enhanceProfiles() {
    document.querySelectorAll("#page-ambassadeurs .person-card").forEach((card, index) => {
      card.classList.toggle("rg2-profile-featured", index < 2);
      addGlass(card, ((index * 7) % 30) - 15);
    });

    document.querySelectorAll("#page-equipe .team-card").forEach((card, index) => {
      card.classList.toggle("rg2-profile-featured", index < 2);
      addGlass(card, ((index * 7) % 30) - 15);
    });
  }

  function removeEnhancements() {
    teardownHome();
    document.querySelectorAll(".rg2-nav-icon,.rg2-article-orbit").forEach(item => item.remove());
    document.querySelectorAll(".rg2-article-primary,.rg2-article-secondary,.rg2-profile-featured").forEach(item => {
      item.classList.remove("rg2-article-primary","rg2-article-secondary","rg2-profile-featured");
    });
  }

  async function applyEnhancements(refresh = false) {
    if (!isActive()) {
      removeEnhancements();
      return;
    }

    if (refresh || !cachedContent) await refreshContent();

    addNavIcons();
    buildHome(cachedContent || {});
    enhanceArticles();
    enhancePlans();
    enhanceProfiles();
  }

  function scheduleEnhancement() {
    if (mutationFrame) return;
    mutationFrame = requestAnimationFrame(() => {
      mutationFrame = null;
      if (!isActive()) return;
      enhanceArticles();
      enhancePlans();
      enhanceProfiles();
    });
  }

  function init() {
    applyEnhancements(true);

    document.addEventListener("storm-theme-change", () => {
      setTimeout(() => applyEnhancements(true), 0);
    });

    document.querySelectorAll(".nav-tab[data-page]").forEach(tab => {
      tab.addEventListener("click", () => {
        if (tab.dataset.page === "faq") {
          setTimeout(() => applyEnhancements(true), 100);
        } else {
          setTimeout(scheduleEnhancement, 100);
        }
      });
    });

    if (window.MutationObserver) {
      const observer = new MutationObserver(scheduleEnhancement);
      [
        document.getElementById("articlesList"),
        document.querySelector("#page-plans .plans-grid"),
        document.querySelector("#page-ambassadeurs .people-grid"),
        document.querySelector("#page-equipe .team-grid")
      ].filter(Boolean).forEach(target => {
        observer.observe(target, { childList: true, subtree: true });
      });
    }

    window.addEventListener("focus", () => {
      if (isActive()) applyEnhancements(true);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
