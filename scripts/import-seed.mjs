// One-time import of the prototype's seed data into Postgres.
// Usage: npm run seed
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// Load .env.local without a dependency.
const env = {};
try {
  const raw = await readFile(join(root, '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  console.error('Could not read .env.local. Copy .env.example to .env.local first.');
  process.exit(1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

// The seed file assigns to window.CAYMUS_SEED; give it a window to assign to.
const seedSrc = await readFile(join(root, 'design-reference/caymus-data.js'), 'utf8');
const sandbox = { window: {} };
new Function('window', seedSrc)(sandbox.window);
const SEED = sandbox.window.CAYMUS_SEED;
if (!SEED) { console.error('CAYMUS_SEED not found in design-reference/caymus-data.js'); process.exit(1); }

const { data: existing } = await sb.from('boards').select('id').limit(1);
if (existing?.length) {
  console.error('Boards already exist. Aborting so this does not create duplicates.');
  console.error('To start over, delete all rows from the boards table and re-run.');
  process.exit(1);
}

console.log('Importing board:', SEED.boardName);

const { data: board, error: bErr } = await sb.from('boards')
  .insert({ name: SEED.boardName, description: SEED.boardDesc, position: 0 })
  .select().single();
if (bErr) throw bErr;

// Label colours and dropdown choices.
const opts = [];
for (const [field, list] of Object.entries(SEED.labels ?? {}))
  list.forEach(([label, color], i) =>
    opts.push({ board_id: board.id, field, label, color, position: i }));
for (const [field, list] of Object.entries(SEED.dropdowns ?? {}))
  list.forEach((label, i) => {
    if (!opts.some((o) => o.field === field && o.label === label))
      opts.push({ board_id: board.id, field, label, color: null, position: i });
  });
if (opts.length) {
  const { error } = await sb.from('field_options').upsert(opts, { onConflict: 'board_id,field,label' });
  if (error) throw error;
  console.log('  field options:', opts.length);
}

// Purch / Refi checklists.
const tpl = [];
for (const [deal, names] of Object.entries(SEED.subTemplates ?? {}))
  names.forEach((name, i) => tpl.push({ board_id: board.id, deal, name, position: i }));
if (tpl.length) {
  const { error } = await sb.from('subitem_templates').insert(tpl);
  if (error) throw error;
  console.log('  templates:', tpl.length);
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const date = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

let gi = 0, itemCount = 0, subCount = 0;
for (const g of SEED.groups ?? []) {
  const { data: group, error: gErr } = await sb.from('groups')
    .insert({ board_id: board.id, title: g.title, color: g.color, position: gi++ })
    .select().single();
  if (gErr) throw gErr;

  let ii = 0;
  for (const it of g.items ?? []) {
    const { data: item, error: iErr } = await sb.from('items').insert({
      board_id: board.id, group_id: group.id, name: it.name, position: ii++,
      agent: it.agent, deal: it.deal, close_date: date(it.date),
      lender: Array.isArray(it.lender) ? it.lender : (it.lender ? [it.lender] : []),
      volume: num(it.vol), status: it.status, appraisal: it.appraisal,
      appraiser: it.appraiser, instructed: it.instructed, broker: it.broker,
      compliance: it.compliance, notes: it.notes, email: it.email,
      legacy_id: String(it.id)
    }).select().single();
    if (iErr) throw iErr;
    itemCount++;

    const subs = (it.subs ?? []).map((s, i) => ({
      item_id: item.id, name: s.name, cond: s.cond || 'Requested',
      due_date: date(s.date), details: s.details, position: i
    }));
    if (subs.length) {
      const { error } = await sb.from('subitems').insert(subs);
      if (error) throw error;
      subCount += subs.length;
    }
  }
  console.log('  group:', g.title, '(' + (g.items?.length ?? 0) + ' items)');
}

console.log('\nDone. ' + gi + ' groups, ' + itemCount + ' items, ' + subCount + ' subitems.');
console.log('Reload the app to see them.');
