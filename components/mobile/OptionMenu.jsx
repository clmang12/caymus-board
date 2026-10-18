'use client';
import { swatch } from './format';

export const stop = (e) => e.stopPropagation();

// Should a menu of `count` options open above `el` instead of below it?
// `reserve` is the space taken at the bottom of the screen (tab bar).
export function opensUp(el, count, reserve = 84) {
  if (!el || typeof window === 'undefined') return false;
  const r = el.getBoundingClientRect();
  const height = count * 34 + 14;
  return r.bottom + height > window.innerHeight - reserve && r.top - height > 60;
}

// Status / condition picker. Swallows pointerdown and click so choosing an
// option never reaches the card or row underneath; the document listener in
// MobileApp closes it on any tap outside.
export default function OptionMenu({ options, current, onPick, up, align = 'right', label }) {
  return (
    <div
      className={'m-pop' + (up ? ' up' : '') + (align === 'left' ? ' left' : '')}
      role="menu"
      aria-label={label}
      onPointerDown={stop}
      onClick={stop}
    >
      {options.map(([l, color]) => (
        <button
          key={l}
          type="button"
          role="menuitemradio"
          aria-checked={l === current}
          className={'m-pop-opt' + (l === current ? ' cur' : '')}
          style={{ background: swatch(color) }}
          onClick={() => onPick(l)}
        >
          <span>{l}</span>
          {l === current && <span className="m-pop-check" aria-hidden="true">✓</span>}
        </button>
      ))}
    </div>
  );
}

// Coloured status pill that opens the status menu. Unset status shows a
// dashed "Set status" placeholder.
export function StatusPill({ status, color, open, onOpen, big = false }) {
  return (
    <button
      type="button"
      className={'m-pill status hit' + (status ? '' : ' unset') + (big ? ' big' : '')}
      style={status ? { background: color } : undefined}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={status ? `Status: ${status}` : 'Set status'}
      onPointerDown={stop}
      onClick={(e) => { e.stopPropagation(); onOpen(e.currentTarget); }}
    >
      {status || 'Set status'}
    </button>
  );
}
