// Stroke icons from the design reference.
const base = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };

export const PencilIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="2" {...base} aria-hidden="true">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export const CloseIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2" {...base} aria-hidden="true">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
);

export const UndoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="2" {...base} aria-hidden="true">
    <path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
  </svg>
);

export const BackIcon = () => (
  <svg width="11" height="19" viewBox="0 0 12 20" aria-hidden="true">
    <path d="M10 2L2 10l8 8" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// "Open in full" — a box with an arrow out of its corner.
export const OpenIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="2" {...base} aria-hidden="true">
    <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

// Sort: arrow down beside arrow up.
export const SortIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" strokeWidth="2" {...base} aria-hidden="true">
    <path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" />
  </svg>
);

export const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M11 11l3.4 3.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const TAB_PATHS = {
  board: <><rect x="2" y="3" width="20" height="6" rx="1.5" /><rect x="2" y="12" width="20" height="9" rx="1.5" opacity=".5" /></>,
  inbox: <><path d="M3 12h5l2 3h4l2-3h5" /><path d="M4 6h16v12H4z" /></>,
  me: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
};

export const TabIcon = ({ tab, active }) => (
  <svg width="23" height="23" viewBox="0 0 24 24" strokeWidth={active ? 2.1 : 1.8} {...base} aria-hidden="true">
    {TAB_PATHS[tab]}
  </svg>
);
