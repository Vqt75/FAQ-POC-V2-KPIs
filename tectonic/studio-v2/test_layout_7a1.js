const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const checks = [
  ['responsive canvas marker', 'STUDIO V2 — 7A.1 / RESPONSIVE CANVAS'],
  ['fluid sidebar token', '--studio-sidebar:clamp(210px,17vw,244px)'],
  ['fluid gutter token', '--studio-gutter:clamp(18px,2.25vw,34px)'],
  ['shell uses fluid sidebar', 'grid-template-columns:var(--studio-sidebar) minmax(0,1fr)'],
  ['admin main constrained', 'body.storm-admin-open .admin-main {'],
  ['admin main clips x overflow', 'overflow-x:clip'],
  ['panel cannot force min width', 'body.storm-admin-open .admin-panel {'],
  ['project children shrink', 'body.storm-admin-open .studio-project-layout > *'],
  ['news children shrink', 'body.storm-admin-open .studio-news-layout > *'],
  ['spaces children shrink', 'body.storm-admin-open .studio-spaces-layout > *'],
  ['questions children shrink', 'body.storm-admin-open .studio-questions-layout > *'],
  ['ambassadors children shrink', 'body.storm-admin-open .studio-amb-layout > *'],
  ['pilotage children shrink', 'body.storm-admin-open .studio-pilotage-subgrid > *'],
  ['responsive project columns', 'grid-template-columns:minmax(250px,32%) minmax(0,1fr)'],
  ['responsive questions columns', 'grid-template-columns:minmax(260px,34%) minmax(0,1fr)'],
  ['responsive ambassadors columns', 'body.storm-admin-open .studio-amb-layout {'],
  ['faq preview stacks at intermediate widths', 'body.storm-admin-open .storm-faq-layout.is-editing .storm-faq-preview-pane'],
  ['domain save can contract', 'body.storm-admin-open .studio-domain-save {'],
  ['mobile shell remains single column', '--studio-sidebar:0px'],
  ['media cannot force width', 'body.storm-admin-open iframe']
];
let failed = 0;
for (const [name, needle] of checks) {
  if (!html.includes(needle)) { console.error(`FAIL — ${name}`); failed++; }
}
if (failed) process.exit(1);
console.log(`OK — Studio Responsive Canvas 7A.1 : ${checks.length} vérifications validées.`);
