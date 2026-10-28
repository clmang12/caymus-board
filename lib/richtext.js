// Update bodies are either plain text (automations, AI assistants, the mobile
// composer) or HTML from the desktop rich-text composer. HTML is always passed
// through sanitizeHtml before it is shown, so a body can't inject markup.

// Text colours the composer offers. Any other colour is dropped on sanitize, so
// pasted black text can't vanish in dark mode.
export const TEXT_COLORS = [
  ['Red', '#e2445c'], ['Orange', '#fdab3d'], ['Green', '#00c875'],
  ['Blue', '#0086c0'], ['Purple', '#a25ddc'], ['Grey', '#808080'],
];
const COLOR_SET = new Set(TEXT_COLORS.map(([, c]) => c));

const RICH_RE = /<\/?(p|div|br|b|strong|i|em|s|strike|del|u|code|pre|ul|ol|li|a|span|font|h[1-6]|blockquote)\b[^>]*>/i;
export const isRichText = (body) => RICH_RE.test(body || '');

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function textToHtml(text) {
  return escapeHtml(text || '').replace(/\n/g, '<br>');
}

// Plain-text rendering of a body, for places that can't show HTML (AI
// assistants, trash names). Safe to run on the server.
export function htmlToText(body) {
  if (!isRichText(body)) return body || '';
  return body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(div|p|h[1-6]|blockquote|pre|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/​/g, '')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim();
}

const TAGS = {
  B: 'b', STRONG: 'b', I: 'i', EM: 'i', S: 's', STRIKE: 's', DEL: 's', U: 'u',
  CODE: 'code', PRE: 'pre', UL: 'ul', OL: 'ol', LI: 'li', A: 'a', BR: 'br',
  P: 'div', DIV: 'div', H1: 'h3', H2: 'h3', H3: 'h3', H4: 'h3', H5: 'h3', H6: 'h3',
  BLOCKQUOTE: 'blockquote', SPAN: 'span', FONT: 'span',
};
// Dropped with their contents; any other unknown tag is unwrapped.
const DROP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'HEAD', 'TITLE', 'META', 'LINK', 'NOSCRIPT']);

function toHex(color) {
  const c = (color || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return m ? '#' + m.slice(1, 4).map((n) => (+n).toString(16).padStart(2, '0')).join('') : '';
}

function safeHref(href) {
  const h = (href || '').trim();
  return /^(https?:|mailto:)/i.test(h) ? h : '';
}

function copyClean(src, dst) {
  for (const node of src.childNodes) {
    if (node.nodeType === 3) { dst.appendChild(document.createTextNode(node.nodeValue)); continue; }
    if (node.nodeType !== 1 || DROP.has(node.tagName)) continue;
    let tag = TAGS[node.tagName];
    // Google Docs wraps whole pastes in <b style="font-weight:normal">.
    if (tag === 'b' && /^(normal|400)$/.test(node.style.fontWeight)) tag = null;
    const color = tag === 'span' ? toHex(node.getAttribute('color') || node.style.color) : '';
    const href = tag === 'a' ? safeHref(node.getAttribute('href')) : '';
    if (!tag || (tag === 'span' && !COLOR_SET.has(color)) || (tag === 'a' && !href)) {
      copyClean(node, dst);
      continue;
    }
    const el = document.createElement(tag);
    if (tag === 'span') el.style.color = color;
    if (tag === 'a') {
      el.setAttribute('href', href);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    copyClean(node, el);
    dst.appendChild(el);
  }
}

// Whitelist sanitizer (browser only). Parsing happens in an inert document,
// and the output is rebuilt node by node, so no attribute other than a
// checked href or a palette colour survives.
export function sanitizeHtml(html) {
  if (typeof document === 'undefined') return textToHtml(htmlToText(html));
  const parsed = new DOMParser().parseFromString(html || '', 'text/html');
  const out = document.createElement('div');
  copyClean(parsed.body, out);
  return out.innerHTML.replace(/​/g, '');
}
