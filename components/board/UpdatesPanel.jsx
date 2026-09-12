'use client';
import { useState } from 'react';
import { timeAgo, initials } from './columns';

export default function UpdatesPanel({ updates, onPost }) {
  const [draft, setDraft] = useState('');
  const list = updates?.list || [];
  const loading = !!updates?.loading;

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    onPost(body);
    setDraft('');
  };

  return (
    <div className="updates-wrap">
      <div className="updates-box">
        <div className="updates-head">
          <span>Updates{list.length > 0 ? ` (${list.length})` : ''}</span>
        </div>

        <div className="updates-compose">
          <textarea
            value={draft}
            placeholder="Write an update…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
          />
          <button className="board-btn board-btn-primary" onClick={submit} disabled={!draft.trim()}>Update</button>
        </div>

        {loading && list.length === 0 && <div className="files-empty">Loading…</div>}
        {!loading && list.length === 0 && (
          <div className="files-empty">No updates yet. Share progress or a note on this deal.</div>
        )}

        {list.map((u) => {
          const name = u.author?.full_name || u.author?.email || 'Someone';
          return (
            <div key={u.id} className="update-row">
              <span className="update-avatar">{initials(name)}</span>
              <div className="update-body-wrap">
                <div className="update-meta">
                  <span className="update-author">{name}</span>
                  <span className="update-time">{timeAgo(u.created_at)}</span>
                </div>
                <div className="update-body">{u.body}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
