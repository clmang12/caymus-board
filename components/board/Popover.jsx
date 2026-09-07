'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Fixed-position popover anchored to a rect, rendered in a portal so it escapes
// the grid's overflow. Closes on outside click, Escape, scroll, or resize.
export default function Popover({ anchorRect, onClose, children, width }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: -9999, left: -9999 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!anchorRect || !ref.current) return;
    const el = ref.current;
    const pw = el.offsetWidth || width || 220;
    const ph = el.offsetHeight || 240;
    const margin = 6;
    let left = anchorRect.left;
    let top = anchorRect.bottom + margin;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (left < 8) left = 8;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, anchorRect.top - ph - margin);
    setPos({ top, left });
  }, [anchorRect, width, mounted]);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [onClose]);

  if (!mounted) return null;
  return createPortal(
    <div ref={ref} className="pop" style={{ top: pos.top, left: pos.left, width }}>
      {children}
    </div>,
    document.body
  );
}
