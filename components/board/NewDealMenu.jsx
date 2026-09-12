'use client';
import { useRef, useState } from 'react';
import Popover from './Popover';
import { optionList } from './columns';

export default function NewDealMenu({ options, onCreate }) {
  const [anchor, setAnchor] = useState(null);
  const btnRef = useRef(null);
  const deals = optionList(options, 'deal');

  return (
    <>
      <button
        ref={btnRef}
        className="board-btn board-btn-primary"
        onClick={() => setAnchor(anchor ? null : btnRef.current.getBoundingClientRect())}
      >
        + New Deal
      </button>
      {anchor && (
        <Popover anchorRect={anchor} onClose={() => setAnchor(null)} width={200}>
          {deals.map((o) => (
            <div
              key={o.label}
              className="pop-opt"
              onClick={() => { onCreate(o.label); setAnchor(null); }}
            >
              {o.label}
            </div>
          ))}
        </Popover>
      )}
    </>
  );
}
