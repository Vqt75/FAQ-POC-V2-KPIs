/*
  STORM — MIDNIGHT FROST V3 · CUPERTINO EDITION
  -------------------------------------------------------------
  Public-only staging layer.
  - vertical scroll drives horizontal stories
  - visible moving optical progress lens
  - no backend changes, no data duplication
*/
(() => {
  'use strict';

  const body = document.body;
  if (!body) return;

  const PAGE_ORDER = ['faq','actu','plans','ambassadeurs','equipe'];
  const PAGE_LABELS = {
    faq:'FAQ',
    actu:'Actualités',
    plans:'Plans & 3D',
    ambassadeurs:'Ambassadeurs',
    equipe:'Équipe projet'
  };
  const PAGE_HINTS = {
    faq:'Interroger la base',
    actu:'Suivre le projet',
    plans:'Explorer les espaces',
    ambassadeurs:'Rencontrer les relais',
    equipe:'Identifier les pilotes'
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 900px)');
  const scrollers = new Map();

  let lens = null;
  let pointerX = window.innerWidth * .78;
  let pointerY = window.innerHeight * .18;
  let raf = 0;
  let rebuildRaf = 0;

  const clamp = (v,min,max) => Math.min(Math.max(v,min),max);
  const pad2 = n => String(Math.max(0,n)).padStart(2,'0');

  function isActive() {
    return body.classList.contains('theme-midnight-frost') && !body.classList.contains('storm-admin-open');
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function hexToRgb(hex) {
    const raw = String(hex || '').trim().replace('#','');
    if (!/^[0-9a-f]{6}$/i.test(raw)) return null;
    return {r:parseInt(raw.slice(0,2),16),g:parseInt(raw.slice(2,4),16),b:parseInt(raw.slice(4,6),16)};
  }

  function rgbToHsl({r,g,b}) {
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
    let h=0,s=0;
    const l=(max+min)/2;
    if(d){
      s=l>.5?d/(2-max-min):d/(max+min);
      if(max===r) h=(g-b)/d+(g<b?6:0);
      else if(max===g) h=(b-r)/d+2;
      else h=(r-g)/d+4;
      h/=6;
    }
    return {h:h*360,s:s*100,l:l*100};
  }

  function hslToHex({h,s,l}) {
    h=((h%360)+360)%360; s=clamp(s,0,100)/100; l=clamp(l,0,100)/100;
    const c=(1-Math.abs(2*l-1))*s;
    const x=c*(1-Math.abs((h/60)%2-1));
    const m=l-c/2;
    let rp=0,gp=0,bp=0;
    if(h<60){rp=c;gp=x;} else if(h<120){rp=x;gp=c;} else if(h<180){gp=c;bp=x;}
    else if(h<240){gp=x;bp=c;} else if(h<300){rp=x;bp=c;} else {rp=c;bp=x;}
    const b=v=>Math.round((v+m)*255).toString(16).padStart(2,'0');
    return `#${b(rp)}${b(gp)}${b(bp)}`.toUpperCase();
  }

  function luminous(hex,fallback) {
    const rgb=hexToRgb(hex);
    if(!rgb) return fallback;
    const hsl=rgbToHsl(rgb);
    if(hsl.s<12) return hsl.l<48?'#9FB1C5':'#D9E1E8';
    return hslToHex({h:hsl.h,s:clamp(hsl.s,38,82),l:clamp(hsl.l,60,74)});
  }

  function applyBrand(content) {
    const branding = content?.branding || window.__stormPublicContent?.branding || {};
    const colors = Array.isArray(branding.colors) ? branding.colors : [];
    body.style.setProperty('--mf-brand-primary',luminous(colors[0],'#9CB6D8'));
    body.style.setProperty('--mf-brand-secondary',luminous(colors[1] || colors[0],'#DDD0A0'));
  }

  function ensureLens() {
    if (lens && document.body.contains(lens)) return lens;
    lens = document.createElement('div');
    lens.className = 'mf-progress-lens';
    lens.setAttribute('aria-hidden','true');
    lens.innerHTML = `
      <div class="mf-progress-lens-inner">
        <span class="mf-lens-count">01</span>
        <span class="mf-lens-section">FAQ</span>
        <span class="mf-lens-total">05</span>
      </div>
      <span class="mf-lens-progress"><i></i></span>`;
    document.body.appendChild(lens);
    return lens;
  }

  function activePage() {
    const page = document.querySelector('.page.active:not(#page-admin)');
    const id = String(page?.id || 'page-faq').replace(/^page-/,'');
    const index = Math.max(0,PAGE_ORDER.indexOf(id));
    return {page,id,index};
  }

  function decorateIndices() {
    document.querySelectorAll('#milestonesList .milestone').forEach((el,i)=>el.dataset.mfIndex=pad2(i+1));
    document.querySelectorAll('#articlesList .article').forEach((el,i)=>el.dataset.mfIndex=pad2(i+1));
  }

  function ensureChapterStory() {
    const page = document.getElementById('page-faq');
    const search = page?.querySelector('.search-panel');
    if(!page || !search || page.querySelector('.mf-chapter-section')) return;

    const section = document.createElement('section');
    section.className = 'mf-chapter-section';
    section.innerHTML = `
      <div class="mf-chapter-track">
        ${PAGE_ORDER.map((id,i)=>`
          <button type="button" class="mf-chapter-card" data-mf-open-page="${id}">
            <span>${pad2(i+1)} / ${pad2(PAGE_ORDER.length)}</span>
            <strong>${esc(PAGE_LABELS[id])}</strong>
            <em>${esc(PAGE_HINTS[id])}</em>
          </button>`).join('')}
      </div>`;
    page.insertBefore(section,search);
    section.addEventListener('click',e=>{
      const card=e.target.closest('[data-mf-open-page]');
      if(!card) return;
      document.querySelector(`.nav-tab[data-page="${card.dataset.mfOpenPage}"]`)?.click();
      window.scrollTo({top:0,behavior:reducedMotion.matches?'auto':'smooth'});
    });
  }

  function wrapTrack(track,kind) {
    if(!track || track.dataset.mfWrapped==='1') return;
    track.dataset.mfWrapped='1';
    track.classList.add('mf-hscroll-track');

    const wrapper=document.createElement('div');
    wrapper.className='mf-hscroll';
    wrapper.dataset.mfKind=kind;

    const sticky=document.createElement('div');
    sticky.className='mf-hscroll-sticky';
    const viewport=document.createElement('div');
    viewport.className='mf-hscroll-viewport';

    track.parentNode.insertBefore(wrapper,track);
    wrapper.appendChild(sticky);
    sticky.appendChild(viewport);
    viewport.appendChild(track);

    scrollers.set(wrapper,{wrapper,sticky,viewport,track,kind,travel:0,progress:0});
  }

  function discoverScrollers() {
    const chapter=document.querySelector('.mf-chapter-track');
    if(chapter) wrapTrack(chapter,'chapters');
    const milestone=document.getElementById('milestonesList');
    if(milestone && milestone.children.length) wrapTrack(milestone,'milestones');
    const articles=document.getElementById('articlesList');
    if(articles && articles.children.length) wrapTrack(articles,'articles');
    const plans=document.getElementById('plansGrid');
    if(plans && plans.children.length) wrapTrack(plans,'plans');
    const ambassadors=document.getElementById('ambassadorsGrid');
    if(ambassadors && ambassadors.children.length) wrapTrack(ambassadors,'people');
    const xyz=document.getElementById('teamXyzGrid');
    if(xyz && xyz.children.length) wrapTrack(xyz,'team');
    const parella=document.getElementById('teamParellaGrid');
    if(parella && parella.children.length) wrapTrack(parella,'team');
  }

  function visibleChildCount(track) {
    return [...track.children].filter(el=>getComputedStyle(el).display!=='none').length;
  }

  function measureScroller(state) {
    const {wrapper,sticky,viewport,track}=state;
    if(!wrapper.isConnected) return;

    if(mobile.matches || !isActive() || wrapper.offsetParent===null) {
      wrapper.style.height='auto';
      track.style.setProperty('--mf-track-x','0px');
      state.travel=0;
      state.progress=0;
      return;
    }

    // Allow layout to settle before measuring max-content track.
    const viewportWidth=viewport.clientWidth || window.innerWidth;
    const trackWidth=track.scrollWidth;
    const travel=Math.max(0,trackWidth-viewportWidth);
    const stickyHeight=Math.max(480,window.innerHeight-72);
    state.travel=travel;
    wrapper.style.height=`${Math.ceil(stickyHeight + travel + Math.min(180,window.innerHeight*.16))}px`;
  }

  function measureAll() {
    scrollers.forEach(measureScroller);
  }

  function currentStage() {
    const nav=72;
    const mid=window.innerHeight*.58;
    let best=null;
    scrollers.forEach(state=>{
      if(state.wrapper.offsetParent===null || state.travel<=0) return;
      const r=state.wrapper.getBoundingClientRect();
      if(r.top<=nav+6 && r.bottom>=mid) {
        const score=Math.abs(r.top-nav);
        if(!best || score<best.score) best={state,score};
      }
    });
    return best?.state || null;
  }

  function updateLens(stage) {
    const el=ensureLens();
    const {id,index}=activePage();
    let progress=0;
    let count=index+1;
    let total=PAGE_ORDER.length;
    let label=PAGE_LABELS[id] || 'Storm';

    if(stage && stage.travel>0) {
      progress=stage.progress;
      const items=Math.max(1,visibleChildCount(stage.track));
      count=Math.min(items,Math.floor(progress*Math.max(items-1,0))+1);
      total=items;
      label=PAGE_LABELS[id] || label;
      body.style.setProperty('--mf-lens-x',`${(-26 + progress*52).toFixed(2)}vw`);
    } else {
      const page=activePage().page;
      if(page) {
        const rect=page.getBoundingClientRect();
        const denom=Math.max(1,page.scrollHeight-window.innerHeight);
        progress=clamp(-rect.top/denom,0,1);
      }
      body.style.setProperty('--mf-lens-x','0vw');
    }

    body.style.setProperty('--mf-lens-progress',clamp(progress,.025,1).toFixed(4));
    el.querySelector('.mf-lens-count').textContent=pad2(count);
    el.querySelector('.mf-lens-total').textContent=pad2(total);
    el.querySelector('.mf-lens-section').textContent=label;
  }

  function updateScrollers() {
    raf=0;
    if(!isActive()) {
      updateLens(null);
      return;
    }

    scrollers.forEach(state=>{
      if(mobile.matches || state.wrapper.offsetParent===null || state.travel<=0) {
        state.progress=0;
        state.track.style.setProperty('--mf-track-x','0px');
        return;
      }
      const rect=state.wrapper.getBoundingClientRect();
      const stickyHeight=state.sticky.clientHeight || (window.innerHeight-72);
      const scrollDistance=Math.max(1,state.wrapper.offsetHeight-stickyHeight);
      const progress=clamp(-rect.top/scrollDistance,0,1);
      state.progress=progress;
      state.track.style.setProperty('--mf-track-x',`${(-state.travel*progress).toFixed(2)}px`);
    });

    updateLens(currentStage());
  }

  function requestUpdate() {
    if(!raf) raf=requestAnimationFrame(updateScrollers);
  }

  function scheduleRebuild() {
    if(rebuildRaf) cancelAnimationFrame(rebuildRaf);
    rebuildRaf=requestAnimationFrame(()=>{
      rebuildRaf=0;
      decorateIndices();
      ensureChapterStory();
      discoverScrollers();
      requestAnimationFrame(()=>{
        measureAll();
        requestUpdate();
      });
    });
  }

  function pointerAtmosphere(e) {
    if(!isActive() || reducedMotion.matches) return;
    pointerX+=(e.clientX-pointerX)*.20;
    pointerY+=(e.clientY-pointerY)*.20;
    body.style.setProperty('--mf-pointer-x',`${pointerX.toFixed(0)}px`);
    body.style.setProperty('--mf-pointer-y',`${pointerY.toFixed(0)}px`);
  }

  document.addEventListener('pointermove',pointerAtmosphere,{passive:true});
  window.addEventListener('scroll',requestUpdate,{passive:true});
  window.addEventListener('resize',()=>{
    measureAll();
    requestUpdate();
  },{passive:true});

  document.addEventListener('storm-theme-change',()=>{
    applyBrand(window.__stormPublicContent);
    scheduleRebuild();
  });

  document.addEventListener('storm-public-content-ready',e=>{
    applyBrand(e.detail?.content || window.__stormPublicContent);
    scheduleRebuild();
  });

  document.addEventListener('click',e=>{
    if(e.target.closest('.nav-tab')) {
      requestAnimationFrame(()=>{
        measureAll();
        requestUpdate();
      });
    }
    if(e.target.closest('.filter-pill')) {
      requestAnimationFrame(()=>{
        measureAll();
        requestUpdate();
      });
    }
  });

  mobile.addEventListener?.('change',()=>{
    measureAll();
    requestUpdate();
  });

  if(window.ResizeObserver) {
    const ro=new ResizeObserver(()=>{
      measureAll();
      requestUpdate();
    });
    ['milestonesList','articlesList','plansGrid','ambassadorsGrid','teamXyzGrid','teamParellaGrid'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) ro.observe(el);
    });
  }

  if(window.MutationObserver) {
    const mo=new MutationObserver(mutations=>{
      if(mutations.some(m=>m.type==='childList' || (m.type==='attributes' && m.attributeName==='class'))) scheduleRebuild();
    });
    ['milestonesList','articlesList','plansGrid','ambassadorsGrid','teamXyzGrid','teamParellaGrid'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) mo.observe(el,{childList:true});
    });
    document.querySelectorAll('.page').forEach(page=>mo.observe(page,{attributes:true,attributeFilter:['class']}));
    mo.observe(body,{attributes:true,attributeFilter:['class']});
  }

  // Initial pass. Script is loaded at the end of <body>, so DOM exists.
  ensureLens();
  applyBrand(window.__stormPublicContent);
  scheduleRebuild();
})();
