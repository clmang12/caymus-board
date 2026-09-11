'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { subscribeToBoard } from '@/lib/data/realtime';
import { updateItem, createItem, setItemPositions } from '@/lib/data/boards';
import { addSubitem, updateSubitem, deleteSubitem, applyTemplate } from '@/lib/data/subitems';
import { listAttachments, uploadAttachment, deleteAttachment, getDownloadUrl } from '@/lib/data/attachments';
import { listAutomations, setAutomation } from '@/lib/data/automations';
import { listNotifications, dismissNotification, dismissAll } from '@/lib/data/notifications';
import { savePrefs } from '@/lib/data/prefs';
import GroupSection from './GroupSection';
import AutomationsPanel from './AutomationsPanel';
import NotificationsBell from './NotificationsBell';
import BoardCards from './BoardCards';
import ItemDetailSheet from './ItemDetailSheet';
import AiPanel from './AiPanel';
import { resolveColumns, DEFAULT_ORDER } from './columns';
import './board.css';

const MOBILE_QUERY = '(max-width: 767px)';

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

  const treeRef = useRef(tree);
  useEffect(() => { treeRef.current = tree; }, [tree]);

  const [dragItemId, setDragItemId] = useState(null);

  const cols = useMemo(() => resolveColumns(prefsState), [prefsState]);

  // ---- mobile layout (PORTING item 8) ----
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mq.matches);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const [detailItemId, setDetailItemId] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);

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

  // ---- row drag between / within groups ----
  const moveRow = useCallback((itemId, toGroupId, beforeItemId) => {
    const cur = treeRef.current;
    const fromGroup = cur.groups.find((g) => (g.items || []).some((it) => it.id === itemId));
    if (!fromGroup) return;
    const moved = fromGroup.items.find((it) => it.id === itemId);
    if (beforeItemId === itemId) return;

    let targetItems;
    const groups = cur.groups.map((g) => {
      let items = (g.items || []).filter((it) => it.id !== itemId);
      if (g.id === toGroupId) {
        const at = beforeItemId ? items.findIndex((it) => it.id === beforeItemId) : items.length;
        items = [...items];
        items.splice(at < 0 ? items.length : at, 0, { ...moved, group_id: toGroupId });
        items = items.map((it, i) => ({ ...it, position: i }));
        targetItems = items;
      }
      return { ...g, items };
    });
    if (!targetItems) return;
    setTree({ ...cur, groups });
    setItemPositions(sb, targetItems.map((it, i) => ({ id: it.id, position: i, group_id: toGroupId })))
      .catch((e) => console.error('setItemPositions failed', e));
  }, [sb]);

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

  // ---- attachments (lazy per item, not in the tree query or realtime) ----
  const [attachmentsByItem, setAttachmentsByItem] = useState({});
  const attachmentsLoaded = useRef(new Set());

  const loadAttachments = useCallback((itemId) => {
    if (attachmentsLoaded.current.has(itemId)) return;
    attachmentsLoaded.current.add(itemId);
    setAttachmentsByItem((m) => ({ ...m, [itemId]: { loading: true, list: [] } }));
    listAttachments(sb, itemId)
      .then((list) => setAttachmentsByItem((m) => ({ ...m, [itemId]: { loading: false, list } })))
      .catch((e) => {
        console.error('listAttachments failed', e);
        attachmentsLoaded.current.delete(itemId);
        setAttachmentsByItem((m) => ({ ...m, [itemId]: { loading: false, list: [] } }));
      });
  }, [sb]);

  const uploadAttachmentFor = useCallback(async (itemId, file) => {
    try {
      const created = await uploadAttachment(sb, { itemId, file, userId: user.id });
      setAttachmentsByItem((m) => ({
        ...m,
        [itemId]: { loading: false, list: [created, ...((m[itemId] && m[itemId].list) || [])] },
      }));
    } catch (e) { console.error('uploadAttachment failed', e); }
  }, [sb, user.id]);

  const removeAttachmentFor = useCallback((itemId, attachmentId, storagePath) => {
    setAttachmentsByItem((m) => ({
      ...m,
      [itemId]: { loading: false, list: ((m[itemId] && m[itemId].list) || []).filter((a) => a.id !== attachmentId) },
    }));
    deleteAttachment(sb, attachmentId, storagePath).catch((e) => console.error('deleteAttachment failed', e));
  }, [sb]);

  const downloadAttachment = useCallback(async (storagePath, filename) => {
    try {
      const url = await getDownloadUrl(sb, storagePath);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) { console.error('getDownloadUrl failed', e); }
  }, [sb]);

  const openDetail = useCallback((itemId) => {
    setDetailItemId(itemId);
    loadAttachments(itemId);
  }, [loadAttachments]);
  const closeDetail = useCallback(() => setDetailItemId(null), []);

  // ---- automations (item 9) + notifications (item 5) ----
  const [automations, setAutomations] = useState({});
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    listAutomations(sb, board.id)
      .then((rows) => setAutomations(Object.fromEntries(rows.map((r) => [r.key, r.enabled]))))
      .catch((e) => console.error('listAutomations failed', e));
    listNotifications(sb, user.id)
      .then(setNotifications)
      .catch((e) => console.error('listNotifications failed', e));
  }, [sb, board.id, user.id]);

  const toggleAutomation = useCallback((key, enabled) => {
    setAutomations((m) => ({ ...m, [key]: enabled }));
    setAutomation(sb, board.id, key, enabled).catch((e) => console.error('setAutomation failed', e));
  }, [sb, board.id]);

  const dismissOneNotification = useCallback((id) => {
    setNotifications((list) => list.filter((n) => n.id !== id));
    dismissNotification(sb, id).catch((e) => console.error('dismissNotification failed', e));
  }, [sb]);

  const dismissAllNotifications = useCallback(() => {
    setNotifications([]);
    dismissAll(sb, user.id).catch((e) => console.error('dismissAll failed', e));
  }, [sb, user.id]);

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
      if (n.has(itemId)) { n.delete(itemId); } else { n.add(itemId); loadAttachments(itemId); }
      return n;
    });
  }, [loadAttachments]);

  const sortBy = useCallback((key) => {
    setSort((s) => (!s || s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));
  }, []);

  const q = search.trim().toLowerCase();

  const visibleGroups = useMemo(() => {
    return tree.groups
      .map((group) => ({ group, items: sortItems((group.items || []).filter((it) => matchesSearch(it, q)), sort) }))
      .filter(({ items }) => !(q && items.length === 0));
  }, [tree.groups, q, sort]);

  let detailItem = null;
  let detailGroupColor = null;
  if (detailItemId) {
    for (const g of tree.groups) {
      const found = (g.items || []).find((it) => it.id === detailItemId);
      if (found) { detailItem = found; detailGroupColor = g.color; break; }
    }
  }

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
          <button className="board-btn" onClick={() => setAutomationsOpen(true)}>⚡ Automations</button>
          <button className="board-btn" onClick={() => setAiOpen(true)}>✨ AI Assistant</button>
          <NotificationsBell
            notifications={notifications}
            onDismiss={dismissOneNotification}
            onDismissAll={dismissAllNotifications}
          />
        </div>

        {isMobile ? (
          <BoardCards
            visibleGroups={visibleGroups}
            options={options}
            collapsed={prefsState.collapsed}
            onToggleCollapsed={toggleCollapsed}
            onAddItem={addItem}
            onOpenDetail={openDetail}
          />
        ) : (
          visibleGroups.map(({ group, items }) => (
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
              attachmentsByItem={attachmentsByItem}
              onUploadAttachment={uploadAttachmentFor}
              onDeleteAttachment={removeAttachmentFor}
              onDownloadAttachment={downloadAttachment}
              dragItemId={dragItemId}
              onRowDragStart={setDragItemId}
              onRowDragEnd={() => setDragItemId(null)}
              onMoveRow={moveRow}
            />
          ))
        )}
      </div>

      {detailItem && (
        <ItemDetailSheet
          item={detailItem}
          cols={cols}
          options={options}
          groupColor={detailGroupColor}
          onClose={closeDetail}
          onCommit={(patch) => commitItem(detailItem.id, patch)}
          onCommitSubitem={(subId, patch) => commitSubitem(detailItem.id, subId, patch)}
          onAddSubitem={(name) => createSubitem(detailItem.id, name)}
          onDeleteSubitem={(subId) => removeSubitem(detailItem.id, subId)}
          onApplyChecklist={(deal) => applyChecklist(detailItem.id, deal)}
          attachments={attachmentsByItem[detailItem.id]}
          onUploadAttachment={(file) => uploadAttachmentFor(detailItem.id, file)}
          onDeleteAttachment={(attId, path) => removeAttachmentFor(detailItem.id, attId, path)}
          onDownloadAttachment={downloadAttachment}
        />
      )}

      {automationsOpen && (
        <AutomationsPanel
          enabledMap={automations}
          onToggle={toggleAutomation}
          onClose={() => setAutomationsOpen(false)}
        />
      )}

      {aiOpen && (
        <AiPanel
          sb={sb}
          tree={tree}
          boardId={board.id}
          options={options}
          userId={user.id}
          onClose={() => setAiOpen(false)}
        />
      )}
    </main>
  );
}
