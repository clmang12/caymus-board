'use client';
import OptionMenu, { stop } from './OptionMenu';
import { optionColor, optionsFor, shortDate } from './format';

// Condition rows for one deal. Used inside an expanded card and on the deal
// detail's Conditions tab. `selected` is the list of checked subitem ids;
// `menu` is { subId, up } when this deal's condition popup is open.
export default function ConditionList({
  item, options, selected, menu, variant = 'card',
  onToggleSelect, onOpenMenu, onPick, onBatch, onClearSelection,
}) {
  const subs = item.subitems || [];
  const condOptions = optionsFor(options, 'cond');
  const nSel = subs.filter((s) => selected.includes(s.id)).length;
  const hasAccepted = condOptions.some(([l]) => l === 'Accepted');
  const hasReceived = condOptions.some(([l]) => l === 'Received');

  if (!subs.length) {
    return variant === 'card'
      ? <div className="m-conds-empty">No conditions yet.</div>
      : <div className="m-empty"><div className="m-empty-icon">📋</div>No conditions on this deal.</div>;
  }

  return (
    <div className={'m-conds ' + variant}>
      {subs.map((s) => {
        const checked = selected.includes(s.id);
        const open = menu?.subId === s.id;
        return (
          <div key={s.id} className={'m-cond' + (open ? ' raised' : '')}>
            <button
              type="button"
              className="m-check-hit"
              role="checkbox"
              aria-checked={checked}
              aria-label={`Select ${s.name}`}
              onClick={() => onToggleSelect(s.id)}
            >
              <span className={'m-check' + (checked ? ' on' : '')} aria-hidden="true">{checked ? '✓' : ''}</span>
            </button>
            <div className="m-cond-name">
              {s.name}
              {variant === 'detail' && s.cond_date && <div className="m-cond-date">{shortDate(s.cond_date, true)}</div>}
            </div>
            <div className="m-anchor">
              <button
                type="button"
                className="m-pill cond hit"
                style={{ background: optionColor(options, 'cond', s.cond) || 'var(--neutral)' }}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`${s.name}: ${s.cond || 'no status'}`}
                onPointerDown={stop}
                onClick={(e) => onOpenMenu(s.id, e.currentTarget, condOptions.length)}
              >
                {s.cond || 'Set'}
              </button>
              {open && (
                <OptionMenu
                  label={`Condition status for ${s.name}`}
                  options={condOptions}
                  current={s.cond}
                  up={menu.up}
                  onPick={(label) => onPick(s.id, label)}
                />
              )}
            </div>
          </div>
        );
      })}
      {nSel > 0 && (
        <div className="m-batch" role="toolbar" aria-label="Selected conditions">
          <span className="m-batch-count">{nSel} selected</span>
          {hasAccepted && <button type="button" className="m-batch-btn primary" onClick={() => onBatch('Accepted')}>Mark Accepted</button>}
          {hasReceived && <button type="button" className="m-batch-btn" onClick={() => onBatch('Received')}>Received</button>}
          <button type="button" className="m-batch-clear" onClick={onClearSelection}>Clear</button>
        </div>
      )}
    </div>
  );
}
