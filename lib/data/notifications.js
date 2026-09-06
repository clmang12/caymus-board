export async function listNotifications(sb, userId) {
  const { data, error } = await sb.from('notifications')
    .select('id, item_id, board_id, kind, message, read_at, created_at')
    .eq('user_id', userId).is('read_at', null)
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return data;
}

export async function dismissNotification(sb, id) {
  const { error } = await sb.from('notifications')
    .update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function dismissForItem(sb, userId, itemId) {
  const { error } = await sb.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId).eq('item_id', itemId).is('read_at', null);
  if (error) throw error;
}

export async function dismissAll(sb, userId) {
  const { error } = await sb.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId).is('read_at', null);
  if (error) throw error;
}
