import { updateItem, createItem } from '@/lib/data/boards';
import { addSubitem, updateSubitem } from '@/lib/data/subitems';
import { postUpdate } from '@/lib/data/updates';

function findItem(tree, id) {
  for (const g of tree.groups) {
    const it = (g.items || []).find((i) => i.id === id);
    if (it) return it;
  }
  return null;
}

function findGroupId(tree, idOrTitle) {
  const g = tree.groups.find((g) => g.id === idOrTitle || g.title === idOrTitle);
  if (!g) throw new Error(`Group "${idOrTitle}" not found on this board`);
  return g.id;
}

export async function applyAction(sb, action, { tree, boardId, userId }) {
  switch (action.type) {
    case 'set_field':
      return updateItem(sb, action.dealId, { [action.field]: action.value });

    case 'bulk_set_field':
      return Promise.all((action.dealIds || []).map((id) => updateItem(sb, id, { [action.field]: action.value })));

    case 'set_condition': {
      const it = findItem(tree, action.dealId);
      const existing = (it?.subitems || []).find((s) => s.name.toLowerCase() === action.condName.toLowerCase());
      const patch = {};
      if (action.cond) patch.cond = action.cond;
      if (action.date) patch.due_date = action.date;
      if (action.details) patch.details = action.details;
      if (existing) return updateSubitem(sb, existing.id, patch);
      const created = await addSubitem(sb, action.dealId, action.condName);
      return Object.keys(patch).length ? updateSubitem(sb, created.id, patch) : created;
    }

    case 'add_condition': {
      const created = await addSubitem(sb, action.dealId, action.name);
      return action.cond ? updateSubitem(sb, created.id, { cond: action.cond }) : created;
    }

    case 'move_deal':
      return updateItem(sb, action.dealId, { group_id: findGroupId(tree, action.group) });

    case 'add_deal': {
      const { type, group, ...rest } = action;
      return createItem(sb, { boardId, groupId: findGroupId(tree, group), ...rest });
    }

    case 'post_update':
      return postUpdate(sb, action.dealId, userId, action.text);

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

export async function applyActions(sb, actions, ctx) {
  const results = [];
  for (const action of actions) {
    results.push(await applyAction(sb, action, ctx));
  }
  return results;
}
