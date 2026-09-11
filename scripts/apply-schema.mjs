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
const marker = '-- ==CRON==';
const splitAt = sql.indexOf(marker);
const mainSql = splitAt < 0 ? sql : sql.slice(0, splitAt);
const cronSql = splitAt < 0 ? '' : sql.slice(splitAt);

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log('Connected. Applying schema.sql ...');
try {
  await client.query(mainSql);
  console.log('Schema applied successfully.');
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
}

// pg_cron needs to be enabled per-project; some plans only allow that from
// the dashboard. Run it as its own batch so a failure here can't roll back
// the schema above (Postgres runs a multi-statement simple-query string as
// one implicit transaction).
if (cronSql.trim() && !process.exitCode) {
  try {
    await client.query(cronSql);
    console.log('pg_cron schedule applied.');
  } catch (err) {
    console.warn('pg_cron step skipped:', err.message);
    console.warn('Enable "pg_cron" under Database > Extensions in the Supabase dashboard, then re-run this script.');
  }
}

await client.end();
