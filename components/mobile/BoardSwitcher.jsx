'use client';
import { useRef, useState } from 'react';
import { PencilIcon } from './icons';
import { stop } from './OptionMenu';

const BOARD_COLORS = ['var(--accent)', '#a25ddc', '#00c875', '#fdab3d', '#e2445c', '#579bfc'];
export const boardColor = (index) => BOARD_COLORS[index % BOARD_COLORS.length];

function RenameInput({ initial, onSave, onCancel }) {
  const [value, setValue] = useState(initial);
  const settled = useRef(false);
  const finish = (save) => {
    if (settled.current) return;
    settled.current = true;
    const v = value.trim();
    if (save && v && v !== initial) onSave(v); else onCancel();
  };
  return (
    <input
      className="m-board-input"
      value={value}
      autoFocus
      aria-label="Board name"
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        // Esc cancels the rename only; it shouldn't also close the switcher.
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
      }}
      onBlur={() => finish(true)}
      onPointerDown={stop}
      onClick={stop}
    />
  );
}

// `placement` is 'header' (drops under the board title) or 'tab' (opens
// above the tab bar).
export default function BoardSwitcher({ boards, activeId, editingId, placement, pending, onPick, onEdit, onRename, onCancelEdit }) {
  return (
    <div className={'m-boardmenu ' + placement} role="dialog" aria-label="Switch board" onPointerDown={stop} onClick={stop}>
      <div className="m-label pad">SWITCH BOARD</div>
      {boards.map((b, i) => {
        const active = b.id === activeId;
        const editing = editingId === b.id;
        return (
          <div key={b.id} className={'m-board-row' + (active ? ' active' : '')} aria-current={active ? 'true' : undefined}>
            {editing ? (
              <div className="m-board-pick">
                <span className="m-board-icon" style={{ background: boardColor(i) }} aria-hidden="true">{(b.name || '?')[0]}</span>
                <span className="m-board-text">
                  <RenameInput initial={b.name} onSave={(name) => onRename(b.id, name)} onCancel={onCancelEdit} />
                </span>
              </div>
            ) : (
              <button type="button" className="m-board-pick" onClick={() => onPick(b.id)}>
                <span className="m-board-icon" style={{ background: boardColor(i) }} aria-hidden="true">{(b.name || '?')[0]}</span>
                <span className="m-board-text">
                  <span className="m-board-name">{b.name}</span>
                  {b.description && <span className="m-board-desc">{b.description}</span>}
                </span>
              </button>
            )}
            {!editing && (
              <button type="button" className="m-icon-btn" title="Rename board" aria-label={`Rename ${b.name}`} onClick={() => onEdit(b.id)}>
                <PencilIcon />
              </button>
            )}
            {active && <span className="m-board-check" aria-hidden="true">✓</span>}
            {pending === b.id && <span className="m-spinner sm" aria-label="Loading" />}
          </div>
        );
      })}
    </div>
  );
}
