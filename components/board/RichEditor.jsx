'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Popover from './Popover';
import { TEXT_COLORS, sanitizeHtml } from '@/lib/richtext';

const BLOCKS = [['div', 'Default'], ['h3', 'Heading'], ['blockquote', 'Quote']];
// foreColor has no "remove colour", so "Default" applies this placeholder and
// then unwraps it (sanitizeHtml would drop it anyway: it's not in the palette).
const NO_COLOR = '#010203';
const FORMATTING = /<(b|i|s|u|code|pre|ul|ol|a|span|font|h3|blockquote)\b/i;

const closest = (node, tag, root) => {
  for (let n = node; n && n !== root; n = n.parentNode) if (n.nodeName === tag) return n;
  return null;
};
const unwrap = (el) => {
  while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
  el.remove();
};

const ListIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="2.5" cy="4" r="1.3" fill="currentColor" /><circle cx="2.5" cy="8" r="1.3" fill="currentColor" /><circle cx="2.5" cy="12" r="1.3" fill="currentColor" />
    <path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const NumberedIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
    <text x="0" y="6" fontSize="5.5" fontWeight="700" fill="currentColor">1</text>
    <text x="0" y="14" fontSize="5.5" fontWeight="700" fill="currentColor">2</text>
    <path d="M6 4h8M6 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const LinkIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <path d="M6.8 9.2a3 3 0 0 0 4.2 0l2.1-2.1a3 3 0 0 0-4.2-4.2l-.9.9" />
    <path d="M9.2 6.8a3 3 0 0 0-4.2 0L2.9 8.9a3 3 0 0 0 4.2 4.2l.9-.9" />
  </svg>
);

// Rich-text composer for deal updates: a contentEditable with a working
// toolbar. onSubmit gets plain text when nothing is formatted, else sanitized
// HTML (see lib/richtext.js). inlineMenus opens the style/colour/link menus
// in a row under the toolbar instead of a popover (the mobile app).
export default function RichEditor({ initialHtml = '', placeholder, submitLabel = 'Update', onSubmit, onCancel, autoFocus, inlineMenus, className = '' }) {
  const ref = useRef(null);
  const savedRange = useRef(null);
  const [empty, setEmpty] = useState(!initialHtml);
  const [active, setActive] = useState({});
  const [menu, setMenu] = useState(null);
  const [linkUrl, setLinkUrl] = useState('');

  const refresh = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEmpty(!el.textContent.replace(/​/g, '').trim() && !el.querySelector('li'));
    const sel = window.getSelection();
    if (!sel.rangeCount || !el.contains(sel.anchorNode)) return;
    savedRange.current = sel.getRangeAt(0).cloneRange();
    const q = (cmd) => { try { return document.queryCommandState(cmd); } catch { return false; } };
    setActive({
      bold: q('bold'), italic: q('italic'), strike: q('strikeThrough'),
      ul: q('insertUnorderedList'), ol: q('insertOrderedList'),
      code: !!closest(sel.anchorNode, 'CODE', el),
      link: !!closest(sel.anchorNode, 'A', el),
      block: closest(sel.anchorNode, 'H3', el) ? 'h3' : closest(sel.anchorNode, 'BLOCKQUOTE', el) ? 'blockquote' : 'div',
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    el.innerHTML = initialHtml;
    document.execCommand('styleWithCSS', false, false);
    if (autoFocus) {
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
    }
    refresh();
    document.addEventListener('selectionchange', refresh);
    return () => document.removeEventListener('selectionchange', refresh);
    // initialHtml is only the starting content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Put focus and the caret back where they were before a toolbar/popover click.
  const restore = () => {
    const el = ref.current;
    const hadFocus = document.activeElement === el;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && el.contains(savedRange.current.startContainer)
        && (!hadFocus || !(sel.rangeCount && el.contains(sel.anchorNode)))) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const exec = (cmd, value) => {
    restore();
    document.execCommand(cmd, false, value);
    refresh();
  };

  const setColor = (color) => {
    setMenu(null);
    exec('foreColor', color || NO_COLOR);
    if (!color) ref.current.querySelectorAll(`font[color="${NO_COLOR}"]`).forEach(unwrap);
    refresh();
  };

  // No execCommand for inline code: wrap the selection, unwrap a selected code
  // span, or step out of the code span the caret is in.
  const toggleCode = () => {
    restore();
    const el = ref.current;
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const inCode = closest(range.commonAncestorContainer, 'CODE', el);
    if (inCode && !range.collapsed) {
      unwrap(inCode);
    } else if (inCode) {
      const after = document.createTextNode('​');
      inCode.after(after);
      range.setStart(after, 1);
      range.collapse(true);
    } else {
      const code = document.createElement('code');
      if (range.collapsed) {
        code.textContent = '​';
        range.insertNode(code);
        range.setStart(code.firstChild, 1);
        range.collapse(true);
      } else {
        code.appendChild(range.extractContents());
        range.insertNode(code);
        range.selectNodeContents(code);
      }
    }
    sel.removeAllRanges();
    sel.addRange(range);
    refresh();
  };

  const addLink = (e) => {
    e.preventDefault();
    let url = linkUrl.trim();
    setMenu(null);
    setLinkUrl('');
    if (!url) return;
    if (!/^(https?:|mailto:)/i.test(url)) url = (url.includes('@') && !url.includes('/') ? 'mailto:' : 'https://') + url;
    restore();
    const sel = window.getSelection();
    if (sel.rangeCount && !sel.getRangeAt(0).collapsed) document.execCommand('createLink', false, url);
    else {
      const a = document.createElement('a');
      a.href = url;
      a.textContent = url.replace(/^mailto:/, '');
      document.execCommand('insertHTML', false, a.outerHTML + '&nbsp;');
    }
    refresh();
  };

  const onPaste = (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    if (html) document.execCommand('insertHTML', false, sanitizeHtml(html));
    else document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  };

  const submit = () => {
    const el = ref.current;
    if (!el.textContent.replace(/​/g, '').trim() && !el.querySelector('li')) return;
    const html = sanitizeHtml(el.innerHTML)
      .replace(/(<div><br><\/div>|<br>)+$/g, '')
      .replace(/^(<div><br><\/div>|<br>)+/g, '');
    const body = FORMATTING.test(html) ? html : el.innerText.replace(/​/g, '').trim();
    if (onSubmit(body) !== false) {
      el.innerHTML = '';
      refresh();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
    else if (e.key === 'Escape' && onCancel) { e.preventDefault(); onCancel(); }
  };

  // Toolbar buttons must not take focus, or the selection they act on is lost.
  const keep = (e) => e.preventDefault();
  const tool = (key, title, onClick, children, extra = '') => (
    <button type="button" className={'rte-tool' + (active[key] ? ' on' : '') + extra} title={title} aria-label={title}
      aria-pressed={key ? !!active[key] : undefined} onMouseDown={keep} onClick={onClick}>{children}</button>
  );
  const openMenu = (kind) => (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu((m) => (inlineMenus && m?.kind === kind ? null : { kind, rect }));
  };
  const blockLabel = BLOCKS.find(([b]) => b === active.block)?.[1] || 'Default';
  const menuBody = menu && (
    <>
      {menu.kind === 'block' && BLOCKS.map(([b, label]) => (
        <div key={b} className={'pop-opt rte-block-opt rte-block-' + b} onMouseDown={keep}
          onClick={() => { setMenu(null); exec('formatBlock', `<${b}>`); }}>
          {label}{active.block === b && <span className="pop-check">✓</span>}
        </div>
      ))}
      {menu.kind === 'color' && (
        <>
          <div className="pop-opt" onMouseDown={keep} onClick={() => setColor(null)}>
            <span className="pop-swatch rte-swatch-default" />Default
          </div>
          {TEXT_COLORS.map(([label, c]) => (
            <div key={c} className="pop-opt" onMouseDown={keep} onClick={() => setColor(c)}>
              <span className="pop-swatch" style={{ background: c }} />{label}
            </div>
          ))}
        </>
      )}
      {menu.kind === 'link' && (
        <form className="rte-link-form" onSubmit={addLink}>
          <input autoFocus value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Paste or type a link" aria-label="Link URL" />
          <button type="submit" className="board-btn board-btn-primary" disabled={!linkUrl.trim()}>Add</button>
        </form>
      )}
    </>
  );

  return (
    <div className={'rte' + (className ? ' ' + className : '')}>
      <div
        ref={ref}
        className={'rte-input' + (empty ? ' empty' : '')}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        data-placeholder={placeholder}
        onInput={refresh}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
      <div className="updates-tools">
        {tool('bold', 'Bold (⌘B)', () => exec('bold'), <b>B</b>)}
        {tool('italic', 'Italic (⌘I)', () => exec('italic'), <i>I</i>, ' rte-italic')}
        {tool('strike', 'Strikethrough', () => exec('strikeThrough'), <s>S</s>)}
        {tool('code', 'Code', toggleCode, '<>')}
        {tool('ul', 'Bulleted list', () => exec('insertUnorderedList'), <ListIcon />)}
        {tool('ol', 'Numbered list', () => exec('insertOrderedList'), <NumberedIcon />)}
        <span className="updates-tool-divider" />
        {tool('link', 'Link', active.link ? () => exec('unlink') : openMenu('link'), <LinkIcon />)}
        {tool(null, 'Text style', openMenu('block'), <>{blockLabel}<span className="rte-caret">⌄</span></>, ' rte-block')}
        {tool(null, 'Text colour', openMenu('color'), <span className="rte-color-a">A</span>)}
        <span className="rte-actions">
          {onCancel && <button type="button" className="board-btn rte-cancel" onClick={onCancel}>Cancel</button>}
          <button type="button" className="board-btn board-btn-primary rte-submit" onMouseDown={keep} onClick={submit} disabled={empty}>{submitLabel}</button>
        </span>
      </div>

      {menu && inlineMenus && <div className={'rte-menu rte-menu-' + menu.kind}>{menuBody}</div>}
      {menu && !inlineMenus && (
        <Popover anchorRect={menu.rect} onClose={() => setMenu(null)} width={menu.kind === 'link' ? 280 : 170}>
          {menuBody}
        </Popover>
      )}
    </div>
  );
}
