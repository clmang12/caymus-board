'use client';
import OptionMenu, { StatusPill, stop } from './OptionMenu';
import ConditionList from './ConditionList';
import { OpenIcon } from './icons';
import { agentColor, agentInitials, condProgress, dealColor, money, optionColor, optionsFor, shortDate } from './format';

export default function DealCard({
  item, group, options, expanded, flash, statusMenu, condMenu, selected,
  onToggleExpand, onOpenStatus, onPickStatus, condHandlers, onOpenDeal,
}) {
  const { done, total, pct } = condProgress(item);
  const lenders = item.lender || [];
  const vol = money(item.volume);
  const raised = !!statusMenu || !!condMenu;
  const statusOptions = optionsFor(options, 'status');

  return (
    <article
      id={'deal-' + item.id}
      className={'m-card' + (raised ? ' raised' : '') + (flash ? ' flash' : '')}
      style={{ '--edge': group.color }}
      onClick={() => onToggleExpand(item.id)}
    >
      <div className="m-card-top">
        <div className="m-card-name">
          {item.name}
          <button
            type="button"
            className="m-open-btn"
            title="Open full deal"
            aria-label={`Open ${item.name}`}
            onPointerDown={stop}
            onClick={(e) => { e.stopPropagation(); onOpenDeal(item.id); }}
          ><OpenIcon /></button>
        </div>
        <div className="m-anchor" onClick={stop}>
          <StatusPill
            status={item.status}
            color={optionColor(options, 'status', item.status)}
            open={!!statusMenu}
            onOpen={(el) => onOpenStatus(item.id, el, statusOptions.length)}
          />
          {statusMenu && (
            <OptionMenu
              label={`Status for ${item.name}`}
              options={statusOptions}
              current={item.status}
              up={statusMenu.up}
              onPick={(label) => onPickStatus(item.id, label)}
            />
          )}
        </div>
      </div>

      <div className="m-card-meta">
        <span className="m-agent">
          <span className="m-avatar" style={{ background: agentColor(options, item.agent) }} aria-hidden="true">
            {agentInitials(item.agent)}
          </span>
          <span className="m-agent-name">{item.agent || 'Unassigned'}</span>
        </span>
        {item.deal && <span className="m-chip" style={{ background: dealColor(options, item.deal) }}>{item.deal}</span>}
        {lenders.slice(0, 2).map((l) => <span key={l} className="m-lender">{l}</span>)}
        {lenders.length > 2 && <span className="m-lender">+{lenders.length - 2}</span>}
      </div>

      <div className="m-card-foot">
        <div className="m-bar" role="progressbar" aria-label="Conditions accepted" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <div className={'m-bar-fill' + (pct >= 1 ? ' full' : '')} style={{ width: Math.round(pct * 100) + '%' }} />
        </div>
        <span className="m-foot-txt">{total ? `${done}/${total}` : '—'}</span>
        {item.close_date && <span className="m-foot-txt">📅 {shortDate(item.close_date)}</span>}
        {vol && <span className="m-vol">{vol}</span>}
        <button
          type="button"
          className={'m-chev' + (expanded ? ' up' : '')}
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide conditions' : 'Show conditions'}
          onClick={(e) => { e.stopPropagation(); onToggleExpand(item.id); }}
        >⌄</button>
      </div>

      {expanded && (
        <div className="m-card-body" onClick={stop}>
          <div className="m-label">CONDITIONS · {total ? `${done}/${total}` : '—'}</div>
          <ConditionList item={item} options={options} selected={selected} menu={condMenu} {...condHandlers} />
          <button type="button" className="m-link" onClick={() => onOpenDeal(item.id)}>Open full deal →</button>
        </div>
      )}
    </article>
  );
}
