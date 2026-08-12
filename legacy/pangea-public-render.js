// ─────────────────────────────────────────────────────────────────
// QUARANTAINE LEGACY — rendu public Pangea.
//
// Ce fichier contient le rendu des 5 pages publiques historiques de
// Pangea (Actualités, Plans & 3D, Ambassadeurs, Équipe projet, ainsi
// que la lightbox), extrait à l'identique depuis index.html.
//
// Ceci n'est PAS un chantier de modernisation Pangea — c'est une
// mise en quarantaine du code legacy, à l'identique, pour réduire ce
// dont le Studio dépend encore dans le script partagé. Aucune ligne
// de logique n'a été modifiée, renommée ou reformulée par rapport à
// sa version dans index.html.
//
// Script classique (pas de type="module") : ces fonctions restent
// globales, exactement comme avant l'extraction — le Studio continue
// de les appeler directement après une sauvegarde (voir
// renderPlansFront/renderAmbassadorsFront, appelées depuis les
// éditeurs Espaces et Ambassadeurs pour rafraîchir l'aperçu Pangea).
// Elles dépendent à leur tour de fonctions restées dans index.html
// (escapeHtml, isPdfUrl, richTextToHtml — utilisé aussi par le moteur
// FAQ legacy, non touché), partagées via le même scope global,
// exactement comme aujourd'hui.
// ─────────────────────────────────────────────────────────────────

  function renderMilestonesFront(milestones, progress) {
    const stepEl = document.getElementById('planningStep');
    const fillEl = document.getElementById('planningFill');
    const pctEl  = document.getElementById('planningPct');
    const percent = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
    if (stepEl) stepEl.innerHTML = `${escapeHtml(progress?.stepLine1 || '')}<br>${escapeHtml(progress?.stepLine2 || '')}`;
    if (fillEl) fillEl.style.width = percent + '%';
    if (pctEl) pctEl.textContent = percent + '%';

    const list = document.getElementById('milestonesList');
    if (!list) return;
    const items = milestones || [];
    list.innerHTML = items.map((m, i) => {
      const pill = MILESTONE_STATUS_MAP[m.status] || MILESTONE_STATUS_MAP.future;
      return `
        <div class="milestone ${escapeHtml(m.status || 'future')} reveal" style="--i:${i}" data-reveal>
          <div class="milestone-spine"><span class="milestone-dot"></span><span class="milestone-line"></span></div>
          <div class="milestone-content">
            <div class="milestone-date mono">${escapeHtml(m.date || '')}</div>
            <div class="milestone-label">${escapeHtml(m.label || '')} <span class="status-pill ${pill.cls}">${pill.label}</span></div>
            <div class="milestone-step mono">Étape ${i + 1} sur ${items.length}</div>
            <div class="milestone-desc">${escapeHtml(m.desc || '')}</div>
          </div>
        </div>`;
    }).join('');
    observeNewReveals(list);
  }

  function articleBodyToHtml(text) {
    const escaped = escapeHtml(text || '');
    return escaped.split('\n').map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('## ')) return `<strong>${trimmed.slice(3)}</strong>`;
      return line;
    }).join('\n');
  }

  function renderArticlesFront(articles) {
    const headerEl = document.getElementById('articlesHeader');
    const listEl = document.getElementById('articlesList');
    if (!listEl) return;
    const items = articles || [];
    if (headerEl) headerEl.textContent = `Publications — ${items.length} article${items.length > 1 ? 's' : ''}`;
    listEl.innerHTML = items.map((a, i) => `
      <div class="article reveal" style="--i:${i}" data-reveal data-article="${escapeHtml(a.id)}">
        <button class="article-header-btn" aria-expanded="false" aria-controls="article-body-${escapeHtml(a.id)}">
          <div>
            <div class="article-meta-row">
              <span class="tag-pill">${escapeHtml(a.tag || '')}</span>
              <span class="article-date mono">${escapeHtml(a.date || '')}</span>
            </div>
            <div class="article-title">${escapeHtml(a.title || '')}</div>
            <div class="article-chapeau">${richTextToHtml(a.chapeau || '')}</div>
          </div>
          <span class="article-chevron"><svg viewBox="0 0 12 12"><polyline points="1,3 6,9 11,3"/></svg></span>
        </button>
        <div class="article-body" id="article-body-${escapeHtml(a.id)}"><div><div class="article-body-inner">${articleBodyToHtml(a.body)}</div></div></div>
      </div>`
    ).join('');

    listEl.querySelectorAll('.article-header-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const article = btn.closest('.article');
        const isOpen = article.classList.toggle('open');
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        if (isOpen) trackArticleOpen(article.dataset.article);
      });
    });
    observeNewReveals(listEl);
  }

  function richTextToHtml(text) {
    let escaped = escapeHtml(text || '');
    escaped = escaped.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\+\+([\s\S]+?)\+\+/g, '<u>$1</u>');
    escaped = escaped.replace(/\/\/([\s\S]+?)\/\//g, '<em>$1</em>');
    escaped = escaped.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
    return escaped.replace(/\r?\n/g, '<br>');
  }

  function initialsFromName(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function isPdfUrl(url) { return /\.pdf($|\?)/i.test(url || ''); }

  const PDF_ICON_SVG = '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';

  function planCardHtml(plan, index) {
    const url = plan.imageUrl || '';
    const isPdf = isPdfUrl(url);
    const tagsArr = String(plan.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    const dataTags = [plan.type, ...tagsArr].filter(Boolean).join(' ');

    let visualInner;
    if (url && isPdf) {
      visualInner = `<span class="plan-placeholder"><span class="pdf-chip">${PDF_ICON_SVG}<span>Document PDF</span></span><span class="plan-placeholder-label">Cliquer pour ouvrir</span></span>`;
    } else if (url) {
      visualInner = `<img src="${escapeHtml(url)}" alt="${escapeHtml(plan.title || '')}">`;
    } else {
      visualInner = `<span class="plan-placeholder"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5-4 4-3-3-5 5"/></svg><span class="plan-placeholder-label">Visuel à venir</span></span>`;
    }

    return `
      <div class="plan-card reveal" style="--i:${index}" data-reveal data-tags="${escapeHtml(dataTags)}" data-plan-id="${escapeHtml(plan.id)}" data-is-pdf="${isPdf ? '1' : ''}">
        <button class="plan-visual" aria-label="${isPdf ? 'Ouvrir le document' : 'Agrandir'} : ${escapeHtml(plan.title || '')}">
          ${visualInner}
          <span class="plan-type-badge">${escapeHtml(plan.type || '')}</span>
        </button>
        <div class="plan-info">
          <div class="plan-tags">${tagsArr.map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('')}</div>
          <div class="plan-title">${escapeHtml(plan.title || '')}</div>
          <p class="plan-comment">${richTextToHtml(plan.comment || '')}</p>
          <button class="plan-more">Lire la suite ↓</button>
        </div>
      </div>`;
  }

  function renderPlansFront(plans) {
    const items = plans || [];
    const filterBar = document.getElementById('plansFilterBar');
    const grid = document.getElementById('plansGrid');
    if (!grid) return;

    const tagSet = new Set();
    items.forEach(p => {
      if (p.type) tagSet.add(p.type);
      String(p.tags || '').split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagSet.add(t));
    });
    const allTags = [...tagSet].sort((a, b) => a.localeCompare(b, 'fr'));

    if (filterBar) {
      filterBar.innerHTML = [`<button class="filter-pill active" data-filter="all">Tous</button>`]
        .concat(allTags.map(t => `<button class="filter-pill" data-filter="${escapeHtml(t)}">${escapeHtml(t)}</button>`))
        .join('');

      filterBar.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          filterBar.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const filter = btn.dataset.filter;
          grid.querySelectorAll('.plan-card').forEach(card => {
            card.style.display = (filter === 'all' || (card.dataset.tags || '').includes(filter)) ? '' : 'none';
          });
        });
      });
    }

    grid.innerHTML = items.map((p, i) => planCardHtml(p, i)).join('');

    grid.querySelectorAll('.plan-more').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const card = btn.closest('.plan-card');
        card.classList.toggle('expanded');
        btn.textContent = card.classList.contains('expanded') ? 'Réduire ↑' : 'Lire la suite ↓';
      });
    });

    grid.querySelectorAll('.plan-visual').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.plan-card');
        if (card.dataset.isPdf) {
          const plan = items.find(p => p.id === card.dataset.planId);
          if (plan?.imageUrl) window.open(plan.imageUrl, '_blank');
          return;
        }
        openLightbox(card);
      });
    });

    observeNewReveals(grid);
  }

  function personCardHtml(person, index) {
    const avatarInner = person.imageUrl
      ? `<img src="${escapeHtml(person.imageUrl)}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
      : escapeHtml(person.initials || initialsFromName(person.name));
    return `
      <div class="person-card reveal" style="--i:${index % 4}" data-reveal>
        <div class="person-avatar">${avatarInner}</div>
        <div class="person-name">${escapeHtml(person.name || '')}</div>
        <div class="person-role">${escapeHtml(person.role || '')}</div>
        <span class="tag-pill">${escapeHtml(person.tag || '')}</span>
      </div>`;
  }

  function renderAmbassadorsFront(content) {
    const intro = content.ambassadorsContent || {};
    const list = content.ambassadors || [];

    const introBlock = document.getElementById('ambassadorsIntroBlock');
    if (introBlock) {
      introBlock.innerHTML = `<p>${intro.introTitle ? `<strong>${escapeHtml(intro.introTitle)}</strong>\n\n` : ''}${richTextToHtml(intro.introBody || '')}</p>`;
    }

    const rosterLabel = document.getElementById('ambassadorsRosterLabel');
    if (rosterLabel) rosterLabel.textContent = `${list.length} ambassadeur${list.length > 1 ? 's' : ''}${intro.rosterLabel ? ' — ' + intro.rosterLabel : ''}`;

    const grid = document.getElementById('ambassadorsGrid');
    if (grid) {
      grid.innerHTML = list.map((p, i) => personCardHtml(p, i)).join('');
      observeNewReveals(grid);
    }

    const ctaBlock = document.getElementById('ambassadorsCtaBlock');
    if (ctaBlock) {
      ctaBlock.innerHTML = `<div class="info-block-title">${escapeHtml(intro.ctaTitle || '')}</div><p>${richTextToHtml(intro.ctaBody || '')}</p>`;
    }
  }

  function teamCardHtml(person, index) {
    const isParella = person.badge === 'Parella';
    const avatarInner = person.imageUrl
      ? `<img src="${escapeHtml(person.imageUrl)}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:10px;">`
      : escapeHtml(person.initials || initialsFromName(person.name));
    return `
      <div class="team-card reveal" style="--i:${index % 3}" data-reveal>
        <div class="team-avatar${isParella ? ' parella' : ''}">${avatarInner}</div>
        <div class="team-info">
          <div class="team-name">${escapeHtml(person.name || '')}</div>
          <div class="team-title">${escapeHtml(person.title || '')}</div>
          <span class="team-badge${isParella ? ' parella' : ' xyz'}">${isParella ? 'Parella' : 'XYZ'}</span>
        </div>
      </div>`;
  }

  function renderTeamFront(content) {
    const teamContent = content.teamContent || {};
    const team = content.team || [];
    const xyz = team.filter(t => t.badge !== 'Parella');
    const parella = team.filter(t => t.badge === 'Parella');

    const xyzGrid = document.getElementById('teamXyzGrid');
    if (xyzGrid) { xyzGrid.innerHTML = xyz.map((p, i) => teamCardHtml(p, i)).join(''); observeNewReveals(xyzGrid); }

    const parellaIntroBlock = document.getElementById('parellaIntroBlock');
    if (parellaIntroBlock) {
      parellaIntroBlock.innerHTML = `
        <div class="parella-icon"><svg viewBox="0 0 24 24"><path d="M3 21V10l9-7 9 7v11"/><path d="M9 21v-6h6v6"/></svg></div>
        <div class="parella-text">${richTextToHtml(teamContent.parellaIntro || '')}</div>`;
    }

    const parellaGrid = document.getElementById('teamParellaGrid');
    if (parellaGrid) { parellaGrid.innerHTML = parella.map((p, i) => teamCardHtml(p, i)).join(''); observeNewReveals(parellaGrid); }

    const ctaBlock = document.getElementById('teamCtaBlock');
    if (ctaBlock) {
      ctaBlock.innerHTML = `<div class="info-block-title">${escapeHtml(teamContent.ctaTitle || '')}</div><p>${richTextToHtml(teamContent.ctaBody || '')}</p>`;
    }
  }

  const lightbox      = document.getElementById("lightbox");
  const lightboxStage = document.getElementById("lightboxStage");
  const lightboxWrap  = document.getElementById("lightboxWrap");
  const lightboxMedia = document.getElementById("lightboxMedia");
  const lightboxTitleEl = document.getElementById("lightboxTitle");
  const lightboxCap   = document.getElementById("lightboxCaption");
  const lightboxClose = document.getElementById("lightboxClose");
  const lbZoomIn      = document.getElementById("lbZoomIn");
  const lbZoomOut     = document.getElementById("lbZoomOut");
  const lbReset       = document.getElementById("lbReset");
  const lbZoomLabel   = document.getElementById("lbZoomLabel");

  let scale=1, tx=0, ty=0, dragging=false, startX=0, startY=0, startTx=0, startTy=0;
  const MIN_SCALE=0.3, MAX_SCALE=8;

  function applyTransform() {
    lightboxWrap.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    lbZoomLabel.textContent = Math.round(scale*100)+"%";
  }

  function resetView() {
    const stage=lightboxStage.getBoundingClientRect();
    const media=lightboxMedia.firstElementChild;
    if (!media) return;
    const mw=media.naturalWidth||media.offsetWidth||800;
    const mh=media.naturalHeight||media.offsetHeight||500;
    const sw=stage.width||window.innerWidth;
    const sh=stage.height||window.innerHeight*0.7;
    scale=Math.min(sw/mw,sh/mh,1);
    tx=(sw-mw*scale)/2; ty=(sh-mh*scale)/2;
    lightboxWrap.style.transformOrigin="0 0";
    applyTransform();
  }

  function zoomBy(factor,cx,cy) {
    const stage=lightboxStage.getBoundingClientRect();
    const px=(cx!==undefined?cx-stage.left:stage.width/2);
    const py=(cy!==undefined?cy-stage.top:stage.height/2);
    const ns=Math.min(MAX_SCALE,Math.max(MIN_SCALE,scale*factor));
    tx=px-(px-tx)*(ns/scale); ty=py-(py-ty)*(ns/scale);
    scale=ns; applyTransform();
  }

  lightboxStage.addEventListener("wheel",e=>{e.preventDefault();zoomBy(e.deltaY<0?1.15:1/1.15,e.clientX,e.clientY);},{passive:false});
  lbZoomIn.addEventListener("click",()=>zoomBy(1.4));
  lbZoomOut.addEventListener("click",()=>zoomBy(1/1.4));
  lbReset.addEventListener("click",resetView);

  lightboxStage.addEventListener("mousedown",e=>{
    if(e.button!==0)return;
    dragging=true; startX=e.clientX; startY=e.clientY; startTx=tx; startTy=ty;
    lightboxStage.classList.add("dragging");
  });
  window.addEventListener("mousemove",e=>{if(!dragging)return;tx=startTx+(e.clientX-startX);ty=startTy+(e.clientY-startY);applyTransform();});
  window.addEventListener("mouseup",()=>{dragging=false;lightboxStage.classList.remove("dragging");});

  let lastDist=0,lastTX=0,lastTY=0;
  lightboxStage.addEventListener("touchstart",e=>{
    if(e.touches.length===2){lastDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);}
    else if(e.touches.length===1){lastTX=e.touches[0].clientX;lastTY=e.touches[0].clientY;}
  },{passive:true});
  lightboxStage.addEventListener("touchmove",e=>{
    e.preventDefault();
    if(e.touches.length===2){
      const dist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      const cx=(e.touches[0].clientX+e.touches[1].clientX)/2;
      const cy=(e.touches[0].clientY+e.touches[1].clientY)/2;
      if(lastDist>0)zoomBy(dist/lastDist,cx,cy); lastDist=dist;
    } else if(e.touches.length===1){
      tx+=e.touches[0].clientX-lastTX; ty+=e.touches[0].clientY-lastTY;
      lastTX=e.touches[0].clientX; lastTY=e.touches[0].clientY; applyTransform();
    }
  },{passive:false});
  lightboxStage.addEventListener("touchend",()=>{lastDist=0;});
  lightboxStage.addEventListener("dblclick",resetView);

  function openLightbox(card) {
    const img   = card.querySelector(".plan-visual img");
    const ph    = card.querySelector(".plan-placeholder");
    const title = card.querySelector(".plan-title").textContent;
    const text  = card.querySelector(".plan-comment").textContent;
    lightboxTitleEl.textContent = title;
    lightboxCap.textContent   = text;
    scale=1; tx=0; ty=0; lightboxWrap.style.transform="";

    if (img) {
      const i=new Image(); i.className="lightbox-img"; i.src=img.src; i.alt=title;
      lightboxMedia.innerHTML=""; lightboxMedia.appendChild(i);
      lightbox.classList.add("open"); document.body.style.overflow="hidden";
      const dr=()=>requestAnimationFrame(()=>requestAnimationFrame(resetView));
      i.complete?dr():(i.onload=dr);
    } else if (ph) {
      const label=ph.querySelector(".plan-placeholder-label").textContent;
      lightboxMedia.innerHTML=`<div class="lightbox-placeholder-lb"><div class="lb-ph-label">${label}</div></div>`;
      lightbox.classList.add("open"); document.body.style.overflow="hidden";
      requestAnimationFrame(()=>requestAnimationFrame(resetView));
    }
  }

  function closeLightbox() { lightbox.classList.remove("open"); document.body.style.overflow=""; }

  lightboxClose.addEventListener("click",closeLightbox);
  lightbox.addEventListener("click",e=>{if(e.target===lightbox)closeLightbox();});
  document.addEventListener("keydown",e=>{
    if(!lightbox.classList.contains("open"))return;
    if(e.key==="Escape")closeLightbox();
    if(e.key==="+"||e.key==="=")zoomBy(1.3);
    if(e.key==="-")zoomBy(1/1.3);
    if(e.key==="0")resetView();
  });
