// Allow an email to create an account (sign-up is invite-only; see
// allowed_emails in supabase/schema.sql). They then sign in with
// "Email me a sign-in link" and can set a password from the sidebar.
// Usage: npm run invite -- someone@example.com [--remove]
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';

const raw = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const env = {};
for (const l of raw.split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2]; }

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes('@')) {
  console.error('Usage: npm run invite -- someone@example.com [--remove]');
  process.exit(1);
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

if (process.argv.includes('--remove')) {
  const { error } = await admin.from('allowed_emails').delete().eq('email', email);
  if (error) throw error;
  console.log(`Removed ${email} from the invite list. An existing account is not deleted.`);
} else {
  const { error } = await admin.from('allowed_emails').upsert({ email });
  if (error) throw error;
  console.log(`Invited ${email}. They can now sign in with "Email me a sign-in link".`);
}
