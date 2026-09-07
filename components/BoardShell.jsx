'use client';
import Sidebar from './Sidebar';
import BoardGrid from './board/BoardGrid';
import './board/board.css';

export default function BoardShell({ user, boards, board, options, prefs }) {
  return (
    <div className="board-root">
      <Sidebar boards={boards} activeId={board.id} user={user} />
      <BoardGrid user={user} board={board} options={options} prefs={prefs} />
    </div>
  );
}
