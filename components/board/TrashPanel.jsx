'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listBoards } from '@/lib/data/boards';
import { listTrash, restoreFromTrash, deleteFromTrash, emptyTrash } from '@/lib/data/trash';
import { timeAgo } from './columns';

const KIND_LABEL = { item: 'Deal', condition: 'Condition', update: 'Update' };
const KIND_ICON = { board: '📋', item: '📄', condition: '☑️', update: '💬' };

export default function TrashPanel({ sb, onClose }) {
  const router = useRouter();
  const [rows, setRows] = useState(null);
  const [boardNames, setBoardNames] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [trash, boards] = await Promise.all([listTrash(sb), listBoards(sb)]);
      setRows(trash);
      setBoardNames(Object.fromEntries(boards.map((b) => [b.id, b.name])));
    } catch (e) {
      setError(e.message || 'Could not load the trash');
      setRows([]);
    }
  }, [sb]);

  useEffect(() => { load(); }, [load]);

  const run = async (key, fn, refresh) => {
    setBusy(key);
    setError('');
    try {
      await fn();
      await load();
      if (refresh) router.refresh();
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const restore = (r) => run(r.id, () => restoreFromTrash(sb, r.id), true);
  const purge = (r) => {
    if (confirm(`Permanently delete "${r.name}"? This can't be undone.`)) run(r.id, () => deleteFromTrash(sb, r.id));
  };
  const purgeAll = () => {
    if (confirm(`Permanently delete all ${rows.length} items in the trash? This can't be undone.`)) run('all', () => emptyTrash(sb));
  };

  const meta = (r) => (r.kind === 'board'
    ? 'Board'
    : `${KIND_LABEL[r.kind] || 'Deal'} · ${boardNames[r.board_id] || 'board deleted'}`)
    + ` · deleted ${timeAgo(r.deleted_at)}${r.via ? ` by ${r.via}` : ''}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>🗑 Trash</span>
          {rows?.length > 0 && (
            <button className="trash-empty-all" onClick={purgeAll} disabled={!!busy}>Empty trash</button>
          )}
          <button onClick={onClose}>✕</button>
        </div>
        {error && <div className="trash-error">{error}</div>}
        <div className="modal-body">
          {rows === null && <div className="trash-empty">Loading…</div>}
          {rows?.length === 0 && <div className="trash-empty">Trash is empty. Deleted deals and boards show up here, as do conditions and updates deleted by an AI assistant.</div>}
          {rows?.map((r) => (
            <div key={r.id} className="trash-row">
              <span className="trash-icon">{KIND_ICON[r.kind] || '📄'}</span>
              <div className="trash-text">
                <div className="trash-name">{r.name}</div>
                <div className="trash-meta">{meta(r)}</div>
              </div>
              <button className="board-btn" onClick={() => restore(r)} disabled={!!busy}>
                {busy === r.id ? 'Working…' : 'Restore'}
              </button>
              <button className="sub-del" title="Delete forever" onClick={() => purge(r)} disabled={!!busy}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
