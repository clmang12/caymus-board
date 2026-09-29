'use client';
import { useRef, useState } from 'react';
import Cell from './Cell';
import SubitemPanel from './SubitemPanel';
import AttachmentsPanel from './AttachmentsPanel';
import UpdatesPanel from './UpdatesPanel';
import Popover from './Popover';
import SyncedInput from './SyncedInput';
import { conditionProgress, gridTemplate } from './columns';

function formatActivityDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ActivityLog({ item, updates, attachments }) {
  const entries = [
    ...(item.created_at ? [{ id: 'created', label: 'Deal created', date: item.created_at }] : []),
    ...((updates?.list || []).map((update) => ({ id: `update-${update.id}`, label: 'Update posted', detail: update.body, date: update.created_at }))),
    ...((attachments?.list || []).map((file) => ({ id: `file-${file.id}`, label: 'File uploaded', detail: file.filename, date: file.created_at }))),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="activity-log">
      {entries.length === 0 && <div className="activity-empty">No activity yet.<br />Changes to this deal will appear here.</div>}
      {entries.map((entry) => (
        <div key={entry.id} className="activity-row">
          <span className="activity-dot" />
          <div className="activity-copy">
            <div className="activity-meta"><strong>{entry.label}</strong><span>{formatActivityDate(entry.date)}</span></div>
            {entry.detail && <div className="activity-detail">{entry.detail}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

const Chevron = ({ open }) => (
  <svg width="11" height="11" viewBox="0 0 12 12" style={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: 'transform .15s' }}>
    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChatIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 3.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H6l-3 2.5V10.5H3a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
);

export default function ItemRow({
  item, cols, options, groupColor, onCommit, expanded, onToggleExpand,
  onCommitSubitem, onAddSubitem, onDeleteSubitem, onApplyChecklist,
  attachments, onUploadAttachment, onDeleteAttachment, onDownloadAttachment,
  updates, onPostUpdate, onOpenUpdates,
  onDuplicateItem, onDeleteItem,
  onNotify,
  celebrateApproval,
  dragging, dropBefore, onDragStartRow, onDragEndRow, onDragOverRow, onDropRow,
}) {
  const tmpl = gridTemplate(cols);
  const subs = item.subitems || [];
  const menuBtnRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [updatesClosing, setUpdatesClosing] = useState(false);
  const [drawerTab, setDrawerTab] = useState('updates');

  const openUpdates = () => {
    setUpdatesClosing(false);
    setUpdatesOpen(true);
    onOpenUpdates(item.id);
  };

  // Play the slide-out, then unmount (see .updates-drawer.closing in board.css).
  const closeUpdates = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setUpdatesOpen(false);
    else setUpdatesClosing(true);
  };
  const onDrawerAnimationEnd = (e) => {
    if (updatesClosing && e.target === e.currentTarget) { setUpdatesOpen(false); setUpdatesClosing(false); }
  };

  const onDelete = () => {
    if (confirm(`Delete "${item.name}"? It moves to trash and can be restored.`)) {
      onDeleteItem(item.id);
      onNotify?.(`Deleted "${item.name}". Press Undo to restore it.`);
    }
  };

  return (
    <div
      className={'irow-wrap' + (dropBefore ? ' drop-before' : '') + (expanded ? ' row-expanded' : '')}
      style={{ opacity: dragging ? 0.4 : 1, '--group-color': groupColor }}
      onDragOver={(e) => { if (onDragOverRow) { e.preventDefault(); e.stopPropagation(); onDragOverRow(); } }}
      onDrop={(e) => { if (onDropRow) { e.preventDefault(); e.stopPropagation(); onDropRow(); } }}
    >
      <div className="irow" style={{ gridTemplateColumns: tmpl }}>
        {cols.map((col) => {
          if (col.key === 'conditions_progress') {
            const progress = conditionProgress(item, options);
            return (
              <div key={col.key} className="icell center">
                {progress && (
                  <div
                    className="conditions-progress"
                    role="progressbar"
                    aria-label={`${progress.total} conditions: ${progress.statuses.map(({ count, status }) => `${count} ${status}`).join(', ')}`}
                    aria-valuemin={0}
                    aria-valuemax={progress.total}
                    aria-valuenow={progress.accepted}
                    title={progress.statuses.map(({ count, status }) => `${count} ${status}`).join(', ')}
                  >
                    {progress.statuses.map(({ status, count, color }) => (
                      <span key={status} className="conditions-progress-segment" aria-hidden="true" style={{ flex: `${count} 1 0%`, backgroundColor: color }} />
                    ))}
                  </div>
                )}
              </div>
            );
          }
          if (col.key === 'name') {
            return (
              <div key="name" className="icell sticky">
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
                  <SyncedInput
                    className="cell-input"
                    value={item.name}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = item.name; e.currentTarget.blur(); } }}
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== item.name) onCommit({ name: v }); else e.target.value = item.name; }}
                  />
                  {subs.length > 0 && <span className="chip" title={`${subs.length} conditions`}>{subs.length}</span>}
                  <button
                    className={'row-chat-btn' + (updatesOpen ? ' open' : '')}
                    title="Open chat and update history"
                    aria-label={`Open chat and update history for ${item.name}`}
                    onClick={(e) => { e.stopPropagation(); openUpdates(); }}
                  >
                    <ChatIcon />
                  </button>
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
              className={'icell' + (col.align === 'center' ? ' center' : col.align === 'right' ? ' right' : '') + (col.key === 'status' && celebrateApproval ? ' approval-status-cell' : '') + (col.type === 'label' ? '' : '')}
              style={col.type === 'label' ? { padding: 0 } : undefined}>
              <Cell col={col} item={item} options={options} onCommit={onCommit} />
              {col.key === 'status' && celebrateApproval && (
                <div className="approval-confetti" aria-hidden="true">
                  {Array.from({ length: 25 }, (_, index) => (
                    <span key={index} style={{ '--x': `${(index * 37) % 100}%`, '--drift': `${((index * 23) % 56) - 28}px`, '--delay': `${(index % 8) * 35}ms`, '--color': ['#00c875', '#0073ea', '#fdab3d', '#e2445c', '#a25ddc'][index % 5] }} />
                  ))}
                </div>
              )}
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
            onNotify={onNotify}
          />
        </>
      )}

      {updatesOpen && (
        <div className={'updates-drawer-overlay' + (updatesClosing ? ' closing' : '')} onClick={closeUpdates} role="presentation">
          <aside
            className={'updates-drawer' + (updatesClosing ? ' closing' : '')}
            aria-label={`Chat and update history for ${item.name}`}
            onClick={(e) => e.stopPropagation()}
            onAnimationEnd={onDrawerAnimationEnd}
          >
            <div className="updates-drawer-head">
              <button className="updates-drawer-close" title="Close chat" aria-label="Close chat" onClick={closeUpdates}>×</button>
              <div>
                <div className="updates-drawer-title">{item.name}</div>
              </div>
              <span className="updates-drawer-avatar" aria-hidden="true">{item.name?.trim()?.[0]?.toUpperCase() || '?'}</span>
            </div>
            <div className="updates-drawer-tabs" role="tablist" aria-label="Deal details">
              <button className={drawerTab === 'updates' ? 'active' : ''} role="tab" aria-selected={drawerTab === 'updates'} onClick={() => setDrawerTab('updates')}>⌂ <span>Updates</span>{updates?.list?.length > 0 && ` / ${updates.list.length}`}</button>
              <button className={drawerTab === 'files' ? 'active' : ''} role="tab" aria-selected={drawerTab === 'files'} onClick={() => setDrawerTab('files')}>Files</button>
              <button className={drawerTab === 'activity' ? 'active' : ''} role="tab" aria-selected={drawerTab === 'activity'} onClick={() => setDrawerTab('activity')}>Activity Log</button>
            </div>
            <div className="updates-drawer-body">
              {drawerTab === 'updates' && <UpdatesPanel updates={updates} onPost={onPostUpdate} />}
              {drawerTab === 'files' && (
                <AttachmentsPanel
                  attachments={attachments}
                  onUpload={onUploadAttachment}
                  onDelete={onDeleteAttachment}
                  onDownload={onDownloadAttachment}
                />
              )}
              {drawerTab === 'activity' && <ActivityLog item={item} updates={updates} attachments={attachments} />}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
