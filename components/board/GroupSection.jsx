'use client';
import { useRef, useState } from 'react';
import ItemRow from './ItemRow';
import { gridTemplate, fmtCurrency, MIN_COL_WIDTH, softColor } from './columns';

const Chevron = ({ open, color }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: 'transform .15s', color }}>
    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function GroupSection({
  group, cols, options, collapsed, onToggleCollapsed,
  onCommitItem, onResizeColumn, onResizeEnd, onReorderColumns,
  sort, onSort, expandedIds, onToggleExpand, onAddItem,
  onCommitSubitem, onAddSubitem, onDeleteSubitem, onApplyChecklist,
}) {
  const [dragKey, setDragKey] = useState(null);
  const [overKey, setOverKey] = useState(null);
  const resizing = useRef(null);
  const tmpl = gridTemplate(cols);
  const open = !collapsed;
  const items = group.items || [];
  const volSum = items.reduce((a, it) => a + (Number(it.volume) || 0), 0);

  const startResize = (key, e) => {
    e.preventDefault();
    e.stopPropagation();
    const col = cols.find((c) => c.key === key);
    resizing.current = { key, startX: e.clientX, startW: col.width };
    const move = (ev) => {
      if (!resizing.current) return;
      const w = Math.max(MIN_COL_WIDTH, resizing.current.startW + (ev.clientX - resizing.current.startX));
      onResizeColumn(resizing.current.key, w);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (resizing.current) { onResizeEnd(); resizing.current = null; }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <section className="grp">
      <div className="grp-head">
        <button className="grp-toggle" onClick={() => onToggleCollapsed(group.id)} style={{ color: group.color }}>
          <Chevron open={open} color={group.color} />
        </button>
        <span className="grp-title" style={{ color: group.color }}>{group.title}</span>
        <span className="grp-count">{items.length === 1 ? '1 item' : `${items.length} items`}</span>
      </div>

      {open && (
        <div className="grid-box" style={{ borderColor: softColor(group.color), borderLeft: `4px solid ${group.color}` }}>
          {/* header */}
          <div className="hrow" style={{ gridTemplateColumns: tmpl }}>
            {cols.map((col) => {
              const active = sort?.key === col.key;
              return (
                <div
                  key={col.key}
                  className={'hcell' + (col.sticky ? ' sticky' : '') + (overKey === col.key && dragKey && dragKey !== col.key ? ' dragover' : '')}
                  style={{ textAlign: col.align, paddingLeft: col.sticky ? 16 : 10 }}
                  draggable={!col.sticky}
                  onDragStart={(e) => { if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; setDragKey(col.key); }}
                  onDragOver={(e) => { if (dragKey && dragKey !== col.key) { e.preventDefault(); setOverKey(col.key); } }}
                  onDrop={(e) => { e.preventDefault(); if (dragKey && dragKey !== col.key) onReorderColumns(dragKey, col.key); setDragKey(null); setOverKey(null); }}
                  onDragEnd={() => { setDragKey(null); setOverKey(null); }}
                  onClick={() => onSort(col.key)}
                  title="Click to sort, drag to reorder"
                >
                  {col.label}
                  {active && <span style={{ color: 'var(--blue)', fontSize: 9, marginLeft: 4 }}>{sort.dir === 1 ? '▲' : '▼'}</span>}
                  <span className="hcell-resize" title="Drag to resize"
                    onMouseDown={(e) => startResize(col.key, e)} onClick={(e) => e.stopPropagation()} />
                </div>
              );
            })}
          </div>

          {/* rows */}
          {items.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              cols={cols}
              options={options}
              groupColor={group.color}
              onCommit={(patch) => onCommitItem(it.id, patch)}
              expanded={expandedIds.has(it.id)}
              onToggleExpand={() => onToggleExpand(it.id)}
              onCommitSubitem={(subId, patch) => onCommitSubitem(it.id, subId, patch)}
              onAddSubitem={(name) => onAddSubitem(it.id, name)}
              onDeleteSubitem={(subId) => onDeleteSubitem(it.id, subId)}
              onApplyChecklist={(deal) => onApplyChecklist(it.id, deal)}
            />
          ))}
          {items.length === 0 && (
            <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--tx3)' }}>No deals in this group.</div>
          )}

          {/* add deal */}
          <div className="add-row">
            <input
              placeholder="+ Add deal"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) { onAddItem(group.id, e.target.value.trim()); e.target.value = ''; }
              }}
            />
          </div>

          {/* sum */}
          {volSum > 0 && (
            <div className="sum-row" style={{ gridTemplateColumns: tmpl }}>
              {cols.map((col) => (
                <div key={col.key} className="sum-cell" style={{ borderRight: 'none' }}>
                  {col.key === 'volume' && (<><b>{fmtCurrency(volSum)}</b><span>SUM</span></>)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
