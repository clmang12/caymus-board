export async function getSubitems(sb, itemId) {
  const { data, error } = await sb.from('subitems')
    .select('*').eq('item_id', itemId).order('position');
  if (error) throw error;
  return data;
}

export async function addSubitem(sb, itemId, name) {
  const { data: last } = await sb.from('subitems')
    .select('position').eq('item_id', itemId)
    .order('position', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await sb.from('subitems')
    .insert({ item_id: itemId, name, position: (last?.position ?? -1) + 1 })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateSubitem(sb, subitemId, patch) {
  const { data, error } = await sb.from('subitems')
    .update(patch).eq('id', subitemId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSubitem(sb, subitemId) {
  const { error } = await sb.from('subitems').delete().eq('id', subitemId);
  if (error) throw error;
}

// Apply the Purch / Refi checklist to an item.
export async function applyTemplate(sb, itemId, boardId, deal) {
  const { data: tpl, error } = await sb.from('subitem_templates')
    .select('name, position').eq('deal', deal).order('position');
  if (error) throw error;
  if (!tpl?.length) return [];
  const rows = tpl.map((t, i) => ({ item_id: itemId, name: t.name, position: i }));
  const { data, error: e2 } = await sb.from('subitems').insert(rows).select();
  if (e2) throw e2;
  return data;
}
