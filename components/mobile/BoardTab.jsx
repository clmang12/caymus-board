'use client';
import DealCard from './DealCard';
import BoardSwitcher from './BoardSwitcher';
import { SearchIcon, UndoIcon, CloseIcon } from './icons';
import { millions, money, personInitials } from './format';
import { stop } from './OptionMenu';

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
  tree, boards, options, profile, switcher, collapsed, query, undoDepth,
  expandedId, menu, condSel, flashId,
  onToggleBoardMenu, onToggleGroup, onToggleAll, onQuery, onUndo,
  onToggleExpand, onOpenStatus, onPickStatus, condHandlersFor, onOpenDeal,
}) {
  const q = query.trim().toLowerCase();
  const groups = tree.groups
    .map((g) => ({ group: g, items: q ? g.items.filter((it) => (it.name || '').toLowerCase().includes(q)) : g.items }))
    .filter(({ items }) => !q || items.length);
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
          {boardStats(tree.groups).map((s) => (
            <div key={s.label} className="m-stat">
              <div className="m-stat-val">{s.value}</div>
              <div className="m-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="m-toolbar">
          {undoDepth > 0 && (
            <button type="button" className="m-tool-btn push" onClick={onUndo} title="Undo last change">
              <UndoIcon />Undo
            </button>
          )}
          <button type="button" className={'m-tool-btn' + (undoDepth > 0 ? '' : ' push')} onClick={onToggleAll}>
            {anyOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </div>

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
      </header>

      <div className="m-scroll" id="m-board-scroll">
        <div className="m-board-list">
          {q && !groups.length && (
            <div className="m-empty"><div className="m-empty-icon">🔍</div>No deals match “{query.trim()}”.</div>
          )}
          {groups.map(({ group, items }) => {
            const open = q ? true : !collapsed[group.id];
            const vol = group.items.reduce((a, it) => a + (Number(it.volume) || 0), 0);
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
