'use client';
import { useState } from 'react';
import Popover from './Popover';
import { labelColor, optionList, EMPTY_COLOR } from './columns';

const commitOnEnter = (e) => {
  if (e.key === 'Enter') e.currentTarget.blur();
  if (e.key === 'Escape') { e.currentTarget.value = e.currentTarget.defaultValue; e.currentTarget.blur(); }
};

function SubRow({ sub, options, groupColor, onCommit, onDelete }) {
  const [anchor, setAnchor] = useState(null);
  const color = labelColor(options, 'cond', sub.cond);

  return (
    <div className="subs-row">
      <div style={{ borderLeft: `5px solid ${groupColor}`, padding: '0 4px' }}>
        <input
          className="sub-input"
          defaultValue={sub.name}
          onKeyDown={commitOnEnter}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== sub.name) onCommit({ name: v });
            else e.target.value = sub.name;
          }}
        />
      </div>
      <div
        className="sub-cond"
        style={{ background: sub.cond ? color : 'transparent', color: sub.cond ? '#fff' : 'var(--tx3)' }}
        onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
      >
        {sub.cond || '–'}
      </div>
      <div style={{ justifyContent: 'center', padding: '0 4px' }}>
        <input
          type="date"
          className="sub-date"
          value={sub.due_date ?? ''}
          onChange={(e) => onCommit({ due_date: e.target.value || null })}
        />
      </div>
      <div style={{ padding: '0 4px' }}>
        <input
          className="sub-input"
          defaultValue={sub.details ?? ''}
          placeholder="–"
          onKeyDown={commitOnEnter}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (sub.details ?? '')) onCommit({ details: v || null });
          }}
        />
      </div>
      <div style={{ justifyContent: 'center', borderRight: 'none', padding: 0 }}>
        <button className="sub-del" title="Delete condition" onClick={onDelete}>✕</button>
      </div>

      {anchor && (
        <Popover anchorRect={anchor} onClose={() => setAnchor(null)} width={200}>
          {optionList(options, 'cond').map((o) => (
            <div key={o.label} className="pop-opt"
              onClick={() => { onCommit({ cond: o.label }); setAnchor(null); }}>
              <span className="pop-swatch" style={{ background: o.color || EMPTY_COLOR }} />
              {o.label}
              {sub.cond === o.label && <span className="pop-check">✓</span>}
            </div>
          ))}
          <div className="pop-opt" style={{ color: 'var(--tx2)' }}
            onClick={() => { onCommit({ cond: null }); setAnchor(null); }}>
            <span className="pop-swatch" style={{ background: 'var(--bd2)' }} />
            Clear
          </div>
        </Popover>
      )}
    </div>
  );
}

export default function SubitemPanel({
  subs, options, groupColor,
  onCommitSubitem, onAddSubitem, onDeleteSubitem, onApplyChecklist,
}) {
  const done = subs.filter((s) => s.cond === 'Accepted').length;

  return (
    <div className="subs-wrap">
      {subs.length > 0 && (
        <div className="subs-progress" title={`${done}/${subs.length} accepted`}>
          <div style={{ width: `${(done / subs.length) * 100}%` }} />
        </div>
      )}
      <div className="subs-box">
        <div className="subs-head">
          <div>Condition / Document</div>
          <div style={{ textAlign: 'center' }}>Status</div>
          <div style={{ textAlign: 'center' }}>Date</div>
          <div>Details</div>
          <div style={{ borderRight: 'none' }} />
        </div>

        {subs.map((s) => (
          <SubRow
            key={s.id}
            sub={s}
            options={options}
            groupColor={groupColor}
            onCommit={(patch) => onCommitSubitem(s.id, patch)}
            onDelete={() => onDeleteSubitem(s.id)}
          />
        ))}

        {subs.length === 0 && (
          <div className="subs-empty">
            No conditions yet.
            <button className="board-btn" onClick={() => onApplyChecklist('Purch')}>Apply Purchase checklist</button>
            <button className="board-btn" onClick={() => onApplyChecklist('Refi')}>Apply Refi checklist</button>
          </div>
        )}

        <div className="subs-add">
          <input
            placeholder="+ Add condition"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                onAddSubitem(e.target.value.trim());
                e.target.value = '';
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
