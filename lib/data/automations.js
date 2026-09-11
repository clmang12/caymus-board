export async function listAutomations(sb, boardId) {
  const { data, error } = await sb.from('automations').select('key, enabled').eq('board_id', boardId);
  if (error) throw error;
  return data;
}

export async function setAutomation(sb, boardId, key, enabled) {
  const { error } = await sb.from('automations')
    .upsert({ board_id: boardId, key, enabled }, { onConflict: 'board_id,key' });
  if (error) throw error;
}
