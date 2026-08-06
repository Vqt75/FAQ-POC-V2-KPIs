from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
CSS_FILE = ROOT / "themes" / "rainbow-glass.css"
JS_FILE = ROOT / "themes" / "rainbow-glass.js"

CSS_MARKER = "STORM RAINBOW GLASS — FAQ MOTION V3"
JS_MARKER = "STORM RAINBOW GLASS — FAQ MOTION V3"

V3_CSS = r'''
/* =====================================================
   STORM RAINBOW GLASS — FAQ MOTION V3
   La réponse se déploie entre la recherche et « À la une ».
===================================================== */

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq > .results-zone.rg3-inline-results {
  width: 100%;
  max-width: var(--max);
  margin: 0 auto;
  padding: 0 20px;
  display: grid;
  grid-template-rows: 0fr;
  overflow: hidden;
  opacity: 0;
  transform: translate3d(0, -10px, 0) scale(.992);
  transform-origin: 50% 0;
  transition:
    grid-template-rows .58s cubic-bezier(.16, 1, .3, 1),
    opacity .24s ease,
    transform .48s cubic-bezier(.16, 1, .3, 1),
    margin-top .58s cubic-bezier(.16, 1, .3, 1);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq > .results-zone.rg3-inline-results > .results-inner {
  width: 100%;
  max-width: none;
  min-height: 0;
  overflow: hidden;
  padding: 0;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq > .results-zone.rg3-inline-results.rg3-result-open {
  grid-template-rows: 1fr;
  margin-top: 14px;
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq > .results-zone.rg3-inline-results .state-box {
  width: min(100%, 940px);
  margin-inline: auto;
  border: 1px solid rgba(255,255,255,.86);
  border-radius: 18px 25px 18px 25px;
  background:
    radial-gradient(circle at 94% 0%, color-mix(in srgb, var(--rg2-cyan, #8fcce0) 16%, transparent), transparent 34%),
    radial-gradient(circle at 4% 100%, color-mix(in srgb, var(--rg2-violet, #aa92d7) 12%, transparent), transparent 34%),
    linear-gradient(145deg, rgba(255,255,255,.76), rgba(247,250,252,.50));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.98),
    0 25px 65px rgba(42,61,77,.08);
  backdrop-filter: blur(23px) saturate(132%);
  -webkit-backdrop-filter: blur(23px) saturate(132%);
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq > .results-zone.rg3-inline-results .loading-box {
  padding: 42px 34px;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq > .results-zone.rg3-inline-results .result-box {
  padding: 42px 48px 48px;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq > .results-zone.rg3-inline-results .notfound-box {
  padding: 46px 38px;
}

body.theme-rainbow-glass:not(.storm-admin-open) #page-faq > .results-zone.rg3-inline-results .result-answer {
  max-width: 760px;
}

/*
  « À la une » n'est pas masqué : il descend naturellement au rythme
  du déploiement de la réponse, sans saut brutal de mise en page.
*/
body.theme-rainbow-glass:not(.storm-admin-open) #page-faq .rg2-home-stream {
  will-change: transform;
}

@media (max-width: 700px) {
  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq > .results-zone.rg3-inline-results {
    padding: 0 10px;
  }

  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq > .results-zone.rg3-inline-results .result-box,
  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq > .results-zone.rg3-inline-results .loading-box,
  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq > .results-zone.rg3-inline-results .notfound-box {
    padding: 32px 24px 36px;
  }
}

@media (prefers-reduced-motion: reduce) {
  body.theme-rainbow-glass:not(.storm-admin-open) #page-faq > .results-zone.rg3-inline-results {
    transition: none;
    transform: none;
  }
}
'''

V3_JS = r'''
/* =====================================================
   STORM RAINBOW GLASS — FAQ MOTION V3
   Replace dynamiquement la réponse avant « À la une ».
===================================================== */

(() => {
  "use strict";

  const body = document.body;
  if (!body) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let resultObserver = null;
  let closeTimer = null;
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

    /*
      Lorsqu'une nouvelle recherche remplace l'ancienne, le code principal
      masque d'abord l'ancien état puis affiche le nouveau 90 ms plus tard.
      Ce délai évite que le panneau se referme brièvement entre les deux.
    */
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      if (!visibleStateExists(results)) {
        results.classList.remove("rg3-result-open");
        hasAutoScrolledForCurrentOpen = false;
      }
    }, 460);
  }

  function observeResults() {
    const results = getResultsZone();
    if (!results) return;

    resultObserver?.disconnect();
    resultObserver = new MutationObserver(syncResultState);
    resultObserver.observe(results, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"]
    });

    syncResultState();
  }

  function refresh() {
    window.setTimeout(() => {
      placeResultsBeforeFeatured();
      observeResults();
    }, 0);
  }

  document.addEventListener("storm-theme-change", refresh);

  document.querySelectorAll('.nav-tab[data-page="faq"]').forEach(tab => {
    tab.addEventListener("click", () => window.setTimeout(refresh, 140));
  });

  /*
    La V2 reconstruit la composition de l'accueil à certains moments.
    On replace donc la zone de réponse après chaque reconstruction.
  */
  if (window.MutationObserver) {
    const page = document.getElementById("page-faq");
    if (page) {
      const homeObserver = new MutationObserver(() => {
        if (isRainbowActive()) placeResultsBeforeFeatured();
      });
      homeObserver.observe(page, { childList: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }
})();
'''


def fail(message: str) -> None:
    print(f"ERREUR : {message}")
    sys.exit(1)


def main() -> None:
    if not CSS_FILE.exists() or not JS_FILE.exists():
        fail(
            "Les fichiers Rainbow Glass sont introuvables. "
            "Installe d'abord Rainbow Glass et sa composition V2."
        )

    css = CSS_FILE.read_text(encoding="utf-8")
    js = JS_FILE.read_text(encoding="utf-8")
    changed = False

    if CSS_MARKER not in css:
        CSS_FILE.write_text(css.rstrip() + "\n\n" + V3_CSS.lstrip(), encoding="utf-8")
        print("Motion FAQ V3 ajoutée à themes/rainbow-glass.css.")
        changed = True
    else:
        print("La partie CSS de la motion FAQ V3 est déjà installée.")

    if JS_MARKER not in js:
        JS_FILE.write_text(js.rstrip() + "\n\n" + V3_JS.lstrip(), encoding="utf-8")
        print("Motion FAQ V3 ajoutée à themes/rainbow-glass.js.")
        changed = True
    else:
        print("La partie JavaScript de la motion FAQ V3 est déjà installée.")

    print("")
    if changed:
        print("Correction UI/UX installée avec succès.")
        print("La réponse apparaît maintenant avant « À la une ».")
        print("Le bloc « À la une » glisse vers le bas pendant l'ouverture.")
        print("Le thème classique et l'administration ne sont pas modifiés.")
    else:
        print("Aucune modification nécessaire : la correction est déjà présente.")


if __name__ == "__main__":
    main()
