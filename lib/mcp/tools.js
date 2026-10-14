// Tools exposed to outside AI assistants (Claude, ChatGPT, ...) through the
// MCP endpoint at /api/mcp. Each tool is a thin wrapper over lib/data, run
// with a Supabase client that carries the caller's own OAuth access token, so
// RLS and the database automations apply exactly as they do in the web app.
//
// Scope is "read + everyday edits": no deletes, no board/group/automation
// admin, no dropdown-option management. The restrictive `oauth_*` policies in
// supabase/schema.sql enforce the same limits for OAuth tokens at the database,
// so a token used outside this endpoint can't do more than these tools.

import { z } from 'zod';
import {
  listBoards, getBoardTree, getFieldOptions, getItem, searchItems,
  updateItem, createItem, moveItemToGroup, newDealGroup, checklistFor,
} from '@/lib/data/boards';
import { getSubitem, addSubitem, updateSubitem, applyTemplate } from '@/lib/data/subitems';
import { listUpdates, postUpdate } from '@/lib/data/updates';
import { listAttachments } from '@/lib/data/attachments';

// Deal fields whose value must be one of the board's dropdown options.
const LABEL_FIELDS = ['agent', 'deal', 'status', 'appraisal', 'appraiser', 'instructed', 'broker', 'compliance'];

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const uuid = z.string().uuid();

const dealFields = {
  name: z.string().min(1).describe('Client name, usually "Last, First"'),
  agent: z.string().nullable(),
  deal: z.string().nullable().describe('Deal type, e.g. a Purchase or Refinance label'),
  close_date: date.nullable(),
  lender: z.array(z.string()).describe('Full list of lenders (replaces the current list)'),
  volume: z.number().nonnegative().nullable().describe('Mortgage amount in dollars'),
  status: z.string().nullable(),
  appraisal: z.string().nullable(),
  appraiser: z.string().nullable(),
  instructed: z.string().nullable(),
  broker: z.string().nullable().describe('Broker Complete column'),
  compliance: z.string().nullable(),
  notes: z.string().nullable(),
  email: z.string().nullable(),
};

function ok(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 1) }] };
}

function fail(message) {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

// Every handler gets the user's client; any thrown error becomes a tool error
// the assistant can read, rather than a protocol failure.
function handler(ctxFor, fn) {
  return async (args, extra) => {
    try {
      return ok(await fn(args, ctxFor(extra)));
    } catch (e) {
      return fail(e?.message || String(e));
    }
  };
}

async function boardLabels(sb, boardId) {
  const options = await getFieldOptions(sb, boardId);
  return Object.fromEntries(Object.entries(options).map(([field, list]) => [field, list.map(([label]) => label)]));
}

// Resolve a value to the board's own spelling of that option. A field with no
// options configured accepts free text; null clears the field.
function canonical(labels, field, value) {
  if (value == null || value === '') return null;
  const list = labels[field] || [];
  if (!list.length) return value;
  const hit = list.find((l) => l.toLowerCase() === String(value).toLowerCase());
  if (!hit) throw new Error(`"${value}" is not a valid ${field}. Valid values: ${list.join(', ')}`);
  return hit;
}

function checkDealPatch(labels, patch) {
  const out = { ...patch };
  for (const f of LABEL_FIELDS) if (f in out) out[f] = canonical(labels, f, out[f]);
  if ('lender' in out) out.lender = (out.lender || []).map((l) => canonical(labels, 'lender', l));
  return out;
}

async function requireDeal(sb, dealId) {
  const deal = await getItem(sb, dealId);
  if (!deal) throw new Error(`No deal with id ${dealId}`);
  return deal;
}

function conditionSummary(subitems) {
  const byStatus = {};
  for (const s of subitems || []) byStatus[s.cond || '(blank)'] = (byStatus[s.cond || '(blank)'] || 0) + 1;
  return { total: (subitems || []).length, by_status: byStatus };
}

function compactDeal({ subitems, position, created_at, updated_at, ...deal }) {
  return { ...deal, conditions: conditionSummary(subitems) };
}

function findGroup(tree, idOrTitle) {
  const want = String(idOrTitle).toLowerCase();
  const g = tree.groups.find((g) => g.id === idOrTitle || g.title.toLowerCase() === want);
  if (!g) throw new Error(`No group "${idOrTitle}" on this board. Groups: ${tree.groups.map((g) => g.title).join(', ')}`);
  return g;
}

const READ = { readOnlyHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

export const SERVER_INSTRUCTIONS = `CAYMUS deal pipeline for a Canadian mortgage brokerage. Boards hold groups (pipeline stages), groups hold deals, deals hold conditions (the document checklist).
Start with list_boards, then get_board for the groups, deals and valid dropdown values, or search_deals to find a client. Use get_deal for a deal's conditions, update feed and files.
Dropdown fields only accept the board's existing values. Changing status, broker or compliance can move a deal to another group automatically, as it does in the app.
Assistants can't delete anything or change boards, groups or dropdown lists; people do that in the app.`;

// ctxFor(extra) -> { sb, userId }
export function registerTools(server, ctxFor) {
  server.registerTool('list_boards', {
    title: 'List boards',
    description: 'List every board (one per broker team / year).',
    inputSchema: z.object({}),
    annotations: READ,
  }, handler(ctxFor, async (_args, { sb }) => listBoards(sb)));

  server.registerTool('get_board', {
    title: 'Get board',
    description: 'A board\'s groups (pipeline stages) and every deal in them, with a condition count per status, plus the valid values for each dropdown field.',
    inputSchema: z.object({ board_id: uuid }),
    annotations: READ,
  }, handler(ctxFor, async ({ board_id }, { sb }) => {
    const [tree, valid_values] = await Promise.all([getBoardTree(sb, board_id), boardLabels(sb, board_id)]);
    return {
      id: tree.id,
      name: tree.name,
      groups: tree.groups.map((g) => ({ id: g.id, title: g.title, deals: g.items.map(compactDeal) })),
      valid_values,
    };
  }));

  server.registerTool('search_deals', {
    title: 'Search deals',
    description: 'Find deals across all boards (or one) by client name / notes / email text and by field filters. Results are sorted by closing date.',
    inputSchema: z.object({
      text: z.string().optional().describe('Matches client name, notes or email'),
      board_id: uuid.optional(),
      status: z.string().optional(),
      agent: z.string().optional(),
      lender: z.string().optional().describe('Exact lender label'),
      closing_from: date.optional(),
      closing_to: date.optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }),
    annotations: READ,
  }, handler(ctxFor, async (a, { sb }) => searchItems(sb, {
    text: a.text, boardId: a.board_id, status: a.status, agent: a.agent, lender: a.lender,
    closeFrom: a.closing_from, closeTo: a.closing_to, limit: a.limit,
  })));

  server.registerTool('get_deal', {
    title: 'Get deal',
    description: 'One deal in full: every field, its conditions (with ids for update_condition), its update feed and the names of its uploaded files.',
    inputSchema: z.object({ deal_id: uuid }),
    annotations: READ,
  }, handler(ctxFor, async ({ deal_id }, { sb }) => {
    const deal = await requireDeal(sb, deal_id);
    const [updates, files] = await Promise.all([listUpdates(sb, deal_id), listAttachments(sb, deal_id)]);
    return {
      ...deal,
      subitems: undefined,
      conditions: deal.subitems.map(({ position, ...s }) => s),
      updates: updates.map((u) => ({ body: u.body, at: u.created_at, by: u.author?.full_name || u.author?.email || 'Automation' })),
      files: files.map((f) => ({ name: f.filename, size_bytes: f.size_bytes, uploaded_at: f.created_at })),
    };
  }));

  server.registerTool('update_deal', {
    title: 'Update deal',
    description: 'Change one or more fields on a deal. Only the fields you pass change; pass null to clear one. Dropdown fields must use a value from get_board\'s valid_values.',
    inputSchema: z.object({ deal_id: uuid, changes: z.object(dealFields).partial() }),
    annotations: { ...WRITE, idempotentHint: true },
  }, handler(ctxFor, async ({ deal_id, changes }, { sb }) => {
    if (!Object.keys(changes).length) throw new Error('Pass at least one field in changes.');
    const deal = await requireDeal(sb, deal_id);
    await updateItem(sb, deal_id, checkDealPatch(await boardLabels(sb, deal.board.id), changes));
    // Re-read: automations may have moved the deal or changed other fields.
    return compactDeal(await getItem(sb, deal_id));
  }));

  server.registerTool('move_deal', {
    title: 'Move deal',
    description: 'Move a deal to another group (pipeline stage) on the same board, by group id or title.',
    inputSchema: z.object({ deal_id: uuid, group: z.string() }),
    annotations: { ...WRITE, idempotentHint: true },
  }, handler(ctxFor, async ({ deal_id, group }, { sb }) => {
    const deal = await requireDeal(sb, deal_id);
    const target = findGroup(await getBoardTree(sb, deal.board.id), group);
    await moveItemToGroup(sb, deal_id, target.id);
    return compactDeal(await getItem(sb, deal_id));
  }));

  server.registerTool('create_deal', {
    title: 'Create deal',
    description: 'Add a new deal to a board. Without a group it lands where the app\'s "+ New Deal" button puts it. Purchase and refinance deal types get their standard conditions checklist.',
    inputSchema: z.object({
      board_id: uuid,
      group: z.string().optional().describe('Group id or title'),
      ...dealFields,
      lender: dealFields.lender.optional(),
      apply_checklist: z.boolean().default(true),
    }).partial({
      agent: true, deal: true, close_date: true, volume: true, status: true, appraisal: true,
      appraiser: true, instructed: true, broker: true, compliance: true, notes: true, email: true,
    }),
    annotations: WRITE,
  }, handler(ctxFor, async ({ board_id, group, apply_checklist, ...fields }, { sb }) => {
    const tree = await getBoardTree(sb, board_id);
    const target = group ? findGroup(tree, group) : newDealGroup(tree.groups);
    if (!target) throw new Error('This board has no groups.');
    const patch = checkDealPatch(await boardLabels(sb, board_id), fields);
    for (const k of Object.keys(patch)) if (patch[k] === null) delete patch[k];
    const created = await createItem(sb, { boardId: board_id, groupId: target.id, ...patch });
    const checklist = apply_checklist ? checklistFor(patch.deal) : null;
    if (checklist) await applyTemplate(sb, created.id, board_id, checklist);
    return compactDeal(await getItem(sb, created.id));
  }));

  server.registerTool('add_condition', {
    title: 'Add condition',
    description: 'Add a condition (checklist document) to a deal.',
    inputSchema: z.object({
      deal_id: uuid,
      name: z.string().min(1),
      status: z.string().optional().describe('A condition status from get_board valid_values.cond'),
      due_date: date.optional(),
      details: z.string().optional(),
    }),
    annotations: WRITE,
  }, handler(ctxFor, async ({ deal_id, name, status, due_date, details }, { sb }) => {
    const deal = await requireDeal(sb, deal_id);
    const patch = {};
    if (status) patch.cond = canonical(await boardLabels(sb, deal.board.id), 'cond', status);
    if (due_date) patch.due_date = due_date;
    if (details) patch.details = details;
    const created = await addSubitem(sb, deal_id, name);
    return Object.keys(patch).length ? updateSubitem(sb, created.id, patch) : created;
  }));

  server.registerTool('update_condition', {
    title: 'Update condition',
    description: 'Change a condition\'s status, due date, details or name. Get condition ids from get_deal. Changing the status stamps its status date, as in the app.',
    inputSchema: z.object({
      condition_id: uuid,
      name: z.string().min(1).optional(),
      status: z.string().nullable().optional(),
      due_date: date.nullable().optional(),
      details: z.string().nullable().optional(),
    }),
    annotations: { ...WRITE, idempotentHint: true },
  }, handler(ctxFor, async ({ condition_id, name, status, due_date, details }, { sb }) => {
    const sub = await getSubitem(sb, condition_id);
    if (!sub) throw new Error(`No condition with id ${condition_id}`);
    const patch = {};
    if (name !== undefined) patch.name = name;
    if (status !== undefined) patch.cond = canonical(await boardLabels(sb, sub.item.board_id), 'cond', status);
    if (due_date !== undefined) patch.due_date = due_date;
    if (details !== undefined) patch.details = details;
    if (!Object.keys(patch).length) throw new Error('Pass at least one of name, status, due_date, details.');
    return updateSubitem(sb, condition_id, patch);
  }));

  server.registerTool('post_update', {
    title: 'Post update',
    description: 'Post a message to a deal\'s Updates feed, as the signed-in user.',
    inputSchema: z.object({ deal_id: uuid, text: z.string().min(1) }),
    annotations: WRITE,
  }, handler(ctxFor, async ({ deal_id, text }, { sb, userId }) => {
    await requireDeal(sb, deal_id);
    const u = await postUpdate(sb, deal_id, userId, text);
    return { id: u.id, body: u.body, at: u.created_at };
  }));
}
