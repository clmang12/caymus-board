'use client';
import { useRef, useState } from 'react';
import Popover from './Popover';
import { optionList, EMPTY_COLOR } from './columns';

export default function FilterMenu({ options, filter, onChange }) {
  const [anchor, setAnchor] = useState(null);
  const btnRef = useRef(null);
  const active = !!(filter.agent || filter.lender);
  const label = [filter.agent, filter.lender].filter(Boolean).join(' · ') || 'Filter';
  const pick = (key, value) => onChange({ ...filter, [key]: filter[key] === value ? null : value });

  const row = (key, o, swatch) => (
    <div key={o.label} className="pop-opt" onClick={() => pick(key, o.label)}>
      {swatch && <span className="pop-swatch" style={{ background: o.color || EMPTY_COLOR }} />}
      {o.label}
      {filter[key] === o.label && <span className="pop-check">✓</span>}
    </div>
  );

  return (
    <>
      <button
        ref={btnRef}
        className={'board-btn' + (active ? ' board-btn-active' : '')}
        title="Filter by agent or lender"
        onClick={() => setAnchor(anchor ? null : btnRef.current.getBoundingClientRect())}
      >
        {label}
      </button>
      {anchor && (
        <Popover anchorRect={anchor} onClose={() => setAnchor(null)} width={240}>
          <div className="pop-section">Agent</div>
          {optionList(options, 'agent').map((o) => row('agent', o, true))}
          <div className="pop-section">Lender</div>
          <div className="pop-scroll">
            {optionList(options, 'lender').map((o) => row('lender', o, false))}
          </div>
          {active && (
            <>
              <div className="pop-divider" />
              <div className="pop-opt" style={{ color: 'var(--tx2)' }}
                onClick={() => { onChange({ agent: null, lender: null }); setAnchor(null); }}>
                Clear filter
              </div>
            </>
          )}
        </Popover>
      )}
    </>
  );
}
