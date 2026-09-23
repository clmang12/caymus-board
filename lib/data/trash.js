// Browse, restore, and permanently purge soft-deleted items and boards.
// Platform-neutral. Rows are restored under their original ids, so anything
// that referenced them (attachments -> subitems, etc.) lines up again.
const BUCKET = 'attachments';
const NESTED = ['groups', 'items', 'subitems', 'updates', 'attachments',
  'field_options', 'subitem_templates', 'automations'];

const strip = (row) => Object.fromEntries(Object.entries(row).filter(([k]) => !NESTED.includes(k)));

async function insertAll(sb, table, rows) {
  if (!rows.length) return;
  const { error } = await sb.from(table).insert(rows);
  if (error) throw error;
}

// Children of already-inserted items. Order matters: attachments can point at subitems.
async function insertItemChildren(sb, items) {
  const rows = (key) => items.flatMap((it) => (it[key] || []).map((r) => ({ ...r, item_id: it.id })));
  await insertAll(sb, 'subitems', rows('subitems'));
  await insertAll(sb, 'updates', rows('updates'));
  await insertAll(sb, 'attachments', rows('attachments'));
}

export async function listTrash(sb) {
  const { data, error } = await sb.from('trash')
    .select('id, kind, name, deleted_at, board_id:payload->>board_id')
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Most recent trash row for a deleted item, or null.
export async function findItemTrashId(sb, itemId) {
  const { data, error } = await sb.from('trash').select('id')
    .eq('kind', 'item').eq('payload->>id', itemId)
    .order('deleted_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function restoreItem(sb, p) {
  const { data: board } = await sb.from('boards').select('id').eq('id', p.board_id).maybeSingle();
  if (!board) throw new Error("This deal's board was deleted — restore the board first.");

  let groupId = p.group_id;
  const { data: group } = await sb.from('groups').select('id').eq('id', groupId).maybeSingle();
  if (!group) {
    const { data: first } = await sb.from('groups').select('id')
      .eq('board_id', p.board_id).order('position').limit(1).maybeSingle();
    if (!first) throw new Error('That board has no groups to restore the deal into.');
    groupId = first.id;
  }

  await insertAll(sb, 'items', [{ ...strip(p), group_id: groupId }]);
  try {
    await insertItemChildren(sb, [p]);
  } catch (e) {
    await sb.from('items').delete().eq('id', p.id);
    throw e;
  }
}

async function restoreBoard(sb, p) {
  const { data: last } = await sb.from('boards')
    .select('position').order('position', { ascending: false }).limit(1).maybeSingle();
  await insertAll(sb, 'boards', [{ ...strip(p), position: (last?.position ?? -1) + 1 }]);

  try {
    const groups = p.groups || [];
    const items = groups.flatMap((g) => (g.items || []).map((it) => ({ ...it, board_id: p.id, group_id: g.id })));
    await insertAll(sb, 'groups', groups.map((g) => ({ ...strip(g), board_id: p.id })));
    await insertAll(sb, 'items', items.map(strip));
    await insertItemChildren(sb, items);

    // Boards trashed before snapshots included board config have no options or
    // checklists; borrow them from the first remaining board so it's usable.
    let options = p.field_options;
    let templates = p.subitem_templates;
    if (!options) {
      const { data: src } = await sb.from('boards').select('id')
        .neq('id', p.id).order('position').limit(1).maybeSingle();
      if (src) {
        const [o, t] = await Promise.all([
          sb.from('field_options').select('field, label, color, position').eq('board_id', src.id),
          sb.from('subitem_templates').select('deal, name, position').eq('board_id', src.id),
        ]);
        options = o.data || [];
        templates = templates || t.data || [];
      }
    }
    const withBoard = (rows) => (rows || []).map((r) => ({ ...r, board_id: p.id }));
    await insertAll(sb, 'field_options', withBoard(options));
    await insertAll(sb, 'subitem_templates', withBoard(templates));
    await insertAll(sb, 'automations', withBoard(p.automations));
  } catch (e) {
    await sb.from('boards').delete().eq('id', p.id);
    throw e;
  }
}

export async function restoreFromTrash(sb, trashId) {
  const { data: row, error } = await sb.from('trash').select('kind, payload').eq('id', trashId).single();
  if (error) throw error;
  if (row.kind === 'board') await restoreBoard(sb, row.payload);
  else await restoreItem(sb, row.payload);
  const { error: e2 } = await sb.from('trash').delete().eq('id', trashId);
  if (e2) throw e2;
  return row.kind;
}

function storagePaths(kind, p) {
  const items = kind === 'board' ? (p.groups || []).flatMap((g) => g.items || []) : [p];
  return items.flatMap((it) => (it.attachments || []).map((a) => a.storage_path));
}

// Permanent: also removes the files from storage, which the DB cascade leaves behind.
export async function deleteFromTrash(sb, trashId) {
  const { data: row, error } = await sb.from('trash').select('kind, payload').eq('id', trashId).single();
  if (error) throw error;
  const paths = storagePaths(row.kind, row.payload);
  if (paths.length) {
    const { error: se } = await sb.storage.from(BUCKET).remove(paths);
    if (se) throw se;
  }
  const { error: e2 } = await sb.from('trash').delete().eq('id', trashId);
  if (e2) throw e2;
}

export async function emptyTrash(sb) {
  const { data, error } = await sb.from('trash').select('id');
  if (error) throw error;
  for (const r of data) await deleteFromTrash(sb, r.id);
}
