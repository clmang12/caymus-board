'use client';
import { labelColor, fmtCurrency, fmtDate } from './columns';

export default function BoardCards({ visibleGroups, options, collapsed, onToggleCollapsed, onAddItem, onOpenDetail }) {
  return (
    <div className="cards-wrap">
      {visibleGroups.map(({ group, items }) => {
        const open = !collapsed[group.id];
        return (
          <section key={group.id} className="card-group">
            <button className="card-group-head" onClick={() => onToggleCollapsed(group.id)} style={{ color: group.color }}>
              <span className={'card-chevron' + (open ? ' open' : '')}>▸</span>
              <span className="card-group-title">{group.title}</span>
              <span className="card-group-count">{items.length}</span>
            </button>
            {open && (
              <div className="card-list">
                {items.map((it) => {
                  const statusColor = labelColor(options, 'status', it.status);
                  return (
                    <button key={it.id} className="deal-card" style={{ borderLeftColor: group.color }} onClick={() => onOpenDetail(it.id)}>
                      <div className="deal-card-top">
                        <span className="deal-card-name">{it.name}</span>
                        {it.status && <span className="pill" style={{ background: statusColor }}>{it.status}</span>}
                      </div>
                      <div className="deal-card-meta">
                        {it.agent && <span className="chip">{it.agent}</span>}
                        {it.deal && <span>{it.deal}</span>}
                        {it.close_date && <span>{fmtDate(it.close_date)}</span>}
                        {it.volume ? <span>{fmtCurrency(it.volume)}</span> : null}
                      </div>
                    </button>
                  );
                })}
                {items.length === 0 && <div className="card-empty">No deals in this group.</div>}
                <div className="card-add">
                  <input
                    placeholder="+ Add deal"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value.trim()) { onAddItem(group.id, e.target.value.trim()); e.target.value = ''; }
                    }}
                  />
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
