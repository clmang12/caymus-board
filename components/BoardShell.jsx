'use client';
import { useState } from 'react';
import Sidebar from './Sidebar';
import BoardGrid from './board/BoardGrid';
import './board/board.css';

export default function BoardShell({ user, boards, board, options, prefs }) {
  const [sbOpen, setSbOpen] = useState(false);

  return (
    <div className={'board-root' + (sbOpen ? ' sb-drawer-open' : '')}>
      <div className="sb-scrim" onClick={() => setSbOpen(false)} />
      <Sidebar boards={boards} activeId={board.id} user={user} />
      <div className="board-main-wrap">
        <div className="mobile-topbar">
          <button onClick={() => setSbOpen(true)} title="Boards">☰</button>
          <span className="mobile-topbar-title">{board.name}</span>
        </div>
        <BoardGrid user={user} board={board} options={options} prefs={prefs} />
      </div>
    </div>
  );
}
