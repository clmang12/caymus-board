'use client';
import Cell from './Cell';
import { gridTemplate, labelColor, fmtDate, itemProgress, EMPTY_COLOR } from './columns';

const Chevron = ({ open }) => (
  <svg width="11" height="11" viewBox="0 0 12 12" style={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: 'transform .15s' }}>
    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ItemRow({ item, cols, options, groupColor, onCommit, expanded, onToggleExpand }) {
  const tmpl = gridTemplate(cols);
  const subs = item.subitems || [];
  const prog = itemProgress(item);

  return (
    <div>
      <div className="irow" style={{ gridTemplateColumns: tmpl }}>
        {cols.map((col) => {
          if (col.key === 'name') {
            return (
              <div key="name" className="icell sticky" style={{ borderLeft: `5px solid ${groupColor}` }}>
                <div className="name-cell" style={{ width: '100%' }}>
                  <button className="name-expand" title="Conditions" onClick={onToggleExpand}>
                    <Chevron open={expanded} />
                  </button>
                  <input
                    className="cell-input"
                    defaultValue={item.name}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = item.name; e.currentTarget.blur(); } }}
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== item.name) onCommit({ name: v }); else e.target.value = item.name; }}
                  />
                  {subs.length > 0 && <span className="chip" title={`${subs.length} conditions`}>{subs.length}</span>}
                </div>
              </div>
            );
          }
          return (
            <div key={col.key}
              className={'icell' + (col.align === 'center' ? ' center' : col.align === 'right' ? ' right' : '') + (col.type === 'label' ? '' : '')}
              style={col.type === 'label' ? { padding: 0 } : undefined}>
              <Cell col={col} item={item} options={options} onCommit={onCommit} />
            </div>
          );
        })}
      </div>

      {expanded && (
        <div className="subs-wrap">
          {subs.length > 0 && (
            <div className="subs-progress" title={`${prog}% complete`}>
              <div style={{ width: `${(subs.filter((s) => s.cond === 'Accepted').length / subs.length) * 100}%` }} />
            </div>
          )}
          <div className="subs-box">
            <div className="subs-head">
              <div>Condition / Document</div>
              <div style={{ textAlign: 'center' }}>Status</div>
              <div style={{ textAlign: 'center' }}>Date</div>
              <div style={{ borderRight: 'none' }}>Details</div>
            </div>
            {subs.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--tx3)' }}>No conditions on this deal.</div>
            )}
            {subs.map((s) => (
              <div key={s.id} className="subs-row">
                <div style={{ borderLeft: `5px solid ${groupColor}` }}>{s.name}</div>
                <div style={{ justifyContent: 'center', padding: 0 }}>
                  <span className="label-fill" style={{ background: labelColor(options, 'cond', s.cond), color: '#fff', fontSize: 12 }}>
                    {s.cond || '–'}
                  </span>
                </div>
                <div style={{ justifyContent: 'center', color: s.due_date ? 'var(--tx)' : 'var(--tx3)' }}>
                  {fmtDate(s.due_date) || '–'}
                </div>
                <div style={{ borderRight: 'none', color: s.details ? 'var(--tx)' : 'var(--tx3)' }}>{s.details || '–'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
