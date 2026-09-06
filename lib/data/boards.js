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

export async function reorderBoards(sb, orderedIds) {
  const rows = orderedIds.map((id, i) => ({ id, position: i }));
  const { error } = await sb.from('boards').upsert(rows);
  if (error) throw error;
}

export async function renameBoard(sb, boardId, name) {
  const { error } = await sb.from('boards').update({ name }).eq('id', boardId);
  if (error) throw error;
}

export async function updateGroup(sb, groupId, patch) {
  const { error } = await sb.from('groups').update(patch).eq('id', groupId);
  if (error) throw error;
}
