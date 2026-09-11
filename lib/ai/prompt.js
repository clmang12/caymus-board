// Builds the board context + action grammar sent as the system prompt to
// /api/claude, and parses the model's response back into display text +
// proposed actions. Ported from the prototype's chat-drawer "actions"
// protocol (design-reference/CAYMUS 25 Board.dc.html, ~line 1280), adapted
// to this app's actual schema/field names and trimmed to the actions this
// app can execute (lib/ai/applyActions.js).

function fieldEnum(options, field) {
  const list = (options?.[field] || []).map(([label]) => label);
  return list.length ? list.join('|') : '(free text)';
}

export function buildBoardContext(tree, options) {
  const groupsTxt = tree.groups.map((g) => `[group:${g.id}] ${g.title}`).join('\n');
  const itemsTxt = tree.groups
    .flatMap((g) => (g.items || []).map((it) => {
      const lender = (it.lender || []).join(',');
      const conds = (it.subitems || []).map((s) => `${s.name}=${s.cond}`).join(',');
      return `[id:${it.id}] "${it.name}" group="${g.title}" agent=${it.agent || ''} deal=${it.deal || ''} `
        + `close_date=${it.close_date || ''} lender=${lender} volume=${it.volume || ''} status=${it.status || ''} `
        + `appraisal=${it.appraisal || ''} appraiser=${it.appraiser || ''} instructed=${it.instructed || ''} `
        + `broker=${it.broker || ''} compliance=${it.compliance || ''} notes="${(it.notes || '').slice(0, 80)}" conditions=[${conds}]`;
    }))
    .join('\n');

  return {
    groupsTxt,
    itemsTxt,
    enums: {
      status: fieldEnum(options, 'status'),
      deal: fieldEnum(options, 'deal'),
      appraisal: fieldEnum(options, 'appraisal'),
      instructed: fieldEnum(options, 'instructed'),
      broker: fieldEnum(options, 'broker'),
      compliance: fieldEnum(options, 'compliance'),
      cond: fieldEnum(options, 'cond'),
    },
  };
}

export function buildSystemPrompt(ctx) {
  return `You are an assistant embedded in a mortgage deal-pipeline board (like monday.com) for a Canadian mortgage brokerage.
You can answer questions about the board and, when asked, propose concrete changes.

Groups on this board:
${ctx.groupsTxt}

Deals on this board (each has a stable [id:...]):
${ctx.itemsTxt}

Valid values — status: ${ctx.enums.status}; deal type: ${ctx.enums.deal}; appraisal: ${ctx.enums.appraisal}; instructed: ${ctx.enums.instructed}; broker: ${ctx.enums.broker}; compliance: ${ctx.enums.compliance}; condition status: ${ctx.enums.cond}.

When the user asks you to change, update, move, set, add, mark, or otherwise modify anything, do NOT just describe it — propose concrete actions. First write a one-sentence plain-text summary of what you will do, then append a fenced code block \`\`\`actions containing a JSON object {"actions":[...]}. Never mention the JSON block itself in your prose — the user sees a friendly confirmation UI instead, and must approve before anything is applied.

Action shapes (dealId/dealIds are the [id:...] above; group is a group id or title from the Groups list):
- {"type":"set_field","dealId":"<id>","field":"status|agent|deal|close_date|volume|lender|appraisal|appraiser|instructed|broker|compliance|notes|name","value":<string, number, or array for lender>}
- {"type":"bulk_set_field","dealIds":["<id>","<id>",...],"field":"<same fields as set_field>","value":<value>} — apply ONE field/value to MANY deals at once. Use this for bulk requests like "mark all submitted deals as approved". Resolve the matching deals yourself from the board data above and list their [id]s.
- {"type":"set_condition","dealId":"<id>","condName":"<condition/document name>","cond":"<status>","date":"YYYY-MM-DD","details":"<text>"} (cond/date/details all optional; creates the condition on that deal if it doesn't already have one by that name)
- {"type":"add_condition","dealId":"<id>","name":"<name>","cond":"<status>"}
- {"type":"move_deal","dealId":"<id>","group":"<group id or title>"}
- {"type":"add_deal","group":"<group id or title>","name":"Last, First","deal":"<deal type>","agent":"<name>","lender":["<name>",...],"volume":<number>,"close_date":"YYYY-MM-DD","status":"<status>"}
- {"type":"post_update","dealId":"<id>","text":"<message to post to the deal's update feed>"}

Use dates in YYYY-MM-DD. Resolve deals the user names to their [id]. If a request is ambiguous or you can't find the deal, ask instead of guessing. For questions or analysis with no change requested, answer normally with no actions block.`;
}

export function parseActions(text) {
  const m = /```actions\s*([\s\S]*?)```/.exec(text || '');
  if (!m) return { clean: (text || '').trim(), actions: [] };
  const clean = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim();
  let actions = [];
  try { actions = JSON.parse(m[1]).actions || []; } catch { actions = []; }
  return { clean, actions };
}

function findItem(tree, id) {
  for (const g of tree.groups) {
    const it = (g.items || []).find((i) => i.id === id);
    if (it) return it;
  }
  return null;
}

function findGroup(tree, idOrTitle) {
  return tree.groups.find((g) => g.id === idOrTitle || g.title === idOrTitle);
}

function fmtVal(v) {
  return Array.isArray(v) ? v.join(', ') : String(v);
}

export function describeAction(action, tree) {
  switch (action.type) {
    case 'set_field': {
      const it = findItem(tree, action.dealId);
      return `Set ${action.field} to "${fmtVal(action.value)}" on ${it ? it.name : action.dealId}`;
    }
    case 'bulk_set_field': {
      const names = (action.dealIds || []).map((id) => findItem(tree, id)?.name || id);
      return `Set ${action.field} to "${fmtVal(action.value)}" on ${names.length} deal(s): ${names.join(', ')}`;
    }
    case 'set_condition': {
      const it = findItem(tree, action.dealId);
      return `Set condition "${action.condName}"${action.cond ? ` to "${action.cond}"` : ''} on ${it ? it.name : action.dealId}`;
    }
    case 'add_condition': {
      const it = findItem(tree, action.dealId);
      return `Add condition "${action.name}"${action.cond ? ` (${action.cond})` : ''} to ${it ? it.name : action.dealId}`;
    }
    case 'move_deal': {
      const it = findItem(tree, action.dealId);
      const g = findGroup(tree, action.group);
      return `Move ${it ? it.name : action.dealId} to "${g ? g.title : action.group}"`;
    }
    case 'add_deal': {
      const g = findGroup(tree, action.group);
      return `Add new deal "${action.name}" to "${g ? g.title : action.group}"`;
    }
    case 'post_update': {
      const it = findItem(tree, action.dealId);
      return `Post update on ${it ? it.name : action.dealId}: "${action.text}"`;
    }
    default:
      return `Unrecognized action: ${action.type}`;
  }
}
