// ─────────────────────────────────────────────────────────────────
// TECTONIC STUDIO — tectonic/studio.js
//
// JavaScript du Studio V2, déplacé tel quel depuis index.html vers ce
// shell dédié (tectonic/studio.html). Aucune logique interne
// réorganisée pendant ce déplacement — chaque fonction est verbatim,
// dans son ordre d'origine.
//
// Deux catégories de contenu dans ce fichier :
//   1. Helpers partagés, DUPLIQUÉS depuis index.html (Pangea en a
//      aussi besoin pour son propre chargement public — voir le
//      commentaire "PARTAGÉ" sur chaque bloc). Dupliqués plutôt
//      qu'extraits dans un troisième fichier commun, pour ne courir
//      aucun risque de rupture de comportement sur l'un ou l'autre
//      côté — même philosophie que la duplication verbatim du CSS.
//   2. Fonctions et état propres au Studio, déplacés intégralement
//      (plus aucune trace dans index.html).
//
// Deux adaptations, strictement nécessaires à la scission physique en
// deux documents distincts, pas des refactors opportunistes :
//   - adminLogoutBtn : l'appel à goToFaqPage() (qui basculait des
//     classes CSS dans le même document) est remplacé par une vraie
//     navigation vers /?pangea=1, puisqu'il n'y a plus de page locale
//     à activer dans ce fichier ;
//   - un petit script de démarrage est ajouté en fin de fichier pour
//     que /admin ouvre directement le Studio (ou la modale de
//     connexion) au chargement — équivalent exact de ce que
//     provoquait un clic sur adminLinkBtn depuis Pangea.
// ─────────────────────────────────────────────────────────────────

  // ═══ Helpers partagés avec Pangea (dupliqués verbatim) ═══
  function getClientSessionId() {
    let sessionId = localStorage.getItem(CLIENT_SESSION_KEY);
    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(CLIENT_SESSION_KEY, sessionId);
    }
    return sessionId;
  }
  function getAdminToken() { return sessionStorage.getItem(ADMIN_TOKEN_KEY) || ''; }
  function setAdminToken(token) { sessionStorage.setItem(ADMIN_TOKEN_KEY, token); }
  function clearAdminToken() { sessionStorage.removeItem(ADMIN_TOKEN_KEY); }
  function studioNormalizeSiteStructure(raw, team) {
    const configured = raw && typeof raw === 'object' && !Array.isArray(raw);
    const teamDefault = Array.isArray(team) && team.length > 0;
    return {
      home: true,
      timeline: configured ? raw.timeline !== false : true,
      news: configured ? raw.news !== false : true,
      spaces: configured ? raw.spaces !== false : true,
      questions: configured ? raw.questions !== false : true,
      ambassadors: configured ? raw.ambassadors !== false : true,
      team: configured ? raw.team !== false : teamDefault
    };
  }
  async function loadContent() {
    try {
      const res = await fetch('/api/content', { headers: { 'x-admin-token': getAdminToken() } });
      if (!res.ok) throw new Error('API contenu indisponible');
      const data = await res.json();
      return {
        branding: data.branding && typeof data.branding === 'object' ? data.branding : { projectName: 'Projet XYZ', logoUrl: '', theme: 'default' },
        siteStructure: studioNormalizeSiteStructure(data.siteStructure, data.team),
        project: data.project && typeof data.project === 'object' ? data.project : studioDefaultProjectSeed(),
        publicContent: data.publicContent && typeof data.publicContent === 'object' ? data.publicContent : {},
        faqEntries: Array.isArray(data.faqEntries) ? data.faqEntries : [],
        faqDrafts: Array.isArray(data.faqDrafts) ? data.faqDrafts : [],
        progress: data.progress && typeof data.progress === 'object' ? data.progress : { stepLine1: '', stepLine2: '', percent: 0 },
        milestones: Array.isArray(data.milestones) ? data.milestones : [],
        articles: Array.isArray(data.articles) ? data.articles : [],
        ambassadorsContent: data.ambassadorsContent && typeof data.ambassadorsContent === 'object' ? data.ambassadorsContent : {},
        ambassadors: Array.isArray(data.ambassadors) ? data.ambassadors : [],
        teamContent: data.teamContent && typeof data.teamContent === 'object' ? data.teamContent : {},
        team: Array.isArray(data.team) ? data.team : [],
        spaces: Array.isArray(data.spaces) ? data.spaces : [],
        spacesInitialized: data.spacesInitialized === true,
        plans: Array.isArray(data.plans) ? data.plans : []
      };
    } catch (e) {
      console.warn('Impossible de charger le contenu serveur :', e);
      return {
        branding: { projectName: 'Projet XYZ', logoUrl: '', theme: 'default' }, siteStructure: studioNormalizeSiteStructure(null, []), project: studioDefaultProjectSeed(), publicContent: {}, faqEntries: [], faqDrafts: [],
        progress: { stepLine1: '', stepLine2: '', percent: 0 }, milestones: [], articles: [],
        ambassadorsContent: {}, ambassadors: [], teamContent: {}, team: [], spaces: [], spacesInitialized: false, plans: []
      };
    }
  }
  function resizeImageIfNeeded(file, maxDim = 640) {
    return new Promise(resolve => {
      if (!file.type || !file.type.startsWith('image/')) { resolve(file); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const { naturalWidth: width, naturalHeight: height } = img;
        if (!width || !height || Math.max(width, height) <= maxDim) { resolve(file); return; }
        const scale = maxDim / Math.max(width, height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob(blob => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: outType }));
        }, outType, 0.9);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  function uploadFile(file, resizeMaxDim) {
    return new Promise(async resolve => {
      const resized = resizeMaxDim ? await resizeImageIfNeeded(file, resizeMaxDim) : file;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataBase64 = String(reader.result).split(',')[1] || '';
          const ext = String(resized.name || '').split('.').pop().toLowerCase();
          const inferredMime = ({ woff2:'font/woff2', woff:'font/woff', ttf:'font/ttf', otf:'font/otf' })[ext] || '';
          const mimeType = resized.type || inferredMime;
          const res = await fetch('/api/admin/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
            body: JSON.stringify({ filename: resized.name, mimeType, dataBase64 })
          });
          if (res.status === 401) { resolve({ ok: false, unauthorized: true }); return; }
          const data = await res.json().catch(() => ({}));
          if (!res.ok) { resolve({ ok: false, error: data.error }); return; }
          resolve({ ok: true, url: data.url });
        } catch (e) {
          console.warn('Upload impossible :', e);
          resolve({ ok: false });
        }
      };
      reader.onerror = () => resolve({ ok: false });
      reader.readAsDataURL(resized);
    });
  }
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function isPdfUrl(url) { return /\.pdf($|\?)/i.test(url || ''); }
  function applyPublicContent(publicContent) {
    const scopes = {
      faq:          { root: '#page-faq' },
      actu:         { root: '#page-actu' },
      plans:        { root: '#page-plans' },
      ambassadeurs: { root: '#page-ambassadeurs' },
      equipe:       { root: '#page-equipe' }
    };
    Object.entries(scopes).forEach(([scope, { root }]) => {
      const payload = publicContent?.[scope];
      if (!payload) return;
      const page = document.querySelector(root);
      if (!page) return;
      const eyebrowEl = page.querySelector('.hero .eyebrow');
      const titleEl   = page.querySelector('.hero .hero-title');
      const descEl    = page.querySelector('.hero .hero-desc');
      if (eyebrowEl && typeof payload.eyebrow === 'string') eyebrowEl.textContent = payload.eyebrow;
      if (descEl && typeof payload.desc === 'string') descEl.textContent = payload.desc;
      if (titleEl && (typeof payload.titleLine1 === 'string' || typeof payload.titleAccent === 'string')) {
        titleEl.innerHTML = `${escapeHtml(payload.titleLine1 || '')}<br><span class="accent">${escapeHtml(payload.titleAccent || '')}</span>`;
      }
    });
  }
  function applyTheme(theme) {
    const normalizedTheme = theme === 'rainbow-glass'
      ? 'rainbow-glass'
      : (theme === 'midnight-frost' ? 'midnight-frost' : 'default');
    document.body.classList.toggle('theme-rainbow-glass', normalizedTheme === 'rainbow-glass');
    document.body.classList.toggle('theme-midnight-frost', normalizedTheme === 'midnight-frost');
    document.body.dataset.publicTheme = normalizedTheme;
    document.dispatchEvent(new CustomEvent('storm-theme-change', {
      detail: { theme: normalizedTheme }
    }));

    requestAnimationFrame(() => {
      const activeTab = document.querySelector('.nav-tab.active');
      if (activeTab) positionIndicator(activeTab);
    });
  }
  function applyBranding(branding) {
    if (!branding) return;
    applyTheme(branding.theme);
    const nameEl = document.querySelector('.nav-brand-name');
    if (nameEl && branding.projectName) nameEl.textContent = branding.projectName;
    if (branding.projectName) document.title = `${branding.projectName} — Espace collaborateurs`;

    const footerBrand = document.getElementById('footerBrandLine');
    if (footerBrand && branding.projectName) {
      footerBrand.textContent = `${branding.projectName} · Espace collaborateurs — Document interne, réservé aux équipes`;
    }

    const markEl = document.querySelector('.nav-mark');
    if (markEl) {
      if (branding.logoUrl) {
        markEl.classList.add('has-logo');
        markEl.innerHTML = `<img src="${escapeHtml(branding.logoUrl)}" alt="Logo">`;
      } else {
        markEl.classList.remove('has-logo');
        markEl.innerHTML = '';
      }
    }
  }
  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }
  function positionIndicator(tab) {
    const navRect = navInnerEl.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    navIndicator.style.left  = (tabRect.left - navRect.left) + 'px';
    navIndicator.style.width = tabRect.width + 'px';
  }
  function computeProgressFromMilestones(milestones) {
    const items = milestones || [];
    const total = items.length;
    if (!total) return { stepLine1: 'Étape 0', stepLine2: 'sur 0', percent: 0 };
    const doneCount = items.filter(m => m.status === 'done').length;
    const currentIndex = items.findIndex(m => m.status === 'current');
    const stepNumber = currentIndex >= 0 ? currentIndex + 1 : Math.min(doneCount + 1, total);
    const percent = Math.round(((doneCount + (currentIndex >= 0 ? 0.5 : 0)) / total) * 100);
    return {
      stepLine1: `Étape ${stepNumber}`,
      stepLine2: `sur ${total}`,
      percent: Math.max(0, Math.min(100, percent))
    };
  }
  function studioDefaultProjectSeed() {
    return {
      intro: {
        title: 'Un nouveau lieu de travail, pensé pour nos usages.',
        body: "Le projet accompagne le regroupement des équipes dans un environnement en flex office. Les futurs espaces sont conçus pour offrir davantage de choix au fil de la journée : se concentrer, échanger, collaborer, se réunir ou faire une pause, selon l’activité du moment."
      },
      sections: [
        { id:'project-focus-usages', type:'focus', enabled:true, title:'Pourquoi faire évoluer nos espaces ?', body:"Nos façons de travailler ont changé : davantage de travail hybride, plus de projets transverses et des besoins très différents au cours d’une même journée. Le projet vise à mieux faire correspondre les espaces à ces usages, plutôt qu’à reproduire partout le même poste de travail." },
        { id:'project-key-figures', type:'keyFigures', enabled:true, title:'Quelques repères', items:[
          { value:'8/10', label:'postes de travail pour 10 collaborateurs' },
          { value:'6', label:'grandes typologies d’espaces' },
          { value:'1', label:'casier individuel par collaborateur' },
          { value:'2026', label:'année d’installation cible' }
        ] },
        { id:'project-text-daily-life', type:'text', enabled:true, title:'Ce qui changera au quotidien.', body:"Dans les zones en flex office, les postes ne seront plus attribués individuellement. Chacun pourra choisir son environnement en fonction de son activité : poste standard, espace calme, cabine pour un appel, salle de réunion ou zone collaborative. Des casiers personnels et des repères simples accompagneront cette nouvelle organisation." },
        { id:'project-image', type:'image', enabled:false, asset:null, caption:'' },
        { id:'project-gallery', type:'gallery', enabled:false, title:'Se projeter dans les futurs espaces', items:[] },
        { id:'project-timeline', type:'timeline', enabled:true },
        { id:'project-quote', type:'quote', enabled:true, quote:"Le flex office n’est pas une fin en soi : l’enjeu est que chacun trouve plus facilement l’espace adapté à ce qu’il a besoin de faire.", attribution:'Équipe projet' },
        { id:'project-choices', type:'choices', enabled:true, title:'Ce qui guide les choix', items:[
          { title:'Donner du choix', body:'Proposer plusieurs environnements plutôt qu’un poste unique pour toutes les activités.' },
          { title:'Préserver la concentration', body:'Identifier clairement les zones calmes et multiplier les solutions pour les appels et les tâches de focus.' },
          { title:'Faciliter les échanges', body:'Créer davantage de lieux pour collaborer, se réunir et partager de manière informelle.' },
          { title:'Rester ajustable', body:'Observer les usages après l’installation et faire évoluer les espaces lorsque cela est utile.' }
        ] },
        { id:'project-team', type:'team', enabled:true }
      ]
    };
  }

  // ═══ Constantes nécessaires aux helpers partagés ci-dessus ═══
  const ADMIN_TOKEN_KEY = 'xyz_admin_token';
  const MILESTONE_STATUS_MAP = {
    done:    { cls: 'status-confirmed', label: 'Terminé' },
    current: { cls: 'status-pending',   label: 'En cours' },
    future:  { cls: 'status-neutral',   label: 'À venir' }
  };
  // faqData démarre vide ici : contrairement à Pangea (qui a un repli
  // legacy de 34 questions codées en dur, hors périmètre de ce
  // déplacement), le Studio écrase toujours cette valeur avec les
  // vraies données serveur dès refreshAdminPage() — jamais affichée
  // ni utilisée avant cet instant.
  let faqData = [];

  let studioSaveDirty = false;
  let studioSaveMode = 'saved';
  let studioAutosaveTimer = null;
  let studioSaveObserver = null;
  let studioSaveObserverFrame = 0;

  // ═══ Studio — fonctions et état propres, déplacés intégralement ═══
  const KPI_DEFAULT_STATE = { faqAsked: [], tabViews: {}, articleOpens: {}, contactSubmissions: [], visitSessions: [], moodEntries: [] };
  async function loadKpi() {
    try {
      const res = await fetch('/api/kpi', { headers: { 'x-admin-token': getAdminToken() } });
      if (res.status === 401) return { unauthorized: true };
      if (!res.ok) throw new Error('API KPI indisponible');
      const data = await res.json();
      return {
        faqAsked: Array.isArray(data.faqAsked) ? data.faqAsked : [],
        tabViews: data.tabViews && typeof data.tabViews === 'object' ? data.tabViews : {},
        articleOpens: data.articleOpens && typeof data.articleOpens === 'object' ? data.articleOpens : {},
        contactSubmissions: Array.isArray(data.contactSubmissions) ? data.contactSubmissions : [],
        visitSessions: Array.isArray(data.visitSessions) ? data.visitSessions : [],
        moodEntries: Array.isArray(data.moodEntries) ? data.moodEntries : []
      };
    } catch (e) {
      console.warn('Impossible de charger les KPI côté serveur :', e);
      return JSON.parse(JSON.stringify(KPI_DEFAULT_STATE));
    }
  }
  async function resetKpi() {
    const res = await fetch('/api/kpi/reset', { method: 'POST', headers: { 'x-admin-token': getAdminToken() } });
    return res.ok;
  }
  function buildSavePayload(content) {
    return {
      branding: content.branding,
      siteStructure: studioNormalizeSiteStructure(content.siteStructure, content.team),
      project: content.project,
      publicContent: content.publicContent,
      faqEntries: faqData,
      faqDrafts: content.faqDrafts,
      progress: content.progress,
      milestones: content.milestones,
      articles: content.articles,
      ambassadorsContent: content.ambassadorsContent,
      ambassadors: content.ambassadors,
      teamContent: content.teamContent,
      team: content.team,
      spaces: content.spaces,
      plans: content.plans
    };
  }
  async function saveContent(contentState) {
    const saveSource = document.body.dataset.studioSaveSource || 'manual';
    delete document.body.dataset.studioSaveSource;
    // STUDIO V2 — 8D.2 / STRUCTURE PERSISTENCE HARDENING
    // Dernière frontière avant POST : aucune sauvegarde Studio ne peut
    // effacer la structure par omission d'un payload historique.
    const liveStructure = contentState?.siteStructure || currentAdminContent?.siteStructure;
    const liveTeam = contentState?.team || currentAdminContent?.team || [];
    const stateToSave = liveStructure
      ? { ...contentState, siteStructure: studioNormalizeSiteStructure(liveStructure, liveTeam) }
      : contentState;
    studioSetSaveState('saving');
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
        body: JSON.stringify(stateToSave)
      });
      if (res.status === 401) { studioSetSaveState('error'); return { ok:false, unauthorized:true, saveSource }; }
      if (!res.ok) { studioSetSaveState('error'); return { ok:false, saveSource }; }
      const data = await res.json();
      studioSetSaveState('saved');
      setTimeout(() => refreshStudioPublicationStatus(), 0);
      return { ok:true, content:data.content, saveSource };
    } catch (e) {
      console.warn('Sauvegarde impossible :', e);
      studioSetSaveState('error');
      return { ok:false, saveSource };
    }
  }
  const adminModal         = document.getElementById('adminModal');
  const adminPasswordInput = document.getElementById('adminPasswordInput');
  const adminModalError    = document.getElementById('adminModalError');
  const adminModalSubmit   = document.getElementById('adminModalSubmit');
  const adminModalCancel   = document.getElementById('adminModalCancel');
  const studioPreviewBtn   = document.getElementById('studioPreviewBtn');
  const studioPublishBtn   = document.getElementById('studioPublishBtn');
  const adminLogoutBtn     = document.getElementById('adminLogoutBtn');
  const adminResetBtn      = document.getElementById('adminResetBtn');
  let currentAdminContent = { publicContent: {}, faqEntries: [] };
  let currentStudioKpi = null;
  let currentPublicationStatus = null;
  const STUDIO_SAVE_BUTTONS = {
    identity:'saveIdentityBtn',
    structure:'studioStructureSave',
    project:'studioProjectSave',
    news:'studioNewsSave',
    spaces:'studioSpacesSave',
    questions:'studioQuestionsSave',
    ambassadors:'studioAmbSave'
  };
  function studioCurrentSaveButton() {
    const route = document.body.dataset.studioRoute || '';
    const id = STUDIO_SAVE_BUTTONS[route];
    return id ? document.getElementById(id) : null;
  }
  function studioScheduleAutosave() {
    clearTimeout(studioAutosaveTimer);
    const route = document.body.dataset.studioRoute || '';
    if (!STUDIO_SAVE_BUTTONS[route]) return;
    studioAutosaveTimer = setTimeout(() => studioRunSave('auto'), 900);
  }
  function studioRunSave(source = 'manual') {
    clearTimeout(studioAutosaveTimer);
    const button = studioCurrentSaveButton();
    if (!button || button.disabled || studioSaveMode === 'saving') return false;
    document.body.dataset.studioSaveSource = source;
    button.click();
    // If validation prevents the actual save request, never leak the source
    // into the next manual save. saveContent consumes it immediately otherwise.
    setTimeout(() => {
      if (document.body.dataset.studioSaveSource === source) delete document.body.dataset.studioSaveSource;
    }, 1200);
    return true;
  }
  function studioSetSaveState(mode) {
    const el = document.getElementById('studioSaveState');
    studioSaveMode = mode;
    studioSaveDirty = mode !== 'saved';
    if (el) {
      el.classList.toggle('is-dirty', mode === 'dirty');
      el.classList.toggle('is-saving', mode === 'saving');
      el.classList.toggle('is-error', mode === 'error');
      el.classList.toggle('is-saved', mode === 'saved');
      el.textContent = mode === 'saving' ? 'Enregistrement…'
        : mode === 'error' ? 'Enregistrement impossible'
        : mode === 'dirty' ? 'Modifications en cours'
        : 'Tout est enregistré';
    }
    if (mode === 'dirty') studioScheduleAutosave();
    if (currentPublicationStatus) renderPublicationStatus(currentPublicationStatus);
  }
  function studioBindContextSaveDock() {
    if (studioSaveObserver) { studioSaveObserver.disconnect(); studioSaveObserver = null; }
    const dock = document.getElementById('studioContextSaveDock');
    const dockBtn = document.getElementById('studioContextSaveBtn');
    const dockLabel = document.getElementById('studioContextSaveLabel');
    const heroButton = studioCurrentSaveButton();
    const route = document.body.dataset.studioRoute || '';
    if (!dock || !dockBtn || !heroButton || !STUDIO_SAVE_BUTTONS[route]) {
      dock?.classList.remove('is-visible');
      dock?.setAttribute('aria-hidden','true');
      return;
    }
    const label = document.querySelector(`.admin-nav-item[data-studio-route="${route}"]`)?.dataset.studioLabel || 'Rubrique';
    if (dockLabel) dockLabel.textContent = label;
    dockBtn.onclick = () => studioRunSave('manual');
    const root = document.querySelector('.admin-main');
    studioSaveObserver = new IntersectionObserver(entries => {
      const visible = !entries[0]?.isIntersecting;
      dock.classList.toggle('is-visible', visible);
      dock.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }, { root, threshold:.2, rootMargin:'-74px 0px 0px 0px' });
    studioSaveObserver.observe(heroButton);
  }
  function studioQueueContextSaveDockBind() {
    cancelAnimationFrame(studioSaveObserverFrame);
    studioSaveObserverFrame = requestAnimationFrame(() => studioBindContextSaveDock());
  }
  async function loadPublicationStatus() {
    try {
      const res = await fetch('/api/admin/publication-status', {
        headers: { 'x-admin-token': getAdminToken() }
      });
      if (res.status === 401) return { ok:false, unauthorized:true };
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return { ok:false, error:data.error || 'État indisponible' };
      return data;
    } catch (error) {
      console.warn('État de publication indisponible :', error);
      return { ok:false, error:'État indisponible' };
    }
  }
  function publicationUiModel(status) {
    if (!status || status.ok === false || status.unauthorized) {
      return { cls:'is-blocked', short:'État indisponible', title:'Publication à vérifier', body:'Storm ne peut pas vérifier la version actuellement publiée.', canPublish:false };
    }
    if (!status.publishable) {
      return { cls:'is-blocked', short:'Publication impossible', title:'Publication impossible', body:status.blockingError || 'Une information doit être corrigée avant publication.', canPublish:false };
    }
    if (status.hasUnpublishedChanges) {
      return { cls:'has-changes', short:'Modifications non publiées', title:'Des modifications sont prêtes', body:'La version enregistrée diffère de celle actuellement visible par les collaborateurs.', canPublish:true };
    }
    return { cls:'is-current', short:'Tout est publié', title:'Le site est à jour', body:'La version enregistrée correspond à celle visible par les collaborateurs.', canPublish:false };
  }
  function renderPublicationStatus(status) {
    currentPublicationStatus = status;
    const ui = publicationUiModel(status);
    const state = document.getElementById('studioPublicationState');
    if (state) {
      state.className = `studio-publication-state ${ui.cls}`;
      state.textContent = ui.short;
      state.title = status?.blockingError || '';
    }
    if (studioPublishBtn) {
      studioPublishBtn.disabled = !ui.canPublish || studioSaveDirty;
      studioPublishBtn.title = studioSaveDirty
        ? 'Enregistrez d’abord vos modifications'
        : (ui.canPublish ? 'Publier les modifications enregistrées' : ui.short);
    }
    const overview = document.getElementById('studioOverviewPublication');
    if (overview) {
      overview.innerHTML = `
        <div class="studio-overview-publication ${ui.cls}">
          <span class="studio-overview-publication-dot"></span>
          <div>
            <strong>${escapeHtml(ui.title)}</strong>
            <p>${escapeHtml(ui.body)}</p>
          </div>
        </div>`;
    }
  }
  function renderStudioOverview(kpi, content, status) {
    const target = document.getElementById('studioResumeList');
    if (!target) return;
    const gaps = (kpi?.faqAsked || []).filter(entry => !entry.matched);
    const drafts = content?.faqDrafts || [];
    const articles = content?.articles || [];
    const plans = content?.plans || [];
    const ambassadors = content?.ambassadors || [];
    const rows = [];

    if (drafts.length) rows.push({ route:'questions', title:`${drafts.length} question${drafts.length>1?'s':''} à vérifier`, meta:'Des questions importées attendent d’être vérifiées avant d’être ajoutées.', action:'Questions →' });
    if (gaps.length) rows.push({ route:'questions', title:`${gaps.length} recherche${gaps.length>1?'s':''} sans réponse`, meta:'Des collaborateurs ont cherché une information qui n’est pas encore couverte.', action:'Voir →' });
    if (!articles.length) rows.push({ route:'news', title:'Aucune actualité publiée', meta:'Ajoutez une première publication lorsque le projet a quelque chose à raconter.', action:'Actualités →' });
    if (!plans.length) rows.push({ route:'spaces', title:'Aucun espace documenté', meta:'Ajoutez les premiers visuels lorsque les éléments de conception sont disponibles.', action:'Espaces →' });
    if (!ambassadors.length) rows.push({ route:'ambassadors', title:'Aucun ambassadeur renseigné', meta:'La communauté peut rester vide tant qu’elle n’est pas constituée.', action:'Ambassadeurs →' });

    if (!rows.length) {
      rows.push({ route:'project', title:'Rien ne demande une action immédiate', meta:'Vous pouvez poursuivre la mise à jour du projet quand une nouvelle information arrive.', action:'Le projet →' });
    }

    target.innerHTML = rows.slice(0,4).map(row => `
      <button type="button" class="studio-resume-row" data-studio-go="${row.route}">
        <span><strong>${escapeHtml(row.title)}</strong><span>${escapeHtml(row.meta)}</span></span>
        <em>${escapeHtml(row.action)}</em>
      </button>`).join('');
    renderPublicationStatus(status);
  }
  async function refreshStudioPublicationStatus() {
    const status = await loadPublicationStatus();
    if (status?.unauthorized) {
      clearAdminToken();
      openAdminModal();
      return status;
    }
    renderPublicationStatus(status);
    return status;
  }
  async function refreshAdminPage() {
    const [kpi, content, publicationStatus] = await Promise.all([loadKpi(), loadContent(), loadPublicationStatus()]);
    if (kpi?.unauthorized || publicationStatus?.unauthorized) {
      showToast('Votre session a expiré. Reconnectez-vous.');
      clearAdminToken();
      openAdminModal();
      return;
    }
    currentAdminContent = content;
    currentStudioKpi = kpi;
    currentPublicationStatus = publicationStatus;
    if (content.faqEntries.length) faqData = content.faqEntries;
    const adminProjectName = document.getElementById('adminProjectName');
    if (adminProjectName) adminProjectName.textContent = content.branding?.projectName || 'Projet';
    renderKpiDashboard(kpi, content);
    renderContentEditor(content);
    renderStructureEditor(content);
    renderProjectEditor(content);
    renderNewsEditor(content);
    renderTeamEditor(content);
    renderVisualsEditor(content);
    renderFaqEditor(content);
    studioSetSaveState('saved');
    renderStudioOverview(kpi, content, publicationStatus);
    applyStudioRoute(document.body.dataset.studioRoute || 'overview', { scroll:false });
    studioQueueContextSaveDockBind();
  }
  function openAdminPage() {
    document.body.classList.add('storm-admin-open');
    document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById('page-admin').classList.add('active');
    document.body.dataset.studioRoute = 'overview';
    navIndicator.style.width = '0px';
    window.scrollTo({ top:0, behavior:'auto' });
    document.querySelector('.admin-main')?.scrollTo({ top:0, behavior:'auto' });
    refreshAdminPage();
  }
  function openAdminModal() {
    adminModalError.style.display = 'none';
    adminPasswordInput.value = '';
    adminModal.classList.add('open');
    setTimeout(() => adminPasswordInput.focus(), 50);
  }
  function closeAdminModal() { adminModal.classList.remove('open'); }

  async function checkAdminPassword() {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPasswordInput.value })
      });
      const data = await res.json();
      if (res.ok && data.ok && data.token) {
        setAdminToken(data.token);
        closeAdminModal();
        openAdminPage();
      } else {
        adminModalError.style.display = 'block';
      }
    } catch (e) {
      adminModalError.style.display = 'block';
    }
  }
  adminModalSubmit.addEventListener('click', checkAdminPassword);
  adminPasswordInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); checkAdminPassword(); } });
  adminModalCancel.addEventListener('click', closeAdminModal);
  adminModal.addEventListener('click', e => { if (e.target === adminModal) closeAdminModal(); });
  studioPreviewBtn?.addEventListener('click', () => {
    window.open('/?tectonic=1', '_blank', 'noopener');
  });
  document.getElementById('stormDiscoverTectonicBtn')?.addEventListener('click', () => {
    window.open('/storm', '_blank', 'noopener');
  });
  adminLogoutBtn.addEventListener('click', () => {
    clearAdminToken();
    window.location.href = '/'; // accueil public Ivory — jamais Pangea, jamais un login resté affiché dans Studio
    showToast('Déconnecté.');
  });
  adminResetBtn.addEventListener('click', async () => {
    if (!confirm('Réinitialiser toutes les données KPI (pour tous les collaborateurs) ? Cette action est irréversible.')) return;
    const ok = await resetKpi();
    if (!ok) {
      showToast('Votre session a expiré. Reconnectez-vous.');
      clearAdminToken();
      openAdminModal();
      return;
    }
    refreshAdminPage();
    showToast('Données réinitialisées.');
  });
  const adminExportBtn = document.getElementById('adminExportBtn');
  adminExportBtn.addEventListener('click', exportKpiToExcel);
  function applyStudioRoute(route, options) {
    const opts = options || {};
    const item = document.querySelector(`.admin-nav-item[data-studio-route="${route}"]`);
    if (!item) return;
    const panel = item.dataset.adminPanel;
    document.body.dataset.studioRoute = route;
    document.querySelectorAll('.admin-nav-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => {
      p.classList.add('hidden');
      p.classList.remove('studio-panel-enter');
    });
    item.classList.add('active');
    const targetPanel = document.getElementById('adminPanel' + panel.charAt(0).toUpperCase() + panel.slice(1));
    targetPanel?.classList.remove('hidden');
    if (targetPanel && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      void targetPanel.offsetWidth;
      targetPanel.classList.add('studio-panel-enter');
      window.setTimeout(() => targetPanel.classList.remove('studio-panel-enter'), 180);
    }
    const label = document.getElementById('adminCurrentPanelLabel');
    if (label) label.textContent = item.dataset.studioLabel || item.textContent.trim();
    studioQueueContextSaveDockBind();

    const planningTitle = document.getElementById('studioPlanningTitle');
    const planningSub = document.getElementById('studioPlanningSub');
    if (route === 'project') {
      if (planningTitle) planningTitle.textContent = 'Le projet.';
      if (planningSub) planningSub.textContent = 'Mettez à jour les grandes étapes. L’éditeur narratif complet arrivera dans le prochain lot métier.';
    } else if (route === 'news') {
      if (planningTitle) planningTitle.textContent = 'Actualités.';
      if (planningSub) planningSub.textContent = 'Publiez les informations qui font avancer la compréhension du projet.';
    }

    const peopleTitle = document.getElementById('studioPeopleTitle');
    const peopleSub = document.getElementById('studioPeopleSub');
    if (route === 'ambassadors') {
      if (peopleTitle) peopleTitle.textContent = 'Ambassadeurs.';
      if (peopleSub) peopleSub.textContent = 'Gérez les relais du projet et les informations qui permettent aux collaborateurs de les identifier.';
    }

    if (opts.scroll !== false) {
      const studioScroller = document.querySelector('.admin-main');
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      if (studioScroller) studioScroller.scrollTo({ top:0, behavior });
      else window.scrollTo({ top:0, behavior });
    }
  }

  document.getElementById('adminSidebarNav')?.addEventListener('click', e => {
    const item = e.target.closest('.admin-nav-item');
    if (!item) return;
    applyStudioRoute(item.dataset.studioRoute || 'overview');
  });

  document.addEventListener('keydown', e => {
    if (!document.body.classList.contains('storm-admin-open')) return;
    if (!(e.ctrlKey || e.metaKey) || String(e.key).toLowerCase() !== 's') return;
    const route = document.body.dataset.studioRoute || '';
    if (!STUDIO_SAVE_BUTTONS[route]) return;
    e.preventDefault();
    studioRunSave('manual');
  });

  document.getElementById('page-admin')?.addEventListener('click', e => {
    const shortcut = e.target.closest('[data-studio-go]');
    if (!shortcut) return;
    applyStudioRoute(shortcut.dataset.studioGo);
    if (shortcut.dataset.studioGo === 'news') {
      requestAnimationFrame(() => document.getElementById('studioNewArticleBtn')?.click());
    }
    if (shortcut.dataset.studioGo === 'questions') {
      requestAnimationFrame(() => document.getElementById('studioQuestionAdd')?.click());
    }
  });

  document.getElementById('page-admin')?.addEventListener('input', e => {
    if (e.target.closest('.admin-panel') && !e.target.closest('#adminPanelDashboard')) studioSetSaveState('dirty');
  }, true);
  document.getElementById('page-admin')?.addEventListener('change', e => {
    if (e.target.closest('.admin-panel') && !e.target.closest('#adminPanelDashboard')) studioSetSaveState('dirty');
  }, true);

  const studioAdminMainObserver = new MutationObserver(() => {
    if (!document.body.classList.contains('storm-admin-open')) return;
    studioQueueContextSaveDockBind();
  });
  const studioAdminMainNode = document.querySelector('.admin-main');
  if (studioAdminMainNode) studioAdminMainObserver.observe(studioAdminMainNode, { childList:true, subtree:true });

  studioPublishBtn?.addEventListener('click', async () => {
    if (studioSaveDirty) {
      showToast('Enregistrez d’abord vos modifications dans l’éditeur ouvert.');
      return;
    }
    if (studioPublishBtn.disabled) return;
    studioPublishBtn.classList.add('is-busy');
    studioPublishBtn.textContent = 'Publication…';
    studioPublishBtn.disabled = true;
    try {
      const res = await fetch('/api/admin/publish', {
        method:'POST',
        headers:{ 'x-admin-token': getAdminToken() }
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        showToast('Votre session a expiré. Reconnectez-vous.');
        clearAdminToken();
        openAdminModal();
        return;
      }
      if (!res.ok || !data.ok) {
        showToast(data.error || 'La publication a échoué.');
        return;
      }
      showToast('Les modifications sont publiées.');
      await refreshStudioPublicationStatus();
      renderStudioOverview(currentStudioKpi, currentAdminContent, currentPublicationStatus);
    } catch (error) {
      console.warn('Publication impossible :', error);
      showToast('La publication a échoué. Réessayez.');
    } finally {
      studioPublishBtn.classList.remove('is-busy');
      studioPublishBtn.textContent = 'Publier';
      renderPublicationStatus(currentPublicationStatus);
    }
  });

  const TAB_LABELS = { faq: 'Questions', actu: 'Actualités', plans: 'Espaces', ambassadeurs: 'Ambassadeurs', equipe: 'Le projet' };

  function fmtDate(ts) {
    return new Date(ts).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  }
  function renderBarList(container, entries, opts) {
    opts = opts || {};
    if (!entries.length) {
      container.innerHTML = `<div class="kpi-empty">${opts.emptyText || "Aucune donnée pour l'instant."}</div>`;
      return;
    }
    const max = Math.max(...entries.map(e => e.value), 1);
    container.innerHTML = entries.map(e => `
      <div class="kpi-bar-row">
        <div class="kpi-bar-label" title="${String(e.label).replace(/"/g,'&quot;')}">${e.label}</div>
        <div class="kpi-bar-track"><div class="kpi-bar-fill${opts.gap ? ' gap' : ''}" style="width:${(e.value/max*100)}%"></div></div>
        <div class="kpi-bar-value">${e.value}</div>
      </div>
    `).join('');
  }
  function renderKpiDashboard(kpi, content) {
    const faqAsked = Array.isArray(kpi?.faqAsked) ? kpi.faqAsked : [];
    const moodEntries = Array.isArray(kpi?.moodEntries) ? kpi.moodEntries : [];
    const contacts = Array.isArray(kpi?.contactSubmissions) ? kpi.contactSubmissions : [];
    const tabViews = kpi?.tabViews && typeof kpi.tabViews === 'object' ? kpi.tabViews : {};
    const articleOpens = kpi?.articleOpens && typeof kpi.articleOpens === 'object' ? kpi.articleOpens : {};
    const totalAsked = faqAsked.length;
    const totalFound = faqAsked.filter(item => item.matched).length;
    const foundRate = totalAsked ? Math.round((totalFound / totalAsked) * 100) : 0;
    const totalArticleOpens = Object.values(articleOpens).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const totalTabViews = Object.values(tabViews).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const totalVisits = new Set(kpi?.visitSessions || []).size;

    const card = (value, label, meta='') => `
      <div class="studio-signal-card">
        <strong>${escapeHtml(String(value))}</strong>
        <span>${escapeHtml(label)}</span>
        ${meta ? `<em>${escapeHtml(meta)}</em>` : '<span></span>'}
      </div>`;

    const usageCards = document.getElementById('kpiUsageCards');
    if (usageCards) usageCards.innerHTML = [
      card(totalVisits, 'Consultations uniques', 'depuis le début'),
      card(totalTabViews, 'Consultations de rubriques', 'navigation cumulée'),
      card(totalArticleOpens, "Ouvertures d’actualités", 'lecture de contenus')
    ].join('');

    const normalizedGapKey = value => String(value || '').trim().toLocaleLowerCase('fr-FR').replace(/[’']/g,"'").replace(/\s+/g,' ');
    const gapMap = new Map();
    faqAsked.filter(item => !item.matched && String(item.q || '').trim()).forEach(item => {
      const key = normalizedGapKey(item.q);
      const existing = gapMap.get(key) || { label:String(item.q).trim(), value:0, lastTs:0 };
      existing.value += 1;
      existing.lastTs = Math.max(existing.lastTs, Number(item.ts) || 0);
      gapMap.set(key, existing);
    });
    const groupedGaps = [...gapMap.values()].sort((a,b) => (b.value-a.value) || (b.lastTs-a.lastTs));

    const answerCards = document.getElementById('kpiAnswerCards');
    if (answerCards) answerCards.innerHTML = [
      card(totalAsked, 'Questions posées à Storm Match', 'signal de besoin'),
      card(`${foundRate}%`, 'Ont trouvé une réponse', totalAsked ? `${totalFound} sur ${totalAsked}` : 'pas encore de données'),
      card(groupedGaps.length, 'Informations à compléter', groupedGaps.length ? 'action éditoriale' : 'rien à traiter')
    ].join('');

    const faqLabels = {};
    (content?.faqEntries || []).forEach(entry => { if (entry?.id) faqLabels[entry.id] = entry.title || entry.question || entry.id; });
    const matchedCounts = {};
    faqAsked.filter(item => item.matched && item.entryId).forEach(item => {
      const id = String(item.entryId);
      matchedCounts[id] = (matchedCounts[id] || 0) + 1;
    });
    const topQuestions = Object.entries(matchedCounts)
      .map(([id,value]) => ({ label:faqLabels[id] || 'Réponse supprimée', value }))
      .sort((a,b) => b.value-a.value)
      .slice(0,8);
    renderBarList(document.getElementById('kpiTopQuestions'), topQuestions, { emptyText:'Aucun sujet suffisamment sollicité pour le moment.' });

    const gapsContainer = document.getElementById('kpiGaps');
    if (gapsContainer) {
      if (!groupedGaps.length) {
        gapsContainer.innerHTML = `<div class="kpi-empty">Storm Match n’a détecté aucune information manquante pour le moment.</div>`;
      } else {
        gapsContainer.innerHTML = groupedGaps.slice(0,10).map((gap,index) => `
          <div class="studio-signal-row">
            <div class="studio-signal-row-copy">
              <strong>« ${escapeHtml(gap.label)} »</strong>
              <span>${gap.value} recherche${gap.value>1?'s':''}${gap.lastTs ? ` · dernière ${escapeHtml(fmtDate(gap.lastTs))}` : ''}</span>
            </div>
            <button type="button" class="studio-signal-action" data-pilotage-create-answer="${index}">Créer une réponse →</button>
          </div>`).join('');
        gapsContainer.querySelectorAll('[data-pilotage-create-answer]').forEach(button => {
          button.addEventListener('click', () => {
            const gap = groupedGaps[Number(button.dataset.pilotageCreateAnswer)];
            if (!gap) return;
            applyStudioRoute('questions');
            requestAnimationFrame(() => {
              document.getElementById('studioQuestionAdd')?.click();
              setTimeout(() => {
                const input = document.getElementById('studioQuestionTitle');
                if (!input) return;
                input.value = gap.label;
                input.dispatchEvent(new Event('input', { bubbles:true }));
                input.focus();
                input.select();
              }, 30);
            });
          });
        });
      }
    }

    const tabEntries = Object.keys(TAB_LABELS).map(id => ({ label:TAB_LABELS[id], value:Number(tabViews[id]) || 0 }));
    renderBarList(document.getElementById('kpiTabs'), tabEntries.some(item => item.value>0) ? tabEntries : [], { emptyText:'Aucune navigation enregistrée pour le moment.' });

    const articleLabels = {};
    (content?.articles || []).forEach(article => { if (article?.id) articleLabels[article.id] = article.title || '(sans titre)'; });
    const articleIds = new Set([...Object.keys(articleLabels), ...Object.keys(articleOpens)]);
    const articleEntries = [...articleIds].map(id => ({ label:articleLabels[id] || 'Actualité supprimée', value:Number(articleOpens[id]) || 0 })).sort((a,b)=>b.value-a.value).slice(0,8);
    renderBarList(document.getElementById('kpiArticles'), articleEntries.some(item => item.value>0) ? articleEntries : [], { emptyText:'Aucune actualité ouverte pour le moment.' });

    const moodBars = entries => [1,2,3,4,5].map(value => ({ label:MOOD_LABELS[value], value:entries.filter(item => Number(item.value)===value).length }));
    renderBarList(document.getElementById('kpiMood'), moodEntries.length ? moodBars(moodEntries) : [], { emptyText:'Aucune contribution au baromètre pour le moment.' });
    const moodCount = document.getElementById('kpiMoodCount');
    if (moodCount) moodCount.textContent = `${moodEntries.length} contribution${moodEntries.length>1?'s':''}`;

    const sevenDaysAgo = Date.now() - 7*24*60*60*1000;
    const recentMood = moodEntries.filter(item => (Number(item.ts)||0) >= sevenDaysAgo);
    const recentCount = document.getElementById('kpiMoodRecentCount');
    if (recentCount) recentCount.textContent = `${recentMood.length} contribution${recentMood.length>1?'s':''}`;
    const moodRecent = document.getElementById('kpiMoodRecent');
    const moodPrivacy = document.getElementById('kpiMoodPrivacy');
    if (recentMood.length >= 5) {
      renderBarList(moodRecent, moodBars(recentMood), { emptyText:'' });
      if (moodPrivacy) moodPrivacy.textContent = 'Agrégation sur 7 jours. Aucun commentaire ni identifiant individuel n’est collecté.';
    } else {
      if (moodRecent) moodRecent.innerHTML = `<div class="kpi-empty">Pas assez de réponses récentes pour afficher une tendance.</div>`;
      if (moodPrivacy) moodPrivacy.textContent = 'Storm attend au moins 5 contributions avant d’afficher une distribution récente.';
    }

    const contactsSection = document.getElementById('kpiContactsSection');
    const contactsContainer = document.getElementById('kpiContacts');
    if (contactsSection) contactsSection.hidden = contacts.length === 0;
    if (contactsContainer && contacts.length) {
      contactsContainer.innerHTML = contacts.slice().reverse().map(contact => `
        <div class="kpi-contact-item">
          <div class="kpi-contact-head"><span class="kpi-contact-name">${escapeHtml(contact.name || 'Anonyme')}</span><span class="kpi-contact-date">${escapeHtml(fmtDate(contact.ts))}</span></div>
          <div class="kpi-contact-email">${escapeHtml(contact.email || '')}</div>
          <div class="kpi-contact-msg">${escapeHtml(contact.message || '')}</div>
        </div>`).join('');
    }
  }
  function handleSaveResult(result, successMessage) {
    const isAuto = result?.saveSource === 'auto';
    if (result.ok) {
      studioSetSaveState('saved');
      refreshStudioPublicationStatus().then(status => {
        renderStudioOverview(currentStudioKpi, currentAdminContent, status);
      });
      if (!isAuto) showToast(successMessage);
      return true;
    }
    if (result.unauthorized) {
      showToast('Votre session a expiré. Reconnectez-vous.');
      clearAdminToken();
      openAdminModal();
    } else if (!isAuto) {
      showToast("Impossible d’enregistrer pour le moment. Réessayez.");
    }
    return false;
  }

  const PUBLIC_SCOPE_LABELS = { faq: 'FAQ', actu: 'Actualités', plans: 'Plans & 3D', ambassadeurs: 'Ambassadeurs', equipe: 'Équipe projet' };
  function renderContentEditor(content) {
    const container = document.getElementById('adminContentEditor');
    if (!container) return;

    content.branding = content.branding || {};
    if (!Array.isArray(content.branding.fonts) || !content.branding.fonts.length) {
      content.branding.fonts = [
        { name: 'Roboto', fileName: '', source: 'system' },
        { name: 'Italiana', fileName: '', source: 'system' }
      ];
    }
    content.branding.fonts = content.branding.fonts.slice(0, 2);
    if (!Array.isArray(content.branding.colors) || !content.branding.colors.length) {
      content.branding.colors = ['#1E1D1E', '#C2AF7E'];
    }
    content.branding.colors = content.branding.colors.slice(0, 2);

    let previewFontFamilies = [
      content.branding.fonts[0]?.name || 'Roboto',
      content.branding.fonts[1]?.name || content.branding.fonts[0]?.name || 'Roboto'
    ];

    const WAVESTONE_LOGO_PURPLE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAhwAAABHCAYAAABMKJ5hAAA3OElEQVR42u1dZ3gbVbp+z6g3W7Jky3bc4tjpvffemxNIKCEhCZdLh73LAktnl13Kwi69t1RKEgKk95CekN6bE/fYlqts9Tbn/hBZCMSyZjyWHTzv8+QHPDOa45lT3q+9H6GUQkTTIT/bSb/7tBRHdllhq/HD76Ng2WuvYRhgyEQjHvh7KqIMMiK+NREiRIgQcaNBKr6CpkP2KTt999k8nD9mD3ld3zEGzHs8SSQbIkSIECFCJBwiuOHSGQd968lcZJ9y1H0RAYZOMuK+51JhSpCLZEOECBEiRIiEQ0T4yDnnpG//NSck2SAEGJFlwj3PpSAmViQbIkSIECFCJBwiOKDwsou+83QuLpysn2zc+3wqDCYxjCJChAgRIkTCIYIDSgvd9P3n83D2iK1esnHfC6nQG0WyIUKECBEi/hhgxFcQGVRX+OgnLxXg6O6aui/6lWdDJBsiRIgQIUIkHCI4wWHz04WvFWLvhqqQ1w2eEIN7nksRwygiRIgQIUIkHCK4wedlseLjEmz+thyhJE/6jzbg/hdSxQRRESJEiBAhEg4R3MAGKNZ9WUa/+7QEAX/dbKPnkGg88PdUxCYoRLIhQoQIESJEwiGCG/ZsqKJL3iyC28XWeU3nPjo8+GIa4pOVItkQIUKECBEi4RDBDcf31tBPXy6Azeqv85r0Dmo88GIaktuoRLIhQoQIESJEwiGCG3LOOelHL+bDUuSp85rENAUe+kcaMjppRLIhQoQIESJEwiGCG8qKPfSTf+Yj55yzzmuMZhnuez4NnftGiWRDhAgRIkSIhEMEN9hr/fSLVwtDam1odBLMfyIF/UbpRbIhQoQIESJEwiGCG7weFt+8X4wdqyvqvEYmJ7j9oVYYNd1ECBH5hggRIkSIaDkQpc0FAKUUm5eX09ULS8HWUZBCCDBpthlZ88xEIhXJhog/3hq4dr6Lc1yECBEi4RAcB3+00iVvhS5/HTQhBnc83AoKlYT3c/w+FoQQiIRFRFORCq+bhbXSTytKvSgv9qCi1Aub1Q+nLQCvJ0g6pDICpZqBTi9FTJwcpgQ5YhPkMMTKoFJLRMLdTL6lz0thr/VTe00AbkcAjJRArZFAqWGg0kggkzNEIml+5PHq2KVSAkYizqUbinC4nAHK+2YpITI5v6iMx83C5fjl2VenDWF+P8EppWBZIOCnIAyg0UmJQtk8okE555z081cKUF3uq/Oajr10uPvJFEQ3sD/K1pUV1JQgR+9hwuZ/UErhcrA0lDjZ9SCREqg0TJOHh64ehB43S+nPnO/Xfwn5+b/lCias8bIBCo/nl99qziAMoFAwpLE23oCfoqrcSy+fceLcURsunnTgSp4btVV+uJ2BOj16v3g6AIWSgTZaClOCHEnpSpreQY30jhq0SlPCECsjMjmDhkwhn5eFw8Z/H2sW3xGANlraKGSMDVA4bAFaXeFDRakXJfluFF52ofCSG2VXPKi1+uHzsCAMgUodJBtRBikMcXJqipchPlkJcys5YlspEBMngzZKSmRy0mREhBCCHasrKACMyDLyPoMiiYCfwlrpoyz7+2mq1kqg0XH/8JRSeD0UAT+9Iea+XEGI9ItXCpB30cV5wbMskN5RTec9lgy1lvtuV3jZRT98IQ/22sB/n80w5L+b6DUvlgUCAQqfl4VEQpCUrqI33R2PLv2atsqjusJHP3+lAHkXXHVeE5+iwD3PpiAxrWHCXsV5brr8o2LEJyvQvoeWaqOE25kIIdi1thJrlljCn+wsYEqQ44G/p9KmFi0ruOSiX7xaiPJiL663oK/OrdseTMTQycZ6f6/W6qcfPJ+HsmIvGEkzXsEU0OmleODvadScJKxKrc3qp2eP2rB/SzXOHLShON8Nn5f7vkYp4HaxcLu8qCj14vwxOwBAqWIQY5YhJUNNM7to0L67FimZKsTEyTgfIGcO2egn/yxA4AblHJRS6I0yPPp6umBryeNmcSXXTc8dteHcMTvyL7pQUeKBrSYAn4ets82CzVq3caGNkkBvlCEhVUlTMlVo3V6N1LYqxCcroNFJImp4WIo8WPFRMfIvOunM+xKbfbPLyjIv/dcjl1Be6gXDXHuOTr7DjFvuT+RFYpa8WURPH7Rd85vNERIpwS33JVJpZlctNn9bDpeDuzl37qgNmZ01GDMjlvO9KRkqkpCmpJuXl3O+Nz/bhaIcF575IJOmtVM3yUTzelgs++AKDu+01nmNNkqCu55IRsdeugaNkQ1QrP+6DEU5bliKPNi3qRpjZ8YK+vd07K3D8o+KUZTjDvueS2ccyOisxpw/JzWZtRPwU6xdbMH+LdUhr8vopEH7ntqwv+3FU3YU53ma/WFliJXB7QoI9ns1lT66Z2MVtn9fgexTjpBhwobA7WJRnOdBcZ4HB7ZWQ65kYIqXoXU7DW3XXYOOvXRo3V4Nnb5+Yu2wBZB7wQmuHrrmBKPZz4vQ/Za4lJd46dFdNdi3uRoXTthhrfBBCPs34KeoqfKjpsqP/GwXDmytBsMECW+r1ip0HxRFB4w2oHUHNZErInP6uV0svv2kBHkXXJj/12TanDWN/F4KS5EHZcXe6xk4/M4FFsi/4MTZI7ZmP78lUoKxM32QDpkUg6O7a7D9hwrOP+LzUvywoBTdBkbRuERuFpZcwSBrrhlHd9egosTLi3SsWWzB/X9Pg7QJYsI7VlfS9V+W1bmYJVKCGfckYshEY4MHl33KQbd/X/Hfd75miQU9B0dTU4Jwjd5SMlRk4qw4+tnLBfW6yX+NzSvKMXBcTJMt9twLTrp3U2iyIZMTTLsrHuHO0Rst31EIsuf3sTi8s4au+KgYZ4/aI354e92/EJC9m6qg0jDI7KLFnY8m0a79Rb2a+oiGpchDt39fiR9XVaAox4VAoPGfy7L4mYTYcPaIDeuWWtBrqJ6OvzUWnfroIhLqoBQ4tMOKkgI37nw0iQ6eEEOksuZn7hMGv+QNCLbuhf/NxgajUkvIlDvNMMTK+B6G2PhNGVge7syMzhrSEEt917pKnDtii7hZc/GEnS59O3SS6IgsI7Lmmxuc4On1sFiz1IKKUu+vn8+LINaHkdNNaNddy+mesitebPiqDH5f5BMe2ADF9u8qrnk310O3AVEYOM4gnkx1wF7rp0vfvkJf+79LOHXQ1iw8BS4Hi5MHarHsg2I0JM+sJXy7dUvL6HPzLmDRfwqRnx0ZsnE91FT5sf2HCrx470W8/0Iezc92Uhqh9IKiHDfeeioXS94sojWVPnG+NFNIAaB9dy0ZNc1Ev/20hNePbFxWjn4jDbRddy2n05UQgnG3xGLfpqqQeRChJvi6L8vQtpsWkUoira320SVvFaG0oG53e4ceWsz5cxKvRKDf4sS+Wrp3Q9XvWP3GZWXoP8ZAUzKE68MSEysnU+fG00unL3Ny7+5aV4lhU4wRt0Qvn3XQHWsqQ16j1kmQNT8eQua8/JFQW+2jn79SiM0ryjgfVBIpQZRBiugYKaIMMqi1EkjlBDQAeNwBOGwB2Kz+YBWLPcArZFBS4IbTFoBKLRE/1m+8GtknHfTLd67g4I9WXiSREEClDSaI6qKlUGkkYBjA76Nw2AKorfahtpp7qMdeG8D6L8twcn8tbrkvkY7IMpKGVOeFC6ctgGUfFCP3vAvzHk+m6R3U4ppvjoRDIiWYMCsOB7ZVc4rhX0VFiRfff1GKP7+WzvngT0hRkslzzPTDF/J4MfMDW6txfF8N7TfS0OiTiw1QrF1ShkM/Wuu8xmiWYf4TyUhIaXjyl8Pmp6sXlcJhC1yX0a//yoL/fTpV0DLZAWMM6DVUjwNbqzkRv9WLLcjsqqEqdWTq1Pw+FmuXlNXr3Rg41oAeg6L/0BsPXyvS4wpgyRtF2LisLOw4v0xOkJqpRtcBOnTsqUNSGxX0puBhJZX+kjfIsoDPy1KXnYW1yoeKEi+KclzIu+hC/nknigs8sNf4632u30/hFw3W3839nWur6KL/FIY0fOr6fompSnTspUOHnlokZ6hgNMug0UkhlRMwBCQQAPV6WNisfpQWeJB9yoFTB2tx6bQDNVXh5xsU5bjx3vN5yD7loLc/1ApChoDr3KPZ4JlQku/GnX9JogPGxhCpaGs0L8IBAMlt+MXwr2L/lioM2RFDB42P4fx1h00yYve6KpzYX8ud1doDWLvYgs59dFQIj0IonDxQS1ctqlvcSyYnuP3hVug2UBhLf9+mahzdU7dM+o+rKjFkopF26q0T7O9WayVk6lwzPX2wFvba8BngwW3VOLqrBoPGx0Rk4p4+aKN7NlaFvMYQK8OUO81o7CQ2mZwgOkYW8XgqZSkMJjlkPGPWP66qpBuWlYdFNpQqBt0HRWPMDBO69ItCdIy03qoEuYIhGl2wmimjkwaAAWwgqP1Qku/BuWN2nNhXi/PHbagq45/cqNFJkJqpEiQUVGnxcpr3Kg0Dja5hckaUUsTEySEJg6u7nAH6/WelWP5xMZy28MepjZKg9zA9hkyKQcdeOhhMslCl1EStDVakJLdRoc8IPVzOeFpw0YV9m6uwc20livM919ae1wGvOxgSvpLnxj3PpkbM65Cf7cKbT+Qg97yTTr8rIazk45YAnV4KhZIBjXAlrUzBQKFkrhX+GjndhD0bqnllvbocLH5YUIrOfXSUq95EtFFGps2PpxeO23llxR/dU4Oftlkxcpqp0V5YVbmXfvXulZB6G6NvisWYGbGCJPFVWrx0zRJLSHdmdbkPaxZbkNFZI2hIqduAKDJkopFu+KYs7HvcLharFpaia/8o2tiL2+UM0NVLLLDVk909+iYT2nXVNvpGk9lFi0debg2liqmzLLexIJESmOK5W46lhW763ecl8LrrX2/xKQrM/UsyBo4zoKEeLEZCEGWQkSiDDO26azFxVhyK89z08E4r9m2qxsVTjrDG9Gt07K0jLy9tL8iL/+JfheBSOTdimgm33JvY4O8eznd0OQN06ZtF+GFBadhhDomUoPewaNx8dwI69tbxriBRqSWkXXctMrtoMGZGLF271IIt31bUuwaDjAo4ursG/370Mv70SmvOoXe+sNcG8PW7V5B7zoV5TyTR1MyWHWKRSAnu+msyegyKjvg+ddUAvIZwBGP4ZnrpDPdFDwCnD9mwe30VJs8xc76397Bo0n+0od6Y/PXg81KsW2pBzyHRtDHqsYOhFEtID0z7Hlrc/nAihAopbPuuAheO28PyLA3bFUMHjI0R7O+WyRlMnhOHQzutnCqITh20Yde6Sky6w9yoE/fQdisOhwhrAUBSuhITbo+LiBKhUs2gVWtlsxGjCwd7NoSXN6XTS3H/86kQcn79xguCtHZqktZOjXG3xNHj+2qweXk5TuyvDdv4kCsYxMQK465XKBhOO7E2StpgjZ1w4HEF8OXbV/Dd56Vhe3J0eilm3puAyXPMguUwMUEdJHL306noNiCaLnitIOz8u0tnHHj7qVw89kabiHk6AgFg76YqXMlzYf7jybTvSEOLVro1muURma91zp/f/o/+ow3oM0zP7+P6KdYutaCs2MOZPilUEkyda0Z0DD/35NmjduxZX9UoL+n4/lq6ZrGlTpdvdIwUdz6aBKFEewovu2i4cXWXg8WqRRbYrMKWFrTpqCFjbjZx/v7rlpahvMTTaPS5ptJHVy+2hDyMGAaYOCsOSekq0Y16HThsfnpgqzWsawePj0GfCORH/XxAkiETjeSp9zLx+Jtt0LmvDlIpibj7t7kh4Kf4/otS+v3nJWGTDUOsDA/8PQ0z700kjZEwLZUSDBhjIE+8lYGOvXRh33fpjAOf/DMfFSXeiH7UvAsu/PuxHCz7oJjaa/1iUlBzIRxqrYRkzTNDp+d38Oecd+KqZgRXdOipIyN4hkUCfor1X5XxIjuhUFXupV+/e6XOZCmGAabflYCeg4VJTAz4KTZ8VcYpeffE/lrs3Sgs2WIkBONuiUNqporTfZfPOrDtu4pGm7A711XizOHQIb923bUYOd0kru46UFLgQf5FZ/1zgAG6DYyKuM6NWishQyYayfMft8Xs/0tq8RUqu9dX0uUfFocdRtHoJLj7qRSMnGZsdGs+o5OGPPJy659zdMLD0d01WPbBFXg9kS2lt1n9WPJWEd56MheFl10i6WgOhAMAOvfVkeFTjPx+kQbFoIpyuH9QiZRg0h1xSExT8Hr0pbMObP1WuMPuaijl5IG6Qyl9Rxow5U6zYK77CyfsdBtHjY2An2L1IovgZCsxTUkmzTZzks29WrKbn+0UfEGXFLjpuqVlIa08mZxg6tx4wVzsf0TkX3SFFXsnDEFThon0RhkZkWUkUTEt1weed8FJF79RFHYiK8MAWfPjMWKaKWJS4+kd1OSuJ5M5eac3f1uOfZuqIn7oB/wUu9ZW4qUHsvHT9moaEJ0dTU84pDIGk2abEZ/C7+AvynFjy7flvFyhqZlqMvF2Mz+1RwpsXF6GvAvCHHanD9nouhBqouYkBe54pJVgGdAeN4vViywhE1PrI1tCu5+HTzWiU28dp3uK8zzY8FWZoAJSbIBi0/Jy5J4PbZn3GqrHgDGiyFfo7+MOqxIt4Kc4e8TWpCENQkiLbXXvcbOc2w106ReFafPjI+6V6jk4mkyaHX7ulsvBYsXHJYIbSeEi55wT/370MlZ+WkIdNpF1NCnhAIDW7VVk/C1xvGWet/9Qidzz/NxWo27irnh5FaUFHqxbaoG/gXOoptJHv36v7qoUiZTg5v9NgJAZ10d319D9W3iGRn4mW3zfeSgrM2tePJQqbpbuj6srceGEXbCxXD7roJtXhK4e0EYF84D4NBNsSbBWhE9ot35XgQNbqmlLz6NoChzeYaVc8tKUKgbT5sc3SSMzRkIw4bY4pLULPwSbfcqBTcvKm4zQ1lT5seD1Qrz7TB6K89ziBG9KwkEIwZiZJmR01vD6YUuRBxuX8bNyjWY5mTLHDBlPr/j2VZU4/VMt7wlEadCaPhZCA2PQ+BiMmSFcnoDN6qerFpbyaqL3a7K14auGk63fos9IPXqP0HO6p7rch9WLLILEab2eYGJsfRUzQyYa0W2A2HejvrnNRUirutyHt57KxdK3rtDSQrdIPCIEpz1AN35TxkkmoNvAKPQcGt1kYzYnKcjwKdz2xC0ry1FwqenyKQJ+iu0/VOClB7NxeKeVsqKKftMQDgCITVA06ODfuaYS54/zs3IHjjOg5xB+i8dm9eO7z0vB11WWfdJBVy+uW+ArPkWB2x5MhJBCY3s38hM++y12rKnE2cPC9pdRqSVk6hzuicQHtlbj2N6aBo/lyK4aumdDaEvPlCDH5DlxiETDqBsZhBAo1NzeUXW5D0vfKsJz8y7g63eLacEllxj7bmScP27HyZ/C3w8kUoLhU02IlNJvXeg7Ss+pL1dpgQe71lY1+fvOPuXA649exg8LSqnYu6eJCAcADJ4Yg24Donj9+FVhKg8PTQ+NTkqy5sVDG8UvQ/3ILit2r+M+kV3OAP32kxKUXfHWubBv+p8ECNkdtbzEQ1cvsgiS83BVZlzoRcMnkdhpD2D1QgsaUoZmrfTRlZ+W1KuqOHZmLNp01IjejTAQlyjn4RkJqjcu+k8hnp5zDu88nUsPbK2m1kqf6PUQGJRSHNhazcnbmdRaia79dU0+9uQ2KtK2Czev+P7N1agq9zb5JKou9+HzVwvw/vN5KC0UQyxNQji0UVKSNT8eGh2/g//A1moc28PPyv1Z8ZLXc33eYOWGpYhbUtKe9VXYu6luotJnuB6jbzYJurlsWVGBy2cdgv3mwW3VOLzDKuhEuZpIbE7ilkh8fF8N9m+u5v3crSvLcfpgaEsvrZ0K426JjYjI1x8Bae3UnHNyfk08yq54seGbMvzzgWw8c+d5fPZyAT2800qryr2i50MA1FT56emfuKk9d+ylgzGu6SuzFEoGHXpyIz4Fl13IPiXc/idXMrzbDPi8FJuXl+Plhy7h+N4aMcQSacIBAD0GRZNBE/j1yHDaA1i1sJSXMJVMzmDKXDMviwwIisxsWl4WdlJSSYGbrvy0pM56d0OsDLc+kCho59H8iy66cXlokS+NTsKpQZvbFax2EbpNc+v2KjJ2ZiznBbxmiQWVFu4WTM45J1292BKyokIiASbOMgvSLK+lIL2jGolpygb/jtfNIvuUAys+LsGL91zEk7PO4c0nc+i6Ly30wnE7ra32iRs2D1gKPSgtDL8yhWGAzn11zYZwt+6g5hSG97pZnPrJJsizCQEm3xGHwRNiOJXz/xbnj9nxyiOXsHqxRQyxRJpwyBUMps4xwxTP7+A/vo+/MFWbjmoyekYs7z9w8/JyXD5bf5lswB/U3Mg556x7Is82o0MP4apS/P6gJHuojo9KFYO5jyWjXTduVTunD9mwc12loJOFEIKxM2OR3kHN6b6LJ+z4cRU3bRGfl8XqxaX1dsPs2EuH4VON4krmgJhYORG6yZ7bxSLvggubl5fjnadz8fSd5/HU7PN4+6lcuu5LC714wk4dNr8YfgkDRbluOO3hN2bT6aVozXFNNiaS0pXBZoYccPmMAx5XoMHPphRIzlDhL6+n47aHWvH2zAPBEMunL+Xjo7/lN1n5boskHACQ0VlD+FZlNESYihCC8bfGonV7fguqrNiLtUst8PtCx0PPHLaFLLts30OLCbcJ25vj7GFbvb1jeg3VY8JtsWTSHXGcrIarMuNCxyLNSQoy5U4zJ48LywLrvyrjJAZ3Yn8t3VXPu1GqGGTNa5oywBsdo282cSaOXDZ9m9WP7FMObPimDO88nYun5pzHc/MuYOHrhfTkgVqRfNTj4eDSsdtolvM2BhsDRrOcs4ZTSYEbNdXCxeM0OimZ/adW5M//SkdSOn9vns9LseGbMrz84CWc+qlWnLMNRNhlB4yEYPxtcdi/pTrsZj2/xlVhqtsfTuQs5BOfrCSTZsfRD/+Wzyuxcu+GKoyaZqJd+l2/ZNJpD9CVn5bUKV+uUjO4+e4EmBKEi5G6nAG6erGlzmdetVymzDVDoZJgwFgDflwVhcM7a8J+Ru55JzavKMecPycJKp40ZGIMdq6pxPF94WfRF+W4sXFZOe56Irle0ua0B+iqhaX1qiv2HqFHn5H6Jl9EXjcLS5GHyhWR4T2UAmqNBNENIFoJKUpy24OJ9O2ncuGwBRp9vDarH6cP2XD6kA2rFlrQpqMa/UYZaO/heqRkKIlUJlYXBd8VRVmJh/MB35y0Z1QahqRkqujpg+GHSWqr/Kgu8yEuUSHYOKQyBkMnG0liayVd9O9CHPrRyonIXWMcHrHhlUcuYdZDreiYmbE3VKPGX6PS4oWlyBOxXCu5gkFMnIxc3fOlXDepyXPM/A7+n4Wp+o8x8OoUOGySEbvX8SsdranyY92XZWjbTXtdqea9G6tweKe1zvsHTYhBv9HCNrA6vMOKg9tCJ1MOHh+DLn11BAgm706dG0/PHrFzcrduXlGOgeNiqJBVNVEGGcmaF08vHLfD5Qx/BW//vgJDJsTU25764PZqHNsb+jvr9FJMmxff5GWAAHDhhB1PzzkXMUXMQIBizM0mzH8ipUG/M3hCDCkt9NAlbxaF3adDCDjtAZw6GCQf339Rgh6Do+mwKUZ06RvV4kXbAgGgttrP6R5DnCziyqKhQAhBWltu3jOPm4W1ytco48nopCGP/bsNXfFJCdYusXDaP3+NihIvPvpHPnLPO+ntD7US1ACNyNzyUyx8vRBfv3cFiMByZ1kgs4sGT7zVhl6VkODcoa0hB/9VFdD7/5YKrhZNtFFGps2PpxdP2nmJYx3YVo2T+2tpnxF68ptJRFcvLK1zwzUlyDFtXrygPSVqKn101cLQHU+vpyvRY3A06T/aQLdz6LVSdiUYUnroxTQIaUX2HhZN+o0y1BsSuuZdl3qxZqkF6R3Vdepl2Kx+uv6rMnjrKaUePsWIjr20zWLB+7y0zjLqxkINx0OpLgtw+l3xxOeldMVHxZxEpoTyfFRafNi6sgJ71lehS78ojLsllvYerm+xxCPgp3BxPBC1Okmzq9AyJykgkZKwDVO/j8Je03ietmijjMz9SxLSO6jp4jcKUZzn4fU7XjeLtUstyM92Yf4TybRjLy25kaT3Q3nUGwPGONk1BREMnw83bX4877K6HWsqcfogP2Gq3sOiSb+R/PpkOG0BrF36e32Krd+V42KIkqzxt8Yis6uw+g7hdDwdOc30O10JhZLBlDvNnIR1AGD3uire77wuKFRBGXEuDZsAYF9Q4KzOsRzYWl3vuzEnKTBpthmiG16Y73jrA4nk3udTeVeDCQG3i8WhHVa89uhlvPpIsCTR3wJLbFmWUi9H3SKFqvmtg+gYKScjjVJwJlpcIZMzGJFlJM+8n4new6J5t+2gFDh5oBavPJyNTcvKaaS73t5QYK59ybxmau9h0aT/aH4Hv83qx6qFFjjt3EuNFCoJsubHcz5wr+LYnhoc2m7973/nZzvpxmV1l6Smd1Bj3C1xgrrKSwvr73ialK7E+FuvryvRvruWDOMowHX1nQtd3tWhp46MmMYtkdheG8Caxdf//jWVPrrhm7J63ftjZ8aidXuVmCgqEOQKBhNnxZHnPmqLwRNjeBsTQsDrZnFgazX+cX82lrxRSK0Cl3Y3e8IRoPgjEC25kuGUWA4gIn83IQSZXbTk8TczcPPdCVCp+c/1sitefPBCHj57pYDyKftvkfyDr1XUkIP/0E4rDmzlJwbVvruWjMjiVwbpdrFYsySoT8EGKNZ9WVana00iJZhypxnmJOEyASml2LgsdMdTQoCJs+KQlH79A1UiJZh4exznLPBDO634aWu1oJNHIiWYdEccEtO4jeXI7hoc3P77sezfUo1zR+0h703voMbYmbEttoNoY27E7bpryeNvtMFj/2mDXkOjm5R42Kx+fPN+Md54PKdFNdaiFOBaCOFvhpyM9VNQltu4GEnkxmcwycj8vyaTh/7ZmndX9KtnyqoFpfjXny7hwnG7WMXSGISjoQe/9+c27HzkbCVSgomzzLxLnU79VIsN35Th9CEb/TFELkSXvjoMmSisVsHls0669dvQHU/bdtNiRFZor0Fq22AnXz7vvLpC2N0pNVNNxt/Kravw1bH82nqttHjp+q9De34agwQKQrwkgForgVoXmX9KFQO5onHIgEotIUMnG8mzH2bimQ8zMfpmE0wJcjQFv6M0GGJ755lczorBLQkOewDN7aBzu1hORIgQQKWWRHSMMjmD0TebyDPvZaL7wKgGhViO76vFSw9lY+vKCurzNt8Qi0xOoNIwUKkb/59cyfwurCblO/CgdWvGwe1WFOW4Od9//pgN27+vwIx7Ejnfm5KhIuNvjaOfv1rA2RpgWWDlpyXYsbqyzgSaq/oOUQbh9B38vmCyUVmxN+RkmDLHDKM5dPYzIQSjbjJh17rKOoXKroezR2zYuaYS0+bHCzqJR91kwt4NVbhw0sFpLDtW/zKWH1dV4OKJ0N6NxiCBQiCzqxZ3P5UCmYKARmiv4etdDBcanZT0G2lAryHRuJLnpsf21OLQj1ZcOuOAtcKHSJ5vR3fXYMlbRXjwxTTaHKqSGtfTBDAMtz+xttqPgJ9C2ozkaBy1fvg4EA6pjCAqRtoE7zvo2fvr2xl02YfF2Ph1Ge/k6dICD957Lhe555x05v2JMJialz4QwwC3PdgKPYdEIxIKwJQCap3kmkrCBn3h5DYqMnFWHP30JX4H//qvytBvlIEmt+Eejx91kwl7Nlbh/DE753HXVPlDZuv2HqEXvM3zyZ9stL5mcl37R2HguPByY8xJCjJ5tpm+/0Je2JngLAusW2pB3xF6mpgmnBR4bIKCTJptpjnP5oZdXhn8/hYMGGOgDlsA9UmYqzTCk0ChoI2SoH0PLWksr0NTQipjkJqpJqmZaoy7NZZeyXXj/FE7Th+y4fIZB8qKPbyqxrhix+pK9BwcjZHTTPgjQypjiFLNcNpNrRU+eD2USmVoNmuj0uLjJJ2g1kpgNDdd0rLRLCd3P5WC9PZquvTtIt5VZy4Hi5WflSDvohPzn0immV20zWq/Ss1UoVNvXZONqcE75MjpJrTvoeV1b1GOGxu+KuPFtoxmOcmaF89JfTPcw2PybLOg+g5Oe4CuWlAKm9Uf8kCdOjeeU5+WIRNj0Kk3t0ZJ+dkubFpeJjjD5dNVOO+CC6sWlOKb967UK2Heb6QBvYdFi4kbTQiVWkIyOmnI5Dlm8tgbbcirX3XAPxa0xwN/T8Pom03I6KSBTi9tlPCL181i3VILr55MNxJkMoKYOG7eK2uFDw6bv1n9HSUF3LzehlgZ579baMgVDMbdGkueejcTXfrqGhRiObyzBi89mI3tP1SIDQ1/Tagb+gMxsXKSNS+eXj6bAy+PNvTbfqjA4IkxtGMv7qxrwBgDeg3V805AvR76jjSgcx9hGeCBrdU4srum3gO15xBuB2q0UUam3mmmF0/YObkBt3xbgUHjYmjbbsKx75+7CnMWJlu1qLRe9T9DrAxTf1ZcFdFMNg4pgdEsJ0azHF37RyHgp7DX+KmlyIOcc06cO2pH9ikHruS5BPOAZJ9y4OxRG/iWxt8IYCQESa1VnAlHRakXsQmKZvE3eD0sCrK5qVGnZKoRpW969TJCCDr11pEn382g37xXjE0rynmdawBQnOfBO0/nIv+ikw4cGyMmugvh4QCA/qODsV4+qC73YfUiCzw8PqpaKyHT7oqHNkqYg0inl2LirDhBE/Kqyr109SJLyEkbHSMNHqg8xMX6jNSj11A9p3sqSr1YvcQCoZObegyKJuGGhK7C56X1ul6HTTGiQ0+duFqbMSRSgmijjLTtpiXjb4sjf3qlNXl5aXv8Y0F7zHqkFdr30AbbhjcAbheLkzwEB280tOms5vSuHLYA8nm0m2gsVJV5af4lbuPp2FPbrHR1YhMU5J5nU8h9z6U2qE+N0x7A8o9K8N6zubDX+Fv8PiHIF1ZrJWT6XfHQ6fk5TPZvqcLRXVZefqcufXVkyERhuoUOGGtAh57Cxtx2rKrE+WOhhayGN+BAVaklJGuemfO7r0+Aiw/kCn7CZKGQmKbApDviONf0i2h6S11vlJGu/aPI3L8kkX8ubIdn3svA0MnGBnXwzDnnFKSraHNGegc1EpLD91ZQCpw+bENzcd1fPuNEZWn4ORDRMVJ07qNrdt9BoZJg0uw48uQ7GejYi//4An6KCycdjd6zqMUQDgDo3FdHhk/hd/C7HCxWL+YXn5XJGUyZa0Zcq4YlHOn0Uoy/JbZOyW0+KM5z0w1fl4UMGZji5Rg2xQiPm6X2Wj/nfw6bn6a1V6PPcG5eDnttAKsWlsJhE3aXatdVS0bfJExiHyHA+FvjkJqpFtnGDQxCCKIMMjJgbAx5/I025LmP26LfKD0vEllp8cLpYP/QQXFTvJx0H8gtH+rsYRvKS5q+dJgNUBzaaeXUm6dtVy2SM1XNdu527R9Fnno3AxNuixM8Z7ClQbA6JKmMwaTZZhz80QpLEXed+pMHanFgazXGzIjlfG+bjmoydmYsXfrWFd7j7zdKj/qainFdeOu/LkN+PbFMpyOAj1/MB2lAjiohQHUF98ZHR3fX4MBWK0ZNFy7zn5EQTLg92FWYT7n0NRtRFw1G3xQrrtI/EBRKBj0HR5N23TR007JyfP3eFU79HdwulndM/UYiaEMmGbHt+4p6Oyb/yrjBkV01mHSHsknHXpzvpkd3h9/RmmGAgeMMaO7lzuYkBbnvb6m0dQc1vn7vCqrLfeJibkrCAQCt26vIhNvi6KL/FHIuk/V5g8qffUboqZ5j221CCMbOjMW+TdWcdCmuQhslwdgZwno3sk856Lbvyuu9zmkLcNKvEBI+L8XqhaXoMTiKxsQKR92T0vmXS1+FTE4wZW78DdeRUUR40OikZNr8eOhNMvr+83khK7h+DcoCLUHNsV13Lek9TB92c0SWBbZ9V4HB42NotLHpSsd3ra2qt+Ls10htq0afEfob4puo1BIy9U4z0tqq6BevFfKSZGjpEDRLhxCC0TNMaNNRw+v+CyfsvJPC4pOVZPJsMy83bc+henToJVxSotfDYs1SCyotzZ8Fnz9ux/bvKwT/3YaUSwNAtwHha5KIuEE3HwnBsMlGMv7W8L1YShUjqGHQXKFQMpg8h1tzxHPH7Ni5rrLJxlx42UW3hmFk/XJeAGNmmBCXqCA30pztPiiaPPVuBkbfbBJDLE1JOAAgLlFBps7ld/BTlvKqVrmKoZNj0KUvt+QelYbBmBkmQdvPn9hXS/duqLohJgClQQG2ohyXoGZjTKycTJ3LTydFrQv26uGiSSIifJw5bKPrvrTQihJvk/d+kEgJ+gzXh923JcoghUrTMsqjO/bWES7hzoCf4ocvSpFzzhnxj+rzsvjhi1JOYdTOfXQYOf3GFHJLSFGSh19qjf95MqXRVX9FwlEPBk+MQY9BUZzva9ddi17D+Ct8RhlkJGtePFQahsOkj0KXvlGC/e0Om5/+sKD0hspILspxY8PXwouB9R/NvWQXAAaONaDHIFHkqzFQUeKln79agHeezsXzd13A95+X0rJiT5MSDy4poGnt1FBpmBYxN6RSgml3xSOzi4bTWl76dhFqqyPb0W3XuipO3o3oGClue7AVhAzlRhoqtYRMmx9PHn+jDadvJBIOgfGzCBSn8jeZnGDq3PgGT8Dew/VkwJjw+m1IpAQjp5ug1gqXsLRvUzWO7wszaaoZLbWt31Xgwkm7oJuURiclU+eaOemkGGJlyJobjz+iTHhTw+dl8e2nxTh90AZKgUtnHPjkn/l4du55LPugmBbnuWkkeiz81io/uL06LOE6iZSgSz9dixJQik9Wkjv/ksQptLJvYxW+evcKXM7IfMyTB2rpov8Uhi3wJpES3Py/Ceg19MY3KhgJQe9hevLM+5kYOc0klu/XR6Ib64d7DIomA8Ya6NaV4eUH9B6mx4AxDY/ZK5QMps4149jemnoziTO7aNBLwJ4plRYvXb3YErIkTKliMGZG7HUZcUDA/eHHVZU4eSD8fJjqch/WLLagTUeNoId9twFRZMhEI93wTVlY14++yYTMLhpx1TYC9m+uphu/udYKZdmgxPyC1wqxeUU5hk420qGTjEjJVBFpI2+elFLs3VhFt3wb3h6RmqlC5z5RLe679RmmJ7c/1Ip+8VphWBU6LAusWWyBVMZg1sOtqJAG1W9x5rCNvvdcbtiJooQA426NxdS58WD+QH34EtOU5OGX0mhaOxVWflrCqfJKJBwCQK5gMG1ePI7vrUVFPSIwOr0UWfPjBfM0tOumJaOmmei3n5aE9C4Mn2KEXsCM7m3f1d/xdESWCfc+n9rojb7MSQqac9YRdlndVe/MsCk1tN9Ig2DvRCZnMHlOHA7ttKKiJPQ8SEpXYsLtcTfcRsSygNfDUjSRz0oiIfVaVvnZTrr07aI6ZecpDbrjv3rnCjYvL0ef4Xo6ZFIM2vfQQqOTEKG9Cj4vi13rqujnrxSEVaHCMMDYmbEtsmqJkRBMmm0mVeU+uvLTkrAEvnxeipWflsBa6cPsP7Wi8clKQd+b38di/5ZquuC1Qk55G8MmGzHvsWQ0JglqKmh0UjLz3kS07qCmC/5VyKtisrHh9weVndkmkrJp1H7AGZ01ZMwME/36veKQ1w2ZFIOu/YSrEpFICSbMisOBbXVrQSSmKtB/tHBVEAWXXHTjsrKQZaCGWJng0ulCeRaAoAzvqgWl6NRbR4VM2GzTUUPG3Bx6HjAMMHFWHJLSVTfcRnT5jAP/vD8bDIOIr2JKgcmzzRg0PqbO98YGKLZ8W4G8MOWvK0q92PBNGXasqUCbThr0HaGn3QZGIbmNqsHkw++nKMh20Q1fWbBlZUXYfXe6D4q+YRMMhYBCyeCOP7UCZSl+WFAalrBWwE+xeXk5cs85cfP/JtB+o/TQ6Bq2rtkARXG+m65dYsGm5eVh56oRAgyZZMS9z6cKauQ1N0ikBP1GGkhiqpIu+k8R9m6sajYKsCwFvv24BD+uqqBogiERhjQu4WAkBONuCYpA1bXZxacoMPXOeMF19JPbBLUgPnu54LpKn31HGpCQKkw5VsBPsf4rS71Mf9Q0EzI6RyZcIJMzmHRHHA7tsNbrYfo1Tuyvxb5N1Rg7M1bwebBvU3WdQmjtumtv2AOlpsoPLmJHQqM+lVnCABNvj4M2SoLtP1SgINtVb8M8IKgAfPqgDacP2qCNkiAlU4223TQ0s7MGKRkqxJhl0OikkCsZIpHgmtwKSinYAOD1stTlCKCqzIfcc04c21uD4/tq6/V2XWMcpCkw97GkP/RBFQ5UagmZ/eckqtNLsfzD4rC9l9mnHHjjiRx06avDiCwT7dpfB1O8nIS757IBCnutnxZku3BgmxV7NlSiON+DcA8thgFGz4jFXX9NvqGTRLmeP//3amua3l6NlZ+VhK0z07jWSTBv69KZpnk8IY3s4QhuFkoyeY6ZfvhCHgKB3w9g/C1xaN2+cazakdNN2L2+CueOXhvm0EZJMHSicN37Lpyw0x9XVda7aY6/PbI9QTI6a8iILCNd8XFJ2Pf4vBRrFpWi5+BoKqT7OjFNSSbNNtOP/p73u8NOqIRhEXUtdILENCW59YFEjJxuonvWV2HzinLkXXCGRTyAoBT+2SM2nD1iA8MAaq0EepMMBpMM0SYZ1UVJoVAzkEoIWJbC7WbhrA2gusIHa4UPVeU+OGr9YT/vKuJayXH/39LQoYfYvO8q6ZhxbyISU5V0yZtF9SoZX4XXzeLIriDZMyfJkdFZS9t20aBVayVM8XKodRLIFQxYlsJe44e1wo9KixflJV6UFLhRmO1CUa6bc/WdWitB1jwzZt6X2OLK3LVRUnLrA4lo3V5FF7xeGLaH8Y+7D0WAcADAsElG7Fpb9bskxrZdNBg7M7bRss5/1oKgl8/mXJNs1blvFNp0FqaMyeNmsXqRJWSCKiHAxNvNSMmIbLiAkRCMuzUOezdVoTgvfPW/i6cc2PpdOW57sJWg4xk+1Yhd6ypx+uC1zex6DdVjwGi9eJpEgHjEJSrI9P+Jx9BJRrpnYxW2rSzHpbNOTm5flg0SEHttoMHy9aGQ1k6Fe55N/UNUMwgJqZRgyKQYktpORZd9UIw966vCqvIBgt7Y4jwPivM82LW2EhIpgUrNQKFiIFMwYAMULgcLtzMAv4/yVgomBMjorMFtDyai/2gDaQlibdeDREowYGwMSWytpAtfK8KBrVW/M7xbEiIyC6KNMpI1z3yNuI9MTjB1XuNLVw8YY0CvIb9UokgkwOAJMYJp9x/dZaX7t4QW+WrfQ4tRNzVNuCC5jZKMms4tPEIpsHFZGfKzhRUQ0htlZNq8+GvmgTZKgqlzzVDrxHqySBIPU4KcZM0zkxcXtsejr6Wj19BoqLXNQ1BLJicYPsWIp9/LRO9hetKSymC5fMPUTDX50yvp5K9vZ6D7wCheInsBP4W9NoBKiw+lBR6UXfHCZvXD5+VHNhgmmPw99y/J+NtnbTFkorHFko1fIzVTTR59PR23P9yKk0zAH44sR+pBfUfoSf/Rhv/2Bug9TI9B42Ma/blqrYRkzY+npw/ZYLP6kZSuQo/BwpTW2ax+umqRJWT9uVLFYPpd8TCamyZcQAjBiCwjdq2tDNv9CgDFeR6s+7IM9z6bKmgYqM/IoBjY3k1BkjZkohHdBkQ1qxOlBbTq+O/cMJhkZMyMWAwaH0MvnrBj35ZqHNtdg+J8N6eOn0JZg+26aTHlTvMN0dCrOUChZDBofAzp2j+KHtllxbbvK3DmkI1TdZoQ0OmlaNtVgwFjDeg7Qg9zkkIkir9/R2TWI0lo3V5NF/+niNN+XPdmJRKO6y8MleS/+hgsC0y/Kz5ipVFd++nIkEkxdP2XZegzXA9TvDCH//4t1Th72AaJlIC5DoknDMHQKUb0G920PUGS0lVkzp+T6GevFqD8igcgwfGSnwUb6c8lUr+Nr+/ZUIURWUYqZPxcpZaQrHlmemJ/DZRqCSbPiWt2vTEIAZQqCZQqBqQ5G2c0SI6kAkxntVZCug+KRtf+Uagq89HsU3acOFCLc0ftKMpxw17jbxQiRgigN8nQsacOQybFoNeQaDRl8zGFkoFSxYAJg2Szfgp5M2kDotNLyfCpJvQbbaCXTztwaIcVR3fVoOCyK2xBLj7frXV7NboPjEKPQdFIaauKGEmUyUnwO/32cQTNuteOVEowZKKRtGqtogtfL8SBrdUNew9KBjI5geQG4OaMhIBEUtI44Kf49OV8GvBR3Pt8KhG6MiUULp1x0Dcey8F9L6Sia/+GW9SUUlw+66QVJd7rHkoMIZDJCdI7qhFlaPrsejZAUZTrpvkXg7XhKo3kv4s14KNgKQW9zr6U2laFhBTha/g//Fs+1UZLMPcvyaS56W54PSxyzzmp13NjtEFPSFE2SmiSUgp7TYCW5LuRc86Jy2ccyLvoguWKB7VVfridAc5JoAwTnHumeDnadNKgY28tOveJQqvWSiJkPyO+KC1006oyX1hEk7KAKUHeLJuPUUpRW+WnueedOHXQhvPH7CjMccFa7oPHzXImj1cTheOTlUjvpEbn3jq07aZFQqoCShUTcW9GeYmHlhdfv9IpIVUJg6n5VzTVVProik9KoI2S4LYHW3EeLxugyLvoovaaG0dkjES6h0J5iYcCQGxCZBep309xaHs17dw3Cjq9mC/QHDZ2qZQR28/fQGADFC5ngFaVBeP9V/LcuJLjQmmhB+UlXtRU+eB2svD93MZDKiVQqBhE6aUwJchhTlYgra0aKZkqJKUrERMri6jR0VJBKYXbxdKKEi8Ksl3IOedE4SUXSgo9qLR4Ybf64fWwYNkgsVCoGCjVEihUDPRGGeKTFMjorEHbrhqktFUh2iAjooS3MPC4Wdiq/dQYL2sRIaj/B1DgOuih50+NAAAAAElFTkSuQmCC';
    const WAVESTONE_LOGO_WHITE = 'data:image/png;base64,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';

    const scopes = Object.keys(PUBLIC_SCOPE_LABELS);
    let activeScope = scopes[0];

    function fieldsHtml(scope) {
      const p = content.publicContent?.[scope] || {};
      return `
        <label class="admin-editor-label">Petit titre</label>
        <input type="text" class="form-input" data-scope="${scope}" data-field="eyebrow" value="${escapeHtml(p.eyebrow || '')}">
        <label class="admin-editor-label">Titre</label>
        <input type="text" class="form-input" data-scope="${scope}" data-field="titleLine1" value="${escapeHtml(p.titleLine1 || '')}">
        <label class="admin-editor-label">Mot à mettre en valeur</label>
        <input type="text" class="form-input" data-scope="${scope}" data-field="titleAccent" value="${escapeHtml(p.titleAccent || '')}">
        <label class="admin-editor-label">Texte d'introduction</label>
        <textarea class="form-input admin-editor-textarea" data-scope="${scope}" data-field="desc">${escapeHtml(p.desc || '')}</textarea>
      `;
    }

    function samplerThemeLabel(theme) {
      if (theme === 'rainbow-glass') return 'Rainbow Glass';
      if (theme === 'midnight-frost') return 'Midnight Frost';
      return 'Ivory';
    }

    function normalizeHex(value, fallback = '#1E1D1E') {
      const raw = String(value || '').trim().toUpperCase();
      return /^#[0-9A-F]{6}$/.test(raw) ? raw : fallback;
    }

    function currentBrandColors() {
      const colors = content.branding?.colors || [];
      const primary = normalizeHex(colors[0], '#1E1D1E');
      const secondary = normalizeHex(colors[1], primary);
      return [primary, secondary];
    }

    function cssFontValue(value, fallback) {
      const safe = String(value || fallback || 'Roboto').replace(/["'<>]/g, '').trim() || fallback || 'Roboto';
      return `"${safe}"`;
    }

    function samplerProjectData() {
      const branding = content.branding || {};
      const faq = content.publicContent?.faq || {};
      const projectName = branding.projectName || 'Projet';
      const titleLine1 = faq.titleLine1 || 'Votre futur environnement';
      const titleAccent = faq.titleAccent || 'de travail.';
      const eyebrow = faq.eyebrow || projectName;
      const desc = faq.desc || 'Un espace simple pour suivre le projet, trouver les bonnes informations et découvrir progressivement votre futur environnement de travail.';
      const firstQuestion = faqData?.[0]?.title || 'Que souhaitez-vous savoir sur le projet ?';
      return { projectName, titleLine1, titleAccent, eyebrow, desc, firstQuestion, logoUrl: branding.logoUrl || '' };
    }

    function samplerLogoHtml(data, theme) {
      const themedUrl = data.logoUrlByTheme?.[theme] || data.logoUrl || '';
      if (themedUrl) return `<img src="${escapeHtml(themedUrl)}" alt="">`;
      const initials = String(data.projectName || 'P').split(/\s+/).filter(Boolean).slice(0,2).map(v => v[0]).join('').toUpperCase() || 'P';
      return `<span class="storm-theme-sampler-monogram">${escapeHtml(initials)}</span>`;
    }

    function themeSamplerHtml(theme, options = {}) {
      const d = options.data || samplerProjectData();
      const colors = options.colors || currentBrandColors();
      const fonts = options.fonts || previewFontFamilies;
      const rainbowDecision = window.StormRainbowEngine?.derive(colors) || null;
      const rainbowVars = rainbowDecision?.cssVars || {};
      const brandDecision = window.StormBrandEngine?.resolve(colors) || null;
      const brandAccent = brandDecision?.roles?.accent || normalizeHex(colors[1], normalizeHex(colors[0], '#1E1D1E'));
      const rootStyle = [
        `--brand-primary:${normalizeHex(colors[0], '#1E1D1E')}`,
        `--brand-secondary:${normalizeHex(colors[1], normalizeHex(colors[0], '#1E1D1E'))}`,
        `--brand-accent:${brandAccent}`,
        ...Object.entries(rainbowVars).map(([key, value]) => `${key}:${value}`),
        `--sampler-font-main:${cssFontValue(fonts[0], 'Roboto')}`,
        `--sampler-font-secondary:${cssFontValue(fonts[1] || fonts[0], fonts[0] || 'Roboto')}`
      ].join(';');

      const contentDemo = theme === 'midnight-frost'
        ? `<div class="storm-midnight-flow">
             <div class="storm-midnight-track">
               <div class="storm-midnight-story"><small>01 · À la une</small><strong>${escapeHtml(d.firstQuestion)}</strong></div>
               <div class="storm-midnight-story"><small>02 · Avancement</small><strong>Suivre les prochaines étapes du projet.</strong></div>
               <div class="storm-midnight-story"><small>03 · Plans &amp; 3D</small><strong>Explorer progressivement le futur environnement.</strong></div>
             </div>
             <div class="storm-midnight-lens">02 / 03</div>
           </div>`
        : `<div class="storm-theme-sampler-card">
             <div>
               <small>FAQ</small>
               <strong>${escapeHtml(d.firstQuestion)}</strong>
             </div>
             <span class="storm-theme-sampler-cta">Rechercher</span>
           </div>`;

      return `
        <div
          class="storm-theme-sampler theme-${theme} ${escapeHtml(options.brandClass || '')}"
          id="stormThemeSampler"
          data-rainbow-mode="${escapeHtml(rainbowDecision?.mode || 'pearl')}"
          data-rainbow-influence="${escapeHtml(String(rainbowDecision?.brandInfluence ?? .28))}"
          style="${escapeHtml(rootStyle)}"
        >
          <div class="storm-theme-sampler-nav">
            <div class="storm-theme-sampler-brand">
              <div class="storm-theme-sampler-logo ${(d.logoUrl || d.logoUrlByTheme?.[theme]) ? 'has-image' : ''}">${samplerLogoHtml(d, theme)}</div>
              <span class="storm-theme-sampler-project">${escapeHtml(d.projectName)}</span>
            </div>
            <div class="storm-theme-sampler-tabs"><span>FAQ</span><span>Actualités</span><span>Plans &amp; 3D</span><span>Équipe</span></div>
          </div>

          <div class="storm-theme-sampler-hero">
            <div>
              <div class="storm-theme-sampler-eyebrow">${escapeHtml(d.eyebrow)}</div>
              <div class="storm-theme-sampler-title">
                ${escapeHtml(d.titleLine1)} <span class="accent">${escapeHtml(d.titleAccent)}</span>
              </div>
            </div>
            <div class="storm-theme-sampler-desc">${escapeHtml(d.desc)}</div>
          </div>

          ${contentDemo}
        </div>`;
    }

    function wavestoneSamplerOptions() {
      return {
        brandClass: 'brand-wavestone',
        data: {
          projectName: 'WAVESTONE',
          titleLine1: 'Votre futur environnement',
          titleAccent: 'de travail.',
          eyebrow: 'Projet de transformation',
          desc: 'Un espace clair pour suivre le projet, comprendre les prochaines étapes et retrouver les informations utiles.',
          firstQuestion: 'Quand aura lieu le déménagement ?',
          logoUrlByTheme: {
            ivory: WAVESTONE_LOGO_PURPLE,
            'rainbow-glass': WAVESTONE_LOGO_PURPLE,
            'midnight-frost': WAVESTONE_LOGO_WHITE
          }
        },
        colors: ['#451DC6', '#04EF6A'],
        fonts: ['Roboto', 'Roboto']
      };
    }

    let savedThemeValue = content.branding?.theme || 'default';

    function previewThemeFromValue(value) {
      return value === 'rainbow-glass' ? 'rainbow-glass' : (value === 'midnight-frost' ? 'midnight-frost' : 'ivory');
    }

    function editionValueFromPreview(theme) {
      return theme === 'rainbow-glass' ? 'rainbow-glass' : (theme === 'midnight-frost' ? 'midnight-frost' : 'default');
    }

    function editionDescription(theme) {
      if (theme === 'rainbow-glass') return 'Lumineux & expressif';
      if (theme === 'midnight-frost') return 'Immersif & premium';
      return 'Clair & essentiel';
    }

    function ensureAdminFontFaces() {
      let style = document.getElementById('stormBrandFontFaces');
      if (!style) {
        style = document.createElement('style');
        style.id = 'stormBrandFontFaces';
        document.head.appendChild(style);
      }
      style.textContent = (content.branding?.fonts || []).map(font => {
        if (font?.source !== 'upload' || !/^\/uploads\/[a-zA-Z0-9._-]+$/.test(font.assetUrl || '')) return '';
        const family = String(font.name || 'Storm Brand Font').replace(/["'<>]/g, '').trim();
        return family ? `@font-face{font-family:"${family}";src:url("${font.assetUrl}");font-display:swap;}` : '';
      }).join('\n');
    }

    function render() {
      const branding = content.branding || { projectName: 'Projet XYZ', logoUrl: '', theme: 'default' };
      const savedPreviewTheme = previewThemeFromValue(savedThemeValue);
      let previewTheme = previewThemeFromValue(branding.theme);
      ensureAdminFontFaces();
      previewFontFamilies = [
        branding.fonts?.[0]?.name || 'Roboto',
        branding.fonts?.[1]?.name || branding.fonts?.[0]?.name || 'Roboto'
      ];

      function themeOption(theme, label, description) {
        const selected = previewTheme === theme;
        const applied = savedPreviewTheme === theme;
        const visualClass = theme === 'rainbow-glass' ? 'rainbow' : (theme === 'midnight-frost' ? 'midnight' : 'ivory');
        const textColor = theme === 'midnight-frost' ? 'color:white;' : '';
        return `
          <button type="button" class="storm-theme-option ${selected ? 'selected is-previewing' : ''} ${applied ? 'is-applied' : ''}" data-preview-theme="${theme}" aria-pressed="${selected ? 'true' : 'false'}">
            <span class="storm-theme-active-badge">${applied ? 'Édition enregistrée' : 'Enregistrée'}</span>
            <div class="storm-theme-preview ${visualClass}">
              <span style="position:absolute;left:15px;bottom:15px;font-size:.54rem;font-weight:600;${textColor}z-index:2;max-width:70%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(branding.projectName || 'Projet')}</span>
            </div>
            <div class="storm-theme-meta">
              <div class="storm-theme-copy"><strong>${label}</strong><span>${description}</span></div>
              <i class="storm-theme-check" aria-hidden="true"></i>
            </div>
          </button>`;
      }

      container.innerHTML = `
        <div class="studio-domain-head studio-identity-domain-head">
          <div class="studio-domain-head-copy">
            <div class="admin-page-eyebrow">Administration</div>
            <h1>Identité &amp; apparence.</h1>
            <p>Configurez ce qui identifie le projet et la manière dont Storm traduit sa marque. Ces réglages sont établis au lancement et ne sont modifiés qu’exceptionnellement.</p>
          </div>
          <button type="button" class="studio-domain-save" id="saveIdentityBtn">Enregistrer les réglages</button>
        </div>

        <section class="studio-identity-section">
          <div class="studio-identity-section-head">
            <div><h3>Projet</h3><p>Le nom et le logo qui permettent aux collaborateurs d’identifier immédiatement leur espace projet.</p></div>
          </div>
          <div class="studio-identity-project-grid">
            <div>
              <label class="admin-editor-label">Nom du projet</label>
              <input type="text" class="form-input" id="brandingNameInput" value="${escapeHtml(branding.projectName || 'Projet XYZ')}">
            </div>
            <div>
              <label class="admin-editor-label">Logo</label>
              <div id="brandingLogoDropzone" class="logo-dropzone">
                <div id="brandingLogoPreview" style="width:42px;height:42px;border:1px solid var(--ink-12);border-radius:10px;overflow:hidden;background:var(--offwhite);flex-shrink:0;display:flex;align-items:center;justify-content:center;">
                  ${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" style="width:100%;height:100%;object-fit:contain;">` : ''}
                </div>
                <button type="button" class="admin-modal-cancel" id="brandingLogoUploadBtn" style="flex:none;padding:0 16px;height:36px;">${branding.logoUrl ? 'Remplacer' : 'Ajouter un logo'}</button>
                <span class="logo-dropzone-hint">PNG ou JPEG · glisser-déposer possible</span>
                <button type="button" class="admin-reset" id="brandingLogoRemoveBtn" style="${branding.logoUrl ? '' : 'display:none;'}margin-left:auto;">Retirer</button>
                <input type="file" id="brandingLogoInput" accept="image/png,image/jpeg" style="display:none;">
              </div>
            </div>
          </div>
        </section>

        <section class="studio-identity-section">
          <div class="studio-identity-section-head">
            <div><h3>Identité visuelle</h3><p>Donnez à Storm les éléments bruts de la marque. Les couleurs restent celles que vous saisissez ; l’édition décide ensuite comment les employer.</p></div>
          </div>
          <div class="storm-brand-system-grid">
            <section>
              <div class="storm-brand-system-title">Typographies</div>
              <div class="storm-brand-system-copy">Une police principale est nécessaire. Une seconde police peut porter les moments plus éditoriaux.</div>
              <div class="storm-font-stack" id="stormFontStack">
                ${(branding.fonts || []).map((font, index) => `
                  <div class="storm-font-card" data-font-slot="${index}">
                    <div>
                      <span class="storm-font-role">${index === 0 ? 'Police principale' : 'Police d’expression'}</span>
                      <span class="storm-font-name" id="stormFontName${index}">${escapeHtml(font.name || (index === 0 ? 'Roboto' : 'Italiana'))}</span>
                      <span class="storm-font-sample" id="stormFontSample${index}" style="font-family:${escapeHtml(cssFontValue(previewFontFamilies[index], index === 0 ? 'Roboto' : 'Italiana'))};">Projet Quatro · Aa Bb Cc</span>
                      <span class="storm-font-asset-state">${font.source === 'upload' && font.assetUrl ? 'Police importée et disponible à la publication' : 'Police système'}</span>
                    </div>
                    <div class="storm-font-actions">
                      <button type="button" class="storm-brand-mini-btn" data-font-upload="${index}">${font.source === 'upload' ? 'Remplacer' : 'Importer'}</button>
                      ${index === 1 ? '<button type="button" class="storm-brand-mini-btn is-remove" data-font-remove="1">Retirer</button>' : ''}
                      <input type="file" data-font-input="${index}" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" style="display:none;">
                    </div>
                  </div>`).join('')}
              </div>
              ${branding.fonts.length < 2 ? '<button type="button" class="storm-brand-add-btn" id="addSecondFontBtn" style="margin-top:9px;">+ Ajouter une police d’expression</button>' : ''}
              <div class="storm-brand-system-note">WOFF2, WOFF, TTF ou OTF. Une police importée est stockée par Storm et chargée par le site publié.</div>
            </section>

            <section>
              <div class="storm-brand-system-title">Couleurs</div>
              <div class="storm-brand-system-copy">Une couleur principale suffit. Ajoutez une seconde couleur uniquement si elle appartient réellement à l’identité de marque.</div>
              <div class="storm-color-stack" id="stormColorStack">
                ${(branding.colors || []).map((color, index) => {
                  const safeColor = normalizeHex(color, index === 0 ? '#1E1D1E' : (branding.colors?.[0] || '#1E1D1E'));
                  return `
                    <div class="storm-color-row" data-color-slot="${index}">
                      <input type="color" class="storm-color-picker" data-color-picker="${index}" value="${safeColor}">
                      <div class="storm-color-copy"><label>${index === 0 ? 'Couleur principale' : 'Couleur secondaire'}</label><input type="text" class="storm-color-hex" data-color-hex="${index}" value="${safeColor}" maxlength="7" spellcheck="false"></div>
                      ${index === 1 ? '<button type="button" class="storm-brand-mini-btn is-remove" data-color-remove="1">Retirer</button>' : '<span></span>'}
                    </div>`;
                }).join('')}
              </div>
              ${branding.colors.length < 2 ? '<button type="button" class="storm-brand-add-btn" id="addSecondColorBtn" style="margin-top:9px;">+ Ajouter une seconde couleur</button>' : ''}
              <div class="storm-brand-system-note">Storm ne modifie pas silencieusement vos couleurs. Son moteur choisit seulement leur rôle dans chaque édition.</div>
            </section>
          </div>
        </section>

        <section class="studio-identity-section">
          <div class="studio-identity-section-head">
            <div><h3>Édition Storm</h3><p>L’édition structure l’atmosphère de l’expérience. Changer d’édition est un choix volontaire : les contenus restent les mêmes, leur expression change.</p></div>
          </div>

          <div class="storm-edition-current" id="stormEditionCurrent">
            <div class="storm-theme-preview ${previewTheme === 'rainbow-glass' ? 'rainbow' : (previewTheme === 'midnight-frost' ? 'midnight' : 'ivory')}"></div>
            <div class="storm-edition-current-copy">
              <small>${previewTheme === savedPreviewTheme ? 'Édition utilisée' : 'Nouvelle édition à enregistrer'}</small>
              <strong id="stormCurrentEditionLabel">${samplerThemeLabel(previewTheme)}</strong>
              <span id="stormCurrentEditionDescription">${editionDescription(previewTheme)}</span>
            </div>
            <button type="button" class="storm-edition-change-btn" id="toggleEditionChooserBtn">Voir les autres éditions</button>
          </div>

          <div class="storm-edition-chooser" id="stormEditionChooser" aria-hidden="true">
            <p class="storm-edition-chooser-label">Comparez les trois éditions avant de modifier ce choix.</p>
            <div class="storm-theme-grid" id="stormThemeGrid">
              ${themeOption('ivory', 'Ivory', 'Clair & essentiel')}
              ${themeOption('rainbow-glass', 'Rainbow Glass', 'Lumineux & expressif')}
              ${themeOption('midnight-frost', 'Midnight Frost', 'Immersif & premium')}
            </div>
          </div>

          <div class="storm-theme-sampler-shell">
            <div class="storm-theme-sampler-toolbar"><i></i><i></i><i></i><span>Aperçu de votre projet</span></div>
            <div id="stormThemeSamplerHost">${themeSamplerHtml(previewTheme)}</div>
          </div>
          <div class="storm-theme-sampler-caption">
            <span><strong id="stormThemeSamplerLabel">${samplerThemeLabel(previewTheme)}</strong> · aperçu construit à partir de votre projet.</span>
            <span id="stormThemeSamplerState">${previewTheme === savedPreviewTheme ? 'Édition actuelle' : 'Changement à enregistrer'}</span>
          </div>
          <div class="storm-client-example-row"><button type="button" class="storm-client-example-btn" id="openWavestonePreviewBtn">Voir la démo Wavestone ↗</button></div>
        </section>

        <div class="storm-client-preview-modal" id="wavestonePreviewModal" aria-hidden="true">
          <div class="storm-client-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="wavestonePreviewTitle">
            <div class="storm-client-preview-head">
              <div><div class="eyebrow">Exemple client</div><h3 id="wavestonePreviewTitle">Wavestone dans Storm.</h3><p>Un même projet, trois atmosphères. Les codes Wavestone sont traduits dans chaque édition sans modifier la structure Storm.</p></div>
              <button type="button" class="storm-client-preview-close" id="closeWavestonePreviewBtn" aria-label="Fermer">×</button>
            </div>
            <div class="storm-client-preview-tabs">
              <button type="button" class="storm-client-preview-tab" data-wavestone-theme="ivory">Ivory</button>
              <button type="button" class="storm-client-preview-tab active" data-wavestone-theme="rainbow-glass">Rainbow Glass</button>
              <button type="button" class="storm-client-preview-tab" data-wavestone-theme="midnight-frost">Midnight Frost</button>
            </div>
            <div class="storm-theme-sampler-shell" style="margin-top:0;"><div class="storm-theme-sampler-toolbar"><i></i><i></i><i></i><span>Exemple Wavestone</span></div><div id="wavestoneSamplerHost">${themeSamplerHtml('rainbow-glass', wavestoneSamplerOptions())}</div></div>
          </div>
        </div>`;

      const samplerHost = document.getElementById('stormThemeSamplerHost');
      const samplerLabel = document.getElementById('stormThemeSamplerLabel');
      const samplerState = document.getElementById('stormThemeSamplerState');
      const currentEditionLabel = document.getElementById('stormCurrentEditionLabel');
      const currentEditionDescription = document.getElementById('stormCurrentEditionDescription');

      function refreshThemeCards() {
        const savedTheme = previewThemeFromValue(savedThemeValue);
        container.querySelectorAll('[data-preview-theme]').forEach(item => {
          const theme = item.dataset.previewTheme;
          const isPreview = theme === previewTheme;
          const isApplied = theme === savedTheme;
          item.classList.toggle('selected', isPreview);
          item.classList.toggle('is-previewing', isPreview);
          item.classList.toggle('is-applied', isApplied);
          item.setAttribute('aria-pressed', isPreview ? 'true' : 'false');
          const badge = item.querySelector('.storm-theme-active-badge');
          if (badge) badge.textContent = isApplied ? 'Édition enregistrée' : 'Enregistrée';
        });
      }

      function renderThemeSampler(theme, animate = true) {
        previewTheme = theme;
        content.branding.theme = editionValueFromPreview(theme);
        samplerHost.innerHTML = themeSamplerHtml(theme);
        samplerLabel.textContent = samplerThemeLabel(theme);
        currentEditionLabel.textContent = samplerThemeLabel(theme);
        currentEditionDescription.textContent = editionDescription(theme);
        const isSaved = theme === previewThemeFromValue(savedThemeValue);
        samplerState.textContent = isSaved ? 'Édition actuelle' : 'Changement à enregistrer';
        const current = document.getElementById('stormEditionCurrent');
        const currentPreview = current?.querySelector('.storm-theme-preview');
        if (currentPreview) currentPreview.className = `storm-theme-preview ${theme === 'rainbow-glass' ? 'rainbow' : (theme === 'midnight-frost' ? 'midnight' : 'ivory')}`;
        const currentSmall = current?.querySelector('small');
        if (currentSmall) currentSmall.textContent = isSaved ? 'Édition utilisée' : 'Nouvelle édition à enregistrer';
        refreshThemeCards();
        if (animate) {
          const sampler = document.getElementById('stormThemeSampler');
          if (sampler) requestAnimationFrame(() => { sampler.classList.remove('sampler-animate'); requestAnimationFrame(() => sampler.classList.add('sampler-animate')); });
        }
      }

      document.getElementById('brandingNameInput')?.addEventListener('input', e => {
        content.branding.projectName = e.target.value;
        const project = document.getElementById('adminProjectName');
        if (project) project.textContent = e.target.value || 'Projet';
        samplerHost.innerHTML = themeSamplerHtml(previewTheme);
      });

      const chooser = document.getElementById('stormEditionChooser');
      document.getElementById('toggleEditionChooserBtn')?.addEventListener('click', () => {
        const open = !chooser.classList.contains('is-open');
        chooser.classList.toggle('is-open', open);
        chooser.setAttribute('aria-hidden', open ? 'false' : 'true');
        document.getElementById('toggleEditionChooserBtn').textContent = open ? 'Masquer les éditions' : 'Voir les autres éditions';
      });
      container.querySelectorAll('[data-preview-theme]').forEach(option => option.addEventListener('click', () => {
        renderThemeSampler(option.dataset.previewTheme, true);
        studioSetSaveState('dirty');
      }));

      function cleanFontName(filename, fallback) {
        const base = String(filename || '').replace(/\.(woff2?|ttf|otf)$/i, '').replace(/[-_]+/g, ' ').trim();
        return base || fallback;
      }

      async function loadBrandFont(file, index) {
        if (!file) return;
        if (!/\.(woff2?|ttf|otf)$/i.test(file.name || '')) {
          showToast('Format de police non supporté — utilisez WOFF2, WOFF, TTF ou OTF.');
          return;
        }
        showToast('Import de la police…');
        const result = await uploadFile(file);
        if (!result?.ok || !result.url) {
          showToast(result?.unauthorized ? 'Session expirée — reconnectez-vous.' : (result?.error || 'Impossible d’importer cette police.'));
          return;
        }
        try {
          const previewFamily = `StormPreviewFont${index}_${Date.now()}`;
          const face = new FontFace(previewFamily, `url("${result.url}")`);
          await face.load();
          document.fonts.add(face);
          previewFontFamilies[index] = previewFamily;
          content.branding.fonts[index] = {
            name: cleanFontName(file.name, index === 0 ? 'Police principale' : 'Police d’expression'),
            fileName: file.name,
            source: 'upload',
            assetUrl: result.url
          };
          studioSetSaveState('dirty');
          renderThemeSampler(previewTheme, false);
          render();
          showToast('Police importée. Enregistrez les réglages pour la conserver.');
        } catch (error) {
          console.warn(error);
          showToast('La police a été envoyée mais son aperçu n’a pas pu être chargé.');
        }
      }

      container.querySelectorAll('[data-font-upload]').forEach(button => button.addEventListener('click', () => container.querySelector(`[data-font-input="${button.dataset.fontUpload}"]`)?.click()));
      container.querySelectorAll('[data-font-input]').forEach(input => input.addEventListener('change', () => {
        const index = Number(input.dataset.fontInput);
        const file = input.files?.[0];
        input.value = '';
        loadBrandFont(file, index);
      }));
      container.querySelector('[data-font-remove="1"]')?.addEventListener('click', () => {
        content.branding.fonts = content.branding.fonts.slice(0, 1);
        previewFontFamilies[1] = previewFontFamilies[0] || 'Roboto';
        studioSetSaveState('dirty');
        render();
      });
      document.getElementById('addSecondFontBtn')?.addEventListener('click', () => {
        if (content.branding.fonts.length >= 2) return;
        content.branding.fonts.push({ name: 'Italiana', fileName: '', source: 'system', assetUrl: '' });
        studioSetSaveState('dirty');
        render();
      });

      function setBrandColor(index, raw, source) {
        const fallback = index === 0 ? '#1E1D1E' : (content.branding.colors[0] || '#1E1D1E');
        const value = normalizeHex(raw, fallback);
        content.branding.colors[index] = value;
        const picker = container.querySelector(`[data-color-picker="${index}"]`);
        const hex = container.querySelector(`[data-color-hex="${index}"]`);
        if (picker && source !== 'picker') picker.value = value;
        if (hex && source !== 'hex') hex.value = value;
        samplerHost.innerHTML = themeSamplerHtml(previewTheme);
      }
      container.querySelectorAll('[data-color-picker]').forEach(input => input.addEventListener('input', () => {
        const index = Number(input.dataset.colorPicker);
        setBrandColor(index, input.value, 'picker');
        const hex = container.querySelector(`[data-color-hex="${index}"]`);
        if (hex) hex.value = input.value.toUpperCase();
      }));
      container.querySelectorAll('[data-color-hex]').forEach(input => {
        input.addEventListener('input', () => {
          const index = Number(input.dataset.colorHex);
          const raw = input.value.trim().toUpperCase();
          if (/^#[0-9A-F]{6}$/.test(raw)) setBrandColor(index, raw, 'hex');
        });
        input.addEventListener('blur', () => setBrandColor(Number(input.dataset.colorHex), input.value, 'none'));
      });
      container.querySelector('[data-color-remove="1"]')?.addEventListener('click', () => {
        content.branding.colors = content.branding.colors.slice(0, 1);
        studioSetSaveState('dirty');
        render();
      });
      document.getElementById('addSecondColorBtn')?.addEventListener('click', () => {
        if (content.branding.colors.length >= 2) return;
        content.branding.colors.push(content.branding.colors[0] || '#1E1D1E');
        studioSetSaveState('dirty');
        render();
      });

      const wavestoneModal = document.getElementById('wavestonePreviewModal');
      const wavestoneHost = document.getElementById('wavestoneSamplerHost');
      function renderWavestoneSampler(theme, animate = true) {
        wavestoneHost.innerHTML = themeSamplerHtml(theme, wavestoneSamplerOptions());
        wavestoneModal.querySelectorAll('[data-wavestone-theme]').forEach(button => button.classList.toggle('active', button.dataset.wavestoneTheme === theme));
        if (animate) {
          const sampler = wavestoneHost.querySelector('.storm-theme-sampler');
          requestAnimationFrame(() => { sampler?.classList.remove('sampler-animate'); requestAnimationFrame(() => sampler?.classList.add('sampler-animate')); });
        }
      }
      document.getElementById('openWavestonePreviewBtn')?.addEventListener('click', () => {
        wavestoneModal.classList.add('open');
        wavestoneModal.setAttribute('aria-hidden', 'false');
        renderWavestoneSampler('rainbow-glass', true);
      });
      document.getElementById('closeWavestonePreviewBtn')?.addEventListener('click', () => {
        wavestoneModal.classList.remove('open');
        wavestoneModal.setAttribute('aria-hidden', 'true');
      });
      wavestoneModal?.addEventListener('click', event => {
        if (event.target === wavestoneModal) {
          wavestoneModal.classList.remove('open');
          wavestoneModal.setAttribute('aria-hidden', 'true');
        }
      });
      wavestoneModal?.querySelectorAll('[data-wavestone-theme]').forEach(button => button.addEventListener('click', () => renderWavestoneSampler(button.dataset.wavestoneTheme, true)));

      const logoInput = document.getElementById('brandingLogoInput');
      const logoDropzone = document.getElementById('brandingLogoDropzone');
      document.getElementById('brandingLogoUploadBtn')?.addEventListener('click', () => logoInput?.click());
      async function handleLogoFile(file) {
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
          showToast('Format non supporté — utilisez un PNG ou un JPEG.');
          return;
        }
        showToast('Envoi du logo…');
        const result = await uploadFile(file, 640);
        if (!result?.ok || !result.url) {
          showToast(result?.unauthorized ? 'Session expirée — reconnectez-vous.' : 'Impossible d’envoyer ce logo.');
          return;
        }
        content.branding.logoUrl = result.url;
        studioSetSaveState('dirty');
        render();
        showToast('Logo envoyé. Enregistrez les réglages pour le conserver.');
      }
      logoInput?.addEventListener('change', () => { const file = logoInput.files?.[0]; logoInput.value = ''; handleLogoFile(file); });
      ['dragenter', 'dragover'].forEach(evt => logoDropzone?.addEventListener(evt, e => { e.preventDefault(); logoDropzone.classList.add('drag-over'); }));
      ['dragleave', 'drop'].forEach(evt => logoDropzone?.addEventListener(evt, e => { e.preventDefault(); logoDropzone.classList.remove('drag-over'); }));
      logoDropzone?.addEventListener('drop', e => { const file = e.dataTransfer?.files?.[0]; if (file) handleLogoFile(file); });
      document.getElementById('brandingLogoRemoveBtn')?.addEventListener('click', () => {
        content.branding.logoUrl = '';
        studioSetSaveState('dirty');
        render();
      });

      document.getElementById('saveIdentityBtn')?.addEventListener('click', async () => {
        const name = String(content.branding.projectName || '').trim();
        if (!name) {
          const isAuto = document.body.dataset.studioSaveSource === 'auto';
          delete document.body.dataset.studioSaveSource;
          if (!isAuto) {
            showToast('Ajoutez un nom de projet avant d’enregistrer.');
            document.getElementById('brandingNameInput')?.focus();
          }
          return;
        }
        content.branding.projectName = name;
        const result = await saveContent(buildSavePayload(content));
        if (handleSaveResult(result, 'Identité et apparence enregistrées.')) {
          if (result.saveSource !== 'auto' && result.content?.branding) content.branding = result.content.branding;
          savedThemeValue = content.branding.theme || 'default';
          applyBranding(content.branding);
          currentAdminContent = content;
          if (result.saveSource !== 'auto') render();
          else studioQueueContextSaveDockBind();
        }
      });

      refreshThemeCards();
    }

    render();
  }
  function renderStructureEditor(content) {
    const container = document.getElementById('adminStructureEditor');
    if (!container) return;

    content.siteStructure = studioNormalizeSiteStructure(content.siteStructure, content.team);

    const rows = [
      { key:'home', label:'Accueil', help:'Le point d’entrée du site. Il se recompose automatiquement à partir des contenus publiés.', fixed:true },
      { key:'timeline', label:'Le projet', help:'La présentation du projet et ses grandes étapes.' },
      { key:'news', label:'Actualités', help:'Les informations publiées au fil du projet.' },
      { key:'spaces', label:'Espaces', help:'Les espaces, plans et éléments qui permettent de se projeter.' },
      { key:'questions', label:'Questions', help:'Les réponses officielles proposées par Storm Match.' },
      { key:'ambassadors', label:'Ambassadeurs', help:'Le réseau de proximité et les relais du projet.' },
      { key:'team', label:'Équipe projet', help:'Les personnes qui portent le projet, affichées dans « Le projet ».' }
    ];

    function rowHtml(item) {
      const visible = item.fixed || content.siteStructure[item.key] !== false;
      return `
        <div class="studio-structure-row" data-structure-row="${escapeHtml(item.key)}">
          <div class="studio-structure-row-main">
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.help)}</span>
          </div>
          <div class="studio-structure-row-control">
            ${item.fixed
              ? '<span class="studio-structure-fixed">Toujours visible</span>'
              : `<span class="studio-structure-state" data-structure-state="${escapeHtml(item.key)}">${visible ? 'Visible' : 'Masqué'}</span>
                 <button type="button" class="studio-structure-switch" role="switch" aria-checked="${visible ? 'true' : 'false'}" aria-label="${visible ? 'Masquer' : 'Afficher'} ${escapeHtml(item.label)}" data-structure-toggle="${escapeHtml(item.key)}"></button>`}
          </div>
        </div>`;
    }

    container.innerHTML = `
      <section class="studio-structure-shell">
        <div class="studio-structure-head studio-domain-head">
          <div class="studio-structure-head-copy studio-domain-head-copy">
            <div class="admin-page-eyebrow">Administration</div>
            <h1 class="studio-structure-title">Structure du site.</h1>
            <p>Choisissez ce qui apparaît sur le site public. Masquer une rubrique ne supprime pas son contenu : vous pouvez continuer à la préparer dans le Studio.</p>
          </div>
          <button type="button" class="studio-structure-save studio-domain-save" id="studioStructureSave">Enregistrer la structure</button>
        </div>
        <div class="studio-structure-surface">
          ${rows.map(rowHtml).join('')}
        </div>
        <div class="studio-structure-note">Enregistrer protège vos choix dans le Studio. Le site public ne change qu’au prochain « Publier ».</div>
      </section>`;

    function syncToggle(key) {
      const button = container.querySelector(`[data-structure-toggle="${key}"]`);
      const state = container.querySelector(`[data-structure-state="${key}"]`);
      if (!button) return;
      const visible = content.siteStructure[key] !== false;
      button.setAttribute('aria-checked', visible ? 'true' : 'false');
      const item = rows.find(row => row.key === key);
      button.setAttribute('aria-label', `${visible ? 'Masquer' : 'Afficher'} ${item?.label || key}`);
      if (state) state.textContent = visible ? 'Visible' : 'Masqué';
    }

    container.querySelectorAll('[data-structure-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.structureToggle;
        if (!key || key === 'home') return;
        content.siteStructure[key] = content.siteStructure[key] === false;
        syncToggle(key);
        studioSetSaveState('dirty');
      });
    });

    document.getElementById('studioStructureSave')?.addEventListener('click', async () => {
      content.siteStructure = studioNormalizeSiteStructure(content.siteStructure, content.team);
      const result = await saveContent(buildSavePayload(content));
      if (handleSaveResult(result, 'Structure du site enregistrée.')) {
        if (result.content?.siteStructure) {
          content.siteStructure = studioNormalizeSiteStructure(result.content.siteStructure, result.content.team || content.team);
        }
        currentAdminContent = content;
        if (result.saveSource !== 'auto') renderStructureEditor(content);
        else studioQueueContextSaveDockBind();
      }
    });
  }
  function hydrateProjectForStudio(rawProject) {
    const fallback = studioDefaultProjectSeed();
    const raw = rawProject && typeof rawProject === 'object' ? rawProject : {};
    const introRaw = raw.intro && typeof raw.intro === 'object' ? raw.intro : {};
    const hasSections = Array.isArray(raw.sections) && raw.sections.length > 0;
    const project = {
      intro: {
        title: String(introRaw.title || '').trim() || fallback.intro.title,
        body: String(introRaw.body || introRaw.description || '').trim() || fallback.intro.body
      },
      sections: hasSections ? raw.sections : fallback.sections
    };
    project.sections.forEach(section => {
      if (typeof section.enabled !== 'boolean') section.enabled = true;
    });
    return { project, bootstrapped: !hasSections };
  }
  function studioInlineMarkupToEditorHtml(value) {
    let safe = escapeHtml(String(value || ''));
    safe = safe.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\+\+([\s\S]+?)\+\+/g, '<u>$1</u>');
    safe = safe.replace(/\/\/([\s\S]+?)\/\//g, '<em>$1</em>');
    // Legacy single-star italics are accepted when they already exist in content.
    safe = safe.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
    return safe.replace(/\r?\n/g, '<br>');
  }
  function studioInlineEditorToMarkup(surface) {
    if (!surface) return '';
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') return '\n';
      const inner = [...node.childNodes].map(walk).join('');
      if (tag === 'strong' || tag === 'b') return `**${inner}**`;
      if (tag === 'em' || tag === 'i') return `//${inner}//`;
      if (tag === 'u') return `++${inner}++`;
      if (tag === 'div' || tag === 'p') return `${inner}\n`;
      return inner;
    }
    return [...surface.childNodes].map(walk).join('')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\n+$/g, '');
  }
  function studioInlineEditorHtml(id, value, options = {}) {
    const minHeight = Number(options.minHeight || 96);
    const placeholder = options.placeholder || 'Écrivez ici…';
    const compact = options.compact ? ' is-compact' : '';
    return `<div class="studio-inline-editor${compact}" data-inline-editor="${escapeHtml(id)}">
      <div class="studio-inline-toolbar" role="toolbar" aria-label="Mise en forme du texte">
        <button type="button" data-inline-command="bold" aria-label="Mettre la sélection en gras" title="Gras"><strong>B</strong></button>
        <button type="button" data-inline-command="italic" aria-label="Mettre la sélection en italique" title="Italique">I</button>
        <button type="button" data-inline-command="underline" aria-label="Souligner la sélection" title="Souligner">U</button>
        <span class="studio-inline-toolbar-note">Sélectionnez le texte à mettre en forme</span>
      </div>
      <div class="studio-inline-surface" id="${escapeHtml(id)}" contenteditable="true" spellcheck="true" data-placeholder="${escapeHtml(placeholder)}" style="min-height:${minHeight}px;">${studioInlineMarkupToEditorHtml(value)}</div>
    </div>`;
  }
  function studioBindInlineEditor(root, id, onChange) {
    const surface = root && root.querySelector ? root.querySelector(`#${id}`) : document.getElementById(id);
    if (!surface) return null;
    const wrapper = surface.closest('.studio-inline-editor');
    const commit = () => onChange && onChange(studioInlineEditorToMarkup(surface));

    wrapper?.querySelectorAll('[data-inline-command]').forEach(button => {
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount || selection.isCollapsed) {
          showToast('Sélectionnez d’abord le texte à mettre en forme.');
          surface.focus();
          return;
        }
        const range = selection.getRangeAt(0);
        if (!surface.contains(range.commonAncestorContainer)) {
          showToast('Sélectionnez du texte dans ce champ.');
          return;
        }
        surface.focus();
        document.execCommand(button.dataset.inlineCommand, false, null);
        commit();
      });
    });

    surface.addEventListener('input', commit);
    surface.addEventListener('paste', event => {
      event.preventDefault();
      const text = event.clipboardData?.getData('text/plain') || '';
      document.execCommand('insertText', false, text);
    });
    return surface;
  }
  function renderProjectEditor(content) {
    const container = document.getElementById('adminProjectEditor');
    if (!container) return;

    const hydratedProject = hydrateProjectForStudio(content.project);
    content.project = hydratedProject.project;
    if (hydratedProject.bootstrapped) {
      // Defensive client guard for legacy/partially migrated servers: never leave
      // the editor on a blank project. Saving will persist this proposed base.
      studioSetSaveState('dirty');
    }
    content.milestones = Array.isArray(content.milestones) ? content.milestones : [];
    content.team = Array.isArray(content.team) ? content.team : [];

    const TYPE_META = {
      focus:      { label:'Focus', description:'Mettre en avant une idée structurante.' },
      keyFigures: { label:'Chiffres clés', description:'Donner quelques repères immédiatement lisibles.' },
      text:       { label:'Texte', description:'Développer une information ou une explication.' },
      image:      { label:'Image', description:'Donner à voir un élément du projet.' },
      gallery:    { label:'Galerie', description:'Réunir plusieurs images dans une même séquence.' },
      timeline:   { label:'Grandes étapes', description:'Montrer la trajectoire et le moment actuel.' },
      quote:      { label:'Citation', description:'Faire entendre une voix du projet.' },
      choices:    { label:'Les grands choix', description:'Expliquer les principes qui guident les décisions.' },
      team:       { label:'Équipe projet', description:'Présenter les personnes qui portent le projet.' }
    };

    let activeId = container.dataset.projectActiveId || 'intro';
    let draggingSectionId = null;

    function markDirty() { studioSetSaveState('dirty'); }
    function uid(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }
    function safeId(value) { return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '-'); }
    function activeSection() { return content.project.sections.find(section => section.id === activeId) || null; }

    function sectionMeta(section) {
      if (!section) return { type:'', title:'' };
      const label = TYPE_META[section.type]?.label || 'Section';
      let title = '';
      if (section.type === 'focus' || section.type === 'text') title = section.title || TYPE_META[section.type]?.description || 'Sans titre';
      else if (section.type === 'quote') title = section.quote || 'Citation du projet';
      else if (section.type === 'keyFigures') title = `${(section.items || []).length} repère${(section.items || []).length > 1 ? 's' : ''}`;
      else if (section.type === 'timeline') title = `${content.milestones.length} étape${content.milestones.length > 1 ? 's' : ''}`;
      else if (section.type === 'choices') title = section.title || `${(section.items || []).length} choix`;
      else if (section.type === 'team') title = `${content.team.length} personne${content.team.length > 1 ? 's' : ''}`;
      else if (section.type === 'image') title = section.caption || section.asset?.alt || 'Ajouter un visuel';
      else if (section.type === 'gallery') title = section.title || ((section.items || []).length ? `${section.items.length} image${section.items.length > 1 ? 's' : ''}` : 'Ajouter plusieurs visuels');
      return { type:label, title };
    }

    function structureHtml() {
      const enabledCount = content.project.sections.filter(section => section.enabled !== false).length;
      const rows = content.project.sections.map(section => {
        const meta = sectionMeta(section);
        const enabled = section.enabled !== false;
        return `
          <div class="studio-project-row ${activeId === section.id ? 'is-active' : ''} ${enabled ? '' : 'is-disabled'}" data-project-row="${escapeHtml(section.id)}">
            <span class="studio-project-grip" data-project-drag="${escapeHtml(section.id)}" draggable="true" title="Déplacer cette section" aria-label="Déplacer ${escapeHtml(meta.type)}">⋮⋮</span>
            <button type="button" class="studio-project-row-main" data-project-select="${escapeHtml(section.id)}">
              <span class="studio-project-row-type">${escapeHtml(meta.type)}</span>
              <span class="studio-project-row-title" data-project-row-title="${escapeHtml(section.id)}">${escapeHtml(meta.title)}</span>
            </button>
            <button type="button" class="studio-project-switch" role="switch" aria-checked="${enabled ? 'true' : 'false'}" aria-label="${enabled ? 'Masquer' : 'Afficher'} la section ${escapeHtml(meta.type)}" data-project-toggle="${escapeHtml(section.id)}"></button>
          </div>`;
      }).join('');

      return `
        <aside class="studio-project-structure">
          <div class="studio-project-structure-head"><strong>Structure proposée</strong><span>${enabledCount} active${enabledCount > 1 ? 's' : ''}</span></div>
          <p class="studio-project-structure-note">Une base est déjà préparée. Désactivez ce qui n’est pas utile et faites glisser les poignées pour changer l’ordre.</p>
          <div class="studio-project-list">
            <div class="studio-project-row ${activeId === 'intro' ? 'is-active' : ''}">
              <span class="studio-project-grip is-fixed" aria-hidden="true">•</span>
              <button type="button" class="studio-project-row-main" data-project-select="intro">
                <span class="studio-project-row-type">Ouverture</span>
                <span class="studio-project-row-title" data-project-row-title="intro">${escapeHtml(content.project.intro.title || 'Introduction')}</span>
              </button>
              <span class="studio-project-fixed-state">Toujours</span>
            </div>
            ${rows}
          </div>
          <div class="studio-project-structure-foot">L’ouverture reste en premier. Désactiver une section conserve son contenu : vous pourrez la réactiver plus tard sans rien perdre.</div>
        </aside>`;
    }

    function detailTop(title, eyebrow, section, index) {
      if (!section) {
        return `<div class="studio-project-detail-top"><div><div class="studio-project-detail-eyebrow">${escapeHtml(eyebrow)}</div><div class="studio-project-detail-title-row"><h2 class="studio-project-detail-title">${escapeHtml(title)}</h2><span class="studio-project-visibility is-on">Toujours visible</span></div></div></div>`;
      }
      const enabled = section.enabled !== false;
      return `
        <div class="studio-project-detail-top">
          <div>
            <div class="studio-project-detail-eyebrow">${escapeHtml(eyebrow)}</div>
            <div class="studio-project-detail-title-row">
              <h2 class="studio-project-detail-title">${escapeHtml(title)}</h2>
              <span class="studio-project-visibility ${enabled ? 'is-on' : ''}">${enabled ? 'Visible sur la page' : 'Masquée'}</span>
            </div>
          </div>
          <div class="studio-project-order" aria-label="Ordre de la section">
            <button type="button" data-project-move="-1" title="Monter" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" data-project-move="1" title="Descendre" ${index === content.project.sections.length - 1 ? 'disabled' : ''}>↓</button>
          </div>
        </div>`;
    }

    function repeatPairHtml(section, kind) {
      const items = Array.isArray(section.items) ? section.items : [];
      const isFigures = kind === 'figures';
      return `
        <div class="studio-project-repeat-list">
          ${items.map((item,index) => `
            <div class="studio-project-repeat-item" data-project-repeat-index="${index}">
              <div class="studio-project-repeat-grid">
                <input class="form-input" type="text" data-project-repeat-field="${isFigures ? 'value' : 'title'}" value="${escapeHtml(item?.[isFigures ? 'value' : 'title'] || '')}" placeholder="${isFigures ? 'Ex. 8/10' : 'Titre du choix'}">
                <input class="form-input" type="text" data-project-repeat-field="${isFigures ? 'label' : 'body'}" value="${escapeHtml(item?.[isFigures ? 'label' : 'body'] || '')}" placeholder="${isFigures ? 'Ex. postes pour 10 collaborateurs' : 'Ce que ce choix signifie'}">
              </div>
              <div class="studio-project-repeat-actions">
                <button type="button" class="studio-project-mini-btn" data-project-repeat-move="-1" ${index===0?'disabled':''}>↑</button>
                <button type="button" class="studio-project-mini-btn" data-project-repeat-move="1" ${index===items.length-1?'disabled':''}>↓</button>
                <button type="button" class="studio-project-mini-btn is-danger" data-project-repeat-remove>Retirer</button>
              </div>
            </div>`).join('')}
        </div>
        <button type="button" class="studio-project-add-line" data-project-repeat-add>+ ${isFigures ? 'Ajouter un chiffre' : 'Ajouter un choix'}</button>`;
    }

    function milestoneHtml(m, index) {
      return `
        <div class="studio-project-milestone" data-project-milestone="${escapeHtml(m.id)}">
          <div class="studio-project-milestone-head">
            <select class="form-input" data-project-milestone-field="status" aria-label="État">
              <option value="done" ${m.status==='done'?'selected':''}>Terminé</option>
              <option value="current" ${m.status==='current'?'selected':''}>En ce moment</option>
              <option value="future" ${m.status==='future'?'selected':''}>À suivre</option>
            </select>
            <input class="form-input" type="text" data-project-milestone-field="date" value="${escapeHtml(m.date || '')}" placeholder="Période ou date">
          </div>
          <input class="form-input" type="text" data-project-milestone-field="label" value="${escapeHtml(m.label || '')}" placeholder="Nom de l’étape">
          <textarea class="form-input" data-project-milestone-field="desc" placeholder="Ce qui se passe à cette étape">${escapeHtml(m.desc || '')}</textarea>
          <div class="studio-project-repeat-actions">
            <button type="button" class="studio-project-mini-btn" data-project-milestone-move="-1" ${index===0?'disabled':''}>↑</button>
            <button type="button" class="studio-project-mini-btn" data-project-milestone-move="1" ${index===content.milestones.length-1?'disabled':''}>↓</button>
            <button type="button" class="studio-project-mini-btn is-danger" data-project-milestone-remove>Retirer</button>
          </div>
        </div>`;
    }

    function teamMemberHtml(member, index) {
      const prefix = `projectTeam-${safeId(member.id)}`;
      const initials = String(member.name || '').split(/\s+/).filter(Boolean).slice(0,2).map(v => v[0]).join('').toUpperCase();
      return `
        <div class="studio-project-person-editor" data-project-person="${escapeHtml(member.id)}">
          <div class="studio-project-person-head">
            <strong>${escapeHtml(member.name || `Personne ${index + 1}`)}</strong>
            <div class="studio-project-person-head-actions">
              <button type="button" class="studio-project-mini-btn" data-project-person-move="-1" ${index===0?'disabled':''} title="Monter">↑</button>
              <button type="button" class="studio-project-mini-btn" data-project-person-move="1" ${index===content.team.length-1?'disabled':''} title="Descendre">↓</button>
              <button type="button" class="studio-project-mini-btn is-danger" data-project-person-remove>Retirer</button>
            </div>
          </div>
          <div class="studio-project-person-body">
            <div class="studio-project-photo-drop" id="${prefix}Zone" data-project-person-photo="${prefix}" tabindex="0" role="button" aria-label="Ajouter une photo pour ${escapeHtml(member.name || 'cette personne')}">
              <div class="studio-project-person-photo" id="${prefix}Preview">${member.imageUrl ? `<img src="${escapeHtml(member.imageUrl)}" alt="">` : escapeHtml(initials || 'PHOTO')}</div>
              <strong>${member.imageUrl ? 'Changer la photo' : 'Ajouter une photo'}</strong>
              <span>Déposez une image ici ou choisissez-la sur votre ordinateur.</span>
              <button type="button" class="studio-project-photo-browse" data-project-photo-browse>Parcourir</button>
              ${member.imageUrl ? '<button type="button" class="studio-project-photo-remove" data-project-photo-remove>Retirer la photo</button>' : ''}
              <input type="file" id="${prefix}Input" accept="image/png,image/jpeg" style="display:none;">
            </div>
            <div class="studio-project-person-fields">
              <div class="studio-project-person-field">
                <label>Nom</label>
                <input class="form-input" type="text" data-project-person-field="name" value="${escapeHtml(member.name || '')}" placeholder="Prénom Nom">
              </div>
              <div class="studio-project-person-field">
                <label>Rôle dans le projet</label>
                <input class="form-input" type="text" data-project-person-field="title" value="${escapeHtml(member.title || '')}" placeholder="Ex. Cheffe de projet">
              </div>
              <div class="studio-project-person-field is-wide">
                <label>Organisation ou équipe <span style="font-weight:400;color:var(--ink-35);">(facultatif)</span></label>
                <input class="form-input" type="text" data-project-person-field="badge" value="${escapeHtml(member.badge || '')}" placeholder="Ex. Direction des environnements de travail">
              </div>
            </div>
          </div>
        </div>`;
    }

    function detailHtml() {
      if (activeId === 'intro') {
        return `
          <section class="studio-project-detail">
            ${detailTop('Introduction', 'Ouverture de la page')}
            <div class="studio-project-fields">
              <label class="admin-editor-label">L’idée principale</label>
              <input type="text" class="form-input" id="projectIntroTitle" value="${escapeHtml(content.project.intro.title || '')}" placeholder="Ce que les collaborateurs doivent comprendre d’abord">
              <p class="studio-project-help">Cette ouverture reste toujours en premier. Storm décide ensuite de sa composition selon l’édition utilisée.</p>
              <label class="admin-editor-label">En quelques lignes</label>
              ${studioInlineEditorHtml('projectIntroBody', content.project.intro.body || '', { minHeight:150, placeholder:'Donnez le contexte sans entrer encore dans tous les détails.' })}
            </div>
          </section>`;
      }

      const section = activeSection();
      if (!section) {
        activeId = 'intro';
        return detailHtml();
      }
      const index = content.project.sections.indexOf(section);
      const meta = TYPE_META[section.type] || { label:'Section' };
      let fields = '';

      if (section.type === 'focus' || section.type === 'text') {
        fields = `
          <label class="admin-editor-label">Titre</label>
          <input type="text" class="form-input" data-project-field="title" value="${escapeHtml(section.title || '')}">
          <label class="admin-editor-label">Texte</label>
          ${studioInlineEditorHtml('projectSectionBody', section.body || '', { minHeight:180, placeholder:'Développez cette idée en quelques paragraphes.' })}`;
      } else if (section.type === 'quote') {
        fields = `
          <label class="admin-editor-label">Citation</label>
          <textarea class="form-input" data-project-field="quote" style="min-height:150px;">${escapeHtml(section.quote || '')}</textarea>
          <label class="admin-editor-label">Qui parle ?</label>
          <input type="text" class="form-input" data-project-field="attribution" value="${escapeHtml(section.attribution || '')}" placeholder="Ex. Équipe projet">`;
      } else if (section.type === 'keyFigures') {
        fields = `
          <label class="admin-editor-label">Titre de la séquence</label>
          <input type="text" class="form-input" data-project-field="title" value="${escapeHtml(section.title || '')}">
          ${repeatPairHtml(section, 'figures')}`;
      } else if (section.type === 'choices') {
        fields = `
          <label class="admin-editor-label">Titre de la séquence</label>
          <input type="text" class="form-input" data-project-field="title" value="${escapeHtml(section.title || '')}">
          ${repeatPairHtml(section, 'choices')}`;
      } else if (section.type === 'timeline') {
        const progress = computeProgressFromMilestones(content.milestones);
        fields = `
          <p class="studio-project-status-note">Storm calcule la progression automatiquement à partir des étapes. Une seule étape doit être « En ce moment ».</p>
          <div style="display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:14px;">
            <strong style="font-size:.70rem;">${escapeHtml(progress.currentStepLabel)} sur ${progress.totalSteps}</strong>
            <span style="color:var(--ink-35);font-size:.58rem;">${progress.percent}%</span>
          </div>
          <div class="studio-project-milestones">${content.milestones.map(milestoneHtml).join('')}</div>
          <button type="button" class="studio-project-add-line" id="projectAddMilestone">+ Ajouter une étape</button>`;
      } else if (section.type === 'team') {
        fields = `
          <p class="studio-project-help" style="margin:0 0 14px;">Présentez les quelques personnes qui permettent aux collaborateurs de comprendre qui porte le projet et à qui s’adresser.</p>
          <div class="studio-project-team-list">${content.team.map(teamMemberHtml).join('')}</div>
          <button type="button" class="studio-project-add-line" id="projectAddTeamMember">+ Ajouter une personne</button>`;
      } else if (section.type === 'image') {
        section.asset = section.asset && typeof section.asset === 'object' ? section.asset : { url:'', alt:'' };
        const prefix = `projectAsset-${safeId(section.id)}`;
        fields = `
          <label class="admin-editor-label">Visuel</label>
          <div class="studio-project-media-card">${uploaderHtml(prefix, section.asset.url, { label:'Choisir une image', accept:'image/png,image/jpeg', size:72 })}</div>
          <label class="admin-editor-label">Ce que montre l’image</label>
          <input type="text" class="form-input" data-project-asset-alt value="${escapeHtml(section.asset.alt || '')}" placeholder="Description utile si l’image ne s’affiche pas">
          <label class="admin-editor-label">Légende affichée <span style="font-weight:400;text-transform:none;letter-spacing:0;">(facultatif)</span></label>
          <input type="text" class="form-input" data-project-field="caption" value="${escapeHtml(section.caption || '')}">`;
      } else if (section.type === 'gallery') {
        section.items = Array.isArray(section.items) ? section.items : [];
        fields = `
          <label class="admin-editor-label">Titre de la galerie <span style="font-weight:400;text-transform:none;letter-spacing:0;">(facultatif)</span></label>
          <input type="text" class="form-input" data-project-field="title" value="${escapeHtml(section.title || '')}">
          <div class="studio-project-repeat-list">
            ${section.items.map((asset, assetIndex) => {
              const prefix = `projectGallery-${safeId(section.id)}-${assetIndex}`;
              return `<div class="studio-project-repeat-item" data-project-gallery-index="${assetIndex}">
                <div class="studio-project-media-card">${uploaderHtml(prefix, asset.url, { label:'Choisir une image', accept:'image/png,image/jpeg', size:64 })}</div>
                <label class="admin-editor-label">Ce que montre cette image</label>
                <input type="text" class="form-input" data-project-gallery-alt value="${escapeHtml(asset.alt || '')}">
                <div class="studio-project-repeat-actions">
                  <button type="button" class="studio-project-mini-btn" data-project-gallery-move="-1" ${assetIndex===0?'disabled':''}>↑</button>
                  <button type="button" class="studio-project-mini-btn" data-project-gallery-move="1" ${assetIndex===section.items.length-1?'disabled':''}>↓</button>
                  <button type="button" class="studio-project-mini-btn is-danger" data-project-gallery-remove>Retirer</button>
                </div>
              </div>`;
            }).join('')}
          </div>
          <button type="button" class="studio-project-add-line" id="projectAddGalleryImage">+ Ajouter une image</button>`;
      }

      return `
        <section class="studio-project-detail">
          ${detailTop(meta.label, 'Section', section, index)}
          <div class="studio-project-fields">${fields}</div>
        </section>`;
    }

    function render() {
      container.dataset.projectActiveId = activeId;
      container.innerHTML = `
        <div class="studio-project-head studio-domain-head">
          <div class="studio-project-head-copy studio-domain-head-copy">
            <div class="admin-page-eyebrow">Contenus</div>
            <h1>Le projet.</h1>
            <p>Rassemblez les éléments qui racontent le projet ; Storm se charge de leur donner la bonne forme dans l’édition publiée.</p>
          </div>
          <button type="button" class="studio-project-save studio-domain-save" id="studioProjectSave">Enregistrer Le projet</button>
        </div>
        <div class="studio-project-layout">${structureHtml()}${detailHtml()}</div>`;
      bind();
    }

    function rerender() { render(); }

    function refreshActiveRow() {
      if (activeId === 'intro') {
        const target = container.querySelector('[data-project-row-title="intro"]');
        if (target) target.textContent = content.project.intro.title || 'Introduction';
        return;
      }
      const section = activeSection();
      if (!section) return;
      const target = container.querySelector(`[data-project-row-title="${CSS.escape(section.id)}"]`);
      if (target) target.textContent = sectionMeta(section).title;
    }

    function bindGalleryUploaders(section) {
      (section.items || []).forEach((asset,index) => {
        const prefix = `projectGallery-${safeId(section.id)}-${index}`;
        bindUploader(prefix, asset, 'url', {
          resizeMaxDim:1800,
          onChanged:() => { markDirty(); refreshActiveRow(); }
        });
      });
    }

    function bindTeamPhoto(member) {
      const prefix = `projectTeam-${safeId(member.id)}`;
      const input = document.getElementById(prefix + 'Input');
      const zone = document.getElementById(prefix + 'Zone');
      const preview = document.getElementById(prefix + 'Preview');
      if (!input || !zone || !preview) return;

      function initials() {
        return String(member.name || '').split(/\s+/).filter(Boolean).slice(0,2).map(v => v[0]).join('').toUpperCase() || 'PHOTO';
      }
      function setPreview(url) {
        preview.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="">` : escapeHtml(initials());
      }
      async function handleFile(file) {
        if (!file) return;
        showToast('Envoi en cours...');
        const result = await uploadFile(file, 640);
        if (result.unauthorized) { clearAdminToken(); openAdminModal(); return; }
        if (!result.ok) { showToast(result.error || "Échec de l'envoi."); return; }
        member.imageUrl = result.url;
        setPreview(result.url);
        markDirty();
        showToast('Photo envoyée.');
        rerender();
      }

      zone.addEventListener('click', e => {
        if (e.target.closest('[data-project-photo-remove]')) return;
        input.click();
      });
      zone.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
      });
      zone.querySelector('[data-project-photo-browse]')?.addEventListener('click', e => { e.stopPropagation(); input.click(); });
      input.addEventListener('change', () => { const file = input.files?.[0]; input.value = ''; handleFile(file); });
      ['dragenter','dragover'].forEach(evt => zone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); zone.classList.add('drag-over'); }));
      ['dragleave','drop'].forEach(evt => zone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); zone.classList.remove('drag-over'); }));
      zone.addEventListener('drop', e => { const file = e.dataTransfer?.files?.[0]; if (file) handleFile(file); });
      zone.querySelector('[data-project-photo-remove]')?.addEventListener('click', e => {
        e.stopPropagation(); member.imageUrl = ''; setPreview(''); markDirty(); rerender();
      });
    }

    function clearDropTargets() {
      container.querySelectorAll('.studio-project-row').forEach(row => row.classList.remove('is-drop-target','is-dragging'));
    }

    function moveSectionTo(sourceId, targetId, after) {
      if (!sourceId || !targetId || sourceId === targetId) return;
      const sourceIndex = content.project.sections.findIndex(section => section.id === sourceId);
      if (sourceIndex < 0) return;
      const [moved] = content.project.sections.splice(sourceIndex, 1);
      let targetIndex = content.project.sections.findIndex(section => section.id === targetId);
      if (targetIndex < 0) { content.project.sections.splice(sourceIndex, 0, moved); return; }
      if (after) targetIndex += 1;
      content.project.sections.splice(targetIndex, 0, moved);
      markDirty();
      rerender();
    }

    function bind() {
      container.querySelectorAll('[data-project-select]').forEach(button => {
        button.addEventListener('click', () => { activeId = button.dataset.projectSelect; rerender(); });
      });

      container.querySelectorAll('[data-project-toggle]').forEach(button => {
        button.addEventListener('click', e => {
          e.stopPropagation();
          const section = content.project.sections.find(item => item.id === button.dataset.projectToggle);
          if (!section) return;
          section.enabled = section.enabled === false;
          markDirty();
          rerender();
        });
      });

      container.querySelectorAll('[data-project-drag]').forEach(handle => {
        handle.addEventListener('dragstart', e => {
          draggingSectionId = handle.dataset.projectDrag;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', draggingSectionId);
          handle.closest('.studio-project-row')?.classList.add('is-dragging');
        });
        handle.addEventListener('dragend', () => { draggingSectionId = null; clearDropTargets(); });
      });
      container.querySelectorAll('[data-project-row]').forEach(row => {
        row.addEventListener('dragover', e => {
          if (!draggingSectionId || draggingSectionId === row.dataset.projectRow) return;
          e.preventDefault();
          row.classList.add('is-drop-target');
        });
        row.addEventListener('dragleave', () => row.classList.remove('is-drop-target'));
        row.addEventListener('drop', e => {
          if (!draggingSectionId) return;
          e.preventDefault();
          const rect = row.getBoundingClientRect();
          const after = e.clientY > rect.top + rect.height / 2;
          const targetId = row.dataset.projectRow;
          clearDropTargets();
          moveSectionTo(draggingSectionId, targetId, after);
          draggingSectionId = null;
        });
      });

      const introTitle = document.getElementById('projectIntroTitle');
      introTitle?.addEventListener('input', () => { content.project.intro.title = introTitle.value; markDirty(); refreshActiveRow(); });
      studioBindInlineEditor(container, 'projectIntroBody', value => { content.project.intro.body = value; markDirty(); });

      const section = activeSection();
      if (section) {
        const sectionIndex = content.project.sections.indexOf(section);
        container.querySelectorAll('[data-project-move]').forEach(button => {
          button.addEventListener('click', () => {
            moveItem(content.project.sections, sectionIndex, Number(button.dataset.projectMove));
            markDirty(); rerender();
          });
        });
        container.querySelectorAll('[data-project-field]').forEach(field => {
          field.addEventListener('input', () => { section[field.dataset.projectField] = field.value; markDirty(); refreshActiveRow(); });
        });
        if (section.type === 'focus' || section.type === 'text') {
          studioBindInlineEditor(container, 'projectSectionBody', value => { section.body = value; markDirty(); refreshActiveRow(); });
        }

        if (section.type === 'keyFigures' || section.type === 'choices') {
          section.items = Array.isArray(section.items) ? section.items : [];
          container.querySelectorAll('[data-project-repeat-index]').forEach(itemEl => {
            const index = Number(itemEl.dataset.projectRepeatIndex);
            const item = section.items[index];
            itemEl.querySelectorAll('[data-project-repeat-field]').forEach(field => {
              field.addEventListener('input', () => { item[field.dataset.projectRepeatField] = field.value; markDirty(); refreshActiveRow(); });
            });
            itemEl.querySelectorAll('[data-project-repeat-move]').forEach(button => {
              button.addEventListener('click', () => { moveItem(section.items, index, Number(button.dataset.projectRepeatMove)); markDirty(); rerender(); });
            });
            itemEl.querySelector('[data-project-repeat-remove]')?.addEventListener('click', () => { section.items.splice(index,1); markDirty(); rerender(); });
          });
          container.querySelector('[data-project-repeat-add]')?.addEventListener('click', () => {
            section.items.push(section.type === 'keyFigures' ? { value:'', label:'' } : { title:'', body:'' });
            markDirty(); rerender();
          });
        }

        if (section.type === 'image') {
          section.asset = section.asset && typeof section.asset === 'object' ? section.asset : { url:'', alt:'' };
          const prefix = `projectAsset-${safeId(section.id)}`;
          bindUploader(prefix, section.asset, 'url', { resizeMaxDim:1800, onChanged:() => { markDirty(); refreshActiveRow(); } });
          container.querySelector('[data-project-asset-alt]')?.addEventListener('input', e => { section.asset.alt = e.target.value; markDirty(); refreshActiveRow(); });
        }

        if (section.type === 'gallery') {
          section.items = Array.isArray(section.items) ? section.items : [];
          bindGalleryUploaders(section);
          container.querySelectorAll('[data-project-gallery-index]').forEach(itemEl => {
            const index = Number(itemEl.dataset.projectGalleryIndex);
            const asset = section.items[index];
            itemEl.querySelector('[data-project-gallery-alt]')?.addEventListener('input', e => { asset.alt = e.target.value; markDirty(); refreshActiveRow(); });
            itemEl.querySelectorAll('[data-project-gallery-move]').forEach(button => {
              button.addEventListener('click', () => { moveItem(section.items, index, Number(button.dataset.projectGalleryMove)); markDirty(); rerender(); });
            });
            itemEl.querySelector('[data-project-gallery-remove]')?.addEventListener('click', () => { section.items.splice(index,1); markDirty(); rerender(); });
          });
          document.getElementById('projectAddGalleryImage')?.addEventListener('click', () => {
            section.items.push({ url:'', alt:'' }); markDirty(); rerender();
          });
        }

        if (section.type === 'timeline') {
          container.querySelectorAll('[data-project-milestone]').forEach(card => {
            const id = card.dataset.projectMilestone;
            const milestone = content.milestones.find(item => item.id === id);
            if (!milestone) return;
            card.querySelectorAll('[data-project-milestone-field]').forEach(field => {
              const eventName = field.tagName === 'SELECT' ? 'change' : 'input';
              field.addEventListener(eventName, () => {
                const key = field.dataset.projectMilestoneField;
                if (key === 'status' && field.value === 'current') {
                  content.milestones.forEach(other => {
                    if (other !== milestone && other.status === 'current') other.status = 'future';
                  });
                  milestone.status = 'current';
                  markDirty(); rerender();
                  return;
                }
                milestone[key] = field.value;
                markDirty(); refreshActiveRow();
              });
            });
            card.querySelectorAll('[data-project-milestone-move]').forEach(button => {
              button.addEventListener('click', () => { moveItem(content.milestones, content.milestones.indexOf(milestone), Number(button.dataset.projectMilestoneMove)); markDirty(); rerender(); });
            });
            card.querySelector('[data-project-milestone-remove]')?.addEventListener('click', () => {
              content.milestones = content.milestones.filter(item => item.id !== id); markDirty(); rerender();
            });
          });
          document.getElementById('projectAddMilestone')?.addEventListener('click', () => {
            content.milestones.push({ id:uid('milestone'), status:'future', date:'', label:'Nouvelle étape', desc:'' });
            markDirty(); rerender();
          });
        }

        if (section.type === 'team') {
          container.querySelectorAll('[data-project-person]').forEach(card => {
            const id = card.dataset.projectPerson;
            const member = content.team.find(item => item.id === id);
            if (!member) return;
            bindTeamPhoto(member);
            card.querySelectorAll('[data-project-person-field]').forEach(field => {
              field.addEventListener('input', () => { member[field.dataset.projectPersonField] = field.value; markDirty(); refreshActiveRow(); });
            });
            card.querySelectorAll('[data-project-person-move]').forEach(button => {
              button.addEventListener('click', () => { moveItem(content.team, content.team.indexOf(member), Number(button.dataset.projectPersonMove)); markDirty(); rerender(); });
            });
            card.querySelector('[data-project-person-remove]')?.addEventListener('click', () => {
              content.team = content.team.filter(item => item.id !== id); markDirty(); rerender();
            });
          });
          document.getElementById('projectAddTeamMember')?.addEventListener('click', () => {
            content.team.push({ id:uid('team'), initials:'', name:'', title:'', badge:'', imageUrl:'' });
            markDirty(); rerender();
          });
        }
      }

      document.getElementById('studioProjectSave')?.addEventListener('click', async () => {
        content.progress = computeProgressFromMilestones(content.milestones);
        const result = await saveContent(buildSavePayload(content));
        if (handleSaveResult(result, 'Le projet est enregistré.')) {
          if (result.saveSource !== 'auto') {
            if (result.content?.project) content.project = result.content.project;
            if (Array.isArray(result.content?.milestones)) content.milestones = result.content.milestones;
            if (Array.isArray(result.content?.team)) content.team = result.content.team;
          }
          currentAdminContent = content;
          if (result.saveSource !== 'auto') render();
          else studioQueueContextSaveDockBind();
        }
      });
    }

    render();
  }
  function renderNewsEditor(content) {
    const container = document.getElementById('adminNewsEditor');
    if (!container) return;

    content.articles = Array.isArray(content.articles) ? content.articles : [];
    let activeId = container.dataset.newsActiveId || '';
    let activeBlockId = '';
    let activeListItemIndex = null;
    let lastEditable = null;
    let lastRange = null;
    let pendingMediaInsertion = null;

    const MONTHS_FR = {
      janvier:1, fevrier:2, février:2, mars:3, avril:4, mai:5, juin:6,
      juillet:7, aout:8, août:8, septembre:9, octobre:10, novembre:11, decembre:12, décembre:12
    };

    function markDirty() { studioSetSaveState('dirty'); }
    function uid(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }
    function todayIso() {
      const now = new Date();
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0,10);
    }
    function inferPublishedAt(value) {
      const raw = String(value || '').split('·')[0].trim().toLowerCase();
      const match = raw.match(/^(\d{1,2})\s+([a-zàâäéèêëîïôöùûüç]+)\s+(\d{4})$/i);
      if (!match) return '';
      const day = Number(match[1]);
      const month = MONTHS_FR[match[2]];
      const year = Number(match[3]);
      if (!day || !month || !year) return '';
      return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }
    function safeNewsHref(value) {
      const href = String(value || '').trim();
      return /^(https?:\/\/|mailto:|\/|#)/i.test(href) ? href : '';
    }
    function cleanRuns(raw) {
      const source = Array.isArray(raw) ? raw : [];
      const out = [];
      source.forEach(run => {
        if (!run || typeof run !== 'object') return;
        const text = String(run.text || '');
        if (!text) return;
        const next = { text };
        if (run.bold === true) next.bold = true;
        if (run.italic === true) next.italic = true;
        if (run.highlight === true) next.highlight = true;
        const href = safeNewsHref(run.href);
        if (href) next.href = href;
        const prev = out[out.length - 1];
        if (prev && !!prev.bold === !!next.bold && !!prev.italic === !!next.italic && !!prev.highlight === !!next.highlight && String(prev.href || '') === String(next.href || '')) prev.text += next.text;
        else out.push(next);
      });
      return out;
    }
    function textRuns(value) { const text = String(value || ''); return text ? [{ text }] : []; }
    function runsText(runs) { return cleanRuns(runs).map(run => run.text).join(''); }
    function renderRunsForEditor(runs) {
      return cleanRuns(runs).map(run => {
        let value = escapeHtml(run.text);
        if (run.bold) value = `<strong>${value}</strong>`;
        if (run.italic) value = `<em>${value}</em>`;
        if (run.highlight) value = `<mark>${value}</mark>`;
        if (run.href) value = `<a href="${escapeHtml(run.href)}">${value}</a>`;
        return value;
      }).join('');
    }
    function serializeRuns(root) {
      const runs = [];
      function push(text, marks) {
        if (!text) return;
        const next = { text };
        if (marks.bold) next.bold = true;
        if (marks.italic) next.italic = true;
        if (marks.highlight) next.highlight = true;
        if (marks.href) next.href = marks.href;
        const prev = runs[runs.length - 1];
        if (prev && !!prev.bold === !!next.bold && !!prev.italic === !!next.italic && !!prev.highlight === !!next.highlight && String(prev.href || '') === String(next.href || '')) prev.text += text;
        else runs.push(next);
      }
      function walk(node, marks) {
        if (node.nodeType === Node.TEXT_NODE) { push(node.nodeValue || '', marks); return; }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const tag = node.tagName.toLowerCase();
        if (tag === 'br') { push(' ', marks); return; }
        const next = { ...marks };
        if (tag === 'strong' || tag === 'b') next.bold = true;
        if (tag === 'em' || tag === 'i') next.italic = true;
        if (tag === 'mark') next.highlight = true;
        if (tag === 'a') next.href = safeNewsHref(node.getAttribute('href'));
        [...node.childNodes].forEach(child => walk(child, next));
      }
      [...root.childNodes].forEach(node => walk(node, {}));
      return cleanRuns(runs);
    }
    function legacyBodyToBlocks(body) {
      const lines = String(body || '').split(/\r?\n/);
      const blocks = [];
      let paragraph = [];
      let listType = '';
      let listItems = [];
      function flushParagraph() {
        const text = paragraph.join(' ').trim();
        if (text) blocks.push({ id:uid('paragraph'), type:'paragraph', runs:textRuns(text) });
        paragraph = [];
      }
      function flushList() {
        if (listType && listItems.length) blocks.push({ id:uid(listType), type:listType, items:listItems.map(text => ({ runs:textRuns(text) })) });
        listType = ''; listItems = [];
      }
      lines.forEach(line => {
        const trimmed = String(line || '').trim();
        if (!trimmed) { flushParagraph(); flushList(); return; }
        if (trimmed.startsWith('## ')) { flushParagraph(); flushList(); blocks.push({ id:uid('heading'), type:'heading', runs:textRuns(trimmed.slice(3).trim()) }); return; }
        const bullet = trimmed.match(/^[-*]\s+(.+)$/);
        if (bullet) { flushParagraph(); if (listType && listType !== 'bulletList') flushList(); listType='bulletList'; listItems.push(bullet[1].trim()); return; }
        const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
        if (ordered) { flushParagraph(); if (listType && listType !== 'orderedList') flushList(); listType='orderedList'; listItems.push(ordered[1].trim()); return; }
        flushList(); paragraph.push(trimmed);
      });
      flushParagraph(); flushList();
      return blocks.length ? blocks : [{ id:uid('paragraph'), type:'paragraph', runs:[] }];
    }
    function normalizeClientBlocks(raw, legacyBody) {
      if (!Array.isArray(raw)) return legacyBodyToBlocks(legacyBody);
      const blocks = raw.map(block => {
        if (!block || typeof block !== 'object') return null;
        const id = String(block.id || uid('block'));
        if (block.type === 'paragraph' || block.type === 'heading') return { id, type:block.type, runs:cleanRuns(block.runs) };
        if (block.type === 'bulletList' || block.type === 'orderedList') return { id, type:block.type, items:(Array.isArray(block.items) ? block.items : [{runs:[]}]).map(item => ({ runs:cleanRuns(item?.runs) })) };
        if (block.type === 'image' && block.asset?.url) return { id, type:'image', asset:{ url:String(block.asset.url), alt:String(block.asset.alt || ''), caption:String(block.asset.caption || '') } };
        if (block.type === 'gallery' && Array.isArray(block.items)) return { id, type:'gallery', items:block.items.filter(item => item?.url).map(item => ({ url:String(item.url), alt:String(item.alt || ''), caption:String(item.caption || '') })), caption:String(block.caption || '') };
        if (block.type === 'document' && block.asset?.url) return { id, type:'document', asset:{ url:String(block.asset.url), alt:String(block.asset.alt || ''), caption:String(block.asset.caption || '') }, title:String(block.title || 'Document à consulter'), description:String(block.description || ''), fileName:String(block.fileName || ''), fileSize:Number.isFinite(Number(block.fileSize)) && Number(block.fileSize) > 0 ? Number(block.fileSize) : 0 };
        return null;
      }).filter(Boolean);
      return blocks.length ? blocks : [{ id:uid('paragraph'), type:'paragraph', runs:[] }];
    }
    function blockPlainText(block) {
      if (!block) return '';
      if (block.type === 'paragraph' || block.type === 'heading') return runsText(block.runs);
      if (block.type === 'bulletList' || block.type === 'orderedList') return (block.items || []).map(item => runsText(item.runs)).join(' ');
      if (block.type === 'image') return block.asset?.caption || block.asset?.alt || '';
      if (block.type === 'gallery') return (block.items || []).map(item => item.caption || item.alt || '').join(' ');
      if (block.type === 'document') return [block.title || '', block.description || ''].filter(Boolean).join(' ');
      return '';
    }
    function blocksPlainText(blocks) { return (blocks || []).map(blockPlainText).filter(Boolean).join(' '); }
    function blocksToLegacyBody(blocks) {
      const chunks = [];
      (blocks || []).forEach(block => {
        if (block.type === 'paragraph') { const text = runsText(block.runs).trim(); if (text) chunks.push(text); }
        else if (block.type === 'heading') { const text = runsText(block.runs).trim(); if (text) chunks.push(`## ${text}`); }
        else if (block.type === 'bulletList') { const list = (block.items || []).map(item => runsText(item.runs).trim()).filter(Boolean).map(text => `- ${text}`); if (list.length) chunks.push(list.join('\n')); }
        else if (block.type === 'orderedList') { const list = (block.items || []).map(item => runsText(item.runs).trim()).filter(Boolean).map((text,index) => `${index + 1}. ${text}`); if (list.length) chunks.push(list.join('\n')); }
        else if (block.type === 'document' && block.title) chunks.push(`Document : ${block.title}`);
      });
      return chunks.join('\n\n');
    }
    function hydrateArticle(article) {
      article.publishedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(article.publishedAt || '')) ? article.publishedAt : inferPublishedAt(article.date);
      article.asset = article.asset && typeof article.asset === 'object' && article.asset.url ? { url:String(article.asset.url || ''), alt:String(article.asset.alt || '') } : null;
      article.contentBlocks = normalizeClientBlocks(article.contentBlocks, article.body || '');
      article.body = blocksToLegacyBody(article.contentBlocks);
      return article;
    }
    content.articles.forEach(hydrateArticle);

    function readingMinutes(article) {
      const words = blocksPlainText(article?.contentBlocks || []).trim().split(/\s+/).filter(Boolean).length;
      return Math.max(1, Math.ceil(words / 220));
    }
    function formatStudioDate(value) {
      const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return '';
      const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      if (Number.isNaN(date.getTime())) return '';
      return new Intl.DateTimeFormat('fr-FR', { day:'numeric', month:'long', year:'numeric' }).format(date);
    }
    function formatFileSize(bytes) {
      const value = Number(bytes || 0);
      if (!Number.isFinite(value) || value <= 0) return 'PDF';
      if (value >= 1024 * 1024) return `PDF · ${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1).replace('.', ',')} Mo`;
      return `PDF · ${Math.max(1, Math.round(value / 1024))} Ko`;
    }
    function orderedArticles() {
      return content.articles.map((article,index) => ({ article,index })).sort((left,right) => {
        const a = String(left.article.publishedAt || '');
        const b = String(right.article.publishedAt || '');
        if (a && b && a !== b) return b.localeCompare(a);
        if (a && !b) return -1;
        if (!a && b) return 1;
        return left.index - right.index;
      }).map(entry => entry.article);
    }
    function activeArticle() { return content.articles.find(article => String(article.id) === String(activeId)) || null; }
    function articleRowHtml(article) {
      const date = formatStudioDate(article.publishedAt) || String(article.date || '').split('·')[0].trim() || 'Date à préciser';
      return `
        <button type="button" class="studio-news-row ${String(article.id) === String(activeId) ? 'is-active' : ''}" data-news-select="${escapeHtml(article.id)}">
          <span class="studio-news-row-meta"><span>${escapeHtml(date)}</span>${article.tag ? `<span>${escapeHtml(article.tag)}</span>` : ''}</span>
          <strong>${escapeHtml(article.title || 'Actualité sans titre')}</strong>
          ${article.chapeau ? `<p>${escapeHtml(article.chapeau)}</p>` : ''}
        </button>`;
    }
    function listHtml() {
      const articles = orderedArticles();
      return `
        <aside class="studio-news-list">
          <div class="studio-news-list-head">
            <div><strong>Le fil du projet</strong><span>${articles.length} actualité${articles.length > 1 ? 's' : ''} · classement automatique par date</span></div>
            <button type="button" class="studio-news-new" id="studioNewArticleBtn">+ Nouvelle</button>
          </div>
          <div class="studio-news-list-body">${articles.length ? articles.map(articleRowHtml).join('') : '<div class="studio-news-empty-list">Aucune actualité pour le moment. Créez-en une lorsque le projet a quelque chose d’utile à raconter.</div>'}</div>
        </aside>`;
    }
    function mediaHtml(article) {
      const asset = article.asset && article.asset.url ? article.asset : null;
      return `
        <div class="studio-news-section">
          <span class="studio-news-field-label">Image de couverture <span style="letter-spacing:0;text-transform:none;color:var(--ink-35);">(facultative)</span></span>
          <div class="studio-news-media-drop" id="studioNewsMediaDrop" tabindex="0" role="button" aria-label="Ajouter une image de couverture à cette actualité">
            <div class="studio-news-media-preview" id="studioNewsMediaPreview">${asset ? `<img src="${escapeHtml(asset.url)}" alt="">` : '<div class="studio-news-media-placeholder">Aucune image</div>'}</div>
            <div class="studio-news-media-copy">
              <strong>${asset ? 'Changer l’image' : 'Ajouter une image de couverture'}</strong>
              <p>Cette image ouvre l’article et peut aussi accompagner l’actualité dans le fil.</p>
              <div class="studio-news-media-actions"><button type="button" id="studioNewsMediaBrowse">Parcourir</button>${asset ? '<button type="button" class="is-remove" id="studioNewsMediaRemove">Retirer l’image</button>' : ''}</div>
              <input type="file" id="studioNewsMediaInput" accept="image/png,image/jpeg" style="display:none;">
            </div>
          </div>
          ${asset ? `<div class="studio-news-alt-wrap"><label class="studio-news-field-label" for="studioNewsMediaAlt">Ce que montre cette image</label><input type="text" class="form-input" id="studioNewsMediaAlt" value="${escapeHtml(asset.alt || '')}" placeholder="Ex. Vue du futur work-café au niveau 5"></div>` : ''}
        </div>`;
    }
    function blockControls(block,index,total) {
      return `<div class="studio-news-rich-block-tools" aria-label="Actions sur ce bloc">
        <button type="button" data-news-block-move="-1" data-news-block-id="${escapeHtml(block.id)}" ${index===0?'disabled':''} title="Monter">↑</button>
        <button type="button" data-news-block-move="1" data-news-block-id="${escapeHtml(block.id)}" ${index===total-1?'disabled':''} title="Descendre">↓</button>
        <button type="button" class="is-danger" data-news-block-remove="${escapeHtml(block.id)}" title="Retirer">×</button>
      </div>`;
    }
    function richBlockHtml(block,index,total) {
      const controls = blockControls(block,index,total);
      if (block.type === 'paragraph' || block.type === 'heading') {
        const placeholder = block.type === 'heading' ? 'Votre intertitre' : 'Écrivez un paragraphe…';
        return `<div class="studio-news-rich-block is-${block.type}" data-news-rich-block="${escapeHtml(block.id)}">
          ${controls}
          <div class="studio-news-rich-editable" data-news-block-edit="${escapeHtml(block.id)}" contenteditable="true" spellcheck="true" data-placeholder="${placeholder}">${renderRunsForEditor(block.runs)}</div>
        </div>`;
      }
      if (block.type === 'bulletList' || block.type === 'orderedList') {
        const tag = block.type === 'orderedList' ? 'ol' : 'ul';
        return `<div class="studio-news-rich-block is-list" data-news-rich-block="${escapeHtml(block.id)}">
          ${controls}
          <${tag} class="studio-news-rich-list">${(block.items || []).map((item,itemIndex) => `<li><div class="studio-news-rich-editable" data-news-list-edit="${escapeHtml(block.id)}" data-news-list-index="${itemIndex}" contenteditable="true" spellcheck="true" data-placeholder="Élément de liste">${renderRunsForEditor(item.runs)}</div><button type="button" class="studio-news-list-remove" data-news-list-remove="${escapeHtml(block.id)}" data-news-list-index="${itemIndex}" aria-label="Retirer cet élément">×</button></li>`).join('')}</${tag}>
          <button type="button" class="studio-news-list-add" data-news-list-add="${escapeHtml(block.id)}">+ Ajouter un élément</button>
        </div>`;
      }
      if (block.type === 'image') {
        return `<div class="studio-news-rich-block is-media" data-news-rich-block="${escapeHtml(block.id)}">
          ${controls}
          <div class="studio-news-inline-image-editor"><img src="${escapeHtml(block.asset.url)}" alt=""><div><label class="studio-news-field-label">Description de l’image</label><input type="text" class="form-input" data-news-image-alt="${escapeHtml(block.id)}" value="${escapeHtml(block.asset.alt || '')}" placeholder="Ce que montre l’image"><label class="studio-news-field-label">Légende <span style="letter-spacing:0;text-transform:none;">(facultative)</span></label><input type="text" class="form-input" data-news-image-caption="${escapeHtml(block.id)}" value="${escapeHtml(block.asset.caption || '')}"></div></div>
        </div>`;
      }
      if (block.type === 'gallery') {
        return `<div class="studio-news-rich-block is-media" data-news-rich-block="${escapeHtml(block.id)}">
          ${controls}
          <div class="studio-news-gallery-editor">
            <div class="studio-news-gallery-grid">${(block.items || []).map((asset,itemIndex) => `<div class="studio-news-gallery-item"><img src="${escapeHtml(asset.url)}" alt=""><input type="text" class="form-input" data-news-gallery-alt="${escapeHtml(block.id)}" data-news-gallery-index="${itemIndex}" value="${escapeHtml(asset.alt || '')}" placeholder="Description de l’image"><button type="button" data-news-gallery-remove="${escapeHtml(block.id)}" data-news-gallery-index="${itemIndex}">Retirer</button></div>`).join('')}</div>
            <label class="studio-news-field-label">Légende de la galerie <span style="letter-spacing:0;text-transform:none;">(facultative)</span></label>
            <input type="text" class="form-input" data-news-gallery-caption="${escapeHtml(block.id)}" value="${escapeHtml(block.caption || '')}">
            <button type="button" class="studio-news-list-add" data-news-gallery-add="${escapeHtml(block.id)}">+ Ajouter des images</button>
            <input type="file" data-news-gallery-input="${escapeHtml(block.id)}" accept="image/png,image/jpeg" multiple style="display:none;">
          </div>
        </div>`;
      }
      if (block.type === 'document') {
        return `<div class="studio-news-rich-block is-media" data-news-rich-block="${escapeHtml(block.id)}">
          ${controls}
          <div class="studio-news-document-editor">
            <div class="studio-news-document-icon">PDF</div>
            <div class="studio-news-document-fields">
              <div class="studio-news-document-meta">${escapeHtml(formatFileSize(block.fileSize))}${block.fileName ? ` · ${escapeHtml(block.fileName)}` : ''}</div>
              <label class="studio-news-field-label">Titre du document</label>
              <input type="text" class="form-input" data-news-document-title="${escapeHtml(block.id)}" value="${escapeHtml(block.title || '')}" placeholder="Ex. Kit de déménagement">
              <label class="studio-news-field-label">Description courte <span style="letter-spacing:0;text-transform:none;">(facultative)</span></label>
              <textarea class="form-input studio-news-document-description" data-news-document-description="${escapeHtml(block.id)}" placeholder="Ex. Toutes les informations pratiques pour préparer votre arrivée.">${escapeHtml(block.description || '')}</textarea>
              <a href="${escapeHtml(block.asset.url)}" target="_blank" rel="noopener">Prévisualiser le PDF ↗</a>
            </div>
          </div>
        </div>`;
      }
      return '';
    }
    function mediaChooserHtml() {
      return `<div class="studio-news-media-insert" id="studioNewsMediaInsert" hidden>
        <div class="studio-news-media-insert-copy"><strong>Ajouter au récit</strong><span>Le média sera placé exactement à l’emplacement du curseur.</span></div>
        <div class="studio-news-media-insert-actions">
          <button type="button" data-news-inline-media="image">Image</button>
          <button type="button" data-news-inline-media="gallery">Galerie</button>
          <button type="button" data-news-inline-media="document">Document</button>
        </div>
        <div class="studio-news-media-insert-drop" id="studioNewsInlineDrop">Déposez aussi vos fichiers ici</div>
        <input type="file" id="studioNewsInlineImageInput" accept="image/png,image/jpeg" style="display:none;">
        <input type="file" id="studioNewsInlineGalleryInput" accept="image/png,image/jpeg" multiple style="display:none;">
        <input type="file" id="studioNewsInlineDocumentInput" accept="application/pdf" style="display:none;">
      </div>`;
    }
    function editorHtml(article) {
      if (!article) return `<section class="studio-news-editor"><div class="studio-news-zero-state"><div><strong>Choisissez une actualité.</strong><p>Le fil reste visible en premier. Sélectionnez une publication pour la modifier, ou créez-en une nouvelle.</p></div></div></section>`;
      const minutes = readingMinutes(article);
      return `<section class="studio-news-editor"><div class="studio-news-editor-inner">
        <div class="studio-news-editor-top"><button type="button" class="studio-news-back" id="studioNewsBack">← Toutes les actualités</button><button type="button" class="studio-news-delete" id="studioNewsDelete">Supprimer</button></div>
        <label class="studio-news-field-label" for="studioNewsTitle">Titre</label>
        <textarea class="studio-news-title-input" id="studioNewsTitle" rows="2" placeholder="Ce qui vient de changer ou ce que les collaborateurs doivent savoir">${escapeHtml(article.title || '')}</textarea>
        <div class="studio-news-meta-grid">
          <div><label class="studio-news-field-label" for="studioNewsDate">Date de l’actualité</label><input type="date" class="form-input" id="studioNewsDate" value="${escapeHtml(article.publishedAt || '')}"></div>
          <div><label class="studio-news-field-label" for="studioNewsTag">Thématique <span style="letter-spacing:0;text-transform:none;color:var(--ink-35);">(facultative)</span></label><input type="text" class="form-input" id="studioNewsTag" list="studioNewsTagSuggestions" value="${escapeHtml(article.tag || '')}" placeholder="Ex. Espaces"><datalist id="studioNewsTagSuggestions"><option value="Projet"><option value="Calendrier"><option value="Espaces"><option value="Écoute"><option value="Vie au bureau"></datalist></div>
          <div class="studio-news-readtime" id="studioNewsReadtime">≈ ${minutes} min de lecture</div>
        </div>
        <div class="studio-news-section"><label class="studio-news-field-label" for="studioNewsSummary">En quelques lignes</label>${studioInlineEditorHtml('studioNewsSummary', article.chapeau || '', { minHeight:90, compact:true, placeholder:'Donnez l’essentiel avant que la personne ouvre l’article.' })}</div>
        ${mediaHtml(article)}
        <div class="studio-news-section studio-news-rich-section">
          <div class="studio-news-section-head"><div><span class="studio-news-field-label">Article</span><span class="studio-news-rich-doctrine">Hiérarchie et emphase seulement — Storm gère la mise en forme.</span></div></div>
          <div class="studio-news-rich-toolbar" id="studioNewsRichToolbar" role="toolbar" aria-label="Mise en forme de l’article">
            <button type="button" data-news-format="bold" title="Gras"><strong>B</strong></button>
            <button type="button" data-news-format="italic" title="Italique"><em>I</em></button>
            <button type="button" data-news-format="highlight" title="Mettre en évidence">Surligner</button>
            <button type="button" data-news-format="link" title="Ajouter un lien">Lien</button>
            <span class="studio-news-toolbar-separator"></span>
            <button type="button" data-news-structure="heading">Intertitre</button>
            <button type="button" data-news-structure="bulletList">• Liste</button>
            <button type="button" data-news-structure="orderedList">1. Liste</button>
            <span class="studio-news-toolbar-separator"></span>
            <button type="button" class="is-media" id="studioNewsToggleMedia">+ Média</button>
          </div>
          <div class="studio-news-link-insert" id="studioNewsLinkInsert" hidden>
            <input type="url" class="form-input" id="studioNewsLinkUrl" placeholder="https://… ou mailto:…">
            <button type="button" id="studioNewsLinkApply">Appliquer le lien</button>
            <button type="button" id="studioNewsLinkCancel">Annuler</button>
          </div>
          ${mediaChooserHtml()}
          <div class="studio-news-rich-blocks" id="studioNewsRichBlocks">${(article.contentBlocks || []).map((block,index,all) => richBlockHtml(block,index,all.length)).join('')}</div>
          <button type="button" class="studio-news-add-paragraph" id="studioNewsAddParagraph">+ Ajouter un paragraphe</button>
          <p class="studio-news-writing-help">Sélectionnez les mots à mettre en forme ; placez le curseur là où le média doit apparaître. Les couleurs, polices, tailles et styles restent sous le contrôle de l’édition Storm.</p>
        </div>
      </div></section>`;
    }

    function render() {
      const article = activeArticle();
      container.dataset.newsActiveId = activeId;
      container.innerHTML = `<div class="studio-news-head studio-domain-head"><div class="studio-news-head-copy studio-domain-head-copy"><div class="admin-page-eyebrow">Contenus</div><h1>Actualités.</h1><p>Préparez les informations qui aident les collaborateurs à suivre ce qui change, ce qui se décide et ce qui arrive ensuite.</p></div><button type="button" class="studio-news-save studio-domain-save" id="studioNewsSave">Enregistrer les actualités</button></div><div class="studio-news-layout ${article ? 'is-editing' : ''}">${listHtml()}${editorHtml(article)}</div>`;
      bind();
    }
    function updateListWithoutClosing() {
      const body = container.querySelector('.studio-news-list-body');
      if (!body) return;
      const articles = orderedArticles();
      body.innerHTML = articles.length ? articles.map(articleRowHtml).join('') : '<div class="studio-news-empty-list">Aucune actualité pour le moment.</div>';
      bindListRows();
      const count = container.querySelector('.studio-news-list-head span');
      if (count) count.textContent = `${articles.length} actualité${articles.length > 1 ? 's' : ''} · classement automatique par date`;
    }
    function bindListRows() { container.querySelectorAll('[data-news-select]').forEach(button => button.addEventListener('click', () => { activeId = button.dataset.newsSelect; activeBlockId=''; pendingMediaInsertion=null; render(); })); }
    function syncLegacy(article) { article.body = blocksToLegacyBody(article.contentBlocks); }
    function refreshReadtime(article) { const el=document.getElementById('studioNewsReadtime'); if (el) el.textContent=`≈ ${readingMinutes(article)} min de lecture`; }
    function getBlock(article,id) { return (article.contentBlocks || []).find(block => String(block.id) === String(id)) || null; }
    function blockIndex(article,id) { return (article.contentBlocks || []).findIndex(block => String(block.id) === String(id)); }
    function splitRunsAtOffset(runs, rawOffset) {
      const source = cleanRuns(runs);
      const total = source.reduce((sum, run) => sum + run.text.length, 0);
      const offset = Math.max(0, Math.min(total, Number.isFinite(Number(rawOffset)) ? Number(rawOffset) : total));
      const before=[]; const after=[]; let cursor=0;
      source.forEach(run => {
        const start=cursor; const end=cursor + run.text.length; cursor=end;
        if (end <= offset) { before.push({...run}); return; }
        if (start >= offset) { after.push({...run}); return; }
        const cut=offset-start; const left=run.text.slice(0,cut); const right=run.text.slice(cut);
        if (left) before.push({...run,text:left});
        if (right) after.push({...run,text:right});
      });
      return {before:cleanRuns(before),after:cleanRuns(after)};
    }
    function selectionOffsetWithin(editable, range) {
      if (!editable || !range || !editable.contains(range.startContainer)) return null;
      try {
        const probe=document.createRange();
        probe.selectNodeContents(editable);
        probe.setEnd(range.startContainer,range.startOffset);
        return probe.toString().length;
      } catch (error) { return null; }
    }
    function captureInsertionPoint(article) {
      if (lastEditable) persistEditable(article,lastEditable,{quiet:true});
      const blockId = lastEditable?.dataset.newsBlockEdit || lastEditable?.dataset.newsListEdit || activeBlockId || '';
      const itemIndex = lastEditable?.dataset.newsListIndex != null ? Number(lastEditable.dataset.newsListIndex) : null;
      return { blockId, itemIndex, offset:selectionOffsetWithin(lastEditable,lastRange) };
    }
    function insertBlock(article, block) {
      const index = activeBlockId ? blockIndex(article,activeBlockId) : -1;
      if (index >= 0) article.contentBlocks.splice(index + 1,0,block); else article.contentBlocks.push(block);
      activeBlockId = block.id;
      markDirty(); syncLegacy(article); render();
    }
    function insertBlockAtPoint(article, block, point) {
      const target = point?.blockId ? getBlock(article,point.blockId) : null;
      const index = target ? blockIndex(article,target.id) : -1;
      if (!target || index < 0) { insertBlock(article,block); return; }

      if (target.type === 'paragraph') {
        const total=runsText(target.runs).length;
        const offset=point?.offset == null ? total : Math.max(0,Math.min(total,point.offset));
        if (offset <= 0) article.contentBlocks.splice(index,0,block);
        else if (offset >= total) article.contentBlocks.splice(index+1,0,block);
        else {
          const split=splitRunsAtOffset(target.runs,offset);
          const after={id:uid('paragraph'),type:'paragraph',runs:split.after};
          target.runs=split.before;
          article.contentBlocks.splice(index+1,0,block,after);
        }
      } else if ((target.type === 'bulletList' || target.type === 'orderedList') && Number.isInteger(point?.itemIndex) && target.items?.[point.itemIndex]) {
        const itemIndex=point.itemIndex;
        const item=target.items[itemIndex];
        const total=runsText(item.runs).length;
        const offset=point?.offset == null ? total : Math.max(0,Math.min(total,point.offset));
        const split=splitRunsAtOffset(item.runs,offset);
        const beforeItems=target.items.slice(0,itemIndex).map(entry=>({runs:cleanRuns(entry.runs)}));
        const afterItems=target.items.slice(itemIndex+1).map(entry=>({runs:cleanRuns(entry.runs)}));
        if (split.before.length) beforeItems.push({runs:split.before});
        if (split.after.length) afterItems.unshift({runs:split.after});
        const replacements=[];
        if (beforeItems.length) replacements.push({id:target.id,type:target.type,items:beforeItems});
        replacements.push(block);
        if (afterItems.length) replacements.push({id:beforeItems.length?uid(target.type):target.id,type:target.type,items:afterItems});
        article.contentBlocks.splice(index,1,...replacements);
      } else {
        article.contentBlocks.splice(index+1,0,block);
      }
      activeBlockId=block.id;
      markDirty(); syncLegacy(article); render();
    }
    function focusEditable(blockId,itemIndex=null) {
      requestAnimationFrame(() => {
        const selector = itemIndex == null ? `[data-news-block-edit="${CSS.escape(blockId)}"]` : `[data-news-list-edit="${CSS.escape(blockId)}"][data-news-list-index="${itemIndex}"]`;
        const el = container.querySelector(selector);
        if (!el) return;
        el.focus();
        const range=document.createRange(); range.selectNodeContents(el); range.collapse(false);
        const selection=window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        rememberSelection(el);
      });
    }
    function rememberSelection(editable) {
      lastEditable = editable || lastEditable;
      if (!lastEditable) return;
      activeBlockId = lastEditable.dataset.newsBlockEdit || lastEditable.dataset.newsListEdit || activeBlockId;
      activeListItemIndex = lastEditable.dataset.newsListIndex != null ? Number(lastEditable.dataset.newsListIndex) : null;
      const selection = window.getSelection();
      if (selection && selection.rangeCount && lastEditable.contains(selection.anchorNode)) lastRange = selection.getRangeAt(0).cloneRange();
    }
    function restoreSelection() {
      if (!lastEditable) return false;
      lastEditable.focus();
      if (lastRange) { const selection=window.getSelection(); selection.removeAllRanges(); selection.addRange(lastRange); }
      return true;
    }
    function persistEditable(article, editable, options={}) {
      if (!editable) return;
      const blockId = editable.dataset.newsBlockEdit || editable.dataset.newsListEdit;
      const block = getBlock(article,blockId);
      if (!block) return;
      const runs = serializeRuns(editable);
      if (editable.dataset.newsListEdit) {
        const index=Number(editable.dataset.newsListIndex); if (block.items?.[index]) block.items[index].runs=runs;
      } else block.runs=runs;
      syncLegacy(article); if (!options.quiet) markDirty(); refreshReadtime(article); rememberSelection(editable);
    }
    function bindRichEditables(article) {
      container.querySelectorAll('.studio-news-rich-editable').forEach(editable => {
        ['focus','keyup','mouseup'].forEach(name => editable.addEventListener(name, () => rememberSelection(editable)));
        editable.addEventListener('input', () => persistEditable(article,editable));
        editable.addEventListener('paste', e => { e.preventDefault(); const text=(e.clipboardData?.getData('text/plain') || '').replace(/\s*\n+\s*/g,' '); document.execCommand('insertText',false,text); persistEditable(article,editable); });
        editable.addEventListener('keydown', e => {
          const blockId = editable.dataset.newsBlockEdit || editable.dataset.newsListEdit;
          const block = getBlock(article,blockId);
          if (!block) return;
          if (e.key === 'Enter') {
            e.preventDefault(); persistEditable(article,editable);
            if (editable.dataset.newsListEdit) {
              const itemIndex=Number(editable.dataset.newsListIndex);
              const currentText=runsText(block.items?.[itemIndex]?.runs).trim();
              if (!currentText) {
                block.items.splice(itemIndex,1);
                const parentIndex=blockIndex(article,block.id);
                const paragraph={id:uid('paragraph'),type:'paragraph',runs:[]};
                if (!block.items.length) article.contentBlocks.splice(parentIndex,1,paragraph); else article.contentBlocks.splice(parentIndex+1,0,paragraph);
                activeBlockId=paragraph.id; markDirty(); syncLegacy(article); render(); focusEditable(paragraph.id); return;
              }
              block.items.splice(itemIndex+1,0,{runs:[]}); markDirty(); syncLegacy(article); render(); focusEditable(block.id,itemIndex+1); return;
            }
            const parentIndex=blockIndex(article,block.id);
            const paragraph={id:uid('paragraph'),type:'paragraph',runs:[]};
            article.contentBlocks.splice(parentIndex+1,0,paragraph); activeBlockId=paragraph.id; markDirty(); syncLegacy(article); render(); focusEditable(paragraph.id);
          }
          if (e.key === 'Backspace' && !editable.textContent.trim() && block.type === 'paragraph' && article.contentBlocks.length > 1) {
            e.preventDefault(); const index=blockIndex(article,block.id); article.contentBlocks.splice(index,1); const fallback=article.contentBlocks[Math.max(0,index-1)]; activeBlockId=fallback?.id || ''; markDirty(); syncLegacy(article); render(); if (fallback && (fallback.type==='paragraph'||fallback.type==='heading')) focusEditable(fallback.id);
          }
        });
      });
    }
    function applyInlineFormat(article,format) {
      if (!restoreSelection()) { showToast('Sélectionnez d’abord les mots à mettre en forme.'); return; }
      const selection=window.getSelection();
      if (!selection || selection.isCollapsed || !lastEditable?.contains(selection.anchorNode) || !lastEditable?.contains(selection.focusNode)) {
        showToast('Sélectionnez précisément le texte à mettre en forme.');
        return;
      }
      if (format === 'bold') document.execCommand('bold',false,null);
      else if (format === 'italic') document.execCommand('italic',false,null);
      else if (format === 'highlight') {
        const range=selection.getRangeAt(0);
        const mark=document.createElement('mark');
        mark.appendChild(range.extractContents());
        range.insertNode(mark);
        const next=document.createRange(); next.selectNodeContents(mark);
        selection.removeAllRanges(); selection.addRange(next);
      }
      persistEditable(article,lastEditable);
    }
    function applyStructure(article,type) {
      const id=activeBlockId; const index=id ? blockIndex(article,id) : -1; const block=index>=0 ? article.contentBlocks[index] : null;
      if (type === 'heading') {
        if (block && block.type === 'paragraph') { block.type='heading'; markDirty(); syncLegacy(article); render(); focusEditable(block.id); return; }
        const next={id:uid('heading'),type:'heading',runs:[]}; insertBlock(article,next); focusEditable(next.id); return;
      }
      if (type === 'bulletList' || type === 'orderedList') {
        if (block && (block.type === 'paragraph' || block.type === 'heading')) {
          article.contentBlocks[index]={id:block.id,type,items:[{runs:block.runs || []}]}; activeBlockId=block.id; markDirty(); syncLegacy(article); render(); focusEditable(block.id,0); return;
        }
        const next={id:uid(type),type,items:[{runs:[]}]}; insertBlock(article,next); focusEditable(next.id,0);
      }
    }
    async function uploadInlineFiles(article, files, kind) {
      const list=[...(files || [])]; if (!list.length) return;
      if (kind === 'document') {
        const file=list[0]; if (file.type !== 'application/pdf') { showToast('Ajoutez un document PDF.'); return; }
        showToast('Envoi du document…'); const result=await uploadFile(file); if (!result.ok) { if (result.unauthorized) { clearAdminToken(); openAdminModal(); } else showToast('Impossible d’envoyer ce document.'); return; }
        const cleanName=String(file.name || 'Document').replace(/\.pdf$/i,'').replace(/[-_]+/g,' ');
        insertBlockAtPoint(article,{id:uid('document'),type:'document',asset:{url:result.url,alt:'',caption:''},title:cleanName || 'Document à consulter',description:'',fileName:String(file.name || ''),fileSize:Number(file.size || 0)},pendingMediaInsertion); pendingMediaInsertion=null; showToast('Document ajouté.'); return;
      }
      const imageFiles=list.filter(file => ['image/png','image/jpeg'].includes(file.type));
      if (!imageFiles.length) { showToast('Ajoutez une image PNG ou JPEG.'); return; }
      if (kind === 'image') {
        showToast('Envoi de l’image…'); const result=await uploadFile(imageFiles[0],1800); if (!result.ok) { if (result.unauthorized) { clearAdminToken(); openAdminModal(); } else showToast('Impossible d’envoyer cette image.'); return; }
        insertBlockAtPoint(article,{id:uid('image'),type:'image',asset:{url:result.url,alt:'',caption:''}},pendingMediaInsertion); pendingMediaInsertion=null; showToast('Image ajoutée.'); return;
      }
      showToast('Envoi de la galerie…'); const items=[];
      for (const file of imageFiles.slice(0,12)) { const result=await uploadFile(file,1800); if (result.ok) items.push({url:result.url,alt:'',caption:''}); else if (result.unauthorized) { clearAdminToken(); openAdminModal(); return; } }
      if (!items.length) { showToast('Impossible d’envoyer ces images.'); return; }
      insertBlockAtPoint(article,{id:uid('gallery'),type:'gallery',items,caption:''},pendingMediaInsertion); pendingMediaInsertion=null; showToast(`${items.length} image${items.length>1?'s':''} ajoutée${items.length>1?'s':''}.`);
    }
    function bindCoverMedia(article) {
      const zone=document.getElementById('studioNewsMediaDrop'), input=document.getElementById('studioNewsMediaInput'), browse=document.getElementById('studioNewsMediaBrowse');
      if (!zone || !input || !browse) return;
      async function handleFile(file) {
        if (!file) return; if (!['image/png','image/jpeg'].includes(file.type)) { showToast('Ajoutez une image PNG ou JPEG.'); return; }
        showToast('Envoi de l’image…'); const result=await uploadFile(file,1800); if (result.unauthorized) { showToast('Votre session a expiré. Reconnectez-vous.'); clearAdminToken(); openAdminModal(); return; } if (!result.ok) { showToast('Impossible d’envoyer cette image.'); return; }
        article.asset={url:result.url,alt:article.asset?.alt || ''}; markDirty(); render(); showToast('Image ajoutée.');
      }
      browse.addEventListener('click',e=>{e.stopPropagation();input.click();}); zone.addEventListener('click',e=>{if(!e.target.closest('button,input'))input.click();}); zone.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();input.click();}}); input.addEventListener('change',()=>{const file=input.files?.[0];input.value='';handleFile(file);});
      ['dragenter','dragover'].forEach(name=>zone.addEventListener(name,e=>{e.preventDefault();zone.classList.add('drag-over');})); ['dragleave','drop'].forEach(name=>zone.addEventListener(name,e=>{e.preventDefault();zone.classList.remove('drag-over');})); zone.addEventListener('drop',e=>handleFile(e.dataTransfer?.files?.[0]));
      document.getElementById('studioNewsMediaRemove')?.addEventListener('click',e=>{e.stopPropagation();article.asset=null;markDirty();render();}); document.getElementById('studioNewsMediaAlt')?.addEventListener('input',e=>{if(article.asset){article.asset.alt=e.target.value;markDirty();}});
    }
    function bindRichBlocks(article) {
      bindRichEditables(article);
      container.querySelectorAll('[data-news-block-move]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.newsBlockId;const index=blockIndex(article,id);const target=index+Number(button.dataset.newsBlockMove);if(index<0||target<0||target>=article.contentBlocks.length)return;const [block]=article.contentBlocks.splice(index,1);article.contentBlocks.splice(target,0,block);markDirty();syncLegacy(article);render();}));
      container.querySelectorAll('[data-news-block-remove]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.newsBlockRemove;article.contentBlocks=article.contentBlocks.filter(block=>String(block.id)!==String(id));if(!article.contentBlocks.length)article.contentBlocks.push({id:uid('paragraph'),type:'paragraph',runs:[]});activeBlockId='';markDirty();syncLegacy(article);render();}));
      container.querySelectorAll('[data-news-list-add]').forEach(button=>button.addEventListener('click',()=>{const block=getBlock(article,button.dataset.newsListAdd);if(!block)return;block.items.push({runs:[]});markDirty();syncLegacy(article);render();focusEditable(block.id,block.items.length-1);}));
      container.querySelectorAll('[data-news-list-remove]').forEach(button=>button.addEventListener('click',()=>{const block=getBlock(article,button.dataset.newsListRemove);const index=Number(button.dataset.newsListIndex);if(!block?.items)return;block.items.splice(index,1);if(!block.items.length)block.items.push({runs:[]});markDirty();syncLegacy(article);render();}));
      container.querySelectorAll('[data-news-image-alt]').forEach(input=>input.addEventListener('input',()=>{const block=getBlock(article,input.dataset.newsImageAlt);if(block?.asset){block.asset.alt=input.value;markDirty();}}));
      container.querySelectorAll('[data-news-image-caption]').forEach(input=>input.addEventListener('input',()=>{const block=getBlock(article,input.dataset.newsImageCaption);if(block?.asset){block.asset.caption=input.value;markDirty();}}));
      container.querySelectorAll('[data-news-gallery-alt]').forEach(input=>input.addEventListener('input',()=>{const block=getBlock(article,input.dataset.newsGalleryAlt);const index=Number(input.dataset.newsGalleryIndex);if(block?.items?.[index]){block.items[index].alt=input.value;markDirty();}}));
      container.querySelectorAll('[data-news-gallery-caption]').forEach(input=>input.addEventListener('input',()=>{const block=getBlock(article,input.dataset.newsGalleryCaption);if(block){block.caption=input.value;markDirty();}}));
      container.querySelectorAll('[data-news-gallery-remove]').forEach(button=>button.addEventListener('click',()=>{const block=getBlock(article,button.dataset.newsGalleryRemove);const index=Number(button.dataset.newsGalleryIndex);if(!block?.items)return;block.items.splice(index,1);if(!block.items.length)article.contentBlocks=article.contentBlocks.filter(item=>item.id!==block.id);markDirty();syncLegacy(article);render();}));
      container.querySelectorAll('[data-news-gallery-add]').forEach(button=>button.addEventListener('click',()=>container.querySelector(`[data-news-gallery-input="${CSS.escape(button.dataset.newsGalleryAdd)}"]`)?.click()));
      container.querySelectorAll('[data-news-gallery-input]').forEach(input=>input.addEventListener('change',async()=>{const block=getBlock(article,input.dataset.newsGalleryInput);const files=[...(input.files||[])];input.value='';if(!block||!files.length)return;showToast('Envoi des images…');for(const file of files.slice(0,12-block.items.length)){if(!['image/png','image/jpeg'].includes(file.type))continue;const result=await uploadFile(file,1800);if(result.ok)block.items.push({url:result.url,alt:'',caption:''});}markDirty();render();}));
      container.querySelectorAll('[data-news-document-title]').forEach(input=>input.addEventListener('input',()=>{const block=getBlock(article,input.dataset.newsDocumentTitle);if(block){block.title=input.value;markDirty();syncLegacy(article);refreshReadtime(article);}}));
      container.querySelectorAll('[data-news-document-description]').forEach(input=>input.addEventListener('input',()=>{const block=getBlock(article,input.dataset.newsDocumentDescription);if(block){block.description=input.value;markDirty();refreshReadtime(article);}}));
    }
    function bindLinkPanel(article) {
      const panel=document.getElementById('studioNewsLinkInsert');
      const input=document.getElementById('studioNewsLinkUrl');
      const apply=document.getElementById('studioNewsLinkApply');
      const cancel=document.getElementById('studioNewsLinkCancel');
      if (!panel || !input || !apply || !cancel) return;
      panel.hidden=false;
      input.value='https://';
      requestAnimationFrame(()=>{ input.focus(); input.select(); });
      apply.addEventListener('click',()=>{
        const href=safeNewsHref(input.value);
        if (!href) { showToast('Utilisez une adresse http(s), mailto ou interne.'); input.focus(); return; }
        if (!restoreSelection()) { panel.hidden=true; return; }
        const selection=window.getSelection();
        if (!selection || selection.isCollapsed) { showToast('Sélectionnez le texte à transformer en lien.'); panel.hidden=true; return; }
        document.execCommand('createLink',false,href);
        persistEditable(article,lastEditable);
        panel.hidden=true;
      },{once:true});
      cancel.addEventListener('click',()=>{ panel.hidden=true; restoreSelection(); },{once:true});
      input.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();apply.click();} if(e.key==='Escape'){e.preventDefault();cancel.click();} });
    }
    function bindInlineMedia(article) {
      const panel=document.getElementById('studioNewsMediaInsert'); const toggle=document.getElementById('studioNewsToggleMedia'); if(!panel||!toggle)return;
      toggle.addEventListener('mousedown',e=>{ pendingMediaInsertion=captureInsertionPoint(article); e.preventDefault(); });
      toggle.addEventListener('click',()=>{if(!pendingMediaInsertion)pendingMediaInsertion=captureInsertionPoint(article);panel.hidden=!panel.hidden;toggle.classList.toggle('is-open',!panel.hidden);});
      const imageInput=document.getElementById('studioNewsInlineImageInput'), galleryInput=document.getElementById('studioNewsInlineGalleryInput'), docInput=document.getElementById('studioNewsInlineDocumentInput');
      container.querySelector('[data-news-inline-media="image"]')?.addEventListener('click',()=>{if(!pendingMediaInsertion)pendingMediaInsertion=captureInsertionPoint(article);imageInput?.click();}); container.querySelector('[data-news-inline-media="gallery"]')?.addEventListener('click',()=>{if(!pendingMediaInsertion)pendingMediaInsertion=captureInsertionPoint(article);galleryInput?.click();}); container.querySelector('[data-news-inline-media="document"]')?.addEventListener('click',()=>{if(!pendingMediaInsertion)pendingMediaInsertion=captureInsertionPoint(article);docInput?.click();});
      imageInput?.addEventListener('change',()=>{const files=[...(imageInput.files||[])];imageInput.value='';uploadInlineFiles(article,files,'image');}); galleryInput?.addEventListener('change',()=>{const files=[...(galleryInput.files||[])];galleryInput.value='';uploadInlineFiles(article,files,'gallery');}); docInput?.addEventListener('change',()=>{const files=[...(docInput.files||[])];docInput.value='';uploadInlineFiles(article,files,'document');});
      const drop=document.getElementById('studioNewsInlineDrop'); if(drop){['dragenter','dragover'].forEach(name=>drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add('drag-over');}));['dragleave','drop'].forEach(name=>drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove('drag-over');}));drop.addEventListener('drop',e=>{const files=[...(e.dataTransfer?.files||[])];if(!files.length)return;const pdf=files.find(file=>file.type==='application/pdf');const images=files.filter(file=>['image/png','image/jpeg'].includes(file.type));if(pdf&&!images.length)uploadInlineFiles(article,[pdf],'document');else if(images.length>1)uploadInlineFiles(article,images,'gallery');else if(images.length===1)uploadInlineFiles(article,images,'image');});}
    }
    function bind() {
      bindListRows();
      document.getElementById('studioNewArticleBtn')?.addEventListener('click',()=>{const article={id:uid('article'),tag:'',date:'',publishedAt:todayIso(),title:'',chapeau:'',body:'',contentBlocks:[{id:uid('paragraph'),type:'paragraph',runs:[]}],asset:null};content.articles.push(article);activeId=article.id;activeBlockId=article.contentBlocks[0].id;markDirty();render();requestAnimationFrame(()=>document.getElementById('studioNewsTitle')?.focus());});
      const article=activeArticle();
      if(article){
        document.getElementById('studioNewsBack')?.addEventListener('click',()=>{activeId='';activeBlockId='';pendingMediaInsertion=null;render();});
        document.getElementById('studioNewsDelete')?.addEventListener('click',()=>{const label=article.title?`« ${article.title} »`:'cette actualité';if(!confirm(`Supprimer définitivement ${label} ? Les statistiques de consultation déjà enregistrées resteront disponibles dans Pilotage.`))return;content.articles=content.articles.filter(item=>String(item.id)!==String(article.id));activeId='';activeBlockId='';markDirty();render();});
        const title=document.getElementById('studioNewsTitle'),date=document.getElementById('studioNewsDate'),tag=document.getElementById('studioNewsTag');
        title?.addEventListener('input',()=>{article.title=title.value;markDirty();updateListWithoutClosing();}); date?.addEventListener('change',()=>{article.publishedAt=date.value;markDirty();updateListWithoutClosing();}); tag?.addEventListener('input',()=>{article.tag=tag.value;markDirty();updateListWithoutClosing();});
        studioBindInlineEditor(container,'studioNewsSummary',value=>{article.chapeau=value;markDirty();updateListWithoutClosing();});
        bindCoverMedia(article); bindRichBlocks(article); bindInlineMedia(article);
        const toolbar=document.getElementById('studioNewsRichToolbar'); toolbar?.querySelectorAll('button').forEach(button=>button.addEventListener('mousedown',e=>{if(button.dataset.newsFormat)e.preventDefault();})); toolbar?.querySelectorAll('[data-news-format]').forEach(button=>button.addEventListener('click',()=>{ if(button.dataset.newsFormat==='link') bindLinkPanel(article); else applyInlineFormat(article,button.dataset.newsFormat); })); toolbar?.querySelectorAll('[data-news-structure]').forEach(button=>button.addEventListener('click',()=>applyStructure(article,button.dataset.newsStructure)));
        document.getElementById('studioNewsAddParagraph')?.addEventListener('click',()=>{const block={id:uid('paragraph'),type:'paragraph',runs:[]};insertBlock(article,block);focusEditable(block.id);});
      }
      document.getElementById('studioNewsSave')?.addEventListener('click',async()=>{content.articles.forEach(syncLegacy);const result=await saveContent(buildSavePayload(content));if(handleSaveResult(result,'Les actualités sont enregistrées.')){if(result.saveSource!=='auto'&&Array.isArray(result.content?.articles))content.articles=result.content.articles.map(hydrateArticle);currentAdminContent=content;if(result.saveSource!=='auto')render();else studioQueueContextSaveDockBind();}});
    }
    render();
  }
  function moveItem(array, index, direction) {
    const target = index + direction;
    if (target < 0 || target >= array.length) return;
    const [item] = array.splice(index, 1);
    array.splice(target, 0, item);
  }
  function uploaderHtml(idPrefix, currentUrl, opts) {
    opts = opts || {};
    const shape = opts.shape || 'square';
    const size = opts.size || 44;
    const radius = shape === 'circle' ? '50%' : '10px';
    const isPdf = isPdfUrl(currentUrl);
    let previewInner = '';
    if (currentUrl && isPdf) previewInner = PDF_ICON_SVG;
    else if (currentUrl) previewInner = `<img src="${escapeHtml(currentUrl)}" style="width:100%; height:100%; object-fit:cover;">`;
    return `
      <div class="logo-dropzone" id="${idPrefix}Zone" style="padding:8px; gap:8px;">
        <div id="${idPrefix}Preview" style="width:${size}px; height:${size}px; border-radius:${radius}; overflow:hidden; background:var(--offwhite); border:1px solid var(--ink-12); flex-shrink:0; display:flex; align-items:center; justify-content:center; color:var(--bordeaux);">${previewInner}</div>
        <button type="button" class="admin-modal-cancel" data-dropzone-trigger style="flex:none; padding:0 12px; height:30px; font-size:0.66rem;">${escapeHtml(opts.label || 'Photo')}</button>
        <span class="logo-dropzone-hint">glisser-déposer</span>
        <button type="button" class="admin-reset" id="${idPrefix}Remove" style="margin-left:auto; ${currentUrl ? '' : 'display:none;'}">Retirer</button>
        <input type="file" id="${idPrefix}Input" accept="${escapeHtml(opts.accept || 'image/png,image/jpeg')}" style="display:none;">
      </div>`;
  }
  function bindUploader(idPrefix, entry, fieldKey, opts) {
    opts = opts || {};
    const zone = document.getElementById(idPrefix + 'Zone');
    const input = document.getElementById(idPrefix + 'Input');
    const preview = document.getElementById(idPrefix + 'Preview');
    const removeBtn = document.getElementById(idPrefix + 'Remove');
    if (!zone || !input || !preview) return;

    function setPreview(url) {
      const isPdf = isPdfUrl(url);
      if (url && isPdf) preview.innerHTML = PDF_ICON_SVG;
      else if (url) preview.innerHTML = `<img src="${escapeHtml(url)}" style="width:100%; height:100%; object-fit:cover;">`;
      else preview.innerHTML = '';
      if (removeBtn) removeBtn.style.display = url ? '' : 'none';
    }

    async function handleFile(file) {
      if (!file) return;
      showToast('Envoi en cours...');
      const result = await uploadFile(file, opts.resizeMaxDim);
      if (result.unauthorized) { showToast('Votre session a expiré. Reconnectez-vous.'); clearAdminToken(); openAdminModal(); return; }
      if (!result.ok) { showToast(result.error || "Échec de l'envoi."); return; }
      entry[fieldKey] = result.url;
      setPreview(result.url);
      opts.onChanged?.(result.url);
      showToast('Fichier envoyé.');
    }

    zone.querySelector('[data-dropzone-trigger]')?.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { const f = input.files[0]; input.value = ''; handleFile(f); });
    ['dragenter', 'dragover'].forEach(evt => zone.addEventListener(evt, e => { e.preventDefault(); zone.classList.add('drag-over'); }));
    ['dragleave', 'drop'].forEach(evt => zone.addEventListener(evt, e => { e.preventDefault(); zone.classList.remove('drag-over'); }));
    zone.addEventListener('drop', e => { const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); });
    removeBtn?.addEventListener('click', () => { entry[fieldKey] = ''; setPreview(''); opts.onChanged?.(''); });
  }
  function renderPlanningEditor(content) {
    const container = document.getElementById('adminPlanningEditor');
    if (!container) return;

    content.progress = content.progress || { stepLine1: '', stepLine2: '', percent: 0 };
    content.milestones = content.milestones || [];
    content.articles = content.articles || [];

    const openMilestoneIds = new Set();
    const openArticleIds = new Set();

    function milestoneCardHtml(m, index, total) {
      const isOpen = openMilestoneIds.has(m.id);
      const pill = MILESTONE_STATUS_MAP[m.status] || MILESTONE_STATUS_MAP.future;
      return `
        <div class="faq-card ${isOpen ? 'open' : ''}" data-milestone-card="${m.id}">
          <button type="button" class="faq-card-header" data-milestone-toggle="${m.id}">
            <span class="status-pill ${pill.cls}" style="margin-bottom:0;">${pill.label}</span>
            <span class="milestone-badge">Étape ${index + 1} / ${total}</span>
            <span class="faq-card-title">${escapeHtml(m.date || '')} — ${escapeHtml(m.label || '(sans titre)')}</span>
            <span class="faq-card-chevron"><svg viewBox="0 0 12 12"><polyline points="1,3 6,9 11,3"/></svg></span>
          </button>
          <div class="faq-card-body">
            <div class="faq-card-body-inner">
              <label class="admin-editor-label">Période / date</label>
              <input type="text" class="form-input" data-milestone-field="date" value="${escapeHtml(m.date || '')}">
              <label class="admin-editor-label">Intitulé du jalon</label>
              <input type="text" class="form-input" data-milestone-field="label" value="${escapeHtml(m.label || '')}">
              <label class="admin-editor-label">Statut</label>
              <select class="form-input" data-milestone-field="status">
                <option value="done" ${m.status==='done'?'selected':''}>Terminé</option>
                <option value="current" ${m.status==='current'?'selected':''}>En cours</option>
                <option value="future" ${m.status==='future'?'selected':''}>À venir</option>
              </select>
              <label class="admin-editor-label">Texte d'introduction</label>
              <textarea class="form-input admin-editor-textarea" data-milestone-field="desc">${escapeHtml(m.desc || '')}</textarea>
              <div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
                <button type="button" class="admin-modal-cancel" data-milestone-up="${m.id}" style="flex:none; padding:0 14px; height:34px;" ${index===0?'disabled':''}>↑ Monter</button>
                <button type="button" class="admin-modal-cancel" data-milestone-down="${m.id}" style="flex:none; padding:0 14px; height:34px;" ${index===total-1?'disabled':''}>↓ Descendre</button>
                <button type="button" class="admin-delete-btn" data-milestone-delete="${m.id}" style="margin-top:0;">Supprimer ce jalon</button>
              </div>
            </div>
          </div>
        </div>`;
    }

    function bindMilestoneCard(m) {
      const card = container.querySelector(`[data-milestone-card="${m.id}"]`);
      if (!card) return;
      card.querySelector('[data-milestone-toggle]').addEventListener('click', () => {
        const nowOpen = card.classList.toggle('open');
        if (nowOpen) openMilestoneIds.add(m.id); else openMilestoneIds.delete(m.id);
      });
      card.querySelectorAll('[data-milestone-field]').forEach(field => {
        const evt = field.tagName === 'SELECT' ? 'change' : 'input';
        field.addEventListener(evt, () => {
          const key = field.dataset.milestoneField;
          m[key] = field.value;
          if (key === 'status') {
            const pill = MILESTONE_STATUS_MAP[m.status] || MILESTONE_STATUS_MAP.future;
            const pillEl = card.querySelector('.status-pill');
            if (pillEl) { pillEl.className = `status-pill ${pill.cls}`; pillEl.textContent = pill.label; }
            refreshPlanningProgress();
          }
          if (key === 'date' || key === 'label') {
            const t = card.querySelector('.faq-card-title');
            if (t) t.textContent = `${m.date || ''} — ${m.label || '(sans titre)'}`;
          }
        });
      });
      card.querySelector('[data-milestone-up]')?.addEventListener('click', () => {
        const idx = content.milestones.findIndex(x => x.id === m.id);
        moveItem(content.milestones, idx, -1);
        renderMilestonesList();
        refreshPlanningProgress();
      });
      card.querySelector('[data-milestone-down]')?.addEventListener('click', () => {
        const idx = content.milestones.findIndex(x => x.id === m.id);
        moveItem(content.milestones, idx, 1);
        renderMilestonesList();
        refreshPlanningProgress();
      });
      card.querySelector('[data-milestone-delete]').addEventListener('click', () => {
        if (!confirm('Supprimer définitivement ce jalon ?')) return;
        content.milestones = content.milestones.filter(x => x.id !== m.id);
        openMilestoneIds.delete(m.id);
        renderMilestonesList();
        refreshPlanningProgress();
      });
    }

    function renderMilestonesList() {
      const listEl = document.getElementById('planningMilestonesList');
      if (!listEl) return;
      listEl.innerHTML = content.milestones.length
        ? content.milestones.map((m, i) => milestoneCardHtml(m, i, content.milestones.length)).join('')
        : '<div class="kpi-empty">Aucun jalon pour l\'instant.</div>';
      content.milestones.forEach(bindMilestoneCard);
    }

    function articleCardHtml(a, index, total) {
      const isOpen = openArticleIds.has(a.id);
      return `
        <div class="faq-card ${isOpen ? 'open' : ''}" data-article-card="${a.id}">
          <button type="button" class="faq-card-header" data-article-toggle="${a.id}">
            <span class="tag-pill">${escapeHtml(a.tag || '')}</span>
            <span class="faq-card-title">${escapeHtml(a.title || '(sans titre)')}</span>
            <span class="faq-card-chevron"><svg viewBox="0 0 12 12"><polyline points="1,3 6,9 11,3"/></svg></span>
          </button>
          <div class="faq-card-body">
            <div class="faq-card-body-inner">
              <label class="admin-editor-label">Titre de l'article</label>
              <input type="text" class="form-input" data-article-field="title" value="${escapeHtml(a.title || '')}">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                <div>
                  <label class="admin-editor-label">Étiquette (ex. Calendrier, Écoute...)</label>
                  <input type="text" class="form-input" data-article-field="tag" value="${escapeHtml(a.tag || '')}">
                </div>
                <div>
                  <label class="admin-editor-label">Date affichée (ex. "2 avril 2026 · 4 min")</label>
                  <input type="text" class="form-input" data-article-field="date" value="${escapeHtml(a.date || '')}">
                </div>
              </div>
              <label class="admin-editor-label">Chapeau (résumé affiché avant ouverture)</label>
              <textarea class="form-input admin-editor-textarea" data-article-field="chapeau" style="min-height:70px;">${escapeHtml(a.chapeau || '')}</textarea>
              <label class="admin-editor-label">Corps de l'article — pour un sous-titre en gras, commence la ligne par "## "</label>
              <textarea class="form-input admin-editor-textarea" data-article-field="body" style="min-height:220px;">${escapeHtml(a.body || '')}</textarea>
              <div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
                <button type="button" class="admin-modal-cancel" data-article-up="${a.id}" style="flex:none; padding:0 14px; height:34px;" ${index===0?'disabled':''}>↑ Monter</button>
                <button type="button" class="admin-modal-cancel" data-article-down="${a.id}" style="flex:none; padding:0 14px; height:34px;" ${index===total-1?'disabled':''}>↓ Descendre</button>
                <button type="button" class="admin-delete-btn" data-article-delete="${a.id}" style="margin-top:0;">Supprimer cet article</button>
              </div>
            </div>
          </div>
        </div>`;
    }

    function bindArticleCard(a) {
      const card = container.querySelector(`[data-article-card="${a.id}"]`);
      if (!card) return;
      card.querySelector('[data-article-toggle]').addEventListener('click', () => {
        const nowOpen = card.classList.toggle('open');
        if (nowOpen) openArticleIds.add(a.id); else openArticleIds.delete(a.id);
      });
      card.querySelectorAll('[data-article-field]').forEach(field => {
        field.addEventListener('input', () => {
          const key = field.dataset.articleField;
          a[key] = field.value;
          if (key === 'title') { const t = card.querySelector('.faq-card-title'); if (t) t.textContent = field.value || '(sans titre)'; }
          if (key === 'tag') { const tg = card.querySelector('.tag-pill'); if (tg) tg.textContent = field.value; }
        });
      });
      card.querySelector('[data-article-up]')?.addEventListener('click', () => {
        const idx = content.articles.findIndex(x => x.id === a.id);
        moveItem(content.articles, idx, -1);
        renderArticlesAdminList();
      });
      card.querySelector('[data-article-down]')?.addEventListener('click', () => {
        const idx = content.articles.findIndex(x => x.id === a.id);
        moveItem(content.articles, idx, 1);
        renderArticlesAdminList();
      });
      card.querySelector('[data-article-delete]').addEventListener('click', () => {
        if (!confirm('Supprimer définitivement cet article ? Les statistiques de consultation associées resteront visibles dans Pilotage.')) return;
        content.articles = content.articles.filter(x => x.id !== a.id);
        openArticleIds.delete(a.id);
        renderArticlesAdminList();
      });
    }

    function renderArticlesAdminList() {
      const listEl = document.getElementById('planningArticlesList');
      if (!listEl) return;
      listEl.innerHTML = content.articles.length
        ? content.articles.map((a, i) => articleCardHtml(a, i, content.articles.length)).join('')
        : '<div class="kpi-empty">Aucun article pour l\'instant.</div>';
      content.articles.forEach(bindArticleCard);
    }

    container.innerHTML = `
      <div class="admin-page-eyebrow">Contenus</div>
      <div class="admin-page-title" id="studioPlanningTitle">Actualités &amp; planning.</div>
      <div class="admin-page-sub" id="studioPlanningSub" style="margin-bottom:28px;">Faites vivre le projet au fil de ses étapes et de ses publications.</div>
      <div class="admin-editor-panel studio-project-only" style="margin-bottom:28px;">
        <div class="kpi-section-title">Avancement du projet</div>
        <div class="kpi-section-sub">Storm calcule automatiquement la progression à partir des jalons.</div>
        <div style="display:grid; grid-template-columns:1fr 150px; gap:14px; margin-top:16px; align-items:center;">
          <div>
            <div class="admin-editor-label">Progression</div>
            <div style="display:flex; align-items:center; gap:10px;">
              <div class="progress-track" style="flex:1; height:12px; border-radius:999px; background:var(--ink-08); overflow:hidden;">
                <div class="progress-fill" id="adminPlanningProgressFill" style="width:0%"></div>
              </div>
              <span class="progress-pct mono" id="adminPlanningProgressPct">0%</span>
            </div>
          </div>
          <div>
            <div class="admin-editor-label">Étape actuelle</div>
            <div id="adminPlanningProgressStep" class="mono" style="font-weight:600;">Étape 0 sur 0</div>
          </div>
        </div>
      </div>

      <div class="admin-editor-panel studio-project-only" style="margin-bottom:28px;">
        <div class="kpi-section-title">Jalons</div>
        <div class="kpi-section-sub">Les jalons apparaissent dans cet ordre sur la page Actualités.</div>
        <div class="faq-card-list" id="planningMilestonesList" style="margin-top:20px;"></div>
        <button type="button" class="admin-modal-cancel" id="addMilestoneBtn" style="flex:none; padding:0 20px; margin-top:16px;">+ Ajouter un jalon</button>
      </div>

      <div class="admin-editor-panel studio-news-only">
        <div class="kpi-section-title">Actualités</div>
        <div class="kpi-section-sub">Les publications apparaissent dans cet ordre. Pour ajouter un sous-titre dans le texte, commencez la ligne par "## ".</div>
        <div class="faq-card-list" id="planningArticlesList" style="margin-top:20px;"></div>
        <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <button type="button" class="admin-modal-cancel" id="addArticleBtn" style="flex:none; padding:0 20px;">+ Nouvelle actualité</button>
          <button type="button" class="search-btn" id="savePlanningBtn">Enregistrer</button>
        </div>
      </div>`;

    function refreshPlanningProgress() {
      content.progress = computeProgressFromMilestones(content.milestones);
      const fill = document.getElementById('adminPlanningProgressFill');
      const pct = document.getElementById('adminPlanningProgressPct');
      const step = document.getElementById('adminPlanningProgressStep');
      if (fill) fill.style.width = `${content.progress.percent}%`;
      if (pct) pct.textContent = `${content.progress.percent}%`;
      if (step) step.textContent = `${content.progress.stepLine1} ${content.progress.stepLine2}`;
    }

    refreshPlanningProgress();

    document.getElementById('addMilestoneBtn').addEventListener('click', () => {
      const id = `jalon-${Date.now()}`;
      const newMilestone = { id, status: 'future', date: '', label: 'Nouveau jalon', desc: '' };
      content.milestones = [...content.milestones, newMilestone];
      openMilestoneIds.add(id);
      renderMilestonesList();
      refreshPlanningProgress();
      document.querySelector(`[data-milestone-card="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    document.getElementById('addArticleBtn').addEventListener('click', () => {
      const id = `article-${Date.now()}`;
      const newArticle = { id, tag: '', date: '', title: 'Nouvel article', chapeau: '', body: '' };
      content.articles = [newArticle, ...content.articles];
      openArticleIds.add(id);
      renderArticlesAdminList();
      document.querySelector(`[data-article-card="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.querySelector(`[data-article-card="${id}"] input[data-article-field="title"]`)?.focus();
    });

    document.getElementById('savePlanningBtn').addEventListener('click', async () => {
      const result = await saveContent(buildSavePayload(content));
      if (handleSaveResult(result, 'Planning & Actualités enregistrés.')) {
        renderMilestonesFront(content.milestones, content.progress);
        renderArticlesFront(content.articles);
      }
    });

    renderMilestonesList();
    renderArticlesAdminList();
  }
  function renderTeamEditor(content) {
    const container = document.getElementById('adminTeamEditor');
    if (!container) return;

    content.ambassadorsContent = content.ambassadorsContent && typeof content.ambassadorsContent === 'object' ? content.ambassadorsContent : {};
    content.ambassadors = Array.isArray(content.ambassadors) ? content.ambassadors : [];

    const c = content.ambassadorsContent;
    if (typeof c.contactEnabled !== 'boolean') c.contactEnabled = false;
    // Legacy collective contact fields are preserved in saved state for migration,
    // but Tectonic 6A.1 no longer exposes them in the Studio.
    if (typeof c.contactDestination !== 'string') c.contactDestination = '';
    if (typeof c.contactLabel !== 'string') c.contactLabel = 'Contacter';
    if (typeof c.joinEnabled !== 'boolean') c.joinEnabled = Boolean(c.ctaTitle || c.ctaBody);
    if (!['inline','link'].includes(c.joinMode)) c.joinMode = 'inline';
    if (typeof c.joinTitle !== 'string') c.joinTitle = c.ctaTitle || 'Vous souhaitez devenir ambassadeur ?';
    if (typeof c.joinBody !== 'string') c.joinBody = c.ctaBody || '';
    if (typeof c.joinLabel !== 'string') c.joinLabel = 'Devenir ambassadeur';
    if (typeof c.joinHref !== 'string') c.joinHref = '';

    content.ambassadors.forEach((person,index) => {
      if (!person.id) person.id = `amb-${Date.now()}-${index}`;
      if (typeof person.contactable !== 'boolean') person.contactable = true;
      if (!['email','teams','link'].includes(person.contactChannel)) person.contactChannel = 'email';
      if (typeof person.contactValue !== 'string') person.contactValue = '';
    });

    let activeId = container.dataset.ambassadorActiveId || 'network';
    if (activeId !== 'network' && !content.ambassadors.some(a => String(a.id) === String(activeId))) activeId = 'network';

    const initials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase() || '—';
    const activePerson = () => content.ambassadors.find(a => String(a.id) === String(activeId)) || null;
    const mark = () => { if (typeof markDirty === 'function') markDirty(); };

    function rosterRow(person) {
      return `<button type="button" draggable="true" class="studio-amb-person-row ${String(person.id)===String(activeId)?'is-active':''}" data-amb-select="${escapeHtml(person.id)}" data-amb-drag="${escapeHtml(person.id)}">
        <span class="studio-amb-handle" aria-hidden="true">⋮⋮</span>
        <span class="studio-amb-avatar">${person.imageUrl ? `<img src="${escapeHtml(person.imageUrl)}" alt="">` : escapeHtml(initials(person.name))}</span>
        <span><strong>${escapeHtml(person.name || 'Ambassadeur sans nom')}</strong><small>${escapeHtml(person.tag || person.role || 'Équipe à préciser')}</small></span>
      </button>`;
    }

    function listHtml() {
      return `<aside class="studio-amb-list">
        <div class="studio-amb-list-head"><strong>Le réseau</strong><span>${content.ambassadors.length} ambassadeur${content.ambassadors.length>1?'s':''} · faites glisser pour changer l’ordre</span></div>
        <button type="button" class="studio-amb-network-row ${activeId==='network'?'is-active':''}" data-amb-select="network"><strong>Fonctionnement du réseau</strong><span>Configurer</span></button>
        <div class="studio-amb-roster">${content.ambassadors.map(rosterRow).join('')}</div>
        <button type="button" class="studio-amb-add" id="studioAmbAdd">+ Ajouter un ambassadeur</button>
      </aside>`;
    }

    function networkHtml() {
      return `<section class="studio-amb-detail">
        <div class="studio-amb-detail-kicker">Réseau d’ambassadeurs</div><h2 class="studio-amb-network-title">Des relais au plus près du terrain.</h2>
        <div class="studio-amb-fields">
          <div><label class="admin-editor-label">Comment présenter leur rôle ?</label><input class="form-input" id="ambIntroTitleInput" value="${escapeHtml(c.introTitle || '')}" placeholder="Ex. Quel est leur rôle exactement ?"></div>
          <div><label class="admin-editor-label">En quelques lignes</label>${studioInlineEditorHtml('ambIntroBodyInput', c.introBody || '', { minHeight:145, placeholder:'Expliquez simplement le rôle du réseau.' })}</div>
          <div><label class="admin-editor-label">Précision sous le nombre d’ambassadeurs <span style="font-weight:400;text-transform:none;letter-spacing:0;">(facultatif)</span></label><input class="form-input" id="ambRosterLabelInput" value="${escapeHtml(c.rosterLabel || '')}" placeholder="Ex. toutes directions"></div>

          <div class="studio-amb-section">
            <div class="studio-amb-section-head"><div><strong>Les ambassadeurs peuvent-ils être contactés directement ?</strong><p>Activez cette possibilité pour le réseau. Chaque ambassadeur pourra ensuite accepter ou non d’être contacté et disposer de sa propre coordonnée.</p></div><button type="button" class="studio-amb-switch ${c.contactEnabled?'is-on':''}" id="ambContactToggle" aria-pressed="${c.contactEnabled?'true':'false'}"></button></div>
            ${c.contactEnabled ? `<div class="studio-amb-contact-preview"><strong>Contact individuel activé.</strong> Ouvrez chaque fiche pour renseigner son email, son lien Teams ou un autre lien. Aucun bouton n’est publié sans coordonnée valide.</div>` : ''}
          </div>

          <div class="studio-amb-section">
            <div class="studio-amb-section-head"><div><strong>Recrutement</strong><p>Afficher un appel à rejoindre le réseau uniquement lorsqu’il est réellement ouvert.</p></div><button type="button" class="studio-amb-switch ${c.joinEnabled?'is-on':''}" id="ambJoinToggle" aria-pressed="${c.joinEnabled?'true':'false'}"></button></div>
            ${c.joinEnabled ? `<div class="studio-amb-fields">
              <div><label class="admin-editor-label">Titre</label><input class="form-input" id="ambJoinTitle" value="${escapeHtml(c.joinTitle || '')}"></div>
              <div><label class="admin-editor-label">Message</label>${studioInlineEditorHtml('ambJoinBody', c.joinBody || '', { minHeight:96, compact:true, placeholder:'Expliquez en quelques lignes pourquoi et comment rejoindre le réseau.' })}</div>
              <div><label class="admin-editor-label">Comment manifester son intérêt ?</label><div class="studio-amb-choice"><button type="button" class="${c.joinMode==='inline'?'is-active':''}" data-amb-join-mode="inline">Directement dans Storm</button><button type="button" class="${c.joinMode==='link'?'is-active':''}" data-amb-join-mode="link">Via un lien</button></div></div>
              <div class="studio-amb-two"><div><label class="admin-editor-label">Libellé de l’action</label><input class="form-input" id="ambJoinLabel" value="${escapeHtml(c.joinLabel || 'Devenir ambassadeur')}"></div>${c.joinMode==='link'?`<div><label class="admin-editor-label">Lien</label><input class="form-input" id="ambJoinHref" value="${escapeHtml(c.joinHref || '')}" placeholder="https://…"></div>`:'<div></div>'}</div>
            </div>` : ''}
          </div>
        </div>
      </section>`;
    }

    function personHtml(person) {
      const prefix = `studioAmbPhoto-${String(person.id).replace(/[^a-zA-Z0-9_-]/g,'')}`;
      return `<section class="studio-amb-detail">
        <div class="studio-amb-detail-kicker">Ambassadeur</div><h2>${escapeHtml(person.name || 'Nouvel ambassadeur')}</h2>
        <div class="studio-amb-fields">
          <div><label class="admin-editor-label">Photo <span style="font-weight:400;text-transform:none;letter-spacing:0;">(facultative)</span></label>
            <div class="studio-amb-photo" id="${prefix}Zone" tabindex="0" role="button">
              <div class="studio-amb-photo-preview" id="${prefix}Preview">${person.imageUrl?`<img src="${escapeHtml(person.imageUrl)}" alt="">`:escapeHtml(initials(person.name))}</div>
              <div class="studio-amb-photo-copy"><strong>Déposez une photo ici</strong><p>ou choisissez un fichier depuis votre ordinateur.</p><div class="studio-amb-photo-actions"><button type="button" id="${prefix}Browse">Parcourir</button>${person.imageUrl?`<button type="button" id="${prefix}Remove">Retirer</button>`:''}</div></div>
              <input type="file" id="${prefix}Input" accept="image/png,image/jpeg,image/webp" style="display:none;">
            </div>
          </div>
          <div><label class="admin-editor-label">Nom</label><input class="form-input" data-amb-field="name" value="${escapeHtml(person.name || '')}"></div>
          <div class="studio-amb-two"><div><label class="admin-editor-label">Rôle ou fonction</label><input class="form-input" data-amb-field="role" value="${escapeHtml(person.role || '')}" placeholder="Ex. Responsable comptabilité clients"></div><div><label class="admin-editor-label">Équipe ou direction</label><input class="form-input" data-amb-field="tag" value="${escapeHtml(person.tag || '')}" placeholder="Ex. Finance"></div></div>
          ${c.contactEnabled ? `<div class="studio-amb-section">
            <div class="studio-amb-section-head"><div><strong>Autoriser le contact direct</strong><p>Si cette option est activée et qu’une coordonnée est renseignée, un bouton « Contacter ${escapeHtml(String(person.name || '').trim().split(/\s+/)[0] || 'cet ambassadeur')} » apparaîtra sous sa carte.</p></div><button type="button" class="studio-amb-switch ${person.contactable!==false?'is-on':''}" id="ambPersonContactToggle" aria-pressed="${person.contactable!==false?'true':'false'}"></button></div>
            ${person.contactable!==false ? `<div class="studio-amb-fields">
              <div><label class="admin-editor-label">Canal de contact</label><div class="studio-amb-choice"><button type="button" class="${person.contactChannel==='email'?'is-active':''}" data-amb-contact-channel="email">Email</button><button type="button" class="${person.contactChannel==='teams'?'is-active':''}" data-amb-contact-channel="teams">Teams</button><button type="button" class="${person.contactChannel==='link'?'is-active':''}" data-amb-contact-channel="link">Autre lien</button></div></div>
              <div><label class="admin-editor-label">${person.contactChannel==='email'?'Adresse email':person.contactChannel==='teams'?'Lien Teams':'Lien de contact'}</label><input class="form-input" id="ambPersonContactValue" value="${escapeHtml(person.contactValue || '')}" placeholder="${person.contactChannel==='email'?'prenom.nom@entreprise.fr':'https://…'}"></div>
              <div class="studio-amb-contact-preview">Aperçu public : <strong>Contacter ${escapeHtml(String(person.name || '').trim().split(/\s+/)[0] || 'cet ambassadeur')} →</strong></div>
              ${!person.contactValue ? `<p class="studio-amb-contact-warning">Renseignez une coordonnée pour afficher ce bouton côté collaborateurs.</p>` : ''}
            </div>` : ''}
          </div>` : ''}
        </div>
        <button type="button" class="studio-amb-danger" id="studioAmbDelete">Supprimer cet ambassadeur</button>
      </section>`;
    }

    function detailHtml(){ const p=activePerson(); return activeId==='network'||!p ? networkHtml() : personHtml(p); }

    function render(){
      container.dataset.ambassadorActiveId=activeId;
      container.innerHTML=`<div class="studio-domain-head"><div class="studio-domain-head-copy"><div class="admin-page-eyebrow">Contenus</div><h1>Ambassadeurs.</h1><p>Présentez les collègues qui relaient le projet, répondent aux questions de proximité et font remonter les besoins du terrain.</p></div><button type="button" class="studio-domain-save" id="studioAmbSave">Enregistrer les ambassadeurs</button></div><div class="studio-amb-layout">${listHtml()}${detailHtml()}</div>`;
      bind();
    }

    function bind(){
      container.querySelectorAll('[data-amb-select]').forEach(btn=>btn.addEventListener('click',e=>{ if(e.target.closest('.studio-amb-handle')) return; activeId=btn.dataset.ambSelect; render(); }));
      document.getElementById('studioAmbAdd')?.addEventListener('click',()=>{ const id=`amb-${Date.now()}`; content.ambassadors.push({id,name:'Nouvel ambassadeur',role:'',tag:'',imageUrl:'',initials:'',contactable:true,contactChannel:'email',contactValue:''}); activeId=id; mark(); render(); setTimeout(()=>container.querySelector('[data-amb-field="name"]')?.focus(),0); });

      let dragged='';
      container.querySelectorAll('[data-amb-drag]').forEach(row=>{
        row.addEventListener('dragstart',e=>{dragged=row.dataset.ambDrag; e.dataTransfer.effectAllowed='move';});
        row.addEventListener('dragover',e=>{e.preventDefault();});
        row.addEventListener('drop',e=>{e.preventDefault(); const target=row.dataset.ambDrag; if(!dragged||dragged===target)return; const from=content.ambassadors.findIndex(x=>String(x.id)===String(dragged)); const to=content.ambassadors.findIndex(x=>String(x.id)===String(target)); if(from<0||to<0)return; const [item]=content.ambassadors.splice(from,1); content.ambassadors.splice(to,0,item); mark(); render();});
      });

      if(activeId==='network'){
        const wire=(id,key,event='input')=>document.getElementById(id)?.addEventListener(event,e=>{c[key]=e.target.value; if(key==='joinTitle')c.ctaTitle=e.target.value; if(key==='joinBody')c.ctaBody=e.target.value; mark();});
        wire('ambIntroTitleInput','introTitle'); wire('ambRosterLabelInput','rosterLabel'); wire('ambJoinTitle','joinTitle'); wire('ambJoinLabel','joinLabel'); wire('ambJoinHref','joinHref');
        studioBindInlineEditor(container,'ambIntroBodyInput',value=>{c.introBody=value;mark();});
        studioBindInlineEditor(container,'ambJoinBody',value=>{c.joinBody=value;c.ctaBody=value;mark();});
        document.getElementById('ambContactToggle')?.addEventListener('click',()=>{c.contactEnabled=!c.contactEnabled;mark();render();});
        document.getElementById('ambJoinToggle')?.addEventListener('click',()=>{c.joinEnabled=!c.joinEnabled;c.ctaTitle=c.joinEnabled?c.joinTitle:'';c.ctaBody=c.joinEnabled?c.joinBody:'';mark();render();});
        container.querySelectorAll('[data-amb-join-mode]').forEach(btn=>btn.addEventListener('click',()=>{c.joinMode=btn.dataset.ambJoinMode;mark();render();}));
      } else {
        const person=activePerson(); if(person){
          container.querySelectorAll('[data-amb-field]').forEach(input=>input.addEventListener('input',()=>{person[input.dataset.ambField]=input.value;mark(); if(input.dataset.ambField==='name'){const h=container.querySelector('.studio-amb-detail h2'); if(h)h.textContent=input.value||'Nouvel ambassadeur';}}));
          document.getElementById('ambPersonContactToggle')?.addEventListener('click',()=>{person.contactable=person.contactable===false;mark();render();});
          container.querySelectorAll('[data-amb-contact-channel]').forEach(btn=>btn.addEventListener('click',()=>{person.contactChannel=btn.dataset.ambContactChannel;mark();render();}));
          document.getElementById('ambPersonContactValue')?.addEventListener('input',e=>{person.contactValue=e.target.value;mark();});
          document.getElementById('studioAmbDelete')?.addEventListener('click',()=>{if(!confirm('Supprimer définitivement cet ambassadeur ?'))return;content.ambassadors=content.ambassadors.filter(x=>String(x.id)!==String(person.id));activeId='network';mark();render();});

          const safe=String(person.id).replace(/[^a-zA-Z0-9_-]/g,''); const prefix=`studioAmbPhoto-${safe}`;
          const zone=document.getElementById(prefix+'Zone'), input=document.getElementById(prefix+'Input');
          async function handleFile(file){ if(!file)return; showToast('Envoi en cours...'); const result=await uploadFile(file,640); if(result.unauthorized){clearAdminToken();openAdminModal();return;} if(!result.ok){showToast(result.error||"Échec de l'envoi.");return;} person.imageUrl=result.url; mark(); showToast('Photo envoyée.'); render(); }
          zone?.addEventListener('click',e=>{if(e.target.closest('button'))return;input?.click();});
          zone?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input?.click();}});
          document.getElementById(prefix+'Browse')?.addEventListener('click',e=>{e.stopPropagation();input?.click();});
          input?.addEventListener('change',()=>{const f=input.files?.[0];input.value='';handleFile(f);});
          ['dragenter','dragover'].forEach(evt=>zone?.addEventListener(evt,e=>{e.preventDefault();zone.classList.add('drag-over');}));
          ['dragleave','drop'].forEach(evt=>zone?.addEventListener(evt,e=>{e.preventDefault();zone.classList.remove('drag-over');}));
          zone?.addEventListener('drop',e=>handleFile(e.dataTransfer?.files?.[0]));
          document.getElementById(prefix+'Remove')?.addEventListener('click',e=>{e.stopPropagation();person.imageUrl='';mark();render();});
        }
      }

      document.getElementById('studioAmbSave')?.addEventListener('click',async()=>{
        c.ctaTitle=c.joinEnabled?c.joinTitle:''; c.ctaBody=c.joinEnabled?c.joinBody:'';
        const result=await saveContent(buildSavePayload(content));
        if(handleSaveResult(result,'Ambassadeurs enregistrés.')){currentAdminContent=content;if(result.saveSource!=='auto')renderAmbassadorsFront(content);else studioQueueContextSaveDockBind();}
      });
    }

    render();
  }
  function renderVisualsEditor(content) {
    const container = document.getElementById('adminVisualsEditor');
    if (!container) return;

    const USAGES = ['Se concentrer','Collaborer','Se réunir','Échanger de façon informelle','Faire une pause','Travailler autrement','Accueillir'];
    const STATUS = {
      designing: { label:'En cours de conception', hint:'L’espace peut encore évoluer.' },
      approved: { label:'Validé', hint:'Les grands principes sont arrêtés.' },
      delivered: { label:'Livré', hint:'L’espace est prêt à être découvert.' }
    };
    const MEDIA_KIND = {
      view: 'Une vue de l’espace',
      plan: 'Un plan à explorer',
      document: 'Un document à consulter'
    };

    function text(value) { return String(value ?? ''); }
    function uid(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }
    function normalizeMedia(asset) {
      if (!asset || !asset.url) return null;
      return {
        id: asset.id || uid('space-media'),
        kind: ['view','plan','document'].includes(asset.kind) ? asset.kind : (/\.pdf(?:$|\?)/i.test(asset.url) ? 'document' : 'view'),
        url: asset.url,
        label: text(asset.label),
        alt: text(asset.alt)
      };
    }
    function normalizeSpace(space, index) {
      return {
        id: space?.id || uid('space'),
        name: text(space?.name || space?.title || `Espace ${index + 1}`),
        location: text(space?.location),
        status: STATUS[space?.status] ? space.status : 'designing',
        description: text(space?.description || space?.comment),
        usages: Array.isArray(space?.usages) ? [...new Set(space.usages.filter(Boolean))] : (Array.isArray(space?.usageTags) ? [...new Set(space.usageTags.filter(Boolean))] : []),
        media: (Array.isArray(space?.media) ? space.media : []).map(normalizeMedia).filter(Boolean)
      };
    }

    function studioDefaultSpacesSeed() {
      return [
        { id:'space-overview', name:'Vue d’ensemble du futur site', location:'Niveau R+1', status:'designing', description:'Une première lecture du futur environnement de travail : les différentes familles d’usages s’organisent autour d’une circulation centrale, avec des zones plus calmes et d’autres plus collaboratives.', usages:['Travailler autrement','Collaborer','Se concentrer'], media:[] },
        { id:'space-workcafe', name:'Work-café', location:'Cœur du site', status:'approved', description:'Un espace central, lumineux et polyvalent pour déjeuner, faire une pause, retrouver un collègue ou travailler ponctuellement dans un cadre plus informel.', usages:['Faire une pause','Échanger de façon informelle','Travailler autrement'], media:[] },
        { id:'space-workfloor', name:'Plateau de travail', location:'Niveau R+1', status:'designing', description:'Des postes partagés organisés en quartiers d’équipe, associés à des espaces de proximité pour alterner concentration, échanges rapides et travail collectif.', usages:['Se concentrer','Collaborer','Travailler autrement'], media:[] },
        { id:'space-focus', name:'Espaces de concentration', location:'À proximité des plateaux de travail', status:'approved', description:'Des zones silencieuses et des cabines phoniques permettent de s’isoler pour une tâche exigeante, un appel ou une visioconférence sans gêner le collectif.', usages:['Se concentrer','Travailler autrement'], media:[] },
        { id:'space-meeting', name:'Salles de réunion', location:'Réparties sur les niveaux de travail', status:'designing', description:'Plusieurs formats de salles accompagnent les réunions d’équipe, les ateliers et les échanges hybrides avec des participants à distance.', usages:['Se réunir','Collaborer'], media:[] },
        { id:'space-services', name:'Accueil & services', location:'Rez-de-chaussée', status:'designing', description:'Le rez-de-chaussée rassemble l’accueil et les principaux services du quotidien afin de rendre l’arrivée sur site simple et lisible.', usages:['Accueillir','Faire une pause','Échanger de façon informelle'], media:[] }
      ].map(normalizeSpace);
    }

    function studioMigrateLegacyPlans(plans) {
      if (!Array.isArray(plans) || !plans.length) return [];
      return plans.map((plan, index) => normalizeSpace({
        id: plan?.id || `legacy-space-${index + 1}`,
        name: plan?.title || `Espace ${index + 1}`,
        description: plan?.comment || '',
        status: 'designing',
        usages: ['Travailler autrement'],
        media: plan?.imageUrl ? [{
          id: `legacy-space-media-${index + 1}`,
          kind: /plan|zoning|implantation/i.test(`${plan?.type || ''} ${plan?.tags || ''} ${plan?.title || ''}`) ? 'plan' : (/\.pdf(?:$|\?)/i.test(plan.imageUrl) ? 'document' : 'view'),
          url: plan.imageUrl,
          label: plan.title || '',
          alt: plan.title || ''
        }] : []
      }, index));
    }

    const rawSpaces = Array.isArray(content.spaces) ? content.spaces : [];
    if (!rawSpaces.length && content.spacesInitialized !== true) {
      const migrated = studioMigrateLegacyPlans(content.plans);
      content.spaces = migrated.length ? migrated : studioDefaultSpacesSeed();
    } else {
      content.spaces = rawSpaces.map(normalizeSpace);
    }
    let selectedId = content.spaces[0]?.id || null;
    let draggingId = null;

    function selectedSpace() { return content.spaces.find(space => space.id === selectedId) || null; }
    function markDirty() { studioSetSaveState('dirty'); }
    function mediaKindLabel(kind) { return MEDIA_KIND[kind] || MEDIA_KIND.view; }
    function statusLabel(status) { return STATUS[status]?.label || STATUS.designing.label; }
    function safeName(name) { return text(name).trim() || 'Sans nom'; }

    function mediaPreview(asset) {
      const pdf = /\.pdf(?:$|\?)/i.test(asset.url || '');
      if (pdf) return `<div class="studio-space-media-pdf"><span>PDF</span><small>${escapeHtml(asset.label || 'Document')}</small></div>`;
      return `<img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.alt || asset.label || '')}">`;
    }

    function renderList() {
      const list = document.getElementById('studioSpacesList');
      const count = document.getElementById('studioSpacesCount');
      if (!list) return;
      if (count) count.textContent = `${content.spaces.length} espace${content.spaces.length > 1 ? 's' : ''}`;
      list.innerHTML = content.spaces.length ? content.spaces.map(space => `
        <div class="studio-space-row ${space.id === selectedId ? 'is-active' : ''}" draggable="true" data-space-row="${escapeHtml(space.id)}">
          <span class="studio-space-drag" aria-hidden="true">⋮⋮</span>
          <button type="button" class="studio-space-row-main" data-space-select="${escapeHtml(space.id)}">
            <strong>${escapeHtml(safeName(space.name))}</strong>
            <span>${escapeHtml(space.location || statusLabel(space.status))}</span>
          </button>
          <span class="studio-space-media-count" title="${space.media.length} média(s)">${space.media.length}</span>
        </div>`).join('') : `<div class="studio-space-empty-list">Aucun espace pour le moment.</div>`;

      list.querySelectorAll('[data-space-select]').forEach(button => button.addEventListener('click', () => {
        selectedId = button.dataset.spaceSelect;
        renderList();
        renderDetail();
      }));
      list.querySelectorAll('[data-space-row]').forEach(row => {
        row.addEventListener('dragstart', event => {
          draggingId = row.dataset.spaceRow;
          row.classList.add('is-dragging');
          event.dataTransfer.effectAllowed = 'move';
        });
        row.addEventListener('dragend', () => { draggingId = null; row.classList.remove('is-dragging'); });
        row.addEventListener('dragover', event => { event.preventDefault(); row.classList.add('is-drop-target'); });
        row.addEventListener('dragleave', () => row.classList.remove('is-drop-target'));
        row.addEventListener('drop', event => {
          event.preventDefault();
          row.classList.remove('is-drop-target');
          const targetId = row.dataset.spaceRow;
          if (!draggingId || draggingId === targetId) return;
          const from = content.spaces.findIndex(space => space.id === draggingId);
          const to = content.spaces.findIndex(space => space.id === targetId);
          if (from < 0 || to < 0) return;
          const [moved] = content.spaces.splice(from, 1);
          content.spaces.splice(to, 0, moved);
          markDirty();
          renderList();
        });
      });
    }

    async function addFiles(files) {
      const space = selectedSpace();
      if (!space || !files?.length) return;
      for (const file of [...files]) {
        if (!['image/png','image/jpeg','image/jpg','application/pdf'].includes(file.type)) {
          showToast('Ajoutez une image PNG/JPEG ou un PDF.');
          continue;
        }
        showToast(`Envoi de ${file.name}…`);
        const result = await uploadFile(file, file.type.startsWith('image/') ? 2200 : undefined);
        if (result.unauthorized) { showToast('Votre session a expiré. Reconnectez-vous.'); clearAdminToken(); openAdminModal(); return; }
        if (!result.ok) { showToast(result.error || "Échec de l'envoi."); continue; }
        const isPdf = file.type === 'application/pdf';
        space.media.push({
          id: uid('space-media'),
          kind: isPdf ? 'document' : 'view',
          url: result.url,
          label: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
          alt: isPdf ? '' : safeName(space.name)
        });
        markDirty();
      }
      renderList();
      renderDetail();
      showToast('Média ajouté.');
    }

    function renderMedia(space) {
      return `
        <div class="studio-space-media-list">
          ${space.media.length ? space.media.map(asset => `
            <article class="studio-space-media-item" data-space-media="${escapeHtml(asset.id)}">
              <div class="studio-space-media-preview">${mediaPreview(asset)}</div>
              <div class="studio-space-media-fields">
                <label>Comment ce média doit-il être utilisé ?</label>
                <select class="form-input" data-space-media-kind>
                  ${Object.entries(MEDIA_KIND).map(([value,label]) => `<option value="${value}" ${asset.kind === value ? 'selected' : ''}>${label}</option>`).join('')}
                </select>
                <label>${asset.kind === 'document' ? 'Titre du document' : 'Légende'} <span>(facultatif)</span></label>
                <input type="text" class="form-input" data-space-media-label value="${escapeHtml(asset.label || '')}" placeholder="Ex. Vue depuis l’entrée">
                ${asset.kind !== 'document' ? `<label>Description de l’image <span>(accessibilité)</span></label><input type="text" class="form-input" data-space-media-alt value="${escapeHtml(asset.alt || '')}" placeholder="Décrivez brièvement ce que montre l’image">` : ''}
              </div>
              <button type="button" class="studio-space-media-remove" data-space-media-remove aria-label="Retirer ce média">×</button>
            </article>`).join('') : `<p class="studio-space-media-empty">Aucun visuel pour le moment. L’espace peut être enregistré sans média.</p>`}
        </div>
        <div class="studio-space-dropzone" id="studioSpaceDropzone" tabindex="0">
          <input type="file" id="studioSpaceMediaInput" accept="image/png,image/jpeg,application/pdf" multiple hidden>
          <div><strong>Déposez vos visuels ou documents ici</strong><span>Images PNG/JPEG ou PDF · plusieurs fichiers possibles</span></div>
          <button type="button" class="studio-space-secondary" id="studioSpaceBrowseMedia">Parcourir</button>
        </div>`;
    }

    function bindMedia(space) {
      document.querySelectorAll('[data-space-media]').forEach(card => {
        const asset = space.media.find(item => item.id === card.dataset.spaceMedia);
        if (!asset) return;
        card.querySelector('[data-space-media-kind]')?.addEventListener('change', event => {
          asset.kind = event.target.value;
          markDirty();
          renderDetail();
        });
        card.querySelector('[data-space-media-label]')?.addEventListener('input', event => { asset.label = event.target.value; markDirty(); });
        card.querySelector('[data-space-media-alt]')?.addEventListener('input', event => { asset.alt = event.target.value; markDirty(); });
        card.querySelector('[data-space-media-remove]')?.addEventListener('click', () => {
          space.media = space.media.filter(item => item.id !== asset.id);
          markDirty();
          renderList();
          renderDetail();
        });
      });
      const zone = document.getElementById('studioSpaceDropzone');
      const input = document.getElementById('studioSpaceMediaInput');
      document.getElementById('studioSpaceBrowseMedia')?.addEventListener('click', () => input?.click());
      zone?.addEventListener('click', event => { if (event.target === zone || event.target.closest('div')) input?.click(); });
      input?.addEventListener('change', () => { const files = input.files; input.value = ''; addFiles(files); });
      ['dragenter','dragover'].forEach(name => zone?.addEventListener(name, event => { event.preventDefault(); zone.classList.add('is-dragging'); }));
      ['dragleave','drop'].forEach(name => zone?.addEventListener(name, event => { event.preventDefault(); zone.classList.remove('is-dragging'); }));
      zone?.addEventListener('drop', event => addFiles(event.dataTransfer?.files));
    }

    function renderDetail() {
      const detail = document.getElementById('studioSpacesDetail');
      if (!detail) return;
      const space = selectedSpace();
      if (!space) {
        detail.innerHTML = `<div class="studio-space-no-selection"><strong>Ajoutez un premier espace</strong><p>Décrivez un lieu tel qu’il existe dans le projet ; Storm s’occupe de sa présentation publique.</p></div>`;
        return;
      }
      detail.innerHTML = `
        <div class="studio-space-detail-head">
          <div><span>Espace</span><h2>${escapeHtml(safeName(space.name))}</h2></div>
          <button type="button" class="studio-space-delete" id="studioSpaceDelete">Supprimer</button>
        </div>

        <section class="studio-space-section">
          <div class="studio-space-section-intro"><strong>Identifier l’espace</strong><p>Les informations que les collaborateurs doivent comprendre en premier.</p></div>
          <div class="studio-space-fields two">
            <div><label>Nom de l’espace</label><input type="text" class="form-input" id="studioSpaceName" value="${escapeHtml(space.name)}" placeholder="Ex. Work-café"></div>
            <div><label>Où se trouve-t-il ? <span>(facultatif)</span></label><input type="text" class="form-input" id="studioSpaceLocation" value="${escapeHtml(space.location)}" placeholder="Ex. Niveau 5"></div>
          </div>
          <div class="studio-space-field-full"><label>À quoi ressemble-t-il, ou quelle est son intention ?</label>${studioInlineEditorHtml('studioSpaceDescription', space.description || '', { minHeight:105, placeholder:'Expliquez simplement ce que les collaborateurs doivent retenir.' })}</div>
        </section>

        <section class="studio-space-section">
          <div class="studio-space-section-intro"><strong>Où en est cet espace ?</strong><p>Un état de projet, pas un pourcentage d’avancement.</p></div>
          <div class="studio-space-statuses">
            ${Object.entries(STATUS).map(([value,item]) => `<button type="button" class="studio-space-status ${space.status === value ? 'is-active' : ''}" data-space-status="${value}"><i></i><strong>${item.label}</strong><span>${item.hint}</span></button>`).join('')}
          </div>
        </section>

        <section class="studio-space-section">
          <div class="studio-space-section-intro"><strong>À quoi sert-il ?</strong><p>Choisissez les usages humains. Pas de tags techniques de type « 3D », « étage » ou « macro-zoning ».</p></div>
          <div class="studio-space-usage-grid">
            ${USAGES.map(usage => `<label class="studio-space-usage ${space.usages.includes(usage) ? 'is-active' : ''}"><input type="checkbox" value="${escapeHtml(usage)}" ${space.usages.includes(usage) ? 'checked' : ''}><span>${escapeHtml(usage)}</span></label>`).join('')}
          </div>
        </section>

        <section class="studio-space-section">
          <div class="studio-space-section-intro"><strong>Visuels &amp; documents</strong><p>Ajoutez ce qui aide réellement à se projeter. Storm adapte ensuite l’affichage à la nature du média.</p></div>
          ${renderMedia(space)}
        </section>`;

      const name = document.getElementById('studioSpaceName');
      const location = document.getElementById('studioSpaceLocation');
      name?.addEventListener('input', event => { space.name = event.target.value; markDirty(); renderList(); document.querySelector('.studio-space-detail-head h2').textContent = safeName(space.name); });
      location?.addEventListener('input', event => { space.location = event.target.value; markDirty(); renderList(); });
      studioBindInlineEditor(detail, 'studioSpaceDescription', value => { space.description = value; markDirty(); });
      document.querySelectorAll('[data-space-status]').forEach(button => button.addEventListener('click', () => {
        space.status = button.dataset.spaceStatus;
        markDirty();
        renderList();
        renderDetail();
      }));
      document.querySelectorAll('.studio-space-usage input').forEach(input => input.addEventListener('change', () => {
        space.usages = [...document.querySelectorAll('.studio-space-usage input:checked')].map(item => item.value);
        markDirty();
        input.closest('.studio-space-usage')?.classList.toggle('is-active', input.checked);
      }));
      document.getElementById('studioSpaceDelete')?.addEventListener('click', () => {
        if (!confirm(`Supprimer définitivement « ${safeName(space.name)} » ?`)) return;
        const index = content.spaces.findIndex(item => item.id === space.id);
        content.spaces.splice(index, 1);
        selectedId = content.spaces[Math.min(index, content.spaces.length - 1)]?.id || null;
        markDirty();
        renderList();
        renderDetail();
      });
      bindMedia(space);
    }

    container.innerHTML = `
      <div class="studio-spaces-head studio-domain-head">
        <div class="studio-domain-head-copy">
          <div class="admin-page-eyebrow">Contenus</div>
          <h1>Espaces.</h1>
          <p>Décrivez les lieux tels qu’ils existent dans le projet. Storm transforme ces informations en un parcours de découverte cohérent.</p>
        </div>
        <button type="button" class="search-btn studio-spaces-save studio-domain-save" id="studioSpacesSave">Enregistrer les espaces</button>
      </div>
      <div class="studio-spaces-layout">
        <aside class="studio-spaces-index">
          <div class="studio-spaces-index-head"><strong>Espaces du projet</strong><span id="studioSpacesCount"></span></div>
          <p class="studio-spaces-index-note">L’ordre ci-dessous devient l’ordre de découverte. Faites glisser une ligne pour le modifier.</p>
          <div class="studio-spaces-list" id="studioSpacesList"></div>
          <button type="button" class="studio-space-add" id="studioSpaceAdd">+ Ajouter un espace</button>
        </aside>
        <main class="studio-spaces-detail" id="studioSpacesDetail"></main>
      </div>`;

    document.getElementById('studioSpaceAdd')?.addEventListener('click', () => {
      const space = { id:uid('space'), name:'Nouvel espace', location:'', status:'designing', description:'', usages:[], media:[] };
      content.spaces.push(space);
      selectedId = space.id;
      markDirty();
      renderList();
      renderDetail();
      setTimeout(() => { const input=document.getElementById('studioSpaceName'); input?.focus(); input?.select(); }, 0);
    });
    document.getElementById('studioSpacesSave')?.addEventListener('click', async () => {
      const result = await saveContent(buildSavePayload(content));
      if (handleSaveResult(result, 'Les espaces sont enregistrés.')) {
        if (result.saveSource !== 'auto') {
          if (Array.isArray(result.content?.spaces)) content.spaces = result.content.spaces.map(normalizeSpace);
          if (Array.isArray(result.content?.plans)) content.plans = result.content.plans;
        }
        currentAdminContent = content;
        if (result.saveSource !== 'auto') { renderList(); renderDetail(); renderPlansFront(content.plans || []); }
        else studioQueueContextSaveDockBind();
      }
    });

    renderList();
    renderDetail();
  }
  async function parseDocxToFaqEntries(file) {
    if (typeof mammoth === 'undefined') {
      throw new Error("La librairie de lecture Word n'a pas pu se charger — vérifie ta connexion.");
    }
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const doc = new DOMParser().parseFromString(result.value, 'text/html');
    const nodes = [...doc.body.children];

    function isQuestionNode(el) {
      const text = el.textContent.trim();
      if (!text) return false;
      if (/^H[1-6]$/.test(el.tagName)) return true;
      if (el.tagName === 'P') {
        const strongText = [...el.querySelectorAll('strong,b')].map(n => n.textContent).join('').trim();
        return strongText.length > 0 && strongText.length >= text.length * 0.9;
      }
      return false;
    }

    const blocks = [];
    let current = null;
    nodes.forEach(el => {
      const text = el.textContent.trim();
      if (!text) return;
      if (isQuestionNode(el)) {
        current = { title: text, answerParts: [] };
        blocks.push(current);
      } else if (current) {
        current.answerParts.push(text);
      }
    });

    if (!blocks.length) {
      nodes.forEach(el => {
        const text = el.textContent.trim();
        if (text) blocks.push({ title: text, answerParts: [] });
      });
    }

    return blocks
      .filter(b => b.title)
      .map((b, i) => ({
        id: `import-${Date.now()}-${i}`,
        title: b.title,
        status: 'waiting',
        statusLabel: 'Information en cours de définition',
        category: '',
        answer: b.answerParts.join('\n\n'),
        note: '',
        keywords: []
      }));
  }
  function isDuplicateTitle(title) {
    const norm = normalize(title || '');
    return norm.length > 0 && faqData.some(e => normalize(e.title || '') === norm);
  }
  function openImportReviewModal(imported) {
    const modal = document.getElementById('importReviewModal');
    const list  = document.getElementById('importReviewList');
    const sub   = document.getElementById('importReviewSub');

    const flagged = imported.map(entry => ({ entry, duplicate: isDuplicateTitle(entry.title) }));
    const dupCount = flagged.filter(f => f.duplicate).length;

    sub.textContent = `${imported.length} question${imported.length>1?'s':''} détectée${imported.length>1?'s':''} dans le document`
      + (dupCount ? ` — ${dupCount} semble${dupCount>1?'nt':''} déjà présente${dupCount>1?'s':''} dans la FAQ (décochée${dupCount>1?'s':''} par défaut).` : '. Décoche ce que tu ne veux pas ajouter.');

    list.innerHTML = flagged.map((f, i) => {
      const preview = (f.entry.answer || 'Aucune réponse détectée sous cette question — à compléter manuellement.').slice(0, 150);
      return `
        <label class="import-review-row ${f.duplicate ? 'is-duplicate' : ''}">
          <input type="checkbox" ${f.duplicate ? '' : 'checked'} data-import-index="${i}">
          <div>
            <div class="import-review-row-title">
              ${escapeHtml(f.entry.title)}
              ${f.duplicate ? '<span class="tag-pill" style="background:var(--cream-soft); color:var(--mustard);">Déjà présente</span>' : ''}
            </div>
            <div class="import-review-row-preview">${escapeHtml(preview)}${(f.entry.answer||'').length > 150 ? '…' : ''}</div>
          </div>
        </label>`;
    }).join('');

    modal.classList.add('open');

    document.getElementById('importReviewCancel').onclick = () => modal.classList.remove('open');

    document.getElementById('importReviewConfirm').onclick = async () => {
      const checked = [...list.querySelectorAll('input[type="checkbox"]:checked')]
        .map(cb => flagged[Number(cb.dataset.importIndex)].entry);
      modal.classList.remove('open');
      if (!checked.length) { showToast('Aucune question sélectionnée — import annulé.'); return; }
      currentAdminContent.faqDrafts = [...checked, ...(currentAdminContent.faqDrafts || [])];
      studioSetSaveState('dirty');
      showToast(`${checked.length} question${checked.length>1?'s':''} ajoutée${checked.length>1?'s':''} à la liste « À vérifier ».`);
      renderFaqEditor(currentAdminContent);
      document.getElementById('studioQuestionsList')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
  }

  const CATEGORY_LABELS = {
    calendrier: 'Calendrier', logistique: 'Logistique', mobilite: 'Mobilité', rh: 'RH',
    espaces: 'Espaces', services: 'Services', acces: 'Accès & sécurité', it: 'Informatique',
    accompagnement: 'Accompagnement', communication: 'Communication', decouverte: 'Découverte du site'
  };
  function categoryLabel(cat) { return CATEGORY_LABELS[cat] || (cat ? cat : 'Non classée'); }
  function renderFaqEditor(content) {
    const container = document.getElementById('adminFaqEditor');
    if (!container) return;

    const STATUS = {
      confirmed: {
        short: 'Confirmée',
        label: 'Information confirmée',
        title: 'Confirmée',
        hint: 'Ce point est stabilisé et peut être présenté comme acquis.'
      },
      partial: {
        short: 'À préciser',
        label: 'Information susceptible d’évoluer',
        title: 'Encore susceptible d’évoluer',
        hint: 'La réponse est utile aujourd’hui, mais certains détails peuvent encore changer.'
      },
      waiting: {
        short: 'En définition',
        label: 'Information en cours de définition',
        title: 'En cours de définition',
        hint: 'Le projet n’a pas encore arrêté ce point.'
      }
    };

    let activeFilter = 'all';
    let searchTerm = '';
    let selectedId = null;
    let selectedSource = 'published';
    content.faqDrafts = Array.isArray(content.faqDrafts) ? content.faqDrafts : [];

    const safeArray = value => Array.isArray(value) ? value : [];
    const canonicalStatus = value => STATUS[value] ? value : 'waiting';
    const statusLabel = value => STATUS[canonicalStatus(value)].label;
    const knownCategories = () => {
      const cats = new Set(Object.keys(CATEGORY_LABELS));
      [...faqData, ...content.faqDrafts].forEach(entry => {
        if (entry?.category) cats.add(entry.category);
      });
      return [...cats];
    };
    const currentList = () => selectedSource === 'draft' ? content.faqDrafts : faqData;
    const currentEntry = () => currentList().find(entry => entry.id === selectedId) || null;
    const markDirty = () => studioSetSaveState('dirty');

    function matches(entry) {
      if (activeFilter !== 'all' && canonicalStatus(entry.status) !== activeFilter) return false;
      const haystack = [
        entry.title,
        entry.answer,
        entry.category,
        ...safeArray(entry.phrases)
      ].join(' ').toLowerCase();
      return !searchTerm || haystack.includes(searchTerm.toLowerCase());
    }

    function allVisiblePublished() { return faqData.filter(matches); }

    function listRow(entry, source) {
      const isDraft = source === 'draft';
      const status = canonicalStatus(entry.status);
      const active = selectedId === entry.id && selectedSource === source;
      return `
        <button type="button" class="studio-question-row ${active ? 'is-active' : ''} ${isDraft ? 'is-import' : ''}" data-question-id="${escapeHtml(entry.id)}" data-question-source="${source}">
          <span class="studio-question-row-main">
            <b>${escapeHtml(entry.title || 'Question sans titre')}</b>
            <small>${isDraft ? 'Import à vérifier' : escapeHtml(categoryLabel(entry.category))}</small>
          </span>
          <i class="studio-question-state-dot ${isDraft ? '' : status}" aria-hidden="true"></i>
        </button>`;
    }

    function renderList() {
      const list = document.getElementById('studioQuestionsList');
      const count = document.getElementById('studioQuestionsCount');
      if (!list) return;
      const published = allVisiblePublished();
      const drafts = content.faqDrafts.filter(matches);
      if (count) count.textContent = `${faqData.length} question${faqData.length > 1 ? 's' : ''}`;

      list.innerHTML = `
        ${drafts.length ? `<div class="studio-question-list-label">À vérifier · ${drafts.length}</div>${drafts.map(entry => listRow(entry, 'draft')).join('')}` : ''}
        <div class="studio-question-list-label">Questions${published.length ? ` · ${published.length}` : ''}</div>
        ${published.length ? published.map(entry => listRow(entry, 'published')).join('') : '<div class="storm-empty-editor" style="padding:24px 8px;">Aucune question ne correspond à cette recherche.</div>'}`;

      list.querySelectorAll('[data-question-id]').forEach(button => {
        button.addEventListener('click', () => {
          selectedId = button.dataset.questionId;
          selectedSource = button.dataset.questionSource;
          renderList();
          renderDetail();
        });
      });
    }

    function phraseChip(phrase, index) {
      return `<span class="studio-question-phrase"><span>${escapeHtml(phrase)}</span><button type="button" data-question-phrase-remove="${index}" aria-label="Retirer cette formulation">×</button></span>`;
    }

    function certaintyHtml(entry) {
      const current = canonicalStatus(entry.status);
      return Object.entries(STATUS).map(([value, meta]) => `
        <button type="button" class="studio-question-certainty-option ${current === value ? 'is-active' : ''}" data-question-status="${value}">
          <i aria-hidden="true"></i>
          <strong>${escapeHtml(meta.title)}</strong>
          <span>${escapeHtml(meta.hint)}</span>
        </button>`).join('');
    }

    function renderDetail() {
      const detail = document.getElementById('studioQuestionsDetail');
      if (!detail) return;
      const entry = currentEntry();
      if (!entry) {
        detail.innerHTML = `
          <div class="studio-question-empty">
            <div><strong>Sélectionnez une question</strong><p>Modifiez une réponse existante ou ajoutez une question. Storm Match garde le moteur de recherche et les signaux techniques hors de votre chemin.</p></div>
          </div>`;
        return;
      }

      entry.status = canonicalStatus(entry.status);
      entry.statusLabel = statusLabel(entry.status);
      entry.phrases = safeArray(entry.phrases);
      const isDraft = selectedSource === 'draft';
      const categories = knownCategories();

      detail.innerHTML = `
        <div class="studio-question-detail-head">
          <div><span>${isDraft ? 'Question importée · à vérifier' : 'Question'}</span><h2>${escapeHtml(entry.title || 'Question sans titre')}</h2></div>
          <button type="button" class="studio-question-delete" id="studioQuestionDelete">Supprimer</button>
        </div>

        ${isDraft ? `<div class="studio-question-import-note"><strong>Cette question vient d’un import.</strong> Vérifiez sa formulation et sa réponse, puis ajoutez-la aux questions du projet. Elle ne devient pas publique tant que vous n’utilisez pas le bouton global « Publier ».</div>` : ''}

        <section class="studio-question-section">
          <div class="studio-question-section-intro"><strong>Ce que les collaborateurs cherchent à savoir</strong><p>Écrivez la question comme elle apparaîtrait naturellement dans une conversation.</p></div>
          <div class="studio-question-field">
            <label>Question</label>
            <input type="text" class="form-input" id="studioQuestionTitle" value="${escapeHtml(entry.title || '')}" placeholder="Ex. Est-ce que j’aurai encore un bureau attitré ?">
          </div>
          <div class="studio-question-field">
            <label>Que peut-on répondre ?</label>
            ${studioInlineEditorHtml('studioQuestionAnswer', entry.answer || '', { minHeight:145, placeholder:'Donnez une réponse directe, utile et compréhensible sans connaître le projet de l’intérieur.' })}
          </div>
          <details class="studio-question-note-details" ${entry.note ? 'open' : ''} style="margin-top:18px;">
            <summary style="cursor:pointer;color:var(--ink-50);font-size:.75rem;">${entry.note ? 'Précision complémentaire' : '+ Ajouter une précision complémentaire'}</summary>
            <div class="studio-question-field" style="margin-top:12px;">${studioInlineEditorHtml('studioQuestionNote', entry.note || '', { minHeight:82, compact:true, placeholder:'Facultatif — un contexte ou une nuance qui aide à interpréter la réponse.' })}</div>
          </details>
        </section>

        <section class="studio-question-section">
          <div class="studio-question-section-intro"><strong>Cette information est…</strong><p>Le statut parle du degré de stabilisation de l’information, pas de la qualité de votre réponse.</p></div>
          <div class="studio-question-certainty">${certaintyHtml(entry)}</div>
        </section>

        <section class="studio-question-section">
          <div class="studio-question-section-intro"><strong>Autres façons de poser cette question</strong><p>Ajoutez quelques formulations naturelles. Storm Match les utilise pour retrouver cette réponse même lorsque les collaborateurs n’emploient pas les mêmes mots que vous.</p></div>
          <div class="studio-question-phrases" id="studioQuestionPhrases">${entry.phrases.map(phraseChip).join('')}</div>
          <div class="studio-question-phrase-input-row">
            <input type="text" class="form-input" id="studioQuestionPhraseInput" placeholder="Ex. Est-ce que les places seront libres ?">
            <button type="button" class="studio-question-phrase-add" id="studioQuestionPhraseAdd">Ajouter</button>
          </div>
        </section>

        <section class="studio-question-section">
          <div class="studio-question-section-intro"><strong>Thématique</strong><p>Une aide au classement dans Studio. Elle ne change pas la réponse proposée aux collaborateurs.</p></div>
          <div class="studio-question-theme-row">
            <input type="text" class="form-input" list="studioQuestionCategoryOptions" id="studioQuestionCategory" value="${escapeHtml(entry.category || '')}" placeholder="Ex. Espaces">
            <datalist id="studioQuestionCategoryOptions">${categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(categoryLabel(category))}</option>`).join('')}</datalist>
          </div>
        </section>

        ${isDraft ? '<button type="button" class="studio-question-import-integrate" id="studioQuestionIntegrate">Ajouter aux questions du projet →</button>' : ''}`;

      const title = document.getElementById('studioQuestionTitle');
      const category = document.getElementById('studioQuestionCategory');
      title?.addEventListener('input', event => {
        entry.title = event.target.value;
        markDirty();
        const heading = detail.querySelector('.studio-question-detail-head h2');
        if (heading) heading.textContent = entry.title || 'Question sans titre';
        renderList();
      });
      studioBindInlineEditor(detail, 'studioQuestionAnswer', value => { entry.answer = value; markDirty(); });
      studioBindInlineEditor(detail, 'studioQuestionNote', value => { entry.note = value; markDirty(); });
      category?.addEventListener('input', event => { entry.category = event.target.value.trim(); markDirty(); renderList(); });

      detail.querySelectorAll('[data-question-status]').forEach(button => {
        button.addEventListener('click', () => {
          entry.status = canonicalStatus(button.dataset.questionStatus);
          entry.statusLabel = statusLabel(entry.status);
          markDirty();
          renderList();
          renderDetail();
        });
      });

      function addPhrase() {
        const input = document.getElementById('studioQuestionPhraseInput');
        const value = String(input?.value || '').trim();
        if (!value) return;
        if (!entry.phrases.some(existing => existing.toLowerCase() === value.toLowerCase())) {
          entry.phrases.push(value);
          markDirty();
        }
        renderDetail();
        setTimeout(() => document.getElementById('studioQuestionPhraseInput')?.focus(), 0);
      }
      document.getElementById('studioQuestionPhraseAdd')?.addEventListener('click', addPhrase);
      document.getElementById('studioQuestionPhraseInput')?.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); addPhrase(); }
      });
      detail.querySelectorAll('[data-question-phrase-remove]').forEach(button => {
        button.addEventListener('click', () => {
          entry.phrases.splice(Number(button.dataset.questionPhraseRemove), 1);
          markDirty();
          renderDetail();
        });
      });

      document.getElementById('studioQuestionDelete')?.addEventListener('click', () => {
        if (!confirm(`Supprimer définitivement « ${entry.title || 'cette question'} » ?`)) return;
        if (isDraft) content.faqDrafts = content.faqDrafts.filter(item => item.id !== entry.id);
        else faqData = faqData.filter(item => item.id !== entry.id);
        selectedId = null;
        markDirty();
        renderList();
        renderDetail();
      });

      document.getElementById('studioQuestionIntegrate')?.addEventListener('click', () => {
        const index = content.faqDrafts.findIndex(item => item.id === entry.id);
        if (index < 0) return;
        const [integrated] = content.faqDrafts.splice(index, 1);
        integrated.status = canonicalStatus(integrated.status);
        integrated.statusLabel = statusLabel(integrated.status);
        faqData = [integrated, ...faqData];
        selectedSource = 'published';
        selectedId = integrated.id;
        markDirty();
        renderList();
        renderDetail();
        showToast('Question ajoutée. Enregistrez les questions lorsque vous avez terminé.');
      });
    }

    container.innerHTML = `
      <div class="studio-questions-head studio-domain-head">
        <div class="studio-domain-head-copy">
          <div class="admin-page-eyebrow">Contenus</div>
          <h1>Questions.</h1>
          <p>Renseignez les réponses utiles au projet. Storm Match reconnaît ensuite les différentes façons dont les collaborateurs peuvent poser la même question.</p>
        </div>
        <button type="button" class="search-btn studio-questions-save studio-domain-save" id="studioQuestionsSave">Enregistrer les questions</button>
      </div>

      <aside class="studio-product-note studio-match-note" aria-label="À propos de Storm Match">
        <div class="studio-product-note-kicker">Introducing</div>
        <div>
          <strong>Storm Match</strong>
          <p>Les collaborateurs n’ont pas besoin d’employer les mêmes mots. Storm Match rapproche leurs formulations de la bonne réponse.</p>
        </div>
      </aside>

      <div class="studio-questions-layout">
        <aside class="studio-questions-index">
          <div class="studio-questions-index-head"><strong>Questions du projet</strong><span id="studioQuestionsCount"></span></div>
          <input type="search" class="studio-question-search" id="studioQuestionSearch" placeholder="Rechercher une question…" autocomplete="off">
          <div class="studio-question-filter-row">
            <button type="button" class="studio-question-filter is-active" data-question-filter="all">Toutes</button>
            <button type="button" class="studio-question-filter" data-question-filter="confirmed">Confirmées</button>
            <button type="button" class="studio-question-filter" data-question-filter="partial">À préciser</button>
            <button type="button" class="studio-question-filter" data-question-filter="waiting">En définition</button>
          </div>
          <div class="studio-question-list" id="studioQuestionsList"></div>
          <div class="studio-question-index-actions">
            <button type="button" class="studio-question-add" id="studioQuestionAdd">+ Ajouter une question</button>
            <button type="button" class="studio-question-import" id="studioQuestionImport">Importer depuis Word</button>
            <input type="file" id="studioQuestionImportInput" accept=".docx" hidden>
          </div>
        </aside>
        <main class="studio-questions-detail" id="studioQuestionsDetail"></main>
      </div>`;

    document.getElementById('studioQuestionSearch')?.addEventListener('input', event => {
      searchTerm = event.target.value;
      renderList();
    });
    container.querySelectorAll('[data-question-filter]').forEach(button => {
      button.addEventListener('click', () => {
        activeFilter = button.dataset.questionFilter;
        container.querySelectorAll('[data-question-filter]').forEach(item => item.classList.toggle('is-active', item === button));
        renderList();
      });
    });
    document.getElementById('studioQuestionAdd')?.addEventListener('click', () => {
      const id = `question-${Date.now()}`;
      const entry = {
        id,
        title: 'Nouvelle question',
        answer: '',
        status: 'waiting',
        statusLabel: STATUS.waiting.label,
        category: '',
        note: '',
        keywords: [],
        phrases: [],
        intentSignals: [],
        emotionSignals: [],
        negativeSignals: [],
        priority: 0
      };
      faqData = [entry, ...faqData];
      selectedSource = 'published';
      selectedId = id;
      activeFilter = 'all';
      searchTerm = '';
      const search = document.getElementById('studioQuestionSearch');
      if (search) search.value = '';
      container.querySelectorAll('[data-question-filter]').forEach(item => item.classList.toggle('is-active', item.dataset.questionFilter === 'all'));
      markDirty();
      renderList();
      renderDetail();
      setTimeout(() => { const input = document.getElementById('studioQuestionTitle'); input?.focus(); input?.select(); }, 0);
    });

    const importInput = document.getElementById('studioQuestionImportInput');
    document.getElementById('studioQuestionImport')?.addEventListener('click', () => importInput?.click());
    importInput?.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (!file) return;
      showToast('Lecture du fichier Word…');
      try {
        const imported = await parseDocxToFaqEntries(file);
        if (!imported.length) { showToast('Aucune question détectée dans ce document.'); return; }
        openImportReviewModal(imported);
      } catch (error) {
        console.error(error);
        showToast('Impossible de lire ce fichier Word.');
      }
    });

    document.getElementById('studioQuestionsSave')?.addEventListener('click', async () => {
      const result = await saveContent(buildSavePayload(content));
      if (handleSaveResult(result, 'Les questions sont enregistrées.')) {
        if (result.saveSource !== 'auto') {
          if (Array.isArray(result.content?.faqEntries)) faqData = result.content.faqEntries;
          if (Array.isArray(result.content?.faqDrafts)) content.faqDrafts = result.content.faqDrafts;
        }
        currentAdminContent = content;
        if (result.saveSource !== 'auto') { renderList(); renderDetail(); }
        else studioQueueContextSaveDockBind();
      }
    });

    renderList();
    renderDetail();
  }
  async function exportKpiToExcel() {
    if (typeof XLSX === 'undefined') {
      showToast("La librairie d'export n'a pas pu se charger — vérifie ta connexion.");
      return;
    }
    const kpi = await loadKpi();
    if (kpi.unauthorized) {
      showToast('Votre session a expiré. Reconnectez-vous.');
      clearAdminToken();
      openAdminModal();
      return;
    }
    const wb = XLSX.utils.book_new();

    const totalAsked        = kpi.faqAsked.length;
    const totalFound        = kpi.faqAsked.filter(a => a.matched).length;
    const foundRate         = totalAsked ? Math.round((totalFound / totalAsked) * 100) : 0;
    const totalArticleOpens = Object.values(kpi.articleOpens).reduce((a,b) => a+b, 0);
    const totalTabViews     = Object.values(kpi.tabViews).reduce((a,b) => a+b, 0);
    const totalVisits       = new Set(kpi.visitSessions || []).size;
    const totalContacts     = kpi.contactSubmissions.length;

    const summaryData = [
      [`${currentAdminContent?.branding?.projectName || 'Projet'} — Export Pilotage`, ''],
      ['Généré le', new Date().toLocaleString('fr-FR')],
      ['', ''],
      ['Indicateur', 'Valeur'],
      ['Questions posées', totalAsked],
      ['Taux de réponse trouvée', foundRate + ' %'],
      ['Consultations uniques', totalVisits],
      ['Consultations totales (tous onglets)', totalTabViews],
      ["Ouvertures d'articles", totalArticleOpens],
      ['Messages reçus dans Storm', totalContacts],
      ['Contributions au baromètre', (kpi.moodEntries || []).length],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 38 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Synthèse');

    const qRows = [['Question', 'Réponse trouvée', 'Sujet correspondant', 'Date']];
    kpi.faqAsked.slice().sort((a,b) => b.ts - a.ts).forEach(a => {
      qRows.push([a.q, a.matched ? 'Oui' : 'Non', a.entryId || '', new Date(a.ts).toLocaleString('fr-FR')]);
    });
    const wsQ = XLSX.utils.aoa_to_sheet(qRows);
    wsQ['!cols'] = [{ wch: 50 }, { wch: 16 }, { wch: 24 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsQ, 'Questions posées');

    const gapRows = [['Question sans réponse trouvée', 'Date']];
    kpi.faqAsked.filter(a => !a.matched).sort((a,b) => b.ts - a.ts).forEach(a => {
      gapRows.push([a.q, new Date(a.ts).toLocaleString('fr-FR')]);
    });
    const wsGaps = XLSX.utils.aoa_to_sheet(gapRows);
    wsGaps['!cols'] = [{ wch: 55 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsGaps, 'Trous FAQ');

    const tabRows = [['Onglet', 'Consultations']];
    Object.keys(TAB_LABELS).forEach(id => tabRows.push([TAB_LABELS[id], kpi.tabViews[id] || 0]));
    const wsTabs = XLSX.utils.aoa_to_sheet(tabRows);
    wsTabs['!cols'] = [{ wch: 24 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsTabs, 'Consultations onglets');

    const articleLabels = {};
    (currentAdminContent?.articles || []).forEach(a => { articleLabels[a.id] = a.title || '(sans titre)'; });
    const articleIds = new Set([...Object.keys(articleLabels), ...Object.keys(kpi.articleOpens)]);
    const artRows = [['Article', 'Ouvertures']];
    [...articleIds].forEach(id => artRows.push([articleLabels[id] || `Article supprimé (${id})`, kpi.articleOpens[id] || 0]));
    const wsArt = XLSX.utils.aoa_to_sheet(artRows);
    wsArt['!cols'] = [{ wch: 50 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsArt, 'Articles');

    const contactRows = [['Nom', 'Email', 'Message', 'Date']];
    kpi.contactSubmissions.slice().reverse().forEach(c => {
      contactRows.push([c.name, c.email, c.message, new Date(c.ts).toLocaleString('fr-FR')]);
    });
    const wsContacts = XLSX.utils.aoa_to_sheet(contactRows);
    wsContacts['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 60 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsContacts, 'Demandes de contact');

    const moodRows = [['Ressenti', 'Date']];
    (kpi.moodEntries || []).slice().sort((a,b) => b.ts-a.ts).forEach(entry => {
      moodRows.push([MOOD_LABELS[Number(entry.value)] || String(entry.value || ''), new Date(entry.ts).toLocaleString('fr-FR')]);
    });
    const wsMood = XLSX.utils.aoa_to_sheet(moodRows);
    wsMood['!cols'] = [{ wch:24 }, { wch:20 }];
    XLSX.utils.book_append_sheet(wb, wsMood, 'Climat du projet');

    const safeProjectName = String(currentAdminContent?.branding?.projectName || 'Projet').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'') || 'Projet';
    const filename = `${safeProjectName}-Pilotage-${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast('Export de pilotage généré.');
  }

  // ═══ Démarrage — équivalent du clic sur adminLinkBtn depuis Pangea ═══
  window.addEventListener('DOMContentLoaded', () => {
    if (getAdminToken()) openAdminPage();
    else openAdminModal();
  });
