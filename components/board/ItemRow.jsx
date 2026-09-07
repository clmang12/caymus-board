'use client';
import Cell from './Cell';
import SubitemPanel from './SubitemPanel';
import { gridTemplate } from './columns';

const Chevron = ({ open }) => (
  <svg width="11" height="11" viewBox="0 0 12 12" style={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: 'transform .15s' }}>
    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ItemRow({
  item, cols, options, groupColor, onCommit, expanded, onToggleExpand,
  onCommitSubitem, onAddSubitem, onDeleteSubitem, onApplyChecklist,
}) {
  const tmpl = gridTemplate(cols);
  const subs = item.subitems || [];

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
        <SubitemPanel
          subs={subs}
          options={options}
          groupColor={groupColor}
          onCommitSubitem={onCommitSubitem}
          onAddSubitem={onAddSubitem}
          onDeleteSubitem={onDeleteSubitem}
          onApplyChecklist={onApplyChecklist}
        />
      )}
    </div>
  );
}
