// Column model for the board grid. Order here is the default left-to-right
// layout from design-reference/README.md. Per-user width/order overrides live
// in user_prefs (see lib/data/prefs.js), keyed by `key` so they survive column
// set changes.

export const COLUMNS = [
  { key: 'name',       label: 'Deal / Client',   type: 'text',     width: 320, align: 'left',  sticky: true, field: null },
  { key: 'agent',      label: 'Agent',           type: 'label',    width: 130, align: 'center', field: 'agent', pill: true },
  { key: 'deal',       label: 'Deal Type',       type: 'dropdown', width: 120, align: 'center', field: 'deal' },
  { key: 'close_date', label: 'Closing Date',    type: 'date',     width: 130, align: 'center', field: null },
  { key: 'lender',     label: 'Lender',          type: 'multi',    width: 160, align: 'center', field: 'lender' },
  { key: 'volume',     label: 'Volume',          type: 'currency', width: 130, align: 'right',  field: null },
  { key: 'status',     label: 'Status',          type: 'label',    width: 130, align: 'center', field: 'status' },
  { key: 'appraisal',  label: 'Appraisal',       type: 'label',    width: 120, align: 'center', field: 'appraisal' },
  { key: 'appraiser',  label: 'Appraiser',       type: 'dropdown', width: 150, align: 'center', field: 'appraiser' },
  { key: 'instructed', label: 'Instructed',      type: 'label',    width: 110, align: 'center', field: 'instructed' },
  { key: 'broker',     label: 'Broker Complete', type: 'label',    width: 140, align: 'center', field: 'broker' },
  { key: 'compliance', label: 'Compliance',      type: 'label',    width: 120, align: 'center', field: 'compliance' },
  { key: 'notes',      label: 'Notes',           type: 'text',     width: 200, align: 'left',  field: null },
  { key: 'email',      label: 'Email',           type: 'text',     width: 190, align: 'left',  field: null },
];

export const COL_BY_KEY = Object.fromEntries(COLUMNS.map((c) => [c.key, c]));
export const DEFAULT_ORDER = COLUMNS.map((c) => c.key);
export const DEFAULT_WIDTHS = Object.fromEntries(COLUMNS.map((c) => [c.key, c.width]));

export const EMPTY_COLOR = '#c4c4c4';
export const MIN_COL_WIDTH = 72;

// Resolve the ordered, width-applied column list from prefs.
export function resolveColumns(prefs = {}) {
  const savedOrder = Array.isArray(prefs.colOrder) ? prefs.colOrder.filter((k) => COL_BY_KEY[k]) : [];
  const order = [...savedOrder, ...DEFAULT_ORDER.filter((k) => !savedOrder.includes(k))];
  const widths = { ...DEFAULT_WIDTHS, ...(prefs.colWidths || {}) };
  return order.map((key) => ({ ...COL_BY_KEY[key], width: Math.max(MIN_COL_WIDTH, widths[key] || COL_BY_KEY[key].width) }));
}

export function gridTemplate(cols) {
  return cols.map((c) => `${c.width}px`).join(' ');
}

// { field: [[label, color], ...] } -> color for a value, EMPTY_COLOR if unknown.
export function labelColor(options, field, value) {
  if (!value) return EMPTY_COLOR;
  const list = options?.[field] || [];
  const hit = list.find(([l]) => l === value);
  return (hit && hit[1]) || EMPTY_COLOR;
}

export function optionList(options, field) {
  return (options?.[field] || []).map(([label, color]) => ({ label, color: color || null }));
}

export function fmtCurrency(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function parseCurrency(str) {
  if (str === null || str === undefined || String(str).trim() === '') return null;
  const n = Number(String(str).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Progress %, mirrors the prototype: 25 pts each.
export function itemProgress(it) {
  let p = 0;
  if (it.status === 'Approved') p += 25;
  if (['Complete', 'Audit Done', "Audit Req'd"].includes(it.broker)) p += 25;
  if (it.appraisal === 'Completed') p += 25;
  if (it.instructed === 'YES') p += 25;
  return p;
}

export function softColor(hex) {
  return typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? hex + '99' : hex;
}
