'use client';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { subscribeToBoard } from '@/lib/data/realtime';
import { getBoardTree, getFieldOptions, updateItem, renameBoard } from '@/lib/data/boards';
import { updateSubitem } from '@/lib/data/subitems';
import { listUpdates, postUpdate, editUpdate, trashUpdate } from '@/lib/data/updates';
import { restoreFromTrash } from '@/lib/data/trash';
import { listNotifications, dismissNotification, dismissAll, restoreNotifications } from '@/lib/data/notifications';
import { patchPrefs } from '@/lib/data/prefs';
import { findItem, patchItem, patchSubitems, placeItem, mergeChange } from './tree';
import { shortName, money, shortDate } from './format';
import { opensUp } from './OptionMenu';
import BoardTab, { SORTS } from './BoardTab';
import BoardSwitcher from './BoardSwitcher';
import DealDetail from './DealDetail';
import NotificationsTab from './NotificationsTab';
import MeTab from './MeTab';
import TabBar from './TabBar';
import './mobile.css';

const UNDO_LIMIT = 25;
// Groups that start collapsed on a phone (until the user changes it).
const START_COLLAPSED = /^(Template|Funded - Compliance Done|Cancelled)$/i;
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function describe(col, value) {
  if (value === null || value === undefined || (Array.isArray(value) && !value.length)) return 'cleared';
  if (col.type === 'currency') return money(value);
  if (col.type === 'date') return shortDate(value, true);
  if (Array.isArray(value)) return value.join(', ');
  const s = String(value);
  return s.length > 24 ? s.slice(0, 24) + '…' : s;
}

export default function MobileApp({ user, profile, boards: initialBoards, board, options: initialOptions, prefs, initialDealId }) {
  const sb = useMemo(() => createClient(), []);
  const router = useRouter();
  const [navPending, startNav] = useTransition();
  const [navTarget, setNavTarget] = useState(null);

  const [tree, setTree] = useState(board);
  const treeRef = useRef(tree);
  useEffect(() => { treeRef.current = tree; }, [tree]);
  const [options, setOptions] = useState(initialOptions);
  const [boards, setBoards] = useState(initialBoards);

  const [tab, setTab] = useState('board');
  const [query, setQuery] = useState('');
  // Agent filter, remembered per user per board (an agent usually wants their
  // own deals each time). A saved agent no longer on the board is ignored.
  const [agent, setAgent] = useState(() => (
    (initialOptions?.agent || []).some(([l]) => l === prefs?.mobileAgent) ? prefs.mobileAgent : null));
  const [expandedId, setExpandedId] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [collapsed, setCollapsed] = useState(() => prefs?.mobileCollapsed
    || Object.fromEntries(board.groups.filter((g) => START_COLLAPSED.test(g.title)).map((g) => [g.id, true])));

  // ---- toast (one at a time) ----
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((t, ms = 3200) => {
    clearTimeout(toastTimer.current);
    const id = Date.now() + Math.random();
    setToast({ ...t, id });
    toastTimer.current = setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), ms);
  }, []);

  const reload = useCallback(() => {
    getBoardTree(sb, board.id).then(setTree).catch((e) => console.error('getBoardTree failed', e));
  }, [sb, board.id]);

  // A write failed: say so, and resync from the server rather than guess.
  const failed = useCallback((what, e) => {
    console.error(what, e);
    showToast({ text: 'Couldn’t save that change. Reloaded the board.' }, 4000);
    reload();
  }, [showToast, reload]);

  // ---- theme: prefs.theme (shared with the desktop board), else the system ----
  const [theme, setTheme] = useState(prefs?.theme === 'dark' || prefs?.theme === 'light' ? prefs.theme : null);
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const on = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const dark = theme ? theme === 'dark' : systemDark;
  useEffect(() => {
    // Overscroll areas outside the app container show the body.
    document.body.style.background = dark ? '#14151b' : '#f3f4f7';
    return () => { document.body.style.background = ''; };
  }, [dark]);
  const toggleDark = useCallback(() => {
    const next = dark ? 'light' : 'dark';
    setTheme(next);
    patchPrefs(sb, user.id, board.id, { theme: next }).catch((e) => console.error('patchPrefs failed', e));
  }, [dark, sb, user.id, board.id]);

  // ---- collapsed groups, saved per user per board (separate from the desktop's) ----
  const collapseSaved = useRef(collapsed);
  useEffect(() => {
    if (collapseSaved.current === collapsed) return;
    const t = setTimeout(() => {
      collapseSaved.current = collapsed;
      patchPrefs(sb, user.id, board.id, { mobileCollapsed: collapsed }).catch((e) => console.error('patchPrefs failed', e));
    }, 800);
    return () => clearTimeout(t);
  }, [collapsed, sb, user.id, board.id]);

  // Sort within each group, remembered per user per board like the agent filter.
  const [sort, setSort] = useState(() => (SORTS.some(([k]) => k === prefs?.mobileSort) ? prefs.mobileSort : 'position'));
  const pickSort = useCallback((next) => {
    setMenu(null);
    setSort(next);
    patchPrefs(sb, user.id, board.id, { mobileSort: next }).catch((e) => console.error('patchPrefs failed', e));
  }, [sb, user.id, board.id]);

  const pickAgent = useCallback((next) => {
    setMenu(null);
    setAgent(next);
    setExpandedId(null);
    patchPrefs(sb, user.id, board.id, { mobileAgent: next }).catch((e) => console.error('patchPrefs failed', e));
  }, [sb, user.id, board.id]);

  const toggleGroup = useCallback((groupId) => setCollapsed((c) => ({ ...c, [groupId]: !c[groupId] })), []);
  const toggleAll = useCallback(() => {
    setCollapsed((c) => {
      const anyOpen = treeRef.current.groups.some((g) => !c[g.id]);
      return Object.fromEntries(treeRef.current.groups.map((g) => [g.id, anyOpen]));
    });
  }, []);
  const revealGroup = useCallback((groupId) => setCollapsed((c) => (c[groupId] ? { ...c, [groupId]: false } : c)), []);

  const flash = useCallback((itemId) => {
    setFlashId(itemId);
    setTimeout(() => setFlashId((cur) => (cur === itemId ? null : cur)), 1600);
  }, []);
  useEffect(() => {
    if (!flashId) return;
    const el = document.getElementById('deal-' + flashId);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [flashId]);

  // ---- menus: one status/condition popup at a time, plus the board switcher ----
  const [menu, setMenu] = useState(null); // { kind: 'status'|'cond'|'agent'|'sort', where: 'card'|'detail'|'board', itemId?, subId?, up }
  const [boardMenu, setBoardMenu] = useState(null); // 'header' | 'tab'
  const [editBoardId, setEditBoardId] = useState(null);
  const openRef = useRef(false);
  useEffect(() => { openRef.current = !!(menu || boardMenu); }, [menu, boardMenu]);
  const dismissedAt = useRef(0);
  useEffect(() => {
    const down = () => {
      if (!openRef.current) return;
      dismissedAt.current = Date.now();
      setMenu(null);
      setBoardMenu(null);
      setEditBoardId(null);
    };
    const key = (e) => { if (e.key === 'Escape') { setMenu(null); setBoardMenu(null); } };
    // On window, not document: the App Router mounts React on the document,
    // so only a listener above it is skipped when a popup or trigger calls
    // stopPropagation() on pointerdown.
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key); };
  }, []);

  // Triggers swallow the pointerdown that closes menus, so opening one menu
  // closes the others here (one popup at a time).
  const toggleMenu = useCallback((next, el, count, reserve) => {
    setBoardMenu(null);
    setEditBoardId(null);
    setMenu((m) => (m && m.kind === next.kind && m.where === next.where && m.itemId === next.itemId && m.subId === next.subId
      ? null
      : { ...next, up: opensUp(el, count, reserve) }));
  }, []);
  const toggleBoardMenu = useCallback((from) => {
    setMenu(null);
    setEditBoardId(null);
    setBoardMenu((m) => (m === from ? null : from));
  }, []);

  // ---- undo: inverse writes for this user's own changes, newest first.
  // An entry is skipped (never forced) if the value changed again since. ----
  const undoStack = useRef([]);
  const [undoDepth, setUndoDepth] = useState(0);
  const pushUndo = useCallback((entry) => {
    undoStack.current.push(entry);
    if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
    setUndoDepth(undoStack.current.length);
  }, []);
  const dropUndo = useCallback((entry) => {
    undoStack.current = undoStack.current.filter((e) => e !== entry);
    setUndoDepth(undoStack.current.length);
  }, []);

  // A server row for a deal we just wrote. If the items_automations trigger
  // routed it to another group (status → group), show it first in that group,
  // open the group, and point at it. The routing itself stays in Postgres.
  const settleItem = useCallback((row, expectedGroupId) => {
    if (row.group_id === expectedGroupId) {
      setTree((t) => patchItem(t, row.id, row));
      return;
    }
    const target = treeRef.current.groups.find((g) => g.id === row.group_id);
    if (!target) { reload(); return; }
    const others = target.items.filter((it) => it.id !== row.id);
    const top = others.length ? Math.min(...others.map((it) => it.position)) - 1 : row.position;
    setTree((t) => placeItem(t, row.id, row.group_id, { ...row, position: top }, { top: true }));
    revealGroup(row.group_id);
    flash(row.id);
    if (top !== row.position) {
      updateItem(sb, row.id, { position: top }).catch((e) => console.error('updateItem position failed', e));
    }
  }, [sb, reload, revealGroup, flash]);

  const commitItem = useCallback(async (itemId, patch, label) => {
    const f = findItem(treeRef.current, itemId);
    if (!f) return;
    const keys = Object.keys(patch);
    if (keys.every((k) => same(f.item[k], patch[k]))) return;
    const entry = {
      kind: 'item', itemId, label,
      before: Object.fromEntries(keys.map((k) => [k, f.item[k] ?? null])),
      after: patch, groupId: f.group.id, position: f.item.position,
    };
    pushUndo(entry);
    setTree((t) => patchItem(t, itemId, patch));
    try {
      settleItem(await updateItem(sb, itemId, patch), f.group.id);
    } catch (e) {
      dropUndo(entry);
      failed('updateItem failed', e);
    }
  }, [sb, pushUndo, dropUndo, settleItem, failed]);

  const setStatus = useCallback((itemId, label) => {
    setMenu(null);
    const f = findItem(treeRef.current, itemId);
    if (f) commitItem(itemId, { status: label }, `${shortName(f.item.name)} status → ${label}`);
  }, [commitItem]);

  const commitField = useCallback((itemId, col, value) => {
    const f = findItem(treeRef.current, itemId);
    if (f) commitItem(itemId, { [col.key]: value }, `${shortName(f.item.name)} ${col.label} → ${describe(col, value)}`);
  }, [commitItem]);

  // Set the condition status of one or more of a deal's conditions.
  const setConds = useCallback(async (itemId, subIds, label) => {
    const f = findItem(treeRef.current, itemId);
    if (!f) return;
    const rows = (f.item.subitems || []).filter((s) => subIds.includes(s.id) && s.cond !== label);
    if (!rows.length) return;
    const short = shortName(f.item.name);
    const entry = {
      kind: 'conds', itemId, after: label,
      rows: rows.map((s) => ({ id: s.id, before: { cond: s.cond ?? null, cond_date: s.cond_date ?? null } })),
      label: rows.length === 1 ? `${short} · ${rows[0].name} → ${label}` : `${short} ${rows.length} conditions → ${label}`,
    };
    pushUndo(entry);
    const ids = new Set(rows.map((s) => s.id));
    setTree((t) => patchSubitems(t, itemId, (subs) => subs.map((s) => (ids.has(s.id) ? { ...s, cond: label } : s))));
    try {
      const saved = await Promise.all(rows.map((s) => updateSubitem(sb, s.id, { cond: label })));
      const byId = new Map(saved.map((r) => [r.id, r]));
      setTree((t) => patchSubitems(t, itemId, (subs) => subs.map((s) => (byId.has(s.id) ? { ...s, ...byId.get(s.id) } : s))));
    } catch (e) {
      dropUndo(entry);
      failed('updateSubitem failed', e);
    }
  }, [sb, pushUndo, dropUndo, failed]);

  const undoBusy = useRef(false);
  const undo = useCallback(async () => {
    if (undoBusy.current) return;
    const e = undoStack.current.pop();
    setUndoDepth(undoStack.current.length);
    if (!e) return;
    undoBusy.current = true;
    setMenu(null);
    const say = (text) => showToast({ text });
    try {
      const cur = findItem(treeRef.current, e.itemId);
      if (!cur) return say('Can’t undo · that deal no longer exists');
      if (e.kind === 'item') {
        if (Object.keys(e.after).some((k) => !same(cur.item[k], e.after[k]))) return say('Skipped · it was changed again since');
        const patch = { ...e.before };
        // The trigger may have moved the deal on a status change; move it back too.
        const moveBack = cur.group.id !== e.groupId && treeRef.current.groups.some((g) => g.id === e.groupId);
        if (moveBack) Object.assign(patch, { group_id: e.groupId, position: e.position });
        setTree((t) => (moveBack ? placeItem(t, e.itemId, e.groupId, patch) : patchItem(t, e.itemId, patch)));
        if (moveBack) revealGroup(e.groupId);
        const row = await updateItem(sb, e.itemId, patch);
        // Restoring a status can route it again (e.g. back to Submitted): follow the server.
        const expected = moveBack ? e.groupId : cur.group.id;
        if (row.group_id === expected) setTree((t) => patchItem(t, row.id, row));
        else setTree((t) => placeItem(t, row.id, row.group_id, row));
      } else if (e.kind === 'conds') {
        const subs = cur.item.subitems || [];
        const live = e.rows.filter((r) => subs.find((s) => s.id === r.id)?.cond === e.after);
        if (!live.length) return say('Skipped · those conditions were changed again since');
        const before = new Map(live.map((r) => [r.id, r.before]));
        setTree((t) => patchSubitems(t, e.itemId, (list) => list.map((s) => (before.has(s.id) ? { ...s, ...before.get(s.id) } : s))));
        const saved = await Promise.all(live.map((r) => updateSubitem(sb, r.id, r.before)));
        const byId = new Map(saved.map((r) => [r.id, r]));
        setTree((t) => patchSubitems(t, e.itemId, (list) => list.map((s) => (byId.has(s.id) ? { ...s, ...byId.get(s.id) } : s))));
        if (live.length < e.rows.length) return say(`Undid · ${e.label} (${e.rows.length - live.length} skipped)`);
      }
      say('Undid · ' + e.label);
    } catch (err) {
      failed('undo failed', err);
    } finally {
      undoBusy.current = false;
    }
  }, [sb, showToast, revealGroup, failed]);

  // ---- condition selection (per deal, by subitem id) ----
  const [condSel, setCondSel] = useState({});
  const condHandlersFor = useCallback((itemId, where) => ({
    onToggleSelect: (subId) => setCondSel((m) => {
      const cur = m[itemId] || [];
      return { ...m, [itemId]: cur.includes(subId) ? cur.filter((x) => x !== subId) : [...cur, subId] };
    }),
    onOpenMenu: (subId, el, count) => toggleMenu({ kind: 'cond', where, itemId, subId }, el, count, where === 'card' ? 84 : 16),
    // With rows checked, the pick applies to all of them plus the tapped one.
    onPick: (subId, label) => {
      setMenu(null);
      const sel = condSel[itemId] || [];
      setConds(itemId, sel.length ? [...new Set([...sel, subId])] : [subId], label);
      if (sel.length) setCondSel((m) => ({ ...m, [itemId]: [] }));
    },
    onBatch: (label) => {
      setConds(itemId, condSel[itemId] || [], label);
      setCondSel((m) => ({ ...m, [itemId]: [] }));
    },
    onClearSelection: () => setCondSel((m) => ({ ...m, [itemId]: [] })),
  }), [condSel, setConds, toggleMenu]);

  const toggleExpand = useCallback((itemId) => {
    // The tap that closed a popup shouldn't also fold the card.
    if (Date.now() - dismissedAt.current < 400) return;
    setExpandedId((id) => (id === itemId ? null : itemId));
  }, []);

  // ---- deal detail + its updates feed ----
  const [detail, setDetail] = useState(null); // { id, tab, open }
  const [updatesByItem, setUpdatesByItem] = useState({});
  const updatesLoaded = useRef(new Set());
  const loadUpdates = useCallback((itemId, force = false) => {
    if (!force && updatesLoaded.current.has(itemId)) return;
    updatesLoaded.current.add(itemId);
    setUpdatesByItem((m) => ({ ...m, [itemId]: { loading: true, list: m[itemId]?.list || [] } }));
    listUpdates(sb, itemId)
      .then((list) => setUpdatesByItem((m) => ({ ...m, [itemId]: { loading: false, list } })))
      .catch((e) => {
        console.error('listUpdates failed', e);
        updatesLoaded.current.delete(itemId);
        setUpdatesByItem((m) => ({ ...m, [itemId]: { loading: false, list: m[itemId]?.list || [] } }));
      });
  }, [sb]);

  const openDeal = useCallback((itemId, dealTab = 'details') => {
    setMenu(null);
    setDetail({ id: itemId, tab: dealTab, open: true });
    loadUpdates(itemId);
  }, [loadUpdates]);
  const closeDeal = useCallback(() => {
    setMenu(null);
    setDetail((d) => (d ? { ...d, open: false } : d));
    setTimeout(() => setDetail((d) => (d && !d.open ? null : d)), 320);
  }, []);
  const setDetailTab = useCallback((t) => { setMenu(null); setDetail((d) => (d ? { ...d, tab: t } : d)); }, []);

  const sendUpdate = useCallback(async (itemId, body) => {
    try {
      const created = await postUpdate(sb, itemId, user.id, body);
      setUpdatesByItem((m) => {
        const list = m[itemId]?.list || [];
        return list.some((u) => u.id === created.id) ? m : { ...m, [itemId]: { loading: false, list: [created, ...list] } };
      });
    } catch (e) {
      console.error('postUpdate failed', e);
      showToast({ text: 'Couldn’t post that update.' }, 4000);
    }
  }, [sb, user.id, showToast]);

  const patchUpdates = useCallback((itemId, fn) => {
    setUpdatesByItem((m) => ({ ...m, [itemId]: { loading: false, list: fn(m[itemId]?.list || []) } }));
  }, []);

  const saveUpdateEdit = useCallback(async (itemId, update, body) => {
    patchUpdates(itemId, (list) => list.map((u) => (u.id === update.id ? { ...u, body } : u)));
    try {
      const saved = await editUpdate(sb, update.id, body);
      patchUpdates(itemId, (list) => list.map((u) => (u.id === saved.id ? saved : u)));
    } catch (e) {
      console.error('editUpdate failed', e);
      patchUpdates(itemId, (list) => list.map((u) => (u.id === update.id ? update : u)));
      showToast({ text: 'Couldn’t save that update.' }, 4000);
    }
  }, [sb, patchUpdates, showToast]);

  // Deletes go to the trash; the toast's Undo restores from there.
  const deleteUpdateFor = useCallback(async (itemId, update) => {
    patchUpdates(itemId, (list) => list.filter((u) => u.id !== update.id));
    try {
      const trashId = await trashUpdate(sb, update.id);
      showToast({
        text: 'Update deleted',
        action: 'Undo',
        onAction: () => {
          if (!trashId) return;
          restoreFromTrash(sb, trashId)
            .then(() => loadUpdates(itemId, true))
            .catch((e) => {
              console.error('restoreFromTrash failed', e);
              showToast({ text: 'Couldn’t restore that update.' }, 4000);
            });
        },
      }, 5000);
    } catch (e) {
      console.error('trashUpdate failed', e);
      loadUpdates(itemId, true);
      showToast({ text: 'Couldn’t delete that update.' }, 4000);
    }
  }, [sb, patchUpdates, loadUpdates, showToast]);

  // Deep link from a notification on another board (/m/<board>?deal=<id>).
  useEffect(() => {
    if (!initialDealId) return;
    if (findItem(treeRef.current, initialDealId)) openDeal(initialDealId);
    else showToast({ text: 'That deal is no longer on this board.' });
    window.history.replaceState(null, '', '/m/' + board.id);
  }, [initialDealId, board.id, openDeal, showToast]);

  // ---- realtime: teammates, the desktop board, automations, the MCP connector ----
  useEffect(() => {
    const unsubscribe = subscribeToBoard(sb, board.id, (change) => {
      const { table, event, row } = change;
      if (!row) return;
      if (table === 'field_options') {
        getFieldOptions(sb, board.id).then(setOptions).catch((e) => console.error('getFieldOptions failed', e));
        return;
      }
      if (table === 'updates') {
        // Insert payloads have no author join and deletes carry only the id: refetch.
        for (const itemId of updatesLoaded.current) {
          if (row.item_id === itemId || event === 'DELETE') loadUpdates(itemId, true);
        }
        return;
      }
      setTree((t) => mergeChange(t, change));
    });
    // Catch up once subscribed: the server-rendered tree can be stale — the
    // router serves a cached copy when you switch back to a board within
    // ~30s, and anything changed before the subscription opened is missed.
    reload();
    return unsubscribe;
  }, [sb, board.id, loadUpdates, reload]);

  // ---- notifications (generated server-side; read_at set = cleared) ----
  const [notifs, setNotifs] = useState(null);
  const notifsRef = useRef(notifs);
  useEffect(() => { notifsRef.current = notifs; }, [notifs]);
  const loadNotifs = useCallback(() => {
    listNotifications(sb, user.id).then(setNotifs).catch((e) => {
      console.error('listNotifications failed', e);
      setNotifs((n) => n || []);
    });
  }, [sb, user.id]);
  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  // Back from the background: the socket may have slept, so resync.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      reload();
      loadNotifs();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [reload, loadNotifs]);

  const dismissNotif = useCallback((n) => {
    const list = notifsRef.current || [];
    const index = list.findIndex((x) => x.id === n.id);
    if (index < 0) return;
    setNotifs(list.filter((x) => x.id !== n.id));
    dismissNotification(sb, n.id).catch((e) => console.error('dismissNotification failed', e));
    showToast({
      text: 'Notification cleared',
      action: 'Undo',
      onAction: () => {
        setNotifs((cur) => {
          const arr = (cur || []).filter((x) => x.id !== n.id);
          arr.splice(Math.min(index, arr.length), 0, n);
          return arr;
        });
        restoreNotifications(sb, [n.id]).catch((e) => console.error('restoreNotifications failed', e));
      },
    }, 5000);
  }, [sb, showToast]);

  const clearAllNotifs = useCallback(() => {
    const prev = notifsRef.current || [];
    if (!prev.length) return;
    setNotifs([]);
    dismissAll(sb, user.id).catch((e) => console.error('dismissAll failed', e));
    showToast({
      text: `${prev.length} notification${prev.length === 1 ? '' : 's'} cleared`,
      action: 'Undo',
      onAction: () => {
        setNotifs(prev);
        restoreNotifications(sb, prev.map((n) => n.id)).catch((e) => console.error('restoreNotifications failed', e));
      },
    }, 5000);
  }, [sb, user.id, showToast]);

  const goToBoard = useCallback((boardId, dealId) => {
    setNavTarget(boardId);
    startNav(() => router.push('/m/' + boardId + (dealId ? '?deal=' + dealId : '')));
  }, [router]);

  const openNotif = useCallback((n) => {
    if (!n.item_id) return;
    if (n.board_id && n.board_id !== board.id) return goToBoard(n.board_id, n.item_id);
    if (findItem(treeRef.current, n.item_id)) openDeal(n.item_id);
    else showToast({ text: 'That deal no longer exists.' });
  }, [board.id, goToBoard, openDeal, showToast]);

  const agentFor = useCallback((itemId) => findItem(tree, itemId)?.item.agent || null, [tree]);

  // ---- board switcher ----
  const pickBoard = useCallback((boardId) => {
    setBoardMenu(null);
    setEditBoardId(null);
    if (boardId !== board.id) goToBoard(boardId);
  }, [board.id, goToBoard]);

  const doRename = useCallback(async (boardId, name) => {
    const prev = boards.find((b) => b.id === boardId)?.name;
    setEditBoardId(null);
    setBoards((list) => list.map((b) => (b.id === boardId ? { ...b, name } : b)));
    if (boardId === board.id) setTree((t) => ({ ...t, name }));
    try {
      await renameBoard(sb, boardId, name);
    } catch (e) {
      console.error('renameBoard failed', e);
      setBoards((list) => list.map((b) => (b.id === boardId ? { ...b, name: prev } : b)));
      if (boardId === board.id) setTree((t) => ({ ...t, name: prev }));
      showToast({ text: 'Couldn’t rename the board.' }, 4000);
    }
  }, [sb, boards, board.id, showToast]);

  const switcherProps = {
    editingId: editBoardId,
    pending: navPending ? navTarget : null,
    onPick: pickBoard,
    onEdit: setEditBoardId,
    onRename: doRename,
    onCancelEdit: () => setEditBoardId(null),
  };

  const signOut = useCallback(async () => {
    await sb.auth.signOut();
    window.location.href = '/login';
  }, [sb]);

  const selectTab = useCallback((t) => {
    setTab(t);
    setBoardMenu(null);
    setMenu(null);
    if (detail) closeDeal();
    if (t === 'inbox') loadNotifs();
  }, [detail, closeDeal, loadNotifs]);

  // With a deal open no tab is current, so Board closes the deal rather than
  // opening the switcher.
  const onTabBoardAgain = useCallback(() => {
    if (detail?.open) return selectTab('board');
    toggleBoardMenu('tab');
  }, [detail, selectTab, toggleBoardMenu]);

  const detailItem = detail ? findItem(tree, detail.id)?.item : null;
  // The deal was deleted (or moved off this board) while open.
  useEffect(() => { if (detail && !detailItem) setDetail(null); }, [detail, detailItem]);

  return (
    <div className={'mapp' + (dark ? ' dark' : '')}>
      <div className="m-phone">
        <div className="m-main">
          {tab === 'board' && (
            <BoardTab
              tree={tree}
              boards={boards}
              options={options}
              profile={profile}
              switcher={{ open: boardMenu, props: switcherProps }}
              collapsed={collapsed}
              query={query}
              agent={agent}
              agentMenu={menu?.kind === 'agent'}
              sort={sort}
              sortMenu={menu?.kind === 'sort'}
              onOpenSortMenu={(el, count) => toggleMenu({ kind: 'sort', where: 'board' }, el, count, 84)}
              onSort={pickSort}
              onOpenAgentMenu={(el, count) => toggleMenu({ kind: 'agent', where: 'board' }, el, count, 84)}
              undoDepth={undoDepth}
              expandedId={expandedId}
              menu={menu}
              condSel={condSel}
              flashId={flashId}
              onToggleBoardMenu={toggleBoardMenu}
              onToggleGroup={toggleGroup}
              onToggleAll={toggleAll}
              onQuery={setQuery}
              onAgent={pickAgent}
              onUndo={undo}
              onToggleExpand={toggleExpand}
              onOpenStatus={(itemId, el, count, where) => toggleMenu({ kind: 'status', where, itemId }, el, count, 84)}
              onPickStatus={setStatus}
              condHandlersFor={condHandlersFor}
              onOpenDeal={openDeal}
            />
          )}
          {tab === 'inbox' && (
            <NotificationsTab
              notifs={notifs}
              options={options}
              agentFor={agentFor}
              onOpen={openNotif}
              onDismiss={dismissNotif}
              onClearAll={clearAllNotifs}
            />
          )}
          {tab === 'me' && (
            <MeTab
              profile={profile}
              email={user.email}
              boardId={board.id}
              dark={dark}
              onToggleDark={toggleDark}
              onSignOut={signOut}
            />
          )}
        </div>

        {boardMenu === 'tab' && (
          <BoardSwitcher placement="tab" boards={boards} activeId={board.id} {...switcherProps} />
        )}

        <TabBar
          tab={detail?.open ? null : tab}
          badge={notifs?.length || 0}
          onSelect={selectTab}
          onBoardAgain={onTabBoardAgain}
        />

        {detailItem && (
          <DealDetail
            item={detailItem}
            options={options}
            tab={detail.tab}
            open={detail.open}
            statusMenu={menu?.kind === 'status' && menu.where === 'detail' && menu.itemId === detailItem.id ? menu : null}
            condMenu={menu?.kind === 'cond' && menu.where === 'detail' && menu.itemId === detailItem.id ? menu : null}
            selected={condSel[detailItem.id] || []}
            updates={updatesByItem[detailItem.id]}
            onTab={setDetailTab}
            onClose={closeDeal}
            onOpenStatus={(itemId, el, count) => toggleMenu({ kind: 'status', where: 'detail', itemId }, el, count, 16)}
            onPickStatus={setStatus}
            onCommit={commitField}
            condHandlers={condHandlersFor(detailItem.id, 'detail')}
            onPostUpdate={sendUpdate}
            onEditUpdate={saveUpdateEdit}
            onDeleteUpdate={deleteUpdateFor}
          />
        )}

        {toast && (
          <div className="m-toast" role="status">
            <span className="m-toast-text">{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                className="m-toast-action"
                onClick={() => { toast.onAction(); setToast(null); }}
              >{toast.action}</button>
            )}
          </div>
        )}

        {navPending && <div className="m-navbar-progress" aria-hidden="true" />}
      </div>
    </div>
  );
}
