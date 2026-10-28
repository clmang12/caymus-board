import { htmlToText } from '../richtext';

export async function listUpdates(sb, itemId) {
  const { data, error } = await sb.from('updates')
    .select('id, body, created_at, author:profiles(id, full_name, email)')
    .eq('item_id', itemId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function editUpdate(sb, updateId, body) {
  const { data, error } = await sb.from('updates')
    .update({ body }).eq('id', updateId)
    .select('id, body, created_at, author:profiles(id, full_name, email)').single();
  if (error) throw error;
  return data;
}

export async function postUpdate(sb, itemId, authorId, body) {
  const { data, error } = await sb.from('updates')
    .insert({ item_id: itemId, author_id: authorId, body })
    .select('id, body, created_at, author:profiles(id, full_name, email)').single();
  if (error) throw error;
  return data;
}

// Soft delete for an update post, restorable from the trash view.
// Returns the trash row id, or null if the update doesn't exist.
export async function trashUpdate(sb, updateId, { via } = {}) {
  const { data: u, error } = await sb.from('updates')
    .select('*, item:items(name, board_id)').eq('id', updateId).maybeSingle();
  if (error) throw error;
  if (!u) return null;
  const { item, ...payload } = u;
  const text = htmlToText(u.body);
  const snippet = text.length > 40 ? text.slice(0, 40) + '…' : text;
  const { data: t, error: te } = await sb.from('trash').insert({
    kind: 'update', name: `Update on ${item.name}: "${snippet}"`,
    payload: { ...payload, board_id: item.board_id, deleted_via: via },
  }).select('id').single();
  if (te) throw te;
  await deleteUpdate(sb, updateId);
  return t.id;
}

export async function deleteUpdate(sb, updateId) {
  const { error } = await sb.from('updates').delete().eq('id', updateId);
  if (error) throw error;
}
