// Board / group / item reads and writes. Platform-neutral.

export async function listBoards(sb) {
  const { data, error } = await sb.from('boards')
    .select('id, name, description, position')
    .order('position');
  if (error) throw error;
  return data;
}

// The whole board in one round trip.
export async function getBoardTree(sb, boardId) {
  const { data, error } = await sb.from('boards')
    .select(`id, name, description,
       groups ( id, title, color, position, collapsed,
         items ( id, name, position, created_at, updated_at, agent, deal, close_date, lender, volume,
                 status, appraisal, appraiser, instructed, broker, compliance,
                 notes, email,
                 subitems ( id, name, cond, cond_date, due_date, details, position ) ) )`)
    .eq('id', boardId)
    .order('position', { referencedTable: 'groups' })
    .single();
  if (error) throw error;

  data.groups.sort((a, b) => a.position - b.position);
  for (const g of data.groups) {
    g.items.sort((a, b) => a.position - b.position);
    for (const it of g.items) it.subitems.sort((a, b) => a.position - b.position);
  }
  return data;
}

// Appends after the highest existing position; positions have gaps once
// options are deleted, so the list length isn't a safe next position.
export async function addFieldOption(sb, boardId, field, label) {
  const { data: last, error: e1 } = await sb.from('field_options')
    .select('position').eq('board_id', boardId).eq('field', field)
    .order('position', { ascending: false }).limit(1).maybeSingle();
  if (e1) throw e1;
  const position = last ? last.position + 1 : 0;
  const { data, error } = await sb.from('field_options')
    .insert({ board_id: boardId, field, label, position })
    .select('field, label, color, position').single();
  if (error) throw error;
  return data;
}

export async function deleteFieldOption(sb, boardId, field, label) {
  const { error } = await sb.from('field_options')
    .delete().eq('board_id', boardId).eq('field', field).eq('label', label);
  if (error) throw error;
}

export async function getFieldOptions(sb, boardId) {
  const { data, error } = await sb.from('field_options')
    .select('field, label, color, position')
    .eq('board_id', boardId).order('position');
  if (error) throw error;
  return data.reduce((acc, o) => {
    (acc[o.field] ||= []).push([o.label, o.color]);
    return acc;
  }, {});
}

export async function updateItem(sb, itemId, patch) {
  const { data, error } = await sb.from('items')
    .update(patch).eq('id', itemId).select().single();
  if (error) throw error;
  return data;
}

// "+ New Deal" lands in the first group that isn't the "Template" group
// (the prototype's rule); a board with only that group falls back to it.
export function newDealGroup(groups) {
  return groups.find((g) => !/template/i.test(g.title)) || groups[0] || null;
}

// Which seeded checklist (subitem_templates.deal) a deal type gets, if any.
export function checklistFor(dealLabel) {
  if (/purch/i.test(dealLabel || '')) return 'Purch';
  if (/refi/i.test(dealLabel || '')) return 'Refi';
  return null;
}

export async function createItem(sb, { boardId, groupId, name, ...rest }) {
  const { data: last } = await sb.from('items')
    .select('position').eq('group_id', groupId)
    .order('position', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await sb.from('items').insert({
    board_id: boardId, group_id: groupId, name,
    position: (last?.position ?? -1) + 1, ...rest
  }).select().single();
  if (error) throw error;
  return data;
}

const ITEM_FIELDS = `id, name, agent, deal, close_date, lender, volume, status, appraisal,
  appraiser, instructed, broker, compliance, notes, email, created_at, updated_at`;

// One deal with its group, board and conditions, or null if it doesn't exist.
export async function getItem(sb, itemId) {
  const { data, error } = await sb.from('items')
    .select(`${ITEM_FIELDS}, group:groups(id, title), board:boards(id, name),
             subitems(id, name, cond, cond_date, due_date, details, position)`)
    .eq('id', itemId).maybeSingle();
  if (error) throw error;
  if (data) data.subitems.sort((a, b) => a.position - b.position);
  return data;
}

// Deals across every board (or one), soonest closing first. Text matches the
// name, notes or email; lender matches one entry of the lender list exactly.
export async function searchItems(sb, { text, boardId, groupId, status, agent, lender, closeFrom, closeTo, limit = 50 } = {}) {
  let q = sb.from('items')
    .select(`${ITEM_FIELDS}, group:groups(id, title), board:boards(id, name)`);
  if (text) {
    // PostgREST's or() syntax uses , ( ) as separators.
    const t = text.replace(/[%,()*]/g, ' ').trim();
    if (t) q = q.or(`name.ilike.%${t}%,notes.ilike.%${t}%,email.ilike.%${t}%`);
  }
  if (boardId) q = q.eq('board_id', boardId);
  if (groupId) q = q.eq('group_id', groupId);
  if (status) q = q.ilike('status', status);
  if (agent) q = q.ilike('agent', agent);
  if (lender) q = q.contains('lender', [lender]);
  if (closeFrom) q = q.gte('close_date', closeFrom);
  if (closeTo) q = q.lte('close_date', closeTo);
  const { data, error } = await q
    .order('close_date', { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// Move a deal to the bottom of another group.
export async function moveItemToGroup(sb, itemId, groupId) {
  const { data: last } = await sb.from('items')
    .select('position').eq('group_id', groupId)
    .order('position', { ascending: false }).limit(1).maybeSingle();
  return moveItem(sb, itemId, groupId, (last?.position ?? -1) + 1);
}

// Copy an item (and its subitems) into the same group, appended after
// the existing rows. Attachments are not copied — they're storage objects,
// not cheap to clone, and duplicating a deal rarely means duplicating its files.
export async function duplicateItem(sb, itemId) {
  const { data: src, error: e1 } = await sb.from('items')
    .select('*, subitems(*)').eq('id', itemId).single();
  if (e1) throw e1;

  const { id, created_at, position, subitems, ...rest } = src;
  const { data: last } = await sb.from('items')
    .select('position').eq('group_id', src.group_id)
    .order('position', { ascending: false }).limit(1).maybeSingle();
  const { data: created, error: e2 } = await sb.from('items')
    .insert({ ...rest, name: `${src.name} (copy)`, position: (last?.position ?? -1) + 1 })
    .select().single();
  if (e2) throw e2;

  let newSubs = [];
  if (subitems?.length) {
    const rows = subitems
      .slice().sort((a, b) => a.position - b.position)
      .map(({ id, item_id, created_at, ...s }) => ({ ...s, item_id: created.id }));
    const { data, error: e3 } = await sb.from('subitems').insert(rows).select();
    if (e3) throw e3;
    newSubs = data.sort((a, b) => a.position - b.position);
  }
  return { ...created, subitems: newSubs };
}

// Soft delete: keep a copy so the trash view can restore it. Updates and
// attachment rows cascade-delete with the item, so they go in the snapshot too.
// `via` labels deletes made on someone's behalf (e.g. 'AI assistant').
// Returns the trash row id (null if the item was already gone).
export async function deleteItem(sb, itemId, { via } = {}) {
  const { data: item } = await sb.from('items')
    .select('*, subitems(*), updates(*), attachments(*)').eq('id', itemId).single();
  let trashId = null;
  if (item) {
    const { data, error: trashErr } = await sb.from('trash')
      .insert({ kind: 'item', name: item.name, payload: { ...item, deleted_via: via } })
      .select('id').single();
    if (trashErr) throw trashErr;
    trashId = data.id;
  }
  const { error } = await sb.from('items').delete().eq('id', itemId);
  if (error) throw error;
  return trashId;
}

export async function moveItem(sb, itemId, groupId, position) {
  return updateItem(sb, itemId, { group_id: groupId, position });
}

// Persist a new global board order. Sequential updates rather than upsert —
// upsert would take the INSERT path and trip the NOT NULL on `name`.
export async function reorderBoards(sb, orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await sb.from('boards').update({ position: i }).eq('id', orderedIds[i]);
    if (error) throw error;
  }
}

export async function renameBoard(sb, boardId, name) {
  const { error } = await sb.from('boards').update({ name }).eq('id', boardId);
  if (error) throw error;
}

// New board, appended to the end of the list. Its structure — groups, label /
// dropdown options, and Purch/Refi checklists, but no deals — is copied from
// `fromBoardId` (default: the first board), so a new board starts looking like
// the team's existing one. Falls back to a single "Deals" group if there's
// nothing to copy from.
export async function createBoard(sb, { name, fromBoardId } = {}) {
  const { data: last } = await sb.from('boards')
    .select('position').order('position', { ascending: false }).limit(1).maybeSingle();

  let srcId = fromBoardId;
  if (!srcId) {
    const { data: first } = await sb.from('boards')
      .select('id').order('position').limit(1).maybeSingle();
    srcId = first?.id;
  }

  const [{ data: srcGroups }, { data: srcOpts }, { data: srcTemplates }] = srcId
    ? await Promise.all([
        sb.from('groups').select('title, color, position').eq('board_id', srcId).order('position'),
        sb.from('field_options').select('field, label, color, position').eq('board_id', srcId).order('position'),
        sb.from('subitem_templates').select('deal, name, position').eq('board_id', srcId),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  const { data: board, error } = await sb.from('boards')
    .insert({ name: name || 'Untitled board', position: (last?.position ?? -1) + 1 })
    .select().single();
  if (error) throw error;

  const groupRows = (srcGroups?.length
    ? srcGroups.map((g) => ({ ...g, collapsed: false }))
    : [{ title: 'Deals', color: '#0073ea', position: 0 }]
  ).map((g) => ({ ...g, board_id: board.id }));
  const { data: groups } = await sb.from('groups').insert(groupRows).select();

  if (srcOpts?.length) {
    await sb.from('field_options').insert(srcOpts.map((o) => ({ ...o, board_id: board.id })));
  }
  if (srcTemplates?.length) {
    await sb.from('subitem_templates').insert(srcTemplates.map((t) => ({ ...t, board_id: board.id })));
  }

  return { ...board, groups: (groups || []).sort((a, b) => a.position - b.position) };
}

// Deep copy a board (groups, field options, items, subitems, templates), placed
// right after the original. IDs are generated client-side so we can remap
// parent references without extra round trips. Returns the new board id.
export async function duplicateBoard(sb, boardId) {
  const [{ data: src, error: se }, { data: groups }, { data: opts }, { data: items }, { data: templates }, { data: allBoards }] =
    await Promise.all([
      sb.from('boards').select('name').eq('id', boardId).single(),
      sb.from('groups').select('*').eq('board_id', boardId),
      sb.from('field_options').select('field, label, color, position').eq('board_id', boardId),
      sb.from('items').select('*').eq('board_id', boardId),
      sb.from('subitem_templates').select('deal, name, position').eq('board_id', boardId),
      sb.from('boards').select('id').order('position'),
    ]);
  if (se) throw se;

  const itemIds = (items || []).map((i) => i.id);
  const { data: subs } = itemIds.length
    ? await sb.from('subitems').select('*').in('item_id', itemIds)
    : { data: [] };

  const newBoardId = crypto.randomUUID();
  const groupMap = new Map((groups || []).map((g) => [g.id, crypto.randomUUID()]));
  const itemMap = new Map((items || []).map((i) => [i.id, crypto.randomUUID()]));

  const strip = (row, keys) => {
    const out = { ...row };
    for (const k of keys) delete out[k];
    return out;
  };

  const { error: be } = await sb.from('boards')
    .insert({ id: newBoardId, name: src.name + ' (copy)', position: 999999 });
  if (be) throw be;

  if (groups?.length) {
    const { error } = await sb.from('groups').insert(groups.map((g) => ({
      ...strip(g, ['id']), id: groupMap.get(g.id), board_id: newBoardId,
    })));
    if (error) throw error;
  }
  if (opts?.length) {
    const { error } = await sb.from('field_options')
      .insert(opts.map((o) => ({ ...o, board_id: newBoardId })));
    if (error) throw error;
  }
  if (items?.length) {
    const { error } = await sb.from('items').insert(items.map((i) => ({
      ...strip(i, ['id', 'board_id', 'group_id', 'created_at', 'updated_at']),
      id: itemMap.get(i.id), board_id: newBoardId, group_id: groupMap.get(i.group_id),
    })));
    if (error) throw error;
  }
  if (subs?.length) {
    const { error } = await sb.from('subitems').insert(subs.map((s) => ({
      ...strip(s, ['id', 'item_id', 'created_at']), item_id: itemMap.get(s.item_id),
    })));
    if (error) throw error;
  }
  if (templates?.length) {
    const { error } = await sb.from('subitem_templates')
      .insert(templates.map((t) => ({ ...t, board_id: newBoardId })));
    if (error) throw error;
  }

  const order = (allBoards || []).map((b) => b.id);
  const at = order.indexOf(boardId);
  order.splice(at < 0 ? order.length : at + 1, 0, newBoardId);
  await reorderBoards(sb, order);

  return newBoardId;
}

// Soft delete: stash the whole tree in `trash`, then remove (cascades). Refuses
// to delete the last board.
export async function deleteBoard(sb, boardId) {
  const { count } = await sb.from('boards').select('id', { count: 'exact', head: true });
  if ((count ?? 0) <= 1) throw new Error('Cannot delete the last board');
  // Everything that cascade-deletes with the board, so a restore is complete.
  const { data: tree, error: e1 } = await sb.from('boards')
    .select(`*, groups(*, items(*, subitems(*), updates(*), attachments(*))),
             field_options(*), subitem_templates(*), automations(*)`)
    .eq('id', boardId).single();
  if (e1) throw e1;
  const { error: e2 } = await sb.from('trash').insert({ kind: 'board', name: tree.name, payload: tree });
  if (e2) throw e2;
  const { error } = await sb.from('boards').delete().eq('id', boardId);
  if (error) throw error;
}

export async function updateGroup(sb, groupId, patch) {
  const { error } = await sb.from('groups').update(patch).eq('id', groupId);
  if (error) throw error;
}

// Renumber a set of items (used after a drag between/within groups).
export async function setItemPositions(sb, rows) {
  for (const r of rows) {
    const patch = { position: r.position };
    if (r.group_id) patch.group_id = r.group_id;
    const { error } = await sb.from('items').update(patch).eq('id', r.id);
    if (error) throw error;
  }
}
