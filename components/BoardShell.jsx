'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { subscribeToBoard } from '@/lib/data/realtime';
import { updateItem } from '@/lib/data/boards';
import Sidebar from './Sidebar';

// Minimal but working board view: reads from Postgres, edits persist,
// realtime keeps other clients current. Replace the grid below with the
// full 14-column layout — see PORTING.md item 1.
export default function BoardShell({ user, boards, board, options }) {
  const sb = useMemo(() => createClient(), []);
  const [tree, setTree] = useState(board);

  useEffect(() => setTree(board), [board]);

  useEffect(() => {
    return subscribeToBoard(sb, board.id, ({ table, row }) => {
      if (table !== 'items' || !row) return;
      setTree((t) => ({
        ...t,
        groups: t.groups.map((g) => ({
          ...g,
          items: g.items.map((it) => (it.id === row.id ? { ...it, ...row } : it))
        }))
      }));
    });
  }, [sb, board.id]);

  async function commit(itemId, patch) {
    setTree((t) => ({
      ...t,
      groups: t.groups.map((g) => ({
        ...g,
        items: g.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it))
      }))
    }));
    try { await updateItem(sb, itemId, patch); }
    catch (e) { console.error('Save failed', e); }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar boards={boards} activeId={board.id} user={user} />

      <main style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 2px' }}>{tree.name}</h1>
        <p style={{ fontSize: 13, color: '#676879', margin: '0 0 20px' }}>
          {tree.description}
        </p>

        {tree.groups.map((g) => (
          <section key={g.id} style={{ marginBottom: 26 }}>
            <h2 style={{
              fontSize: 15, fontWeight: 700, color: g.color, margin: '0 0 8px'
            }}>{g.title}</h2>

            <div style={{
              border: '1px solid #e6e9ef', borderRadius: 8, overflow: 'hidden'
            }}>
              {g.items.map((it, i) => (
                <div key={it.id} style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,2fr) 110px 90px 110px 110px',
                  gap: 12, alignItems: 'center', padding: '9px 12px', fontSize: 13,
                  borderTop: i ? '1px solid #f0f2f7' : 'none'
                }}>
                  <input
                    defaultValue={it.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== it.name) commit(it.id, { name: v });
                    }}
                    style={{
                      border: 'none', outline: 'none', fontFamily: 'inherit',
                      fontSize: 13, fontWeight: 500, background: 'transparent',
                      minWidth: 0, padding: '2px 4px'
                    }}
                  />
                  <span style={{ color: '#676879' }}>{it.agent ?? '—'}</span>
                  <span style={{ color: '#676879' }}>{it.deal ?? '—'}</span>
                  <span style={{ color: '#676879' }}>{it.status ?? '—'}</span>
                  <span style={{ color: '#676879' }}>{it.close_date ?? '—'}</span>
                </div>
              ))}
              {!g.items.length && (
                <div style={{ padding: '14px 12px', fontSize: 13, color: '#a0a3bd' }}>
                  No deals in this group.
                </div>
              )}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
