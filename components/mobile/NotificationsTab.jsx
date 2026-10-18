'use client';
import { CloseIcon } from './icons';
import { agentColor, agentInitials, timeAgo } from './format';

// Tags for the kinds generate_notifications() writes (supabase/schema.sql).
const KINDS = {
  submitted_followup: { tag: 'Follow up', color: '#fdab3d' },
  closing_today: { tag: 'Closing', color: '#00c875' },
  instruct_reminder: { tag: 'Instructions', color: '#e2445c' },
};

// Messages start with the deal name ("Kim, Diana — follow up…",
// "Kim, Diana is closing today!"); split it out so it can be highlighted.
function splitMessage(message) {
  const m = /^(.*?)( — | is closing)/.exec(message || '');
  return m ? [m[1], message.slice(m[1].length)] : [null, message];
}

export default function NotificationsTab({ notifs, options, agentFor, onOpen, onDismiss, onClearAll }) {
  const count = notifs?.length || 0;
  return (
    <div className="m-screen">
      <header className="m-head m-head-simple">
        <h1 className="m-screen-title">Notifications</h1>
        {count > 0 && <span className="m-unread">{count}</span>}
        {count > 0 && <button type="button" className="m-text-btn" onClick={onClearAll}>Clear all</button>}
      </header>
      <div className="m-scroll">
        <div className="m-notifs">
          {notifs === null && <div className="m-empty"><span className="m-spinner" aria-label="Loading notifications" /></div>}
          {notifs && !notifs.length && (
            <div className="m-empty"><div className="m-empty-icon">🔔</div>You’re all caught up.</div>
          )}
          {(notifs || []).map((n) => {
            const kind = KINDS[n.kind] || { tag: 'Reminder', color: '#808080' };
            const [target, rest] = splitMessage(n.message);
            const agent = agentFor(n.item_id);
            return (
              <div key={n.id} className="m-notif">
                <button type="button" className="m-notif-main" onClick={() => onOpen(n)}>
                  <span className="m-notif-av">
                    <span className="m-avatar xl" style={{ background: agent ? agentColor(options, agent) : '#66ccff' }} aria-hidden="true">
                      {agent ? agentInitials(agent) : 'C'}
                    </span>
                    <span className="m-unread-dot" aria-hidden="true" />
                  </span>
                  <span className="m-notif-text">
                    <span className="m-notif-msg">
                      {target && <b className="m-notif-target">{target}</b>}{rest}
                    </span>
                    <span className="m-notif-time">{timeAgo(n.created_at)}</span>
                  </span>
                  <span className="m-tag" style={{ background: kind.color }}>{kind.tag}</span>
                </button>
                <button type="button" className="m-icon-btn" title="Clear" aria-label="Clear notification" onClick={() => onDismiss(n)}>
                  <CloseIcon />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
