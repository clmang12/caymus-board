'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Popover from './board/Popover';
import {
  createBoard, renameBoard, duplicateBoard, deleteBoard, reorderBoards,
} from '@/lib/data/boards';

export default function Sidebar({ boards: initial, activeId, user }) {
  const router = useRouter();
  const sb = useRef(createClient()).current;
  const [boards, setBoards] = useState(initial);
  const [editingId, setEditingId] = useState(null);
  const [menu, setMenu] = useState(null); // { id, rect }
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pwAnchor, setPwAnchor] = useState(null);
  const [pwMsg, setPwMsg] = useState(null); // { ok, text }

  useEffect(() => { setBoards(initial); }, [initial]);

  // pick up a "rename this board now" intent left by onNew before navigation
  useEffect(() => {
    let pending;
    try { pending = sessionStorage.getItem('caymus:renameBoard'); } catch {}
    if (pending && initial.some((b) => b.id === pending)) {
      setEditingId(pending);
      try { sessionStorage.removeItem('caymus:renameBoard'); } catch {}
    }
  }, [initial]);

  async function setPassword(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const pw = form.elements.pw.value;
    if (pw.length < 8) return setPwMsg({ ok: false, text: 'Use at least 8 characters.' });
    if (pw !== form.elements.confirm.value) return setPwMsg({ ok: false, text: "Passwords don't match." });
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) return setPwMsg({ ok: false, text: error.message });
    setPwMsg({ ok: true, text: 'Password saved. Use it with your email on the sign-in page.' });
    form.reset();
  }

  async function signOut() {
    await sb.auth.signOut();
    router.push('/login');
  }

  async function run(fn) {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { console.error(e); alert(e.message || 'Something went wrong'); }
    finally { setBusy(false); }
  }

  const onNew = () => run(async () => {
    const created = await createBoard(sb, { name: 'Untitled board', fromBoardId: activeId });
    // stash intent so the freshly navigated Sidebar opens rename inline
    try { sessionStorage.setItem('caymus:renameBoard', created.id); } catch {}
    router.push('/board/' + created.id);
    router.refresh();
  });

  const commitRename = (id, value) => {
    const name = value.trim();
    setEditingId(null);
    const cur = boards.find((b) => b.id === id);
    if (!name || !cur || name === cur.name) return;
    setBoards((bs) => bs.map((b) => (b.id === id ? { ...b, name } : b)));
    run(async () => { await renameBoard(sb, id, name); router.refresh(); });
  };

  const onDuplicate = (id) => run(async () => {
    const newId = await duplicateBoard(sb, id);
    router.push('/board/' + newId);
    router.refresh();
  });

  const onDelete = (id) => {
    const b = boards.find((x) => x.id === id);
    if (boards.length <= 1) { alert("You can't delete the last board."); return; }
    if (!confirm(`Delete "${b?.name}"? It moves to trash and can be restored.`)) return;
    run(async () => {
      await deleteBoard(sb, id);
      const rest = boards.filter((x) => x.id !== id);
      setBoards(rest);
      if (id === activeId) router.push('/board/' + rest[0].id);
      router.refresh();
    });
  };

  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const order = boards.map((b) => b.id).filter((x) => x !== dragId);
    order.splice(order.indexOf(targetId), 0, dragId);
    const next = order.map((id) => boards.find((b) => b.id === id));
    setBoards(next);
    setDragId(null);
    setOverId(null);
    run(async () => { await reorderBoards(sb, order); router.refresh(); });
  };

  return (
    <aside className="sb">
      <div className="sb-brand">CAYMUS</div>
      <div className="sb-label">BOARDS</div>

      <nav className="sb-list">
        {boards.map((b) => {
          const active = b.id === activeId;
          return (
            <div
              key={b.id}
              className={'sb-item' + (active ? ' active' : '') + (overId === b.id && dragId && dragId !== b.id ? ' over' : '')}
              draggable={editingId !== b.id}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragId(b.id); }}
              onDragOver={(e) => { if (dragId && dragId !== b.id) { e.preventDefault(); setOverId(b.id); } }}
              onDrop={(e) => { e.preventDefault(); onDrop(b.id); }}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              onClick={() => { if (editingId !== b.id && !active) router.push('/board/' + b.id); }}
              style={{ opacity: dragId === b.id ? 0.4 : 1 }}
            >
              <span className="sb-dot" />
              {editingId === b.id ? (
                <input
                  className="sb-rename"
                  autoFocus
                  defaultValue={b.name}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => commitRename(b.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') { e.currentTarget.value = b.name; e.currentTarget.blur(); }
                  }}
                />
              ) : (
                <span className="sb-name">{b.name}</span>
              )}
              <button
                className="sb-menu-btn"
                title="Board options"
                onClick={(e) => { e.stopPropagation(); setMenu({ id: b.id, rect: e.currentTarget.getBoundingClientRect() }); }}
              >⋯</button>
            </div>
          );
        })}
      </nav>

      <button className="sb-new" onClick={onNew} disabled={busy}>+ New board</button>

      <div className="sb-foot">
        <div className="sb-email" title={user.email}>{user.email}</div>
        <button className="sb-signout" onClick={(e) => { setPwMsg(null); setPwAnchor(e.currentTarget.getBoundingClientRect()); }}>Set password</button>
        <button className="sb-signout" onClick={signOut}>Sign out</button>
      </div>

      {pwAnchor && (
        <Popover anchorRect={pwAnchor} onClose={() => setPwAnchor(null)} width={240}>
          <form className="sb-pw-form" onSubmit={setPassword}>
            <input type="email" name="username" autoComplete="username" value={user.email} readOnly hidden />
            <input name="pw" type="password" autoComplete="new-password" placeholder="New password" aria-label="New password" required autoFocus />
            <input name="confirm" type="password" autoComplete="new-password" placeholder="Confirm password" aria-label="Confirm password" required />
            <button type="submit">Save password</button>
            {pwMsg && <p className={pwMsg.ok ? 'ok' : 'err'}>{pwMsg.text}</p>}
          </form>
        </Popover>
      )}

      {menu && (
        <Popover anchorRect={menu.rect} onClose={() => setMenu(null)} width={170}>
          <div className="pop-opt" onClick={() => { setEditingId(menu.id); setMenu(null); }}>Rename</div>
          <div className="pop-opt" onClick={() => { onDuplicate(menu.id); setMenu(null); }}>Duplicate</div>
          <div className="pop-opt" style={{ color: '#df2f4a' }} onClick={() => { onDelete(menu.id); setMenu(null); }}>Delete</div>
        </Popover>
      )}
    </aside>
  );
}
