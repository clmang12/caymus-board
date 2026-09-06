// One-time: apply supabase/schema.sql to the database.
// Usage: DATABASE_URL='postgresql://postgres:...' node scripts/apply-schema.mjs
// Or put DATABASE_URL in .env.local.
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

let url = process.env.DATABASE_URL;
if (!url) {
  try {
    const raw = await readFile(join(root, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
      if (m) url = m[1].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
if (!url) {
  console.error('Set DATABASE_URL (env or .env.local) to the Supabase connection string.');
  process.exit(1);
}

const sql = await readFile(join(root, 'supabase/schema.sql'), 'utf8');

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log('Connected. Applying schema.sql ...');
try {
  await client.query(sql);
  console.log('Schema applied successfully.');
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
