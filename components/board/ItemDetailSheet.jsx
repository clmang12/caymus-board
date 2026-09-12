'use client';
import { useRef, useState } from 'react';
import Cell from './Cell';
import SubitemPanel from './SubitemPanel';
import AttachmentsPanel from './AttachmentsPanel';
import Popover from './Popover';

// Mobile counterpart to a grid row: same Cell/SubitemPanel/AttachmentsPanel
// components as the desktop grid, stacked into one scrollable sheet.
export default function ItemDetailSheet({
  item, cols, options, groupColor, onClose, onCommit,
  onCommitSubitem, onAddSubitem, onDeleteSubitem, onApplyChecklist,
  attachments, onUploadAttachment, onDeleteAttachment, onDownloadAttachment,
  onDuplicateItem, onDeleteItem,
}) {
  const fieldCols = cols.filter((c) => c.key !== 'name');
  const subs = item.subitems || [];
  const menuBtnRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const onDelete = () => {
    if (confirm(`Delete "${item.name}"? It moves to trash and can be restored.`)) {
      onClose();
      onDeleteItem(item.id);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="msheet" onClick={(e) => e.stopPropagation()} style={{ borderTop: `4px solid ${groupColor}` }}>
        <div className="msheet-head">
          <input
            className="msheet-name"
            defaultValue={item.name}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') { e.currentTarget.value = item.name; e.currentTarget.blur(); }
            }}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== item.name) onCommit({ name: v }); else e.target.value = item.name;
            }}
          />
          <button
            ref={menuBtnRef}
            className={'sb-menu-btn' + (menuOpen ? ' open' : '')}
            style={{ opacity: 1 }}
            title="Deal options"
            onClick={() => setMenuOpen(true)}
          >⋯</button>
          <button onClick={onClose}>✕</button>
        </div>
        {menuOpen && (
          <Popover anchorRect={menuBtnRef.current.getBoundingClientRect()} onClose={() => setMenuOpen(false)} width={170}>
            <div className="pop-opt" onClick={() => { setMenuOpen(false); onDuplicateItem(item.id); }}>Duplicate</div>
            <div className="pop-opt" style={{ color: '#df2f4a' }} onClick={onDelete}>Delete</div>
          </Popover>
        )}
        <div className="msheet-body">
          {fieldCols.map((col) => (
            <div key={col.key} className="msheet-field">
              <span className="msheet-label">{col.label}</span>
              <div className="msheet-value">
                <Cell col={col} item={item} options={options} onCommit={onCommit} />
              </div>
            </div>
          ))}

          <div className="msheet-scroll-x">
            <SubitemPanel
              subs={subs}
              options={options}
              groupColor={groupColor}
              onCommitSubitem={onCommitSubitem}
              onAddSubitem={onAddSubitem}
              onDeleteSubitem={onDeleteSubitem}
              onApplyChecklist={onApplyChecklist}
            />
          </div>
          <div className="msheet-scroll-x">
            <AttachmentsPanel
              attachments={attachments}
              onUpload={onUploadAttachment}
              onDelete={onDeleteAttachment}
              onDownload={onDownloadAttachment}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
