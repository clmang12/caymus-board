export async function getProfile(sb, userId) {
  const { data, error } = await sb.from('profiles')
    .select('id, email, full_name, role').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}
