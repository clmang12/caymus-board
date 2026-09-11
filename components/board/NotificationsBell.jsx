'use client';
import { useRef, useState } from 'react';
import Popover from './Popover';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsBell({ notifications, onDismiss, onDismissAll }) {
  const [anchor, setAnchor] = useState(null);
  const btnRef = useRef(null);
  const count = notifications.length;

  return (
    <>
      <button
        ref={btnRef}
        className="board-btn notif-bell"
        title="Notifications"
        onClick={() => setAnchor(anchor ? null : btnRef.current.getBoundingClientRect())}
      >
        🔔
        {count > 0 && <span className="notif-badge">{count}</span>}
      </button>
      {anchor && (
        <Popover anchorRect={anchor} onClose={() => setAnchor(null)} width={320}>
          <div className="notif-head">
            Notifications
            {count > 0 && <button onClick={onDismissAll}>Clear all</button>}
          </div>
          {count === 0 && <div className="notif-empty">No notifications.</div>}
          {notifications.map((n) => (
            <div key={n.id} className="notif-item">
              <div className="notif-msg">
                {n.message}
                <span className="notif-time">{timeAgo(n.created_at)}</span>
              </div>
              <button title="Dismiss" onClick={() => onDismiss(n.id)}>✕</button>
            </div>
          ))}
        </Popover>
      )}
    </>
  );
}
