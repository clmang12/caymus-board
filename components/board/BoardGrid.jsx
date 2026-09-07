'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { subscribeToBoard } from '@/lib/data/realtime';
import { updateItem, createItem } from '@/lib/data/boards';
import { addSubitem, updateSubitem, deleteSubitem, applyTemplate } from '@/lib/data/subitems';
import { savePrefs } from '@/lib/data/prefs';
import GroupSection from './GroupSection';
import { resolveColumns, DEFAULT_ORDER } from './columns';
import './board.css';

const SEARCH_FIELDS = ['name', 'agent', 'deal', 'status', 'appraiser', 'broker', 'compliance', 'notes', 'email'];

function matchesSearch(item, q) {
  if (!q) return true;
  const hay = [
    ...SEARCH_FIELDS.map((f) => item[f] || ''),
    (item.lender || []).join(' '),
    ...(item.subitems || []).map((s) => s.name),
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

function sortItems(items, sort) {
  if (!sort) return items;
  const val = (it) => {
    let v = it[sort.key];
    if (Array.isArray(v)) v = v.join(', ');
    if (sort.key === 'volume') return v == null ? null : Number(v);
    return v == null || v === '' ? null : String(v).toLowerCase();
  };
  return [...items].sort((a, b) => {
    const av = val(a), bv = val(b);
    if (av === bv) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av < bv ? -1 : 1) * sort.dir;
  });
}

export default function BoardGrid({ user, board, options, prefs }) {
  const sb = useMemo(() => createClient(), []);
  const [tree, setTree] = useState(board);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [prefsState, setPrefsState] = useState(() => ({
    colWidths: prefs?.colWidths || {},
    colOrder: prefs?.colOrder || DEFAULT_ORDER,
    collapsed: prefs?.collapsed || {},
  }));

  useEffect(() => { setTree(board); }, [board]);

  const cols = useMemo(() => resolveColumns(prefsState), [prefsState]);

  // ---- persistence (debounced) ----
  const saveTimer = useRef(null);
  const persist = useCallback((next) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePrefs(sb, user.id, board.id, next).catch((e) => console.error('savePrefs failed', e));
    }, 400);
  }, [sb, user.id, board.id]);

  // ---- realtime ----
  useEffect(() => {
    return subscribeToBoard(sb, board.id, ({ table, event, row }) => {
      if (!row) return;
      setTree((t) => {
        if (table === 'items') {
          if (event === 'DELETE') {
            return { ...t, groups: t.groups.map((g) => ({ ...g, items: g.items.filter((it) => it.id !== row.id) })) };
          }
          let found = false;
          const groups = t.groups.map((g) => ({
            ...g,
            items: g.items.flatMap((it) => {
              if (it.id !== row.id) return [it];
              found = true;
              return g.id === row.group_id ? [{ ...it, ...row }] : [];
            }),
          }));
          if (!found) {
            const gi = groups.findIndex((g) => g.id === row.group_id);
            if (gi >= 0) groups[gi] = { ...groups[gi], items: [...groups[gi].items, { ...row, subitems: [] }] };
          } else {
            const gi = groups.findIndex((g) => g.id === row.group_id);
            if (gi >= 0 && !groups[gi].items.some((it) => it.id === row.id)) {
              groups[gi] = { ...groups[gi], items: [...groups[gi].items, { ...row, subitems: [] }] };
            }
          }
          return { ...t, groups };
        }
        if (table === 'subitems') {
          return {
            ...t,
            groups: t.groups.map((g) => ({
              ...g,
              items: g.items.map((it) => {
                if (it.id !== row.item_id) return it;
                const subitems = event === 'DELETE'
                  ? (it.subitems || []).filter((s) => s.id !== row.id)
                  : (it.subitems || []).some((s) => s.id === row.id)
                    ? (it.subitems || []).map((s) => (s.id === row.id ? { ...s, ...row } : s))
                    : [...(it.subitems || []), row];
                return { ...it, subitems: subitems.sort((a, b) => a.position - b.position) };
              }),
            })),
          };
        }
        if (table === 'groups') {
          return { ...t, groups: t.groups.map((g) => (g.id === row.id ? { ...g, ...row } : g)) };
        }
        return t;
      });
    });
  }, [sb, board.id]);

  // ---- item mutations (optimistic) ----
  const commitItem = useCallback((itemId, patch) => {
    setTree((t) => ({
      ...t,
      groups: t.groups.map((g) => ({ ...g, items: g.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) })),
    }));
    updateItem(sb, itemId, patch).catch((e) => console.error('updateItem failed', e));
  }, [sb]);

  const addItem = useCallback(async (groupId, name) => {
    try {
      const created = await createItem(sb, { boardId: board.id, groupId, name });
      setTree((t) => ({
        ...t,
        groups: t.groups.map((g) =>
          g.id === groupId && !g.items.some((it) => it.id === created.id)
            ? { ...g, items: [...g.items, { ...created, subitems: [] }] }
            : g),
      }));
    } catch (e) { console.error('createItem failed', e); }
  }, [sb, board.id]);

  // ---- subitem mutations (optimistic) ----
  const patchSubs = useCallback((itemId, fn) => {
    setTree((t) => ({
      ...t,
      groups: t.groups.map((g) => ({
        ...g,
        items: g.items.map((it) =>
          it.id === itemId ? { ...it, subitems: fn(it.subitems || []) } : it),
      })),
    }));
  }, []);

  const commitSubitem = useCallback((itemId, subitemId, patch) => {
    patchSubs(itemId, (subs) => subs.map((s) => (s.id === subitemId ? { ...s, ...patch } : s)));
    updateSubitem(sb, subitemId, patch).catch((e) => console.error('updateSubitem failed', e));
  }, [sb, patchSubs]);

  const removeSubitem = useCallback((itemId, subitemId) => {
    patchSubs(itemId, (subs) => subs.filter((s) => s.id !== subitemId));
    deleteSubitem(sb, subitemId).catch((e) => console.error('deleteSubitem failed', e));
  }, [sb, patchSubs]);

  const createSubitem = useCallback(async (itemId, name) => {
    try {
      const created = await addSubitem(sb, itemId, name);
      patchSubs(itemId, (subs) =>
        subs.some((s) => s.id === created.id)
          ? subs
          : [...subs, created].sort((a, b) => a.position - b.position));
    } catch (e) { console.error('addSubitem failed', e); }
  }, [sb, patchSubs]);

  const applyChecklist = useCallback(async (itemId, deal) => {
    try {
      const rows = await applyTemplate(sb, itemId, board.id, deal);
      if (!rows.length) return;
      patchSubs(itemId, (subs) => {
        const seen = new Set(subs.map((s) => s.id));
        return [...subs, ...rows.filter((r) => !seen.has(r.id))].sort((a, b) => a.position - b.position);
      });
    } catch (e) { console.error('applyTemplate failed', e); }
  }, [sb, board.id, patchSubs]);

  // ---- column ops ----
  const resizeColumn = useCallback((key, width) => {
    setPrefsState((p) => ({ ...p, colWidths: { ...p.colWidths, [key]: width } }));
  }, []);
  const resizeEnd = useCallback(() => {
    setPrefsState((p) => { persist(p); return p; });
  }, [persist]);
  const reorderColumns = useCallback((fromKey, toKey) => {
    setPrefsState((p) => {
      const order = (p.colOrder.length ? p.colOrder : DEFAULT_ORDER).filter((k) => k !== fromKey);
      const at = order.indexOf(toKey);
      order.splice(at < 0 ? order.length : at, 0, fromKey);
      const next = { ...p, colOrder: order };
      persist(next);
      return next;
    });
  }, [persist]);

  // ---- group / row ops ----
  const toggleCollapsed = useCallback((groupId) => {
    setPrefsState((p) => {
      const collapsed = { ...p.collapsed, [groupId]: !p.collapsed[groupId] };
      const next = { ...p, collapsed };
      persist(next);
      return next;
    });
  }, [persist]);

  const allCollapsed = tree.groups.length > 0 && tree.groups.every((g) => prefsState.collapsed[g.id]);
  const collapseAll = useCallback(() => {
    setPrefsState((p) => {
      const val = !(tree.groups.length > 0 && tree.groups.every((g) => p.collapsed[g.id]));
      const collapsed = {};
      tree.groups.forEach((g) => { collapsed[g.id] = val; });
      const next = { ...p, collapsed };
      persist(next);
      return next;
    });
  }, [persist, tree.groups]);

  const toggleExpand = useCallback((itemId) => {
    setExpandedIds((s) => {
      const n = new Set(s);
      n.has(itemId) ? n.delete(itemId) : n.add(itemId);
      return n;
    });
  }, []);

  const sortBy = useCallback((key) => {
    setSort((s) => (!s || s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));
  }, []);

  const q = search.trim().toLowerCase();

  return (
    <main className="board-main">
      <div style={{ padding: '16px 24px 0' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{tree.name}</h1>
        {tree.description && <p style={{ fontSize: 13, color: 'var(--tx2)', margin: '2px 0 0' }}>{tree.description}</p>}
      </div>

      <div className="board-scroll">
        <div className="board-toolbar">
          <div className="board-search">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="var(--tx2)" strokeWidth="1.6" />
              <path d="M11 11l3.4 3.4" stroke="var(--tx2)" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search deals" />
          </div>
          <button className="board-btn" onClick={collapseAll}>{allCollapsed ? 'Expand all' : 'Collapse all'}</button>
        </div>

        {tree.groups.map((group) => {
          const items = sortItems((group.items || []).filter((it) => matchesSearch(it, q)), sort);
          if (q && items.length === 0) return null;
          return (
            <GroupSection
              key={group.id}
              group={{ ...group, items }}
              cols={cols}
              options={options}
              collapsed={!!prefsState.collapsed[group.id]}
              onToggleCollapsed={toggleCollapsed}
              onCommitItem={commitItem}
              onResizeColumn={resizeColumn}
              onResizeEnd={resizeEnd}
              onReorderColumns={reorderColumns}
              sort={sort}
              onSort={sortBy}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
              onAddItem={addItem}
              onCommitSubitem={commitSubitem}
              onAddSubitem={createSubitem}
              onDeleteSubitem={removeSubitem}
              onApplyChecklist={applyChecklist}
            />
          );
        })}
      </div>
    </main>
  );
}
