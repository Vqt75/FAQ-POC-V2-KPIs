// TECTONIC — semantic article content model
// Shared by Node normalization and Compiler. Studio never stores arbitrary
// presentational HTML: text emphasis is represented as runs and layout as blocks.

function safeString(value, max = 20000) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function safeHref(value) {
  const href = safeString(value, 2000).trim();
  if (!href) return '';
  if (/^(https?:\/\/|mailto:|\/|#)/i.test(href)) return href;
  return '';
}

function normalizeRuns(raw) {
  const source = Array.isArray(raw) ? raw : [];
  const runs = [];
  source.forEach(item => {
    if (!item || typeof item !== 'object') return;
    const text = safeString(item.text, 20000);
    if (!text) return;
    const run = { text };
    if (item.bold === true) run.bold = true;
    if (item.italic === true) run.italic = true;
    if (item.highlight === true) run.highlight = true;
    const href = safeHref(item.href);
    if (href) run.href = href;
    const previous = runs[runs.length - 1];
    if (previous
      && !!previous.bold === !!run.bold
      && !!previous.italic === !!run.italic
      && !!previous.highlight === !!run.highlight
      && String(previous.href || '') === String(run.href || '')) {
      previous.text += run.text;
    } else {
      runs.push(run);
    }
  });
  return runs;
}

function textToRuns(value) {
  const text = safeString(value, 20000);
  return text ? [{ text }] : [];
}

function runsToPlainText(runs) {
  return normalizeRuns(runs).map(run => run.text).join('');
}

function normalizeInlineAsset(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const url = safeString(raw.url, 2000).trim();
  if (!url) return null;
  return {
    url,
    alt: safeString(raw.alt, 500),
    caption: safeString(raw.caption, 1000)
  };
}

function legacyBodyToNewsBlocks(body) {
  const lines = safeString(body, 100000).split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let listType = '';
  let listItems = [];

  function uid(type) { return `legacy-${type}-${blocks.length + 1}`; }
  function flushParagraph() {
    const text = paragraph.join(' ').trim();
    if (text) blocks.push({ id:uid('paragraph'), type:'paragraph', runs:textToRuns(text) });
    paragraph = [];
  }
  function flushList() {
    if (listType && listItems.length) {
      blocks.push({
        id:uid(listType),
        type:listType,
        items:listItems.map(text => ({ runs:textToRuns(text) }))
      });
    }
    listType = '';
    listItems = [];
  }

  lines.forEach(line => {
    const trimmed = String(line || '').trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }
    if (trimmed.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push({ id:uid('heading'), type:'heading', runs:textToRuns(trimmed.slice(3).trim()) });
      return;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      if (listType && listType !== 'bulletList') flushList();
      listType = 'bulletList';
      listItems.push(bullet[1].trim());
      return;
    }
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (listType && listType !== 'orderedList') flushList();
      listType = 'orderedList';
      listItems.push(ordered[1].trim());
      return;
    }
    flushList();
    paragraph.push(trimmed);
  });
  flushParagraph();
  flushList();
  return blocks.length ? blocks : [{ id:'legacy-paragraph-1', type:'paragraph', runs:[] }];
}

function normalizeNewsBlock(raw, index) {
  if (!raw || typeof raw !== 'object') return null;
  const type = safeString(raw.type, 40);
  const id = safeString(raw.id, 160) || `news-block-${index + 1}`;

  if (type === 'paragraph' || type === 'heading') {
    return { id, type, runs:normalizeRuns(raw.runs) };
  }
  if (type === 'bulletList' || type === 'orderedList') {
    const items = (Array.isArray(raw.items) ? raw.items : [])
      .slice(0, 80)
      .map(item => ({ runs:normalizeRuns(item && item.runs) }));
    return { id, type, items:items.length ? items : [{ runs:[] }] };
  }
  if (type === 'image') {
    const asset = normalizeInlineAsset(raw.asset);
    if (!asset) return null;
    return { id, type, asset };
  }
  if (type === 'gallery') {
    const items = (Array.isArray(raw.items) ? raw.items : [])
      .slice(0, 12)
      .map(normalizeInlineAsset)
      .filter(Boolean);
    if (!items.length) return null;
    return { id, type, items, caption:safeString(raw.caption, 1000) };
  }
  if (type === 'document') {
    const asset = normalizeInlineAsset(raw.asset);
    if (!asset) return null;
    const rawSize = Number(raw.fileSize);
    return {
      id,
      type,
      asset,
      title:safeString(raw.title, 500) || 'Document à consulter',
      description:safeString(raw.description, 1200),
      fileName:safeString(raw.fileName, 500),
      fileSize:Number.isFinite(rawSize) && rawSize > 0 ? Math.min(rawSize, 200 * 1024 * 1024) : 0
    };
  }
  return null;
}

function normalizeNewsBlocks(raw, legacyBody = '') {
  if (!Array.isArray(raw)) return legacyBodyToNewsBlocks(legacyBody);
  const normalized = raw.slice(0, 120).map(normalizeNewsBlock).filter(Boolean);
  return normalized.length ? normalized : [{ id:'news-paragraph-1', type:'paragraph', runs:[] }];
}

function splitRunsAtOffset(rawRuns, rawOffset) {
  const runs = normalizeRuns(rawRuns);
  const total = runs.reduce((sum, run) => sum + run.text.length, 0);
  const offset = Math.max(0, Math.min(total, Number.isFinite(Number(rawOffset)) ? Number(rawOffset) : total));
  const before = [];
  const after = [];
  let cursor = 0;

  runs.forEach(run => {
    const start = cursor;
    const end = cursor + run.text.length;
    cursor = end;
    if (end <= offset) {
      before.push({ ...run });
      return;
    }
    if (start >= offset) {
      after.push({ ...run });
      return;
    }
    const cut = offset - start;
    const left = run.text.slice(0, cut);
    const right = run.text.slice(cut);
    if (left) before.push({ ...run, text:left });
    if (right) after.push({ ...run, text:right });
  });

  return { before:normalizeRuns(before), after:normalizeRuns(after) };
}

function newsBlocksToPlainText(blocks) {
  const normalized = normalizeNewsBlocks(blocks, '');
  const parts = [];
  normalized.forEach(block => {
    if (block.type === 'paragraph' || block.type === 'heading') parts.push(runsToPlainText(block.runs));
    else if (block.type === 'bulletList' || block.type === 'orderedList') {
      block.items.forEach(item => parts.push(runsToPlainText(item.runs)));
    } else if (block.type === 'image') {
      parts.push(block.asset.caption || block.asset.alt || '');
    } else if (block.type === 'gallery') {
      block.items.forEach(item => parts.push(item.caption || item.alt || ''));
      parts.push(block.caption || '');
    } else if (block.type === 'document') {
      parts.push([block.title || block.asset.caption || '', block.description || ''].filter(Boolean).join(' '));
    }
  });
  return parts.filter(Boolean).join('\n');
}

function newsBlocksToLegacyBody(blocks) {
  const normalized = normalizeNewsBlocks(blocks, '');
  const chunks = [];
  normalized.forEach(block => {
    if (block.type === 'paragraph') {
      const text = runsToPlainText(block.runs).trim();
      if (text) chunks.push(text);
    } else if (block.type === 'heading') {
      const text = runsToPlainText(block.runs).trim();
      if (text) chunks.push(`## ${text}`);
    } else if (block.type === 'bulletList') {
      const lines = block.items.map(item => runsToPlainText(item.runs).trim()).filter(Boolean).map(text => `- ${text}`);
      if (lines.length) chunks.push(lines.join('\n'));
    } else if (block.type === 'orderedList') {
      const lines = block.items.map(item => runsToPlainText(item.runs).trim()).filter(Boolean).map((text, i) => `${i + 1}. ${text}`);
      if (lines.length) chunks.push(lines.join('\n'));
    } else if (block.type === 'document') {
      const label = (block.title || '').trim();
      if (label) chunks.push(`Document : ${label}`);
    }
  });
  return chunks.join('\n\n');
}

module.exports = {
  safeHref,
  normalizeRuns,
  runsToPlainText,
  legacyBodyToNewsBlocks,
  normalizeNewsBlocks,
  splitRunsAtOffset,
  newsBlocksToPlainText,
  newsBlocksToLegacyBody
};
