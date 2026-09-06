// One-time: create the private 'attachments' storage bucket.
// Usage: npm run setup:storage  (reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local)
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const env = {};
try {
  const raw = await readFile(join(root, '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  console.error('Could not read .env.local.');
  process.exit(1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const { data: existing } = await sb.storage.getBucket('attachments');
if (existing) {
  console.log("Bucket 'attachments' already exists.");
  process.exit(0);
}
const { error } = await sb.storage.createBucket('attachments', { public: false });
if (error) {
  console.error('Failed to create bucket:', error.message);
  process.exit(1);
}
console.log("Created private bucket 'attachments'.");
