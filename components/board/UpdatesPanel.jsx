'use client';
import { useRef, useState } from 'react';
import { timeAgo, initials } from './columns';
import Popover from './Popover';
import RichEditor from './RichEditor';
import UpdateBody from './UpdateBody';
import { isRichText, sanitizeHtml, textToHtml } from '@/lib/richtext';

function UpdateRow({ update, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef(null);
  const name = update.author?.full_name || update.author?.email || 'Someone';

  const remove = () => {
    setMenuOpen(false);
    if (confirm('Delete this update? It moves to trash and can be restored.')) onDelete(update);
  };

  return (
    <div className={'update-row' + (editing ? ' editing' : '')}>
      <span className="update-avatar">{initials(name)}</span>
      <div className="update-body-wrap">
        <div className="update-meta">
          <span className="update-author">{name}</span>
          <span className="update-time">{timeAgo(update.created_at)}</span>
          {!editing && (
            <button
              ref={menuBtnRef}
              type="button"
              className={'update-menu-btn' + (menuOpen ? ' open' : '')}
              title="Update options"
              aria-label="Update options"
              onClick={() => setMenuOpen(true)}
            >⋯</button>
          )}
          {menuOpen && (
            <Popover anchorRect={menuBtnRef.current.getBoundingClientRect()} onClose={() => setMenuOpen(false)} width={150}>
              <div className="pop-opt" onClick={() => { setMenuOpen(false); setEditing(true); }}>Edit</div>
              <div className="pop-opt" style={{ color: '#df2f4a' }} onClick={remove}>Delete</div>
            </Popover>
          )}
        </div>
        {editing ? (
          <RichEditor
            initialHtml={isRichText(update.body) ? sanitizeHtml(update.body) : textToHtml(update.body)}
            placeholder="Edit update"
            submitLabel="Save"
            autoFocus
            onCancel={() => setEditing(false)}
            onSubmit={(body) => { if (body !== update.body) onEdit(update, body); setEditing(false); }}
          />
        ) : (
          <UpdateBody body={update.body} />
        )}
      </div>
    </div>
  );
}

export default function UpdatesPanel({ updates, onPost, onEdit, onDelete }) {
  const list = updates?.list || [];
  const loading = !!updates?.loading;

  return (
    <div className="updates-wrap">
      <div className="updates-box">
        <div className="updates-head">
          <span>Updates{list.length > 0 ? ` (${list.length})` : ''}</span>
        </div>

        <div className="updates-compose">
          <RichEditor placeholder="Write an update and mention others with @" onSubmit={onPost} />
        </div>

        {loading && list.length === 0 && <div className="files-empty">Loading…</div>}
        {!loading && list.length === 0 && (
          <div className="files-empty">No updates yet. Share progress or a note on this deal.</div>
        )}

        {list.map((u) => <UpdateRow key={u.id} update={u} onEdit={onEdit} onDelete={onDelete} />)}
      </div>
    </div>
  );
}
