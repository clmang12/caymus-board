'use client';
import DealCard from './DealCard';
import BoardSwitcher from './BoardSwitcher';
import { SearchIcon, SortIcon, UndoIcon, CloseIcon } from './icons';
import { agentColor, agentInitials, millions, money, optionsFor, personInitials } from './format';
import { stop } from './OptionMenu';

export const SORTS = [
  ['position', 'Board order'],
  ['close', 'Closing date'],
  ['name', 'Name (A–Z)'],
];

// Order within a group. Board order is the saved position (drag order on the
// desktop); closing date is soonest first with undated deals last.
const byName = (a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true });
function sortItems(items, sort) {
  if (sort === 'close') {
    return [...items].sort((a, b) => (a.close_date && b.close_date
      ? a.close_date.localeCompare(b.close_date) || a.position - b.position
      : (a.close_date ? -1 : b.close_date ? 1 : a.position - b.position)));
  }
  if (sort === 'name') return [...items].sort((a, b) => byName(a, b) || a.position - b.position);
  return items;
}

function boardStats(groups) {
  const real = groups.filter((g) => !/template/i.test(g.title));
  const volume = real.filter((g) => !/cancelled/i.test(g.title))
    .reduce((a, g) => a + g.items.reduce((b, it) => b + (Number(it.volume) || 0), 0), 0);
  const deals = real.reduce((a, g) => a + g.items.length, 0);
  const funded = (groups.find((g) => g.title === 'Funded - Compliance Done')?.items.length) || 0;
  return [
    { value: millions(volume), label: 'Pipeline volume' },
    { value: String(deals), label: 'Total deals' },
    { value: String(funded), label: 'Funded' },
  ];
}

export default function BoardTab({
  tree, boards, options, profile, switcher, collapsed, query, agent, undoDepth,
  expandedId, menu, condSel, flashId,
  agentMenu, onOpenAgentMenu, sort, sortMenu, onOpenSortMenu, onSort,
  onToggleBoardMenu, onToggleGroup, onToggleAll, onQuery, onAgent, onUndo,
  onToggleExpand, onOpenStatus, onPickStatus, condHandlersFor, onOpenDeal,
}) {
  const q = query.trim().toLowerCase();
  // Agent filter: exact match, like the desktop filter menu. The stats follow
  // it (that agent's pipeline); the search text only narrows the list.
  const agentGroups = tree.groups.map((g) => (agent ? { ...g, items: g.items.filter((it) => it.agent === agent) } : g));
  const groups = agentGroups
    .map((g) => ({ group: g, items: sortItems(q ? g.items.filter((it) => (it.name || '').toLowerCase().includes(q)) : g.items, sort) }))
    .filter(({ items }) => !(q || agent) || items.length);
  const agents = optionsFor(options, 'agent');
  const anyOpen = tree.groups.some((g) => !collapsed[g.id]);
  const who = profile?.full_name || profile?.email || '';

  return (
    <div className="m-screen">
      <header className="m-head">
        <div className="m-head-row">
          <div className="m-board-badge" aria-hidden="true">{(tree.name || 'C')[0]}</div>
          <div className="m-head-title-wrap">
            <button
              type="button"
              className="m-head-title"
              aria-haspopup="dialog"
              aria-expanded={switcher.open === 'header'}
              onPointerDown={stop}
              onClick={() => onToggleBoardMenu('header')}
            >
              <span className="m-board-title">{tree.name}</span>
              <span className={'m-head-chev' + (switcher.open ? ' up' : '')} aria-hidden="true">⌄</span>
            </button>
            {tree.description && <div className="m-board-sub">{tree.description}</div>}
            {switcher.open === 'header' && <BoardSwitcher placement="header" boards={boards} activeId={tree.id} {...switcher.props} />}
          </div>
          <div className="m-me-avatar" title={who} aria-hidden="true">{personInitials(who)}</div>
        </div>

        <div className="m-stats">
          {boardStats(agentGroups).map((s) => (
            <div key={s.label} className="m-stat">
              <div className="m-stat-val">{s.value}</div>
              <div className="m-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="m-toolbar">
          {agents.length > 0 && (
            <div className="m-anchor">
              <button
                type="button"
                className={'m-tool-btn m-agent-btn' + (agent ? ' on' : '')}
                aria-haspopup="menu"
                aria-expanded={!!agentMenu}
                aria-label={`Agent filter: ${agent || 'all agents'}`}
                onPointerDown={stop}
                onClick={(e) => onOpenAgentMenu(e.currentTarget, agents.length + 1)}
              >
                {agent && (
                  <span className="m-avatar sm" style={{ background: agentColor(options, agent) }} aria-hidden="true">{agentInitials(agent)}</span>
                )}
                <span className="m-agent-btn-label">{agent || 'All agents'}</span>
                <span className={'m-head-chev' + (agentMenu ? ' up' : '')} aria-hidden="true">⌄</span>
              </button>
              {agentMenu && (
                <div className="m-menu" role="menu" aria-label="Filter by agent" onPointerDown={stop} onClick={stop}>
                  {[[null, null], ...agents].map(([name, color]) => (
                    <button
                      key={name || 'all'}
                      type="button"
                      role="menuitemradio"
                      aria-checked={agent === name}
                      className={'m-menu-opt' + (agent === name ? ' on' : '')}
                      onClick={() => onAgent(name)}
                    >
                      {name
                        ? <span className="m-avatar" style={{ background: color || '#9699a6' }} aria-hidden="true">{agentInitials(name)}</span>
                        : <span className="m-avatar all" aria-hidden="true">All</span>}
                      <span className="m-menu-label">{name || 'All agents'}</span>
                      {agent === name && <span className="m-board-check" aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {undoDepth > 0 && (
            <button type="button" className="m-tool-btn push" onClick={onUndo} title="Undo last change">
              <UndoIcon />Undo
            </button>
          )}
          <button type="button" className={'m-tool-btn' + (undoDepth > 0 ? '' : ' push')} onClick={onToggleAll}>
            {anyOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </div>

        <div className="m-search-row">
        <label className="m-search">
          <SearchIcon />
          <input
            type="search"
            value={query}
            placeholder="Search deals"
            aria-label="Search deals by name"
            onChange={(e) => onQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="m-icon-btn" aria-label="Clear search" onClick={() => onQuery('')}>
              <CloseIcon size={14} />
            </button>
          )}
        </label>
        <div className="m-anchor">
          <button
            type="button"
            className={'m-sort-btn' + (sort !== 'position' ? ' on' : '')}
            aria-haspopup="menu"
            aria-expanded={!!sortMenu}
            aria-label={`Sort: ${SORTS.find(([k]) => k === sort)[1]}`}
            title="Sort deals"
            onPointerDown={stop}
            onClick={(e) => onOpenSortMenu(e.currentTarget, SORTS.length)}
          ><SortIcon /></button>
          {sortMenu && (
            <div className="m-menu right" role="menu" aria-label="Sort deals" onPointerDown={stop} onClick={stop}>
              <div className="m-label pad">SORT EACH GROUP BY</div>
              {SORTS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={sort === key}
                  className={'m-menu-opt' + (sort === key ? ' on' : '')}
                  onClick={() => onSort(key)}
                >
                  <span className="m-menu-label">{label}</span>
                  {sort === key && <span className="m-board-check" aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        </div>

      </header>

      <div className="m-scroll" id="m-board-scroll">
        <div className="m-board-list">
          {(q || agent) && !groups.length && (
            <div className="m-empty">
              <div className="m-empty-icon">🔍</div>
              {q ? `No ${agent ? agent + '’s ' : ''}deals match “${query.trim()}”.` : `No deals for ${agent} on this board.`}
            </div>
          )}
          {groups.map(({ group, items }) => {
            const open = q ? true : !collapsed[group.id];
            const vol = items.reduce((a, it) => a + (Number(it.volume) || 0), 0);
            return (
              <section key={group.id} className="m-group" aria-label={group.title}>
                <button type="button" className="m-group-head" aria-expanded={open} onClick={() => onToggleGroup(group.id)}>
                  <span className={'m-group-chev' + (open ? '' : ' shut')} aria-hidden="true">▾</span>
                  <span className="m-group-title" style={{ color: group.color }}>{group.title}</span>
                  <span className="m-count">{items.length}</span>
                  {vol > 0 && <span className="m-group-vol">{money(vol)}</span>}
                </button>
                {/* An empty group is just its header; the 0 count says so. */}
                {open && items.length > 0 && (
                  <div className="m-group-body">
                    {items.map((it) => (
                      <DealCard
                        key={it.id}
                        item={it}
                        group={group}
                        options={options}
                        expanded={expandedId === it.id}
                        flash={flashId === it.id}
                        statusMenu={menu?.kind === 'status' && menu.where === 'card' && menu.itemId === it.id ? menu : null}
                        condMenu={menu?.kind === 'cond' && menu.where === 'card' && menu.itemId === it.id ? menu : null}
                        selected={condSel[it.id] || []}
                        onToggleExpand={onToggleExpand}
                        onOpenStatus={(id, el, n) => onOpenStatus(id, el, n, 'card')}
                        onPickStatus={onPickStatus}
                        condHandlers={condHandlersFor(it.id, 'card')}
                        onOpenDeal={onOpenDeal}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
