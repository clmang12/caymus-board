// Pure helpers over the getBoardTree() shape: { groups: [{ items: [{ subitems }] }] }.
// No React, no Supabase — every function returns a new tree.

export function findItem(tree, itemId) {
  for (const group of tree.groups) {
    const item = (group.items || []).find((it) => it.id === itemId);
    if (item) return { group, item };
  }
  return null;
}

export function patchItem(tree, itemId, patch) {
  return {
    ...tree,
    groups: tree.groups.map((g) => (g.items.some((it) => it.id === itemId)
      ? { ...g, items: g.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }
      : g)),
  };
}

export function patchSubitems(tree, itemId, fn) {
  return {
    ...tree,
    groups: tree.groups.map((g) => (g.items.some((it) => it.id === itemId)
      ? { ...g, items: g.items.map((it) => (it.id === itemId ? { ...it, subitems: fn(it.subitems || []) } : it)) }
      : g)),
  };
}

// Index at which an item with `position` belongs in an already-sorted list.
function slotFor(items, position) {
  const at = items.findIndex((it) => it.position > position);
  return at < 0 ? items.length : at;
}

// Move an item into `groupId` (applying `patch`), either first in the group
// or wherever its position puts it. Keeps its loaded conditions.
export function placeItem(tree, itemId, groupId, patch = {}, { top = false } = {}) {
  const found = findItem(tree, itemId);
  if (!found || !tree.groups.some((g) => g.id === groupId)) return tree;
  const moved = { ...found.item, ...patch, group_id: groupId };
  return {
    ...tree,
    groups: tree.groups.map((g) => {
      const items = g.items.filter((it) => it.id !== itemId);
      if (g.id !== groupId) return items.length === g.items.length ? g : { ...g, items };
      const at = top ? 0 : slotFor(items, moved.position);
      return { ...g, items: [...items.slice(0, at), moved, ...items.slice(at)] };
    }),
  };
}

// Apply one realtime change from subscribeToBoard(). Mirrors BoardGrid's
// merge: rows patch in place; a deal that changed group is slotted in by
// position, keeping the conditions it already had (the payload lacks them).
export function mergeChange(tree, { table, event, row }) {
  if (table === 'items') {
    if (event === 'DELETE') {
      return { ...tree, groups: tree.groups.map((g) => ({ ...g, items: g.items.filter((it) => it.id !== row.id) })) };
    }
    if (!tree.groups.some((g) => g.id === row.group_id)) return tree; // another board
    const prev = findItem(tree, row.id);
    if (prev && prev.group.id === row.group_id) return patchItem(tree, row.id, row);
    if (prev) return placeItem(tree, row.id, row.group_id, row);
    return {
      ...tree,
      groups: tree.groups.map((g) => {
        if (g.id !== row.group_id) return g;
        const at = slotFor(g.items, row.position);
        return { ...g, items: [...g.items.slice(0, at), { ...row, subitems: [] }, ...g.items.slice(at)] };
      }),
    };
  }
  if (table === 'subitems') {
    if (event === 'DELETE') {
      return {
        ...tree,
        groups: tree.groups.map((g) => ({
          ...g,
          items: g.items.map((it) => ((it.subitems || []).some((s) => s.id === row.id)
            ? { ...it, subitems: it.subitems.filter((s) => s.id !== row.id) }
            : it)),
        })),
      };
    }
    if (!findItem(tree, row.item_id)) return tree;
    return patchSubitems(tree, row.item_id, (subs) => (subs.some((s) => s.id === row.id)
      ? subs.map((s) => (s.id === row.id ? { ...s, ...row } : s))
      : [...subs, row].sort((a, b) => a.position - b.position)));
  }
  if (table === 'groups') {
    return { ...tree, groups: tree.groups.map((g) => (g.id === row.id ? { ...g, ...row } : g)) };
  }
  return tree;
}
