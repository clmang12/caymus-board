// Column widths, column order, collapsed groups, theme.
// Replaces the prototype's localStorage keys so state follows the user
// across devices and into the mobile app.

export async function getPrefs(sb, userId, boardId) {
  const { data, error } = await sb.from('user_prefs')
    .select('prefs').eq('user_id', userId).eq('board_id', boardId).maybeSingle();
  if (error) throw error;
  return data?.prefs ?? {};
}

export async function savePrefs(sb, userId, boardId, prefs) {
  const { error } = await sb.from('user_prefs')
    .upsert({ user_id: userId, board_id: boardId, prefs });
  if (error) throw error;
}
