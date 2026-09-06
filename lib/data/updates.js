export async function listUpdates(sb, itemId) {
  const { data, error } = await sb.from('updates')
    .select('id, body, created_at, author:profiles(id, full_name, email)')
    .eq('item_id', itemId).order('created_at', { ascending: false });
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
