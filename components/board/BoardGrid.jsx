'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { subscribeToBoard } from '@/lib/data/realtime';
import { getBoardTree, updateItem, createItem, duplicateItem, deleteItem, setItemPositions } from '@/lib/data/boards';
import { findItemTrashId, restoreFromTrash } from '@/lib/data/trash';
import { addSubitem, updateSubitem, deleteSubitem, applyTemplate } from '@/lib/data/subitems';
import { listAttachments, uploadAttachment, deleteAttachment, getDownloadUrl } from '@/lib/data/attachments';
import { listUpdates, postUpdate } from '@/lib/data/updates';
import { listAutomations, setAutomation } from '@/lib/data/automations';
import { listNotifications, dismissNotification, dismissAll } from '@/lib/data/notifications';
import { savePrefs } from '@/lib/data/prefs';
import GroupSection from './GroupSection';
import AutomationsPanel from './AutomationsPanel';
import NotificationsBell from './NotificationsBell';
import NewDealMenu from './NewDealMenu';
import FilterMenu from './FilterMenu';
import TrashPanel from './TrashPanel';
import BoardCards from './BoardCards';
import ItemDetailSheet from './ItemDetailSheet';
import AiPanel from './AiPanel';
import { resolveColumns, DEFAULT_ORDER, COL_BY_KEY } from './columns';
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
  const [filter, setFilter] = useState({ agent: null, lender: null });
  const [trashOpen, setTrashOpen] = useState(false);
  const [sort, setSort] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [prefsState, setPrefsState] = useState(() => ({
    colWidths: prefs?.colWidths || {},
    colOrder: prefs?.colOrder || DEFAULT_ORDER,
    collapsed: prefs?.collapsed || {},
    theme: prefs?.theme || 'light',
  }));

  useEffect(() => { setTree(board); }, [board]);

  // ---- dark/light theme ----
  useEffect(() => {
    document.documentElement.classList.toggle('dark', prefsState.theme === 'dark');
  }, [prefsState.theme]);

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

  // ---- undo: this user's own recent changes, newest first. Entries are
  // skipped (not forced) if the thing was changed again since, so undo never
  // clobbers a teammate's later edit arriving over realtime. ----
  const undoStack = useRef([]);
  const [undoTop, setUndoTop] = useState(null);
  const pushUndo = useCallback((entry) => {
    undoStack.current.push(entry);
    if (undoStack.current.length > 50) undoStack.current.shift();
    setUndoTop(entry.label);
  }, []);

  const findItem = (itemId) => {
    for (const g of treeRef.current.groups) {
      const it = (g.items || []).find((i) => i.id === itemId);
      if (it) return { group: g, item: it };
    }
    return null;
  };

  // ---- item mutations (optimistic) ----
  const applyItemPatch = useCallback((itemId, patch) => {
    setTree((t) => ({
      ...t,
      groups: t.groups.map((g) => ({ ...g, items: g.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) })),
    }));
    updateItem(sb, itemId, patch).catch((e) => console.error('updateItem failed', e));
  }, [sb]);

  const commitItem = useCallback((itemId, patch) => {
    const f = findItem(itemId);
    if (f) {
      const before = Object.fromEntries(Object.keys(patch).map((k) => [k, f.item[k] ?? null]));
      const fields = Object.keys(patch).map((k) => COL_BY_KEY[k]?.label || k).join(', ');
      pushUndo({ kind: 'item', itemId, before, after: patch, groupId: f.group.id, name: f.item.name, label: `${fields} on "${f.item.name}"` });
    }
    applyItemPatch(itemId, patch);
  }, [applyItemPatch, pushUndo]);

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
      pushUndo({ kind: 'create', itemId: created.id, name, label: `add "${name}"` });
    } catch (e) { console.error('createItem failed', e); }
  }, [sb, board.id, pushUndo]);

  // ---- row drag between / within groups ----
  const moveRowRaw = useCallback((itemId, toGroupId, beforeItemId) => {
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

  const moveRow = useCallback((itemId, toGroupId, beforeItemId) => {
    const f = findItem(itemId);
    if (!f || beforeItemId === itemId) return;
    const idx = f.group.items.findIndex((it) => it.id === itemId);
    const nextId = f.group.items[idx + 1]?.id ?? null;
    if (f.group.id === toGroupId && (beforeItemId ?? null) === nextId) return; // dropped where it was
    pushUndo({ kind: 'move', itemId, fromGroupId: f.group.id, beforeItemId: nextId, toGroupId, name: f.item.name, label: `move "${f.item.name}"` });
    moveRowRaw(itemId, toGroupId, beforeItemId);
  }, [moveRowRaw, pushUndo]);

  const duplicateItemFor = useCallback(async (itemId) => {
    try {
      const created = await duplicateItem(sb, itemId);
      setTree((t) => ({
        ...t,
        groups: t.groups.map((g) =>
          g.items.some((it) => it.id === itemId) && !g.items.some((it) => it.id === created.id)
            ? { ...g, items: [...g.items, created] }
            : g),
      }));
      pushUndo({ kind: 'create', itemId: created.id, name: created.name, label: `duplicate "${created.name}"` });
    } catch (e) { console.error('duplicateItem failed', e); }
  }, [sb, pushUndo]);

  const removeItemRaw = useCallback((itemId) => {
    setTree((t) => ({
      ...t,
      groups: t.groups.map((g) => ({ ...g, items: g.items.filter((it) => it.id !== itemId) })),
    }));
    setExpandedIds((s) => { if (!s.has(itemId)) return s; const n = new Set(s); n.delete(itemId); return n; });
    // A restore brings the item back under the same id; don't serve stale lists.
    attachmentsLoaded.current.delete(itemId);
    updatesLoaded.current.delete(itemId);
    return deleteItem(sb, itemId);
  }, [sb]);

  const removeItem = useCallback((itemId) => {
    const name = findItem(itemId)?.item.name || 'deal';
    const done = removeItemRaw(itemId);
    done.catch((e) => console.error('deleteItem failed', e));
    pushUndo({ kind: 'delete', itemId, done, name, label: `delete "${name}"` });
  }, [removeItemRaw, pushUndo]);

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

  const applySubPatch = useCallback((itemId, subitemId, patch) => {
    patchSubs(itemId, (subs) => subs.map((s) => (s.id === subitemId ? { ...s, ...patch } : s)));
    updateSubitem(sb, subitemId, patch).catch((e) => console.error('updateSubitem failed', e));
  }, [sb, patchSubs]);

  const commitSubitem = useCallback((itemId, subitemId, patch) => {
    const sub = findItem(itemId)?.item.subitems?.find((s) => s.id === subitemId);
    if (sub) {
      const before = Object.fromEntries(Object.keys(patch).map((k) => [k, sub[k] ?? null]));
      // The subDateStamp automation rewrites due_date when cond changes; put it back too.
      if ('cond' in patch && !('due_date' in patch)) before.due_date = sub.due_date ?? null;
      pushUndo({ kind: 'sub', itemId, subitemId, before, after: patch, name: sub.name, label: `condition "${sub.name}"` });
    }
    applySubPatch(itemId, subitemId, patch);
  }, [applySubPatch, pushUndo]);

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

  // ---- updates / comments (lazy per item, not in the tree query or realtime) ----
  const [updatesByItem, setUpdatesByItem] = useState({});
  const updatesLoaded = useRef(new Set());

  const loadUpdates = useCallback((itemId) => {
    if (updatesLoaded.current.has(itemId)) return;
    updatesLoaded.current.add(itemId);
    setUpdatesByItem((m) => ({ ...m, [itemId]: { loading: true, list: [] } }));
    listUpdates(sb, itemId)
      .then((list) => setUpdatesByItem((m) => ({ ...m, [itemId]: { loading: false, list } })))
      .catch((e) => {
        console.error('listUpdates failed', e);
        updatesLoaded.current.delete(itemId);
        setUpdatesByItem((m) => ({ ...m, [itemId]: { loading: false, list: [] } }));
      });
  }, [sb]);

  const postUpdateFor = useCallback(async (itemId, body) => {
    try {
      const created = await postUpdate(sb, itemId, user.id, body);
      setUpdatesByItem((m) => ({
        ...m,
        [itemId]: { loading: false, list: [created, ...((m[itemId] && m[itemId].list) || [])] },
      }));
    } catch (e) { console.error('postUpdate failed', e); }
  }, [sb, user.id]);

  // ---- "+ New Deal" quick-create: picks a deal type, drops the item in the
  // first non-"Template" group (as the prototype did), and auto-applies the
  // matching Purch/Refi checklist. ----
  const addNewDeal = useCallback(async (dealLabel) => {
    const groups = treeRef.current.groups;
    const group = groups.find((g) => !/template/i.test(g.title)) || groups[0];
    if (!group) return;
    try {
      const created = await createItem(sb, { boardId: board.id, groupId: group.id, name: 'New deal', deal: dealLabel });
      setTree((t) => ({
        ...t,
        groups: t.groups.map((g) =>
          g.id === group.id && !g.items.some((it) => it.id === created.id)
            ? { ...g, items: [...g.items, { ...created, subitems: [] }] }
            : g),
      }));
      setPrefsState((p) => {
        if (!p.collapsed[group.id]) return p;
        const next = { ...p, collapsed: { ...p.collapsed, [group.id]: false } };
        persist(next);
        return next;
      });
      setExpandedIds((s) => new Set(s).add(created.id));
      loadAttachments(created.id);
      loadUpdates(created.id);
      if (/purch/i.test(dealLabel)) applyChecklist(created.id, 'Purch');
      else if (/refi/i.test(dealLabel)) applyChecklist(created.id, 'Refi');
      pushUndo({ kind: 'create', itemId: created.id, name: created.name, label: `new ${dealLabel} deal` });
    } catch (e) { console.error('addNewDeal failed', e); }
  }, [sb, board.id, persist, applyChecklist, loadAttachments, loadUpdates, pushUndo]);

  // ---- undo ----
  const [undoNote, setUndoNote] = useState('');
  const noteTimer = useRef(null);
  const note = useCallback((text) => {
    setUndoNote(text);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setUndoNote(''), 4000);
  }, []);
  const undoBusy = useRef(false);

  const undo = useCallback(async () => {
    if (undoBusy.current) return;
    const e = undoStack.current.pop();
    setUndoTop(undoStack.current.at(-1)?.label ?? null);
    if (!e) return;
    undoBusy.current = true;
    const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    const f = findItem(e.itemId);
    try {
      if (e.kind === 'item') {
        if (!f) return note(`Can't undo: "${e.name}" no longer exists`);
        if (Object.keys(e.after).some((k) => !same(f.item[k], e.after[k]))) return note(`Skipped: "${e.name}" was changed again since`);
        const patch = { ...e.before };
        // A status/broker/compliance automation may have moved the deal; move it back too.
        if (f.group.id !== e.groupId && treeRef.current.groups.some((g) => g.id === e.groupId)) patch.group_id = e.groupId;
        applyItemPatch(e.itemId, patch);
      } else if (e.kind === 'sub') {
        const sub = f?.item.subitems?.find((s) => s.id === e.subitemId);
        if (!sub) return note(`Can't undo: condition "${e.name}" no longer exists`);
        if (Object.keys(e.after).some((k) => !same(sub[k], e.after[k]))) return note(`Skipped: condition "${e.name}" was changed again since`);
        applySubPatch(e.itemId, e.subitemId, e.before);
      } else if (e.kind === 'move') {
        if (!f || f.group.id !== e.toGroupId) return note(`Skipped: "${e.name}" was moved again since`);
        if (!treeRef.current.groups.some((g) => g.id === e.fromGroupId)) return note(`Can't undo: its old group is gone`);
        moveRowRaw(e.itemId, e.fromGroupId, e.beforeItemId);
      } else if (e.kind === 'create') {
        if (!f) return note(`"${e.name}" is already gone`);
        await removeItemRaw(e.itemId);
      } else if (e.kind === 'delete') {
        await e.done;
        const trashId = await findItemTrashId(sb, e.itemId);
        if (!trashId) return note(`Can't undo: "${e.name}" isn't in the trash anymore`);
        await restoreFromTrash(sb, trashId);
        setTree(await getBoardTree(sb, board.id));
      }
      note(`Undid ${e.label}`);
    } catch (err) {
      console.error('undo failed', err);
      note(`Undo failed: ${err.message || err}`);
    } finally {
      undoBusy.current = false;
    }
  }, [sb, board.id, note, applyItemPatch, applySubPatch, moveRowRaw, removeItemRaw]);

  // Cmd/Ctrl+Z outside text fields; inside one, leave the browser's text undo alone.
  useEffect(() => {
    const onKey = (ev) => {
      if (!(ev.metaKey || ev.ctrlKey) || ev.shiftKey || ev.altKey || ev.key.toLowerCase() !== 'z') return;
      if (ev.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      ev.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

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
    loadUpdates(itemId);
  }, [loadAttachments, loadUpdates]);
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

  const toggleTheme = useCallback(() => {
    setPrefsState((p) => {
      const next = { ...p, theme: p.theme === 'dark' ? 'light' : 'dark' };
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
      if (n.has(itemId)) { n.delete(itemId); } else { n.add(itemId); loadAttachments(itemId); loadUpdates(itemId); }
      return n;
    });
  }, [loadAttachments, loadUpdates]);

  const sortBy = useCallback((key) => {
    setSort((s) => (!s || s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));
  }, []);

  const q = search.trim().toLowerCase();

  const visibleGroups = useMemo(() => {
    const narrowed = !!(q || filter.agent || filter.lender);
    const keep = (it) => matchesSearch(it, q)
      && (!filter.agent || it.agent === filter.agent)
      && (!filter.lender || (it.lender || []).includes(filter.lender));
    return tree.groups
      .map((group) => ({ group, items: sortItems((group.items || []).filter(keep), sort) }))
      .filter(({ items }) => !(narrowed && items.length === 0));
  }, [tree.groups, q, filter, sort]);

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
          <NewDealMenu options={options} onCreate={addNewDeal} />
          <FilterMenu options={options} filter={filter} onChange={setFilter} />
          <button className="board-btn" onClick={undo} disabled={!undoTop}
            title={undoTop ? `Undo ${undoTop} (⌘Z / Ctrl+Z)` : 'Nothing to undo'}>↶ Undo</button>
          <button className="board-btn" onClick={collapseAll}>{allCollapsed ? 'Expand all' : 'Collapse all'}</button>
          <button className="board-btn" onClick={() => setAutomationsOpen(true)}>⚡ Automations</button>
          <button className="board-btn" onClick={() => setAiOpen(true)}>✨ AI Assistant</button>
          <NotificationsBell
            notifications={notifications}
            onDismiss={dismissOneNotification}
            onDismissAll={dismissAllNotifications}
          />
          <button className="board-btn" title="Trash" onClick={() => setTrashOpen(true)}>🗑</button>
          <button className="board-btn" title="Toggle theme" onClick={toggleTheme}>
            {prefsState.theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {undoNote && <span className="undo-note">{undoNote}</span>}
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
              updatesByItem={updatesByItem}
              onPostUpdate={postUpdateFor}
              onDuplicateItem={duplicateItemFor}
              onDeleteItem={removeItem}
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
          updates={updatesByItem[detailItem.id]}
          onPostUpdate={(body) => postUpdateFor(detailItem.id, body)}
          onDuplicateItem={duplicateItemFor}
          onDeleteItem={removeItem}
        />
      )}

      {automationsOpen && (
        <AutomationsPanel
          enabledMap={automations}
          onToggle={toggleAutomation}
          onClose={() => setAutomationsOpen(false)}
        />
      )}

      {trashOpen && <TrashPanel sb={sb} onClose={() => setTrashOpen(false)} />}

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
