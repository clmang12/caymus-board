// Works unchanged on web and React Native.
// Returns an unsubscribe function.

export function subscribeToBoard(sb, boardId, onChange) {
  const channel = sb.channel('board:' + boardId)
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: 'board_id=eq.' + boardId },
        (p) => onChange({ table: 'items', event: p.eventType, row: p.new ?? p.old }))
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'subitems' },
        (p) => onChange({ table: 'subitems', event: p.eventType, row: p.new ?? p.old }))
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'groups', filter: 'board_id=eq.' + boardId },
        (p) => onChange({ table: 'groups', event: p.eventType, row: p.new ?? p.old }))
    .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'field_options', filter: 'board_id=eq.' + boardId },
        (p) => onChange({ table: 'field_options', event: p.eventType, row: p.new }))
    .subscribe();

  return () => { sb.removeChannel(channel); };
}
