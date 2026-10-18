'use client';
import { TabIcon } from './icons';
import { stop } from './OptionMenu';

const TABS = [
  { tab: 'board', label: 'Board' },
  { tab: 'inbox', label: 'Notifications' },
  { tab: 'me', label: 'Me' },
];

// Tapping Board while already on it opens the board switcher above the bar.
export default function TabBar({ tab, badge, onSelect, onBoardAgain }) {
  return (
    <nav className="m-tabbar" aria-label="Main">
      {TABS.map((t) => {
        const active = tab === t.tab;
        return (
          <button
            key={t.tab}
            type="button"
            className={'m-tabbtn' + (active ? ' on' : '')}
            aria-current={active ? 'page' : undefined}
            onPointerDown={active && t.tab === 'board' ? stop : undefined}
            onClick={() => (active && t.tab === 'board' ? onBoardAgain() : onSelect(t.tab))}
          >
            <TabIcon tab={t.tab} active={active} />
            <span className="m-tablabel">{t.label}</span>
            {t.tab === 'inbox' && badge > 0 && <span className="m-badge" aria-label={`${badge} notifications`}>{badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}
