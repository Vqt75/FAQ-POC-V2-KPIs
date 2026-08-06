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
