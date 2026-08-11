const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ivory = fs.readFileSync(path.join(root, 'public', 'renderers', 'ivory.js'), 'utf8');

const checks = [];
function ok(condition, label) {
  if (!condition) throw new Error(`Échec — ${label}`);
  checks.push(label);
}

ok(html.includes('Studio V2 — Hardening 8A: inline rich-text descriptions'), 'styles 8A présents');
ok(html.includes('function studioInlineMarkupToEditorHtml'), 'parser Studio présent');
ok(html.includes('function studioInlineEditorToMarkup'), 'serializer Studio présent');
ok(html.includes('function studioInlineEditorHtml'), 'composant Studio présent');
ok(html.includes('function studioBindInlineEditor'), 'binding Studio présent');
ok(html.includes('data-inline-command="bold"'), 'gras disponible');
ok(html.includes('data-inline-command="italic"'), 'italique disponible');
ok(html.includes('data-inline-command="underline"'), 'soulignement disponible');
ok(!html.includes('data-inline-command="foreColor"'), 'aucune couleur libre');
ok(!html.includes('data-inline-command="fontName"'), 'aucune police libre');
ok(!html.includes('data-inline-command="fontSize"'), 'aucune taille libre');
ok(html.includes("selection.isCollapsed"), 'formatage réservé à une sélection');
ok(html.includes("Sélectionnez d’abord le texte à mettre en forme."), 'feedback sans sélection');
ok(html.includes("getData('text/plain')"), 'coller neutralise la mise en forme externe');
ok(html.includes("return `**${inner}**`"), 'stockage sémantique gras');
ok(html.includes("return `//${inner}//`"), 'stockage sémantique italique');
ok(html.includes("return `++${inner}++`"), 'stockage sémantique souligné');
ok(html.includes("studioInlineEditorHtml('projectIntroBody'"), 'intro Le projet migrée');
ok(html.includes("studioInlineEditorHtml('projectSectionBody'"), 'textes Le projet migrés');
ok(html.includes("studioInlineEditorHtml('studioNewsSummary'"), 'chapeau Actualités migré');
ok(html.includes("studioInlineEditorHtml('studioSpaceDescription'"), 'description Espaces migrée');
ok(html.includes("studioInlineEditorHtml('studioQuestionAnswer'"), 'réponse Questions migrée');
ok(html.includes("studioInlineEditorHtml('studioQuestionNote'"), 'précision Questions migrée');
ok(html.includes("studioInlineEditorHtml('ambIntroBodyInput'"), 'intro Ambassadeurs migrée');
ok(html.includes("studioInlineEditorHtml('ambJoinBody'"), 'message recrutement migré');
ok(!html.includes('<textarea class="form-input" id="projectIntroBody"'), 'ancien textarea projet supprimé');
ok(!html.includes('<textarea class="form-input" id="studioSpaceDescription"'), 'ancien textarea espaces supprimé');
ok(!html.includes('<textarea class="form-input studio-question-answer" id="studioQuestionAnswer"'), 'ancien textarea FAQ supprimé');
ok(ivory.includes('function inlineRichText(value)'), 'renderer Ivory comprend le format riche');
ok(ivory.includes("<p>${inlineRichText(intro.body || intro.description || fallback.intro.body)}</p>"), 'Ivory rend l’intro projet');
ok((ivory.match(/inlineRichText\(section\.body\)/g) || []).length >= 2, 'Ivory rend focus et texte');
ok(ivory.includes('inlineRichText(item.comment)'), 'Ivory rend les descriptions espaces');
ok(ivory.includes('inlineRichText(item.summary)'), 'Ivory rend les chapeaux actualités');
ok(ivory.includes('faqAnswerToHtml(answer)'), 'Ivory conserve le rendu FAQ structuré');
ok(ivory.includes('map(block => `<p>${inlineRichText(block)}</p>`)'), 'FAQ/Ambassadeurs utilisent le parser sémantique');
ok(ivory.includes('inlineRichText(ambassadorJoinBody(join.body))'), 'message recrutement rendu riche');

console.log(`OK — Studio Rich Text 8A : ${checks.length} vérifications validées.`);
