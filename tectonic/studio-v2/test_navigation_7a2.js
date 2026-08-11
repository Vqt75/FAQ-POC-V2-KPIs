const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const checks = [
  ['7A.2 marker', 'STUDIO V2 — 7A.2 / NAVIGATION CONTINUITY'],
  ['admin body locked to viewport', 'height:100dvh;\n    overflow:hidden;'],
  ['Pangea nav hidden in admin', 'body.storm-admin-open > .nav'],
  ['admin page viewport shell', 'body.storm-admin-open #page-admin'],
  ['sidebar viewport height', 'body.storm-admin-open .admin-sidebar {\n    position:relative;'],
  ['nav scroll only', 'overflow-y:auto;\n    overflow-x:hidden;\n    overscroll-behavior:contain;'],
  ['footer fixed flex child', '.admin-sidebar-footer {\n    gap:7px;'],
  ['demo dock', 'class="studio-demo-dock"'],
  ['demo label', '>Mode démo</span>'],
  ['demo launch remains available', 'id="stormDemoLaunchBtn"'],
  ['logout remains available', 'id="adminLogoutBtn"'],
  ['main independent scroll', 'body.storm-admin-open .admin-main {\n    height:100dvh;'],
  ['topbar stronger sticky layer', 'body.storm-admin-open .admin-topbar {\n    z-index:60;'],
  ['fast nav transition', '140ms cubic-bezier(.2,.8,.2,1)'],
  ['panel transition duration', 'studioPanelEnter7A2 160ms'],
  ['tiny panel movement', 'translateY(5px)'],
  ['panel enter JS', "targetPanel.classList.add('studio-panel-enter')"],
  ['main scroller route reset', "const studioScroller = document.querySelector('.admin-main')"],
  ['reduced motion', '@media (prefers-reduced-motion:reduce)'],
  ['short-height adaptation', '@media (max-height:720px) and (min-width:901px)'],
];

let failures = [];
for (const [name, needle] of checks) {
  if (!html.includes(needle)) failures.push(name);
}
if (failures.length) {
  console.error('ÉCHEC — Studio Navigation 7A.2 :', failures.join(', '));
  process.exit(1);
}
console.log(`OK — Studio Navigation 7A.2 : ${checks.length} vérifications validées.`);
