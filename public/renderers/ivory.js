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


// Ivory v2 — Foundation helpers. The Manifest remains semantic: all
// visual decisions (grid, rhythm, motion) stay inside this renderer.
function safeCssColor(value, fallback) {
  const v = String(value || '').trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) ? v : fallback;
}

function safeCssFont(value, fallback) {
  const v = String(value || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  return v || fallback;
}

function currentMilestone(timeline) {
  return (timeline && timeline.milestones || []).find(m => m.status === 'current') || null;
}

function nextMilestone(timeline) {
  return (timeline && timeline.milestones || []).find(m => m.status === 'future') || null;
}

function findNewsItem(news, id) {
  if (!id) return null;
  return (news && news.items || []).find(item => String(item.id) === String(id)) || null;
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

function renderHome(home, context = {}) {
  if (!home) return '';

  const timeline = context.timeline || null;
  const news = context.news || null;
  const current = currentMilestone(timeline);
  const upcoming = nextMilestone(timeline);
  const featuredSource = home.featured && home.featured.source && home.featured.source.module === 'news'
    ? findNewsItem(news, home.featured.source.id)
    : null;
  const latest = (news && news.items || []).find(item =>
    !home.featured || !home.featured.source || String(item.id) !== String(home.featured.source.id)
  ) || null;

  // Schema v1 does not yet expose a dedicated editorial home headline.
  // `home.message` wins when present; the short fallback is deliberately
  // neutral and lives only in the renderer until the future Studio model
  // gives the editor an explicit field.
  const headline = (home.message && String(home.message).trim()) || 'Le projet prend forme.';
  const presentText = current && current.description
    ? current.description
    : (current && current.label) || (home.now && home.now.value) || '';
  const nextDate = (upcoming && upcoming.date) || (home.next && home.next.date) || '';
  const nextTitle = (upcoming && upcoming.label) || (home.next && home.next.label) || '';
  const nextDescription = (upcoming && upcoming.description) || '';

  const featured = home.featured ? `
    <section class="tct-home-featured tct-reveal" data-tct-reveal aria-labelledby="tct-featured-title">
      <div class="tct-home-featured-meta">
        <span>${esc((featuredSource && featuredSource.tag) || 'À découvrir')}</span>
        ${featuredSource && featuredSource.date ? `<span>${esc(featuredSource.date)}</span>` : ''}
      </div>
      <div class="tct-home-featured-copy">
        <h2 id="tct-featured-title">${esc(home.featured.title)}</h2>
        ${home.featured.summary ? `<p>${esc(home.featured.summary)}</p>` : ''}
        <a class="tct-text-link" href="#${esc(home.featured.source && home.featured.source.module || 'news')}" data-tct-route>
          Découvrir <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>` : '';

  const latestNews = latest ? `
    <section class="tct-home-latest tct-reveal" data-tct-reveal aria-labelledby="tct-latest-title">
      <div class="tct-kicker">Dernières nouvelles</div>
      <div class="tct-home-latest-copy">
        <div class="tct-home-latest-meta">${esc([latest.tag, latest.date].filter(Boolean).join(' · '))}</div>
        <h2 id="tct-latest-title">${esc(latest.title)}</h2>
        ${latest.summary ? `<p>${esc(latest.summary)}</p>` : ''}
        <a class="tct-text-link" href="#news" data-tct-route>Lire l’actualité <span aria-hidden="true">→</span></a>
      </div>
    </section>` : '';

  const nextBlock = (nextDate || nextTitle) ? `
    <section class="tct-home-next tct-reveal" data-tct-reveal aria-labelledby="tct-next-title">
      <div class="tct-kicker">Prochaine étape</div>
      <div class="tct-home-next-date">${esc(nextDate)}</div>
      <div class="tct-home-next-copy">
        ${nextTitle ? `<h2 id="tct-next-title">${esc(nextTitle)}</h2>` : ''}
        ${nextDescription ? `<p>${esc(nextDescription)}</p>` : ''}
        ${timeline ? `<a class="tct-text-link" href="#timeline" data-tct-route>Voir les grandes étapes <span aria-hidden="true">→</span></a>` : ''}
      </div>
    </section>` : '';

  return `
    <section id="home" class="tct-section tct-home is-active" aria-labelledby="tct-home-title">
      <div class="tct-home-hero">
        <div class="tct-kicker tct-reveal" data-tct-reveal>En ce moment</div>
        <h1 id="tct-home-title" class="tct-home-title tct-reveal" data-tct-reveal>${esc(headline)}</h1>
        ${presentText ? `<p class="tct-home-lede tct-reveal" data-tct-reveal>${esc(presentText)}</p>` : ''}
      </div>
      ${nextBlock}
      ${featured}
      ${latestNews}
      <section class="tct-home-questions tct-reveal" data-tct-reveal aria-labelledby="tct-home-questions-title">
        <div class="tct-home-questions-copy">
          <h2 id="tct-home-questions-title">${esc(home.askPrompt || 'Une question en tête ?')}</h2>
          <p>Retrouvez les informations disponibles sur le projet.</p>
        </div>
        <a class="tct-home-questions-link" href="#questions" data-tct-route>
          Poser une question <span aria-hidden="true">→</span>
        </a>
      </section>
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
  return `<nav class="tct-nav" id="tct-main-nav" aria-label="Navigation principale">${links}</nav>`;
}

function renderFooter() {
  return `
    <footer class="tct-footer">
      <div class="tct-footer-inner">
        <span class="tct-footer-note">Espace projet</span>
        <span class="tct-footer-signature">Powered by <strong>Storm</strong> · Tectonic 2.1</span>
      </div>
    </footer>`;
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
  :root { color-scheme:light; }
  * { box-sizing:border-box; }
  html { scroll-behavior:smooth; background:#f5f1e8; }
  body {
    margin:0;
    background:var(--tct-canvas,#f5f1e8);
    color:var(--tct-ink,#1e1d1e);
    font-family:var(--tct-font-primary,'Roboto'), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing:antialiased;
    text-rendering:optimizeLegibility;
  }
  body.tct-nav-open { overflow:hidden; }
  a, button, input, textarea { font:inherit; }
  a { color:inherit; }
  button { color:inherit; }
  ::selection { background:var(--tct-accent-soft,#e8deca); color:var(--tct-ink,#1e1d1e); }
  :focus-visible { outline:2px solid var(--tct-primary,#1e1d1e); outline-offset:4px; border-radius:2px; }

  .tct-site {
    --tct-canvas:#f5f1e8;
    --tct-paper:#fbf9f4;
    --tct-ink:#1e1d1e;
    --tct-muted:#6d6963;
    --tct-hairline:rgba(30,29,30,.14);
    --tct-hairline-soft:rgba(30,29,30,.08);
    --tct-accent-soft:#e8deca;
    min-height:100vh;
    background:var(--tct-canvas);
  }

  /* Foundation — header / navigation */
  .tct-header {
    position:sticky;
    top:0;
    z-index:80;
    min-height:88px;
    display:flex;
    align-items:center;
    border-bottom:1px solid transparent;
    background:rgba(245,241,232,.82);
    backdrop-filter:blur(22px) saturate(130%);
    -webkit-backdrop-filter:blur(22px) saturate(130%);
    transition:min-height .35s cubic-bezier(.2,.7,.2,1), border-color .35s ease, background .35s ease;
  }
  .tct-header.is-compact {
    min-height:68px;
    border-color:var(--tct-hairline-soft);
    background:rgba(245,241,232,.94);
  }
  .tct-header-inner {
    width:min(1360px, calc(100% - 64px));
    margin:0 auto;
    display:grid;
    grid-template-columns:minmax(180px,1fr) auto auto;
    align-items:center;
    gap:30px;
  }
  .tct-brand {
    min-width:0;
    display:inline-flex;
    align-items:center;
    gap:12px;
    width:max-content;
    max-width:100%;
    color:var(--tct-ink);
    text-decoration:none;
  }
  .tct-brand img { width:auto; height:30px; max-width:130px; object-fit:contain; }
  .tct-brand-name {
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
    font-size:.88rem;
    font-weight:500;
    letter-spacing:-.01em;
  }
  .tct-nav { display:flex; align-items:center; gap:clamp(18px,2vw,30px); }
  .tct-nav a {
    position:relative;
    padding:8px 0;
    color:var(--tct-muted);
    text-decoration:none;
    font-size:.79rem;
    font-weight:500;
    white-space:nowrap;
    transition:color .2s ease;
  }
  .tct-nav a::after {
    content:'';
    position:absolute;
    left:0; right:0; bottom:2px;
    height:1px;
    background:var(--tct-primary);
    transform:scaleX(0);
    transform-origin:right;
    transition:transform .28s cubic-bezier(.2,.7,.2,1);
  }
  .tct-nav a:hover, .tct-nav a[aria-current="page"] { color:var(--tct-ink); }
  .tct-nav a[aria-current="page"]::after, .tct-nav a:hover::after { transform:scaleX(1); transform-origin:left; }
  .tct-admin-entry {
    display:inline-flex;
    align-items:center;
    gap:7px;
    min-height:36px;
    padding:0 12px;
    border:1px solid var(--tct-hairline);
    border-radius:999px;
    color:var(--tct-muted);
    text-decoration:none;
    font-size:.72rem;
    font-weight:500;
    white-space:nowrap;
    transition:background .2s ease, color .2s ease, border-color .2s ease;
  }
  .tct-admin-entry:hover { color:var(--tct-ink); background:rgba(255,255,255,.42); border-color:rgba(30,29,30,.24); }
  .tct-admin-entry svg { width:13px; height:13px; flex:0 0 auto; }
  .tct-menu-toggle {
    display:none;
    width:38px;
    height:38px;
    border:1px solid var(--tct-hairline);
    border-radius:999px;
    background:transparent;
    cursor:pointer;
    align-items:center;
    justify-content:center;
  }
  .tct-menu-toggle span, .tct-menu-toggle::before, .tct-menu-toggle::after {
    content:'';
    display:block;
    width:14px;
    height:1px;
    background:currentColor;
    transition:transform .22s ease, opacity .22s ease;
  }
  .tct-menu-toggle span { margin:3px 0; }
  .tct-menu-toggle[aria-expanded="true"]::before { transform:translateY(4px) rotate(45deg); }
  .tct-menu-toggle[aria-expanded="true"] span { opacity:0; }
  .tct-menu-toggle[aria-expanded="true"]::after { transform:translateY(-4px) rotate(-45deg); }

  /* Page switching: Foundation v2 removes the legacy one-pager feeling
     while keeping the existing hash targets and Manifest untouched. */
  .tct-main > .tct-section { display:none; }
  .tct-main > .tct-section.is-active { display:block; }
  .tct-section { width:min(1360px, calc(100% - 64px)); margin:0 auto; padding:clamp(72px,8vw,128px) 0; }
  .tct-kicker, .tct-eyebrow {
    margin:0;
    color:var(--tct-muted);
    text-transform:uppercase;
    letter-spacing:.16em;
    font-size:.64rem;
    font-weight:600;
  }
  .tct-text-link {
    display:inline-flex;
    align-items:center;
    gap:8px;
    margin-top:26px;
    color:var(--tct-ink);
    text-decoration:none;
    font-size:.82rem;
    font-weight:500;
  }
  .tct-text-link span { transition:transform .22s ease; }
  .tct-text-link:hover span { transform:translateX(3px); }

  /* Home — photo of the present */
  .tct-home { padding-top:clamp(74px,10vw,160px); padding-bottom:0; }
  .tct-home-hero {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    min-height:min(690px,72vh);
    align-content:start;
  }
  .tct-home-hero > .tct-kicker { grid-column:1 / span 3; padding-top:10px; }
  .tct-home-title {
    grid-column:1 / span 8;
    margin:clamp(24px,3.5vw,52px) 0 0;
    max-width:10.5ch;
    font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif;
    font-size:clamp(3.7rem,7.6vw,7.8rem);
    line-height:.92;
    font-weight:400;
    letter-spacing:-.045em;
    text-wrap:balance;
  }
  .tct-home-lede {
    grid-column:8 / span 4;
    align-self:end;
    margin:0 0 clamp(70px,8vw,116px);
    max-width:34rem;
    color:var(--tct-muted);
    font-size:clamp(1rem,1.25vw,1.18rem);
    line-height:1.65;
  }
  .tct-home-next {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:start;
    padding:clamp(54px,7vw,96px) 0 clamp(72px,9vw,132px);
    border-top:1px solid var(--tct-hairline);
  }
  .tct-home-next > .tct-kicker { grid-column:1 / span 2; padding-top:8px; }
  .tct-home-next-date {
    grid-column:4 / span 3;
    font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif;
    font-size:clamp(2.5rem,4.6vw,5.2rem);
    line-height:.98;
    letter-spacing:-.035em;
  }
  .tct-home-next-copy { grid-column:8 / span 4; }
  .tct-home-next-copy h2 {
    margin:0;
    font-size:clamp(1.25rem,1.8vw,1.8rem);
    font-weight:500;
    line-height:1.2;
    letter-spacing:-.025em;
  }
  .tct-home-next-copy p { margin:16px 0 0; color:var(--tct-muted); line-height:1.65; font-size:.94rem; }

  .tct-home-featured {
    position:relative;
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    padding:clamp(78px,10vw,150px) clamp(28px,5vw,72px);
    margin-inline:calc(clamp(0px,2vw,24px) * -1);
    background:var(--tct-paper);
    overflow:hidden;
  }
  .tct-home-featured::before {
    content:'';
    position:absolute;
    width:min(40vw,520px);
    aspect-ratio:1;
    right:-14%; top:-48%;
    border-radius:50%;
    background:var(--tct-secondary);
    opacity:.09;
    filter:blur(1px);
    pointer-events:none;
  }
  .tct-home-featured-meta {
    grid-column:1 / span 3;
    display:flex;
    flex-direction:column;
    gap:8px;
    color:var(--tct-muted);
    text-transform:uppercase;
    letter-spacing:.13em;
    font-size:.61rem;
    font-weight:600;
  }
  .tct-home-featured-copy { grid-column:5 / span 7; position:relative; }
  .tct-home-featured h2 {
    margin:0;
    max-width:13ch;
    font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif;
    font-size:clamp(2.8rem,5.7vw,6rem);
    line-height:.96;
    font-weight:400;
    letter-spacing:-.04em;
    text-wrap:balance;
  }
  .tct-home-featured p { max-width:40rem; margin:28px 0 0; color:var(--tct-muted); font-size:1rem; line-height:1.7; }

  .tct-home-latest {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    padding:clamp(84px,10vw,148px) 0;
    border-bottom:1px solid var(--tct-hairline);
  }
  .tct-home-latest > .tct-kicker { grid-column:1 / span 3; padding-top:7px; }
  .tct-home-latest-copy { grid-column:6 / span 6; }
  .tct-home-latest-meta { margin-bottom:16px; color:var(--tct-muted); font-size:.68rem; letter-spacing:.08em; text-transform:uppercase; }
  .tct-home-latest h2 { margin:0; font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif; font-size:clamp(2.1rem,4vw,4.1rem); line-height:1.02; font-weight:400; letter-spacing:-.035em; }
  .tct-home-latest p { max-width:38rem; margin:22px 0 0; color:var(--tct-muted); line-height:1.7; }

  .tct-home-questions {
    display:grid;
    grid-template-columns:repeat(12,minmax(0,1fr));
    column-gap:clamp(18px,2vw,32px);
    align-items:end;
    margin-top:clamp(86px,11vw,164px);
    padding:clamp(70px,8vw,112px) clamp(28px,5vw,72px);
    background:var(--tct-ink);
    color:var(--tct-canvas);
  }
  .tct-home-questions-copy { grid-column:1 / span 7; }
  .tct-home-questions h2 { margin:0; max-width:10ch; font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif; font-size:clamp(3rem,5.8vw,6.2rem); line-height:.96; font-weight:400; letter-spacing:-.04em; }
  .tct-home-questions p { margin:24px 0 0; color:rgba(245,241,232,.66); font-size:1rem; }
  .tct-home-questions-link {
    grid-column:9 / span 4;
    display:inline-flex;
    justify-content:space-between;
    align-items:center;
    gap:20px;
    padding:20px 0;
    border-top:1px solid rgba(245,241,232,.32);
    border-bottom:1px solid rgba(245,241,232,.32);
    color:inherit;
    text-decoration:none;
    font-size:.88rem;
  }
  .tct-home-questions-link span { transition:transform .22s ease; }
  .tct-home-questions-link:hover span { transform:translateX(4px); }

  /* Transitional styles for existing sections. Their full Experience v2
     direction is intentionally deferred to the next UI batches. */
  .tct-intro { max-width:760px; margin-bottom:44px; }
  .tct-intro h2 { margin:14px 0 0; font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif; font-size:clamp(2.7rem,5vw,5.2rem); line-height:1; font-weight:400; letter-spacing:-.035em; }
  .tct-desc { max-width:620px; margin:22px 0 0; color:var(--tct-muted); line-height:1.7; }
  .tct-grid, .tct-list, .tct-milestones { list-style:none; padding:0; margin:28px 0 0; display:grid; gap:16px; }
  .tct-grid { grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); }
  .tct-card, .tct-milestone, .tct-person { background:var(--tct-paper); border:1px solid var(--tct-hairline-soft); padding:20px; }
  .tct-card-img, .tct-person-photo { width:100%; margin-bottom:14px; object-fit:cover; max-height:220px; cursor:zoom-in; }
  .tct-card-tag { margin-bottom:6px; color:var(--tct-muted); text-transform:uppercase; letter-spacing:.09em; font-size:.66rem; }
  .tct-progress-bar { height:4px; overflow:hidden; margin:18px 0 8px; background:rgba(30,29,30,.09); }
  .tct-progress-bar > div { height:100%; background:var(--tct-secondary); }
  .tct-empty { color:var(--tct-muted); font-style:italic; }
  .tct-filters { display:flex; flex-wrap:wrap; gap:8px; margin:18px 0 0; }
  .tct-filter-pill { padding:7px 13px; border:1px solid var(--tct-hairline); border-radius:999px; background:transparent; cursor:pointer; font-size:.74rem; }
  .tct-filter-pill.is-active { background:var(--tct-ink); border-color:var(--tct-ink); color:var(--tct-canvas); }
  .tct-pdf-chip { display:flex; align-items:center; gap:8px; padding:20px; margin-bottom:10px; background:rgba(255,255,255,.42); text-decoration:none; }
  .tct-pdf-icon { padding:2px 6px; background:#9d312b; color:#fff; font-size:.62rem; font-weight:700; }
  .tct-article-toggle { width:100%; display:flex; justify-content:space-between; gap:20px; padding:0; border:0; background:none; cursor:pointer; text-align:left; color:inherit; }
  .tct-article-body { margin-top:18px; padding-top:18px; border-top:1px solid var(--tct-hairline-soft); color:var(--tct-muted); line-height:1.75; white-space:pre-line; }
  .tct-ask-box { display:flex; gap:8px; margin-top:24px; }
  .tct-ask-box input { flex:1; min-height:48px; padding:0 15px; border:1px solid var(--tct-hairline); background:rgba(255,255,255,.46); border-radius:0; font-size:.9rem; }
  .tct-ask-box button, .tct-contact-form button { min-height:48px; padding:0 20px; border:1px solid var(--tct-ink); background:var(--tct-ink); color:var(--tct-canvas); cursor:pointer; }
  #tct-question-result, #tct-question-notfound { margin-top:24px; padding:22px 0; border-top:1px solid var(--tct-hairline); }
  .tct-badge { margin-left:8px; padding:3px 7px; background:rgba(30,29,30,.07); font-size:.65rem; }
  .tct-contact-form { max-width:480px; display:flex; flex-direction:column; gap:9px; margin-top:16px; }
  .tct-contact-form input, .tct-contact-form textarea { padding:11px 13px; border:1px solid var(--tct-hairline); background:rgba(255,255,255,.46); border-radius:0; }
  .tct-roster-label { margin-top:8px; color:var(--tct-muted); font-size:.82rem; }
  .tct-cta { margin-top:30px; padding:22px 0; border-top:1px solid var(--tct-hairline); }
  .tct-team-parella { margin-top:42px; padding-top:28px; border-top:1px solid var(--tct-hairline); }

  /* Lightbox remains functional and intentionally neutral. */
  .tct-lightbox-overlay { position:fixed; inset:0; z-index:999; display:flex; align-items:center; justify-content:center; background:rgba(18,18,17,.94); }
  .tct-lightbox-stage { width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; cursor:grab; }
  .tct-lightbox-stage.is-dragging { cursor:grabbing; }
  .tct-lightbox-img { max-width:90vw; max-height:90vh; object-fit:contain; transition:transform .05s linear; user-select:none; -webkit-user-drag:none; }
  .tct-lightbox-close { position:fixed; top:20px; right:24px; width:40px; height:40px; border:1px solid rgba(255,255,255,.26); border-radius:999px; background:rgba(255,255,255,.08); color:#fff; cursor:pointer; }

  /* Footer */
  .tct-footer { padding:30px 0 34px; background:var(--tct-ink); color:rgba(245,241,232,.48); }
  .tct-footer-inner { width:min(1360px, calc(100% - 64px)); margin:0 auto; display:flex; justify-content:space-between; gap:24px; font-size:.64rem; letter-spacing:.045em; }
  .tct-footer-signature strong { color:rgba(245,241,232,.72); font-weight:500; }

  /* Ivory motion: one language, no decorative choreography. */
  .tct-reveal { opacity:0; transform:translateY(14px); transition:opacity .7s ease, transform .85s cubic-bezier(.2,.7,.2,1); }
  .tct-reveal.is-visible { opacity:1; transform:none; }

  @media (max-width:980px) {
    .tct-header-inner { width:min(100% - 40px,1360px); grid-template-columns:1fr auto auto; gap:12px; }
    .tct-menu-toggle { display:inline-flex; }
    .tct-nav {
      position:fixed;
      inset:68px 0 auto 0;
      display:flex;
      flex-direction:column;
      align-items:flex-start;
      gap:2px;
      padding:28px 20px 34px;
      border-bottom:1px solid var(--tct-hairline);
      background:rgba(245,241,232,.98);
      transform:translateY(-120%);
      opacity:0;
      pointer-events:none;
      transition:transform .32s cubic-bezier(.2,.7,.2,1), opacity .2s ease;
    }
    .tct-nav.is-open { transform:none; opacity:1; pointer-events:auto; }
    .tct-nav a { width:100%; padding:13px 0; font-family:var(--tct-font-secondary,'Italiana'), Georgia, serif; font-size:1.7rem; font-weight:400; color:var(--tct-ink); }
    .tct-nav a::after { display:none; }
    .tct-section, .tct-footer-inner { width:calc(100% - 40px); }
    .tct-home-hero { min-height:auto; padding-bottom:92px; }
    .tct-home-hero > .tct-kicker, .tct-home-title, .tct-home-lede { grid-column:1 / -1; }
    .tct-home-title { max-width:11ch; }
    .tct-home-lede { max-width:600px; margin:46px 0 0; }
    .tct-home-next > .tct-kicker { grid-column:1 / span 3; }
    .tct-home-next-date { grid-column:4 / span 4; }
    .tct-home-next-copy { grid-column:8 / -1; }
    .tct-home-featured-meta { grid-column:1 / span 3; }
    .tct-home-featured-copy { grid-column:4 / -1; }
    .tct-home-latest > .tct-kicker { grid-column:1 / span 3; }
    .tct-home-latest-copy { grid-column:4 / -1; }
    .tct-home-questions-copy { grid-column:1 / span 8; }
    .tct-home-questions-link { grid-column:9 / -1; }
  }

  @media (max-width:680px) {
    .tct-header { min-height:70px; }
    .tct-header.is-compact { min-height:62px; }
    .tct-header-inner { width:calc(100% - 28px); }
    .tct-brand img { max-width:92px; height:26px; }
    .tct-brand-name { font-size:.78rem; max-width:150px; }
    .tct-admin-entry { width:36px; padding:0; justify-content:center; }
    .tct-admin-entry span { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
    .tct-nav { inset:62px 0 auto 0; }
    .tct-section, .tct-footer-inner { width:calc(100% - 28px); }
    .tct-home { padding-top:68px; }
    .tct-home-hero { display:block; padding-bottom:78px; }
    .tct-home-title { margin-top:22px; font-size:clamp(3.15rem,16.3vw,5.2rem); }
    .tct-home-lede { margin-top:38px; font-size:.98rem; }
    .tct-home-next, .tct-home-featured, .tct-home-latest, .tct-home-questions { display:block; }
    .tct-home-next { padding:50px 0 74px; }
    .tct-home-next-date { margin-top:32px; font-size:3.7rem; }
    .tct-home-next-copy { margin-top:30px; }
    .tct-home-featured { margin-inline:-14px; padding:70px 28px 76px; }
    .tct-home-featured-meta { margin-bottom:54px; }
    .tct-home-featured h2 { font-size:clamp(2.8rem,13.5vw,4.5rem); }
    .tct-home-latest { padding:78px 0; }
    .tct-home-latest-copy { margin-top:42px; }
    .tct-home-questions { margin-top:82px; margin-inline:-14px; padding:68px 28px 72px; }
    .tct-home-questions h2 { font-size:clamp(3rem,14vw,4.6rem); }
    .tct-home-questions-link { margin-top:56px; width:100%; }
    .tct-ask-box { flex-direction:column; }
    .tct-footer-inner { flex-direction:column; gap:10px; }
  }

  @media (prefers-reduced-motion:reduce) {
    html { scroll-behavior:auto; }
    *, *::before, *::after { animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; scroll-behavior:auto !important; }
    .tct-reveal { opacity:1; transform:none; }
  }
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


function wireFoundation(root, manifest) {
  const doc = root.ownerDocument;
  const win = doc && doc.defaultView;
  if (!doc || !win) return;

  const header = root.querySelector('#tct-site-header');
  const nav = root.querySelector('#tct-main-nav');
  const menuToggle = root.querySelector('#tct-menu-toggle');
  const pages = [...root.querySelectorAll('.tct-main > .tct-section')];

  function closeMenu() {
    if (!nav || !menuToggle) return;
    nav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    doc.body.classList.remove('tct-nav-open');
  }

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const willOpen = menuToggle.getAttribute('aria-expanded') !== 'true';
      menuToggle.setAttribute('aria-expanded', String(willOpen));
      nav.classList.toggle('is-open', willOpen);
      doc.body.classList.toggle('tct-nav-open', willOpen);
    });
  }

  const revealWithin = page => {
    const els = [...page.querySelectorAll('[data-tct-reveal]')];
    if (!els.length) return;
    if (!('IntersectionObserver' in win)) {
      els.forEach(el => el.classList.add('is-visible'));
      return;
    }
    const observer = new win.IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(el => observer.observe(el));
  };

  function activatePage(hash, scroll = true) {
    const requested = String(hash || '#home').replace(/^#/, '') || 'home';
    const target = root.querySelector(`#${requested}`) || root.querySelector('#home') || pages[0];
    if (!target) return;

    pages.forEach(page => page.classList.toggle('is-active', page === target));
    root.querySelectorAll('.tct-nav a').forEach(link => {
      const isCurrent = link.getAttribute('href') === `#${target.id}`;
      if (isCurrent) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    closeMenu();
    revealWithin(target);

    if (scroll) {
      try { win.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* jsdom */ }
    }
  }

  root.querySelectorAll('a[data-tct-route], .tct-nav a, .tct-brand').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (!href.startsWith('#')) return;
    link.addEventListener('click', e => {
      e.preventDefault();
      const hash = href || '#home';
      if (win.location.hash === hash) activatePage(hash, true);
      else win.location.hash = hash;
    });
  });

  win.addEventListener('hashchange', () => activatePage(win.location.hash || '#home', true));
  activatePage(win.location.hash || '#home', false);

  if (header) {
    const updateHeader = () => header.classList.toggle('is-compact', (win.scrollY || 0) > 24);
    updateHeader();
    win.addEventListener('scroll', updateHeader, { passive: true });
  }
}

export function render(manifest, root, actions) {
  const branding = manifest.branding || {};
  const colors = branding.colors || {};
  const fonts = branding.fonts || {};
  const primary = safeCssColor(colors.primary, '#1E1D1E');
  const secondary = safeCssColor(colors.secondary, '#C2AF7E');
  const fontPrimary = safeCssFont(fonts.primary && fonts.primary.family, 'Roboto');
  const fontSecondary = safeCssFont(fonts.secondary && fonts.secondary.family, 'Italiana');
  const projectName = esc(manifest.project && manifest.project.name);
  const logoHtml = branding.logo && branding.logo.url
    ? `<img src="${esc(branding.logo.url)}" alt="${esc(branding.logo.alt)}">`
    : '';

  const sections = SECTION_ORDER
    .filter(key => manifest.content && manifest.content[key])
    .map(key => {
      if (key === 'home') {
        return renderHome(manifest.content.home, {
          timeline: manifest.content.timeline,
          news: manifest.content.news
        });
      }
      return SECTION_RENDERERS[key](manifest.content[key]);
    })
    .join('');

  root.innerHTML = `
    <style>${STYLE}</style>
    <div class="tct-site" style="--tct-primary:${primary};--tct-secondary:${secondary};--tct-font-primary:'${fontPrimary}';--tct-font-secondary:'${fontSecondary}';">
      <header class="tct-header" id="tct-site-header">
        <div class="tct-header-inner">
          <a class="tct-brand" href="#home" aria-label="Accueil — ${projectName}">
            ${logoHtml}
            <span class="tct-brand-name">${projectName}</span>
          </a>
          <button type="button" class="tct-menu-toggle" id="tct-menu-toggle" aria-expanded="false" aria-controls="tct-main-nav" aria-label="Ouvrir la navigation"><span></span></button>
          ${renderNavigation(manifest.navigation)}
          <a class="tct-admin-entry" href="/?pangea=1&admin=1" aria-label="Administration">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>
            <span>Administration</span>
          </a>
        </div>
      </header>
      <main class="tct-main">${sections}</main>
      ${renderFooter()}
    </div>`;

  if (root.ownerDocument) root.ownerDocument.title = manifest.project && manifest.project.name ? manifest.project.name : 'Projet';
  wireInteractions(root, manifest, actions || { submitContact: async () => ({ ok: false, error: 'Indisponible.' }) });
  wireFoundation(root, manifest);
}
