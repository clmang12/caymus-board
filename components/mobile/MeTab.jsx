'use client';
import { personInitials } from './format';

export default function MeTab({ profile, email, boardId, dark, onToggleDark, onSignOut }) {
  const name = profile?.full_name || email || '';
  return (
    <div className="m-screen">
      <header className="m-head m-me-head">
        <div className="m-me-avatar xl" aria-hidden="true">{personInitials(name)}</div>
        <div>
          <div className="m-me-name">{name}</div>
          <div className="m-me-sub">{email !== name ? email + ' · ' : ''}Caymus Mortgage Capital</div>
        </div>
      </header>
      <div className="m-scroll">
        <div className="m-me-body">
          <div className="m-label">SETTINGS</div>
          <div className="m-settings">
            <div className="m-setting">
              <span id="m-dark-label">Dark mode</span>
              <button
                type="button"
                role="switch"
                aria-checked={dark}
                aria-labelledby="m-dark-label"
                className={'m-switch' + (dark ? ' on' : '')}
                onClick={onToggleDark}
              ><span className="m-knob" /></button>
            </div>
            {/* Full page load: the desktop board sets its own theme on <html>. */}
            <a className="m-setting link" href={'/board/' + boardId}>
              <span>Open full board</span><span className="m-setting-aside">›</span>
            </a>
            <button type="button" className="m-setting danger" onClick={onSignOut}>Sign out</button>
          </div>
        </div>
      </div>
    </div>
  );
}
