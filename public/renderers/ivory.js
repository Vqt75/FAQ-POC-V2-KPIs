// TECTONIC — Renderer Ivory (Phase 5, migration de parité)
//
// Contrat inchangé : ce fichier consomme le Manifest et les actions
// du Public Core reçues en arguments. Il ne connaît jamais d'endpoint,
// jamais de mécanisme de stockage — voir runtime.js pour la frontière
// Renderer / Public Core.
//
// Périmètre de cette migration (voir TECTONIC_PHASE5_PARITY_AUDIT.md) :
// moteur FAQ, escalade contact, lecture complète d'article, filtres
// Plans & 3D, distinction image/PDF, lightbox, libellé roster
// ambassadeurs, CTA ambassadeurs/équipe, séparation des groupes
// équipe, logo. Volontairement hors périmètre : baromètre météo,
// tracking KPI, repli IA Gemini, typographies personnalisées
// (jamais appliquées publiquement par Pangea lui-même, donc pas un
// écart de parité — voir l'audit).

import { matchFaq } from '../faq-engine.js';

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isPdfUrl(url) {
  return /\.pdf($|\?)/i.test(url || '');
}

// Port fidèle de articleBodyToHtml() (index.html) : gère les lignes
// "## titre" en gras, rien d'autre — pas une réinterprétation.
function articleBodyToHtml(text) {
  const escaped = esc(text || '');
  return escaped.split('\n').map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) return `<strong>${trimmed.slice(3)}</strong>`;
    return line;
  }).join('\n');
}

function renderAsset(asset, cssClass, enableLightbox = false) {
  if (!asset || !asset.url) return '';
  if (isPdfUrl(asset.url)) {
    return `
      <a class="${cssClass} tct-pdf-chip" href="${esc(asset.url)}" target="_blank" rel="noopener">
        <span class="tct-pdf-icon">PDF</span><span>${esc(asset.alt || 'Ouvrir le document')}</span>
      </a>`;
  }
  // La lightbox (zoom/déplacement) est réservée aux visuels Plans & 3D
  // — c'est ce que l'audit de parité établit, pas les portraits
  // d'ambassadeurs/équipe. Activation explicite, jamais par défaut,
  // pour ne pas l'étendre silencieusement à un usage non demandé.
  return `<img class="${cssClass}${enableLightbox ? ' tct-lightbox-trigger' : ''}" src="${esc(asset.url)}" alt="${esc(asset.alt)}" loading="lazy"${enableLightbox ? ` data-lightbox-src="${esc(asset.url)}" data-lightbox-title="${esc(asset.alt)}"` : ''}>`;
}

function renderIntro(intro) {
  if (!intro) return '';
  return `
    <header class="tct-intro">
      ${intro.eyebrow ? `<div class="tct-eyebrow">${esc(intro.eyebrow)}</div>` : ''}
      ${intro.title ? `<h2>${esc(intro.title)}</h2>` : ''}
      ${intro.description ? `<p class="tct-desc">${esc(intro.description)}</p>` : ''}
    </header>`;
}

function renderHome(home) {
  if (!home) return '';
  const now = home.now ? `<div class="tct-stat"><strong>${esc(home.now.label)}</strong><span>${esc(home.now.value)}</span></div>` : '';
  const next = home.next ? `<div class="tct-stat"><strong>${esc(home.next.label)}</strong><span>${esc(home.next.date)}</span></div>` : '';
  const featured = home.featured
    ? `<div class="tct-featured"><span class="tct-eyebrow">À la une</span><h3>${esc(home.featured.title)}</h3><p>${esc(home.featured.summary)}</p></div>`
    : `<div class="tct-featured tct-empty">Rien à mettre en avant pour le moment.</div>`;
  return `
    <section id="home" class="tct-section tct-home">
      ${home.message ? `<p class="tct-message">${esc(home.message)}</p>` : ''}
      <div class="tct-stats">${now}${next}</div>
      ${featured}
      ${home.askPrompt ? `<p class="tct-ask">${esc(home.askPrompt)}</p>` : ''}
    </section>`;
}

function renderTimeline(timeline) {
  if (!timeline) return '';
  const items = (timeline.milestones || []).map(m => `
    <li class="tct-milestone tct-status-${esc(m.status)}">
      <span class="tct-milestone-date">${esc(m.date)}</span>
      <strong>${esc(m.label)}</strong>
      <p>${esc(m.description)}</p>
    </li>`).join('');
  const p = timeline.progress || {};
  return `
    <section id="timeline" class="tct-section">
      ${renderIntro(timeline.intro)}
      <div class="tct-progress">
        <div class="tct-progress-bar"><div style="width:${Number(p.percent) || 0}%"></div></div>
        <span>${esc(p.currentStepLabel)} — ${esc(p.percent)}%</span>
      </div>
      <ul class="tct-milestones">${items || '<li class="tct-empty">Aucun jalon publié pour le moment.</li>'}</ul>
    </section>`;
}

// ── Plans & 3D : filtres par tag + distinction image/PDF + lightbox ──
function renderSpaces(spaces) {
  if (!spaces) return '';
  const items = spaces.items || [];
  const tagSet = new Set();
  items.forEach(it => {
    if (it.type) tagSet.add(it.type);
    (it.tags || []).forEach(t => tagSet.add(t));
  });
  const allTags = [...tagSet].sort((a, b) => a.localeCompare(b, 'fr'));

  const filterBar = `
    <div class="tct-filters">
      <button class="tct-filter-pill is-active" data-filter="all">Tous</button>
      ${allTags.map(t => `<button class="tct-filter-pill" data-filter="${esc(t)}">${esc(t)}</button>`).join('')}
    </div>`;

  const cards = items.map(it => {
    const dataTags = [it.type, ...(it.tags || [])].filter(Boolean);
    return `
      <li class="tct-card" data-tags="${esc(JSON.stringify(dataTags))}">
        ${renderAsset(it.asset, 'tct-card-img', true)}
        <div class="tct-card-tag">${esc(it.type)}</div>
        <strong>${esc(it.title)}</strong>
        <p>${esc(it.comment)}</p>
      </li>`;
  }).join('');

  return `
    <section id="spaces" class="tct-section">
      ${renderIntro(spaces.intro)}
      ${items.length ? filterBar : ''}
      <ul class="tct-grid" id="tct-spaces-grid">${cards || '<li class="tct-empty">Aucun visuel publié pour le moment.</li>'}</ul>
    </section>`;
}

// ── Actualités : lecture complète (accordéon) ──
function renderNews(news) {
  if (!news) return '';
  const items = (news.items || []).map(a => `
    <li class="tct-card tct-article" data-article-id="${esc(a.id)}">
      <button class="tct-article-toggle" aria-expanded="false">
        <div>
          <div class="tct-card-tag">${esc(a.tag)} — ${esc(a.date)}</div>
          <strong>${esc(a.title)}</strong>
          <p>${esc(a.summary)}</p>
        </div>
        <span class="tct-chevron">↓</span>
      </button>
      <div class="tct-article-body" hidden>${articleBodyToHtml(a.body)}</div>
    </li>`).join('');
  return `
    <section id="news" class="tct-section">
      ${renderIntro(news.intro)}
      <ul class="tct-list">${items || '<li class="tct-empty">Aucune actualité publiée pour le moment.</li>'}</ul>
    </section>`;
}

// ── Questions : vrai moteur de recherche + escalade contact ──
function renderQuestions(questions) {
  if (!questions) return '';
  return `
    <section id="questions" class="tct-section">
      ${renderIntro(questions.intro)}
      <div class="tct-ask-box">
        <input type="text" id="tct-question-input" placeholder="Posez votre question…">
        <button id="tct-ask-btn">Rechercher</button>
      </div>
      <div id="tct-question-result" hidden></div>
      <div id="tct-question-notfound" hidden>
        <p>Nous n'avons pas trouvé de réponse précise à votre question.</p>
        <form id="tct-contact-form" class="tct-contact-form">
          <input type="text" name="name" placeholder="Votre nom" required>
          <input type="email" name="email" placeholder="Votre email" required>
          <textarea name="message" placeholder="Votre question" required></textarea>
          <button type="submit">Envoyer à l'équipe</button>
        </form>
        <p id="tct-contact-status" hidden></p>
      </div>
    </section>`;
}

function renderAmbassadors(ambassadors) {
  if (!ambassadors) return '';
  const roster = ambassadors.roster || [];
  const rosterLabelText = `${roster.length} ambassadeur${roster.length > 1 ? 's' : ''}` +
    (ambassadors.intro && ambassadors.intro.rosterLabel ? ` — ${ambassadors.intro.rosterLabel}` : '');
  const cards = roster.map(p => `
    <li class="tct-person">
      ${renderAsset(p.photo, 'tct-person-photo')}
      <strong>${esc(p.name)}</strong>
      <span>${esc(p.role)}</span>
      <em>${esc(p.tag)}</em>
    </li>`).join('');
  return `
    <section id="ambassadors" class="tct-section">
      <header class="tct-intro">
        ${ambassadors.intro && ambassadors.intro.title ? `<h2>${esc(ambassadors.intro.title)}</h2>` : ''}
        ${ambassadors.intro && ambassadors.intro.body ? `<p class="tct-desc">${esc(ambassadors.intro.body)}</p>` : ''}
      </header>
      <div class="tct-roster-label">${esc(rosterLabelText)}</div>
      <ul class="tct-grid tct-people">${cards || '<li class="tct-empty">Aucun ambassadeur publié pour le moment.</li>'}</ul>
      ${ambassadors.cta && (ambassadors.cta.title || ambassadors.cta.body) ? `
        <div class="tct-cta">
          ${ambassadors.cta.title ? `<strong>${esc(ambassadors.cta.title)}</strong>` : ''}
          ${ambassadors.cta.body ? `<p>${esc(ambassadors.cta.body)}</p>` : ''}
        </div>` : ''}
    </section>`;
}

// ── Équipe : séparation en deux groupes, port fidèle de la règle Pangea ──
// (index.html : `team.filter(t => t.badge !== 'Parella')` définit les
// deux groupes — ici `group` est le nom du champ dans le Manifest).
function renderTeam(team) {
  if (!team) return '';
  const members = team.members || [];
  const internal = members.filter(m => m.group !== 'Parella');
  const parella = members.filter(m => m.group === 'Parella');

  function personCard(m) {
    return `
      <li class="tct-person">
        ${renderAsset(m.photo, 'tct-person-photo')}
        <strong>${esc(m.name)}</strong>
        <span>${esc(m.title)}</span>
      </li>`;
  }

  return `
    <section id="team" class="tct-section">
      <ul class="tct-grid tct-people">${internal.map(personCard).join('') || '<li class="tct-empty">Aucun membre publié pour le moment.</li>'}</ul>
      ${parella.length ? `
        <div class="tct-team-parella">
          ${team.intro && team.intro.introBody ? `<p class="tct-desc">${esc(team.intro.introBody)}</p>` : ''}
          <ul class="tct-grid tct-people">${parella.map(personCard).join('')}</ul>
        </div>` : ''}
      ${team.cta && (team.cta.title || team.cta.body) ? `
        <div class="tct-cta">
          ${team.cta.title ? `<strong>${esc(team.cta.title)}</strong>` : ''}
          ${team.cta.body ? `<p>${esc(team.cta.body)}</p>` : ''}
        </div>` : ''}
    </section>`;
}

function renderNavigation(navigation) {
  const links = (navigation || []).map(n => `<a href="#${esc(n.module)}">${esc(n.label)}</a>`).join('');
  return `<nav class="tct-nav">${links}</nav>`;
}

const SECTION_RENDERERS = {
  home: renderHome,
  timeline: renderTimeline,
  spaces: renderSpaces,
  news: renderNews,
  questions: renderQuestions,
  ambassadors: renderAmbassadors,
  team: renderTeam
};
const SECTION_ORDER = ['home', 'timeline', 'questions', 'news', 'spaces', 'ambassadors', 'team'];

const STYLE = `
  body { margin:0; font-family:system-ui,-apple-system,sans-serif; background:#faf9f6; color:#1a1a1a; }
  .tct-header { padding:24px 32px; background:var(--tct-primary,#1E1D1E); color:#fff; display:flex; align-items:center; gap:14px; }
  .tct-header img { height:32px; width:auto; }
  .tct-header h1 { margin:0; font-size:1.3rem; font-weight:600; }
  .tct-nav { display:flex; gap:18px; padding:14px 32px; background:#fff; border-bottom:1px solid #eee; flex-wrap:wrap; }
  .tct-nav a { color:var(--tct-primary,#1E1D1E); text-decoration:none; font-size:.9rem; font-weight:500; }
  .tct-section { max-width:920px; margin:0 auto; padding:40px 24px; }
  .tct-eyebrow { text-transform:uppercase; letter-spacing:.08em; font-size:.7rem; color:var(--tct-secondary,#C2AF7E); font-weight:700; }
  .tct-desc { color:#555; line-height:1.6; }
  .tct-grid, .tct-list, .tct-milestones { list-style:none; padding:0; margin:20px 0 0; display:grid; gap:16px; }
  .tct-grid { grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); }
  .tct-card, .tct-milestone, .tct-person { background:#fff; border:1px solid #eee; border-radius:8px; padding:16px; }
  .tct-card-img, .tct-person-photo { width:100%; border-radius:6px; margin-bottom:10px; object-fit:cover; max-height:160px; cursor:zoom-in; }
  .tct-card-tag { font-size:.72rem; color:#888; text-transform:uppercase; margin-bottom:4px; }
  .tct-progress-bar { background:#eee; border-radius:99px; height:8px; overflow:hidden; margin:16px 0 6px; }
  .tct-progress-bar > div { background:var(--tct-secondary,#C2AF7E); height:100%; }
  .tct-empty { color:#999; font-style:italic; }
  .tct-stats { display:flex; gap:24px; margin:16px 0; }
  .tct-stat { display:flex; flex-direction:column; }
  .tct-stat strong { font-size:.72rem; text-transform:uppercase; color:#888; }
  .tct-featured { border:1px solid #eee; border-radius:8px; padding:16px; margin-top:16px; }
  .tct-filters { display:flex; gap:8px; flex-wrap:wrap; margin:16px 0 0; }
  .tct-filter-pill { border:1px solid #ddd; background:#fff; border-radius:99px; padding:4px 14px; font-size:.8rem; cursor:pointer; }
  .tct-filter-pill.is-active { background:var(--tct-primary,#1E1D1E); color:#fff; border-color:transparent; }
  .tct-pdf-chip { display:flex; align-items:center; gap:8px; padding:20px; background:#f2f2f2; border-radius:6px; margin-bottom:10px; text-decoration:none; color:#333; }
  .tct-pdf-icon { background:#c0392b; color:#fff; font-size:.65rem; font-weight:700; padding:2px 6px; border-radius:3px; }
  .tct-article-toggle { width:100%; text-align:left; background:none; border:none; padding:0; cursor:pointer; display:flex; justify-content:space-between; gap:12px; font:inherit; color:inherit; }
  .tct-article-body { margin-top:14px; padding-top:14px; border-top:1px solid #eee; color:#444; line-height:1.7; white-space:pre-line; }
  .tct-ask-box { display:flex; gap:8px; margin-top:20px; }
  .tct-ask-box input { flex:1; padding:10px 14px; border:1px solid #ddd; border-radius:6px; font-size:.9rem; }
  .tct-ask-box button, .tct-contact-form button { padding:10px 18px; border:none; border-radius:6px; background:var(--tct-primary,#1E1D1E); color:#fff; cursor:pointer; }
  #tct-question-result { margin-top:20px; padding:16px; border:1px solid #eee; border-radius:8px; background:#fff; }
  .tct-badge { font-size:.68rem; padding:2px 8px; border-radius:99px; background:#eee; margin-left:8px; }
  #tct-question-notfound { margin-top:20px; padding:16px; border:1px dashed #ddd; border-radius:8px; }
  .tct-contact-form { display:flex; flex-direction:column; gap:8px; margin-top:12px; max-width:420px; }
  .tct-contact-form input, .tct-contact-form textarea { padding:8px 12px; border:1px solid #ddd; border-radius:6px; font:inherit; }
  .tct-roster-label { color:#888; font-size:.85rem; margin-top:8px; }
  .tct-cta { margin-top:24px; padding:16px; background:#fff; border:1px solid #eee; border-radius:8px; }
  .tct-team-parella { margin-top:32px; padding-top:24px; border-top:1px solid #eee; }
  .tct-lightbox-overlay { position:fixed; inset:0; background:rgba(0,0,0,.9); display:flex; align-items:center; justify-content:center; z-index:999; }
  .tct-lightbox-stage { width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; cursor:grab; }
  .tct-lightbox-stage.is-dragging { cursor:grabbing; }
  .tct-lightbox-img { max-width:90vw; max-height:90vh; object-fit:contain; transition:transform .05s linear; user-select:none; -webkit-user-drag:none; }
  .tct-lightbox-close { position:fixed; top:20px; right:24px; background:rgba(255,255,255,.15); color:#fff; border:none; border-radius:50%; width:36px; height:36px; font-size:1rem; cursor:pointer; }
`;

function wireInteractions(root, manifest, actions) {
  // Filtres Plans & 3D
  root.querySelectorAll('.tct-filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.tct-filter-pill').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const filter = btn.dataset.filter;
      root.querySelectorAll('#tct-spaces-grid > li').forEach(card => {
        let cardTags = [];
        try { cardTags = JSON.parse(card.dataset.tags || '[]'); } catch (e) { cardTags = []; }
        card.style.display = (filter === 'all' || cardTags.includes(filter)) ? '' : 'none';
      });
    });
  });

  // Lecture complète d'un article
  root.querySelectorAll('.tct-article-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const body = btn.parentElement.querySelector('.tct-article-body');
      const isOpen = !body.hidden;
      body.hidden = isOpen;
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  // Lightbox avec zoom (molette) et déplacement (glisser-déposer) —
  // port du comportement utile de Pangea (zoom + pan), pas une simple
  // image agrandie. Les PDF s'ouvrent déjà dans un nouvel onglet via
  // leur lien direct, pas besoin de lightbox pour eux.
  root.querySelectorAll('.tct-lightbox-trigger').forEach(img => {
    img.addEventListener('click', () => {
      const overlay = document.createElement('div');
      overlay.className = 'tct-lightbox-overlay';
      overlay.innerHTML = `
        <div class="tct-lightbox-stage">
          <img class="tct-lightbox-img" src="${esc(img.dataset.lightboxSrc)}" alt="${esc(img.dataset.lightboxTitle)}">
        </div>
        <button type="button" class="tct-lightbox-close" aria-label="Fermer">✕</button>`;
      document.body.appendChild(overlay);

      const stage = overlay.querySelector('.tct-lightbox-stage');
      const lbImg = overlay.querySelector('.tct-lightbox-img');
      let scale = 1, tx = 0, ty = 0;
      let dragging = false, startX = 0, startY = 0, startTx = 0, startTy = 0;

      function applyTransform() {
        lbImg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      }

      // Zoom à la molette, borné à [1, 5] — 1 = taille d'origine,
      // jamais plus petit (pas d'intérêt à dézoomer sous l'original).
      stage.addEventListener('wheel', e => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        scale = Math.max(1, Math.min(5, scale + delta));
        if (scale === 1) { tx = 0; ty = 0; } // recentrer si on revient à l'échelle d'origine
        applyTransform();
      }, { passive: false });

      // Déplacement (glisser-déposer) — actif uniquement une fois zoomé,
      // comme dans le comportement Pangea d'origine.
      stage.addEventListener('mousedown', e => {
        if (scale <= 1) return;
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        startTx = tx; startTy = ty;
        stage.classList.add('is-dragging');
      });
      window.addEventListener('mousemove', e => {
        if (!dragging) return;
        tx = startTx + (e.clientX - startX);
        ty = startTy + (e.clientY - startY);
        applyTransform();
      });
      window.addEventListener('mouseup', () => {
        dragging = false;
        stage.classList.remove('is-dragging');
      });

      function close() { overlay.remove(); }
      overlay.querySelector('.tct-lightbox-close').addEventListener('click', close);
      // Un clic sur le fond (pas sur l'image elle-même, pour ne pas
      // fermer accidentellement pendant un glisser-déposer) ferme la lightbox.
      overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    });
  });

  // Moteur de recherche FAQ + escalade contact
  const input = root.querySelector('#tct-question-input');
  const askBtn = root.querySelector('#tct-ask-btn');
  const resultBox = root.querySelector('#tct-question-result');
  const notFoundBox = root.querySelector('#tct-question-notfound');
  if (input && askBtn && manifest.content.questions) {
    const items = manifest.content.questions.items || [];
    const ask = () => {
      const question = input.value.trim();
      if (!question) return;
      const match = matchFaq(question, items);
      if (match) {
        notFoundBox.hidden = true;
        resultBox.hidden = false;
        resultBox.innerHTML = `
          <strong>${esc(match.title)}</strong>
          <span class="tct-badge tct-status-${esc(match.status)}">${esc(match.statusLabel)}</span>
          <p>${esc(match.answer)}</p>`;
      } else {
        resultBox.hidden = true;
        notFoundBox.hidden = false;
      }
    };
    askBtn.addEventListener('click', ask);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ask(); } });
  }

  const contactForm = root.querySelector('#tct-contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async e => {
      e.preventDefault();
      const statusEl = root.querySelector('#tct-contact-status');
      const name = contactForm.querySelector('[name="name"]').value.trim();
      const email = contactForm.querySelector('[name="email"]').value.trim();
      const message = contactForm.querySelector('[name="message"]').value.trim();
      // Le Renderer émet une INTENTION ; il ne sait rien de l'endpoint
      // ni du stockage — c'est le Public Core (runtime.js) qui l'exécute.
      const result = await actions.submitContact({ name, email, message });
      statusEl.hidden = false;
      statusEl.textContent = result.ok
        ? 'Votre message a bien été envoyé à l\'équipe.'
        : (result.error || 'Envoi impossible.');
      if (result.ok) contactForm.reset();
    });
  }
}

export function render(manifest, root, actions) {
  const branding = manifest.branding || {};
  const logoHtml = branding.logo && branding.logo.url
    ? `<img src="${esc(branding.logo.url)}" alt="${esc(branding.logo.alt)}">`
    : '';
  root.innerHTML = `
    <style>${STYLE}</style>
    <div style="--tct-primary:${esc(branding.colors && branding.colors.primary)};--tct-secondary:${esc(branding.colors && branding.colors.secondary)};">
      <header class="tct-header">
        ${logoHtml}
        <h1>${esc(manifest.project && manifest.project.name)}</h1>
      </header>
      ${renderNavigation(manifest.navigation)}
      <main>
        ${SECTION_ORDER
          .filter(key => manifest.content && manifest.content[key])
          .map(key => SECTION_RENDERERS[key](manifest.content[key]))
          .join('')}
      </main>
    </div>`;
  wireInteractions(root, manifest, actions || { submitContact: async () => ({ ok: false, error: 'Indisponible.' }) });
}
