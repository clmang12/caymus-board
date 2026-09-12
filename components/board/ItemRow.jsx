'use client';
import { useRef, useState } from 'react';
import Cell from './Cell';
import SubitemPanel from './SubitemPanel';
import AttachmentsPanel from './AttachmentsPanel';
import UpdatesPanel from './UpdatesPanel';
import Popover from './Popover';
import { gridTemplate } from './columns';

const Chevron = ({ open }) => (
  <svg width="11" height="11" viewBox="0 0 12 12" style={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: 'transform .15s' }}>
    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ItemRow({
  item, cols, options, groupColor, onCommit, expanded, onToggleExpand,
  onCommitSubitem, onAddSubitem, onDeleteSubitem, onApplyChecklist,
  attachments, onUploadAttachment, onDeleteAttachment, onDownloadAttachment,
  updates, onPostUpdate,
  onDuplicateItem, onDeleteItem,
  dragging, dropBefore, onDragStartRow, onDragEndRow, onDragOverRow, onDropRow,
}) {
  const tmpl = gridTemplate(cols);
  const subs = item.subitems || [];
  const menuBtnRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const onDelete = () => {
    if (confirm(`Delete "${item.name}"? It moves to trash and can be restored.`)) onDeleteItem(item.id);
  };

  return (
    <div
      className={'irow-wrap' + (dropBefore ? ' drop-before' : '')}
      style={{ opacity: dragging ? 0.4 : 1 }}
      onDragOver={(e) => { if (onDragOverRow) { e.preventDefault(); e.stopPropagation(); onDragOverRow(); } }}
      onDrop={(e) => { if (onDropRow) { e.preventDefault(); e.stopPropagation(); onDropRow(); } }}
    >
      <div className="irow" style={{ gridTemplateColumns: tmpl }}>
        {cols.map((col) => {
          if (col.key === 'name') {
            return (
              <div key="name" className="icell sticky" style={{ borderLeft: `5px solid ${groupColor}` }}>
                <div className="name-cell" style={{ width: '100%' }}>
                  <span
                    className="row-drag"
                    title="Drag to move deal"
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStartRow(); }}
                    onDragEnd={onDragEndRow}
                  >⠿</span>
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
                  <button
                    ref={menuBtnRef}
                    className={'sb-menu-btn row-menu-btn' + (menuOpen ? ' open' : '')}
                    title="Deal options"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
                  >⋯</button>
                  {menuOpen && (
                    <Popover anchorRect={menuBtnRef.current.getBoundingClientRect()} onClose={() => setMenuOpen(false)} width={170}>
                      <div className="pop-opt" onClick={() => { setMenuOpen(false); onDuplicateItem(item.id); }}>Duplicate</div>
                      <div className="pop-opt" style={{ color: '#df2f4a' }} onClick={() => { setMenuOpen(false); onDelete(); }}>Delete</div>
                    </Popover>
                  )}
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
        <>
          <SubitemPanel
            subs={subs}
            options={options}
            groupColor={groupColor}
            onCommitSubitem={onCommitSubitem}
            onAddSubitem={onAddSubitem}
            onDeleteSubitem={onDeleteSubitem}
            onApplyChecklist={onApplyChecklist}
          />
          <AttachmentsPanel
            attachments={attachments}
            onUpload={onUploadAttachment}
            onDelete={onDeleteAttachment}
            onDownload={onDownloadAttachment}
          />
          <UpdatesPanel updates={updates} onPost={onPostUpdate} />
        </>
      )}
    </div>
  );
}
