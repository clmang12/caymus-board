const BUCKET = 'attachments';

export async function uploadAttachment(sb, { itemId, subitemId = null, file, userId }) {
  const path = itemId + '/' + Date.now() + '-' + file.name.replace(/[^\w.\-]/g, '_');
  const { error: upErr } = await sb.storage.from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await sb.from('attachments').insert({
    item_id: itemId, subitem_id: subitemId, storage_path: path,
    filename: file.name, mime_type: file.type, size_bytes: file.size,
    uploaded_by: userId
  }).select().single();
  if (error) throw error;
  return data;
}

export async function listAttachments(sb, itemId) {
  const { data, error } = await sb.from('attachments')
    .select('*').eq('item_id', itemId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// The bucket is private, so downloads need a short-lived signed URL.
export async function getDownloadUrl(sb, storagePath, expiresIn = 300) {
  const { data, error } = await sb.storage.from(BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAttachment(sb, id, storagePath) {
  await sb.storage.from(BUCKET).remove([storagePath]);
  const { error } = await sb.from('attachments').delete().eq('id', id);
  if (error) throw error;
}
