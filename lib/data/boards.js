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
         items ( id, name, position, agent, deal, close_date, lender, volume,
                 status, appraisal, appraiser, instructed, broker, compliance,
                 notes, email,
                 subitems ( id, name, cond, due_date, details, position ) ) )`)
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

// Soft delete: keep a copy so the trash view can restore it.
export async function deleteItem(sb, itemId) {
  const { data: item } = await sb.from('items')
    .select('*, subitems(*)').eq('id', itemId).single();
  if (item) await sb.from('trash').insert({ kind: 'item', name: item.name, payload: item });
  const { error } = await sb.from('items').delete().eq('id', itemId);
  if (error) throw error;
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
  const tree = await getBoardTree(sb, boardId);
  await sb.from('trash').insert({ kind: 'board', name: tree.name, payload: tree });
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
