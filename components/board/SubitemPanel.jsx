'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import Popover from './Popover';
import SyncedInput from './SyncedInput';
import { labelColor, optionList, EMPTY_COLOR } from './columns';

const commitOnEnter = (e) => {
  if (e.key === 'Enter') e.currentTarget.blur();
  if (e.key === 'Escape') { e.currentTarget.value = e.currentTarget.defaultValue; e.currentTarget.blur(); }
};

const COLUMN_DEFS = [
  { key: 'check', label: '', width: 48, min: 32 },
  { key: 'name', label: 'Conditions', width: 330, min: 220 },
  { key: 'status', label: 'Condition Status', width: 240, min: 180 },
  { key: 'date', label: 'Date', width: 120, min: 80 },
  { key: 'notes', label: 'Notes', width: 220, min: 140 },
  { key: 'due', label: 'Due Date', width: 130, min: 100 },
];
const DEFAULT_ORDER = COLUMN_DEFS.map((column) => column.key);
const DEFAULT_WIDTHS = Object.fromEntries(COLUMN_DEFS.map((column) => [column.key, column.width]));

function SubRow({ sub, options, groupColor, onCommit, onDelete, onNotify, isSelected, onToggleSelect, columnOrder, gridTemplateColumns }) {
  const [anchor, setAnchor] = useState(null);
  const [detailsAnchor, setDetailsAnchor] = useState(null);
  const color = labelColor(options, 'cond', sub.cond);

  const cells = {
    check: (
      <div className="sub-check" style={{ borderLeft: `5px solid ${groupColor}` }}>
        <input
          type="checkbox"
          checked={isSelected}
          readOnly
          aria-label={`Select ${sub.name}`}
          onMouseDown={(e) => { e.preventDefault(); onToggleSelect(sub.id, e.shiftKey); }}
          onClick={(e) => e.preventDefault()}
        />
      </div>
    ),
    name: (
      <div className="sub-name-cell">
        <SyncedInput
          className="sub-input"
          value={sub.name}
          onKeyDown={commitOnEnter}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== sub.name) onCommit({ name: v });
            else e.target.value = sub.name;
          }}
        />
        <span className="sub-name-actions">
          <button
            className={'sub-comment' + (sub.details ? ' has-details' : '')}
            title={sub.details || 'Add details'}
            aria-label={sub.details ? 'Edit details' : 'Add details'}
            onClick={(e) => { e.stopPropagation(); setDetailsAnchor(e.currentTarget.getBoundingClientRect()); }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5.25 3.5h9.5c.97 0 1.75.78 1.75 1.75v6c0 .97-.78 1.75-1.75 1.75H10l-3.4 2.25V13H5.25c-.97 0-1.75-.78-1.75-1.75v-6c0-.97.78-1.75 1.75-1.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M10 6.75v3.5M8.25 8.5h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <button className="sub-del" title="Delete condition" onClick={(e) => { e.stopPropagation(); onDelete(); onNotify?.(`Deleted condition "${sub.name}". Press Undo to restore it.`); }}>✕</button>
        </span>
      </div>
    ),
    date: (
      <div className="sub-date-cell" title="Set automatically when the condition status changes">
        <input type="date" className="sub-date" aria-label={`Status date for ${sub.name}`} value={sub.cond_date ?? ''} onChange={(e) => onCommit({ cond_date: e.target.value || null })} />
      </div>
    ),
    notes: (
      <div style={{ padding: '0 4px' }}>
        <SyncedInput
          className="sub-input"
          value={sub.details ?? ''}
          placeholder="–"
          onKeyDown={commitOnEnter}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (sub.details ?? '')) onCommit({ details: v || null });
          }}
        />
      </div>
    ),
    due: (
      <div className="sub-date-cell">
        <input type="date" className="sub-date" aria-label={`Due date for ${sub.name}`} value={sub.due_date ?? ''} onChange={(e) => onCommit({ due_date: e.target.value || null })} />
      </div>
    ),
    status: (
      <div
        className="sub-cond sub-status"
        style={{ background: sub.cond ? color : 'transparent', color: sub.cond ? '#fff' : 'var(--tx3)' }}
        onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
      >
        <span>{sub.cond || '–'}</span>
      </div>
    ),
  };

  return (
    <div className={'subs-row' + (isSelected ? ' selected' : '')} style={{ gridTemplateColumns }}>
      {columnOrder.map((key) => <Fragment key={key}>{cells[key]}</Fragment>)}

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
      {detailsAnchor && (
        <Popover anchorRect={detailsAnchor} onClose={() => setDetailsAnchor(null)} width={260}>
          <div className="sub-details-popover">
            <label>Details</label>
            <SyncedInput
              className="sub-input"
              value={sub.details ?? ''}
              placeholder="Add details"
              onKeyDown={commitOnEnter}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (sub.details ?? '')) onCommit({ details: v || null });
                setDetailsAnchor(null);
              }}
            />
          </div>
        </Popover>
      )}
    </div>
  );
}

export default function SubitemPanel({
  subs, options, groupColor,
  onCommitSubitem, onAddSubitem, onDeleteSubitem, onApplyChecklist, onNotify,
}) {
  const done = subs.filter((s) => s.cond === 'Accepted').length;
  const [widths, setWidths] = useState(DEFAULT_WIDTHS);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_ORDER);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const resizing = useRef(null);
  const lastSelectedId = useRef(null);
  const selectAllRef = useRef(null);
  const [dragColumn, setDragColumn] = useState(null);
  useEffect(() => {
    if (widths.length !== DEFAULT_ORDER.length) setWidths(DEFAULT_WIDTHS);
    if (columnOrder.length !== DEFAULT_ORDER.length || columnOrder.some((key) => !DEFAULT_ORDER.includes(key))) setColumnOrder(DEFAULT_ORDER);
  }, [widths.length, columnOrder]);
  const gridTemplateColumns = columnOrder.map((key) => `${widths[key]}px`).join(' ');
  const allSelected = subs.length > 0 && subs.every((sub) => selectedIds.has(sub.id));
  const someSelected = subs.some((sub) => selectedIds.has(sub.id));

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  const startResize = (key, event) => {
    event.preventDefault();
    event.stopPropagation();
    resizing.current = { key, startX: event.clientX, startWidth: widths[key] };
    const move = (moveEvent) => {
      if (!resizing.current) return;
      const { key: activeKey, startX, startWidth } = resizing.current;
      const min = COLUMN_DEFS.find((column) => column.key === activeKey).min;
      const next = Math.max(min, startWidth + moveEvent.clientX - startX);
      setWidths((current) => ({ ...current, [activeKey]: next }));
    };
    const stop = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
      resizing.current = null;
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
  };

  const moveColumn = (key) => {
    if (!dragColumn || dragColumn === key) return;
    setColumnOrder((current) => {
      const next = current.filter((columnKey) => columnKey !== dragColumn);
      const targetIndex = next.indexOf(key);
      next.splice(targetIndex < 0 ? next.length : targetIndex, 0, dragColumn);
      return next;
    });
    setDragColumn(null);
  };

  const toggleSelect = (itemId, range) => {
    const anchorId = lastSelectedId.current;
    lastSelectedId.current = itemId;
    setSelectedIds((current) => {
      const next = new Set(current);
      const clickedIndex = subs.findIndex((sub) => sub.id === itemId);
      const anchorIndex = anchorId ? subs.findIndex((sub) => sub.id === anchorId) : -1;
      if (range && clickedIndex >= 0 && anchorIndex >= 0) {
        const start = Math.min(clickedIndex, anchorIndex);
        const end = Math.max(clickedIndex, anchorIndex);
        subs.slice(start, end + 1).forEach((sub) => next.add(sub.id));
      } else if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(subs.map((sub) => sub.id)));
    lastSelectedId.current = null;
  };

  const targetsFor = (itemId) => selectedIds.has(itemId) ? [...selectedIds] : [itemId];

  return (
    <div className="subs-wrap">
      {subs.length > 0 && (
        <div className="subs-progress" title={`${done}/${subs.length} accepted`}>
          <div style={{ width: `${(done / subs.length) * 100}%` }} />
        </div>
      )}
      <div className="subs-box">
        <div className="subs-head" style={{ gridTemplateColumns }}>
          {columnOrder.map((key, index) => {
            const column = COLUMN_DEFS.find((candidate) => candidate.key === key);
            return (
            <div
              key={key}
              className={key === 'check' ? 'sub-check-head' : undefined}
              draggable
              onDragStart={() => setDragColumn(key)}
              onDragOver={(event) => { if (dragColumn && dragColumn !== key) event.preventDefault(); }}
              onDrop={() => moveColumn(key)}
              onDragEnd={() => setDragColumn(null)}
              style={{
                textAlign: key === 'status' ? 'center' : undefined,
                borderLeft: key === 'check' ? `5px solid ${groupColor}` : undefined,
                borderRight: index === columnOrder.length - 1 ? 'none' : undefined,
              }}
            >
              {key === 'check' ? (
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  aria-label="Select all conditions"
                  onChange={toggleAll}
                  onClick={(event) => event.stopPropagation()}
                />
              ) : column.label}
              <span className="subs-resize" title="Drag to resize" onMouseDown={(event) => startResize(key, event)} />
            </div>
            );
          })}
        </div>

        {subs.map((s) => (
          <SubRow
            key={s.id}
            sub={s}
            options={options}
            groupColor={groupColor}
            columnOrder={columnOrder}
            gridTemplateColumns={gridTemplateColumns}
            isSelected={selectedIds.has(s.id)}
            onToggleSelect={toggleSelect}
            onNotify={onNotify}
            onCommit={(patch) => targetsFor(s.id).forEach((targetId) => onCommitSubitem(targetId, patch))}
            onDelete={() => targetsFor(s.id).forEach((targetId) => onDeleteSubitem(targetId))}
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
