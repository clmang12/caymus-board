'use client';
import { useState } from 'react';
import Popover from './Popover';
import {
  labelColor, optionList, fmtCurrency, parseCurrency, fmtDate, EMPTY_COLOR,
} from './columns';

const commitOnEnter = (e) => {
  if (e.key === 'Enter') e.currentTarget.blur();
  if (e.key === 'Escape') { e.currentTarget.value = e.currentTarget.defaultValue; e.currentTarget.blur(); }
};

// One grid cell. `col` is the column def, `onCommit(patch)` persists a change.
export default function Cell({ col, item, options, onCommit, readOnly }) {
  const [anchor, setAnchor] = useState(null);
  const [editingNum, setEditingNum] = useState(false);
  const value = item[col.key];
  const openPop = (e) => { if (!readOnly) setAnchor(e.currentTarget.getBoundingClientRect()); };
  const close = () => setAnchor(null);
  const pick = (patch) => { onCommit(patch); close(); };

  // --- text (name, notes, email) ---
  if (col.type === 'text') {
    return (
      <input
        className={'cell-input' + (col.key === 'email' ? ' email' : '')}
        defaultValue={value ?? ''}
        placeholder={col.key === 'name' ? '' : '–'}
        readOnly={readOnly}
        onKeyDown={commitOnEnter}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (col.key === 'name') { if (v && v !== value) onCommit({ name: v }); else e.target.value = value ?? ''; }
          else if (v !== (value ?? '')) onCommit({ [col.key]: v || null });
        }}
      />
    );
  }

  // --- currency (volume) ---
  if (col.type === 'currency') {
    if (editingNum && !readOnly) {
      return (
        <input
          className="cell-input num"
          autoFocus
          defaultValue={value ?? ''}
          onKeyDown={commitOnEnter}
          onBlur={(e) => {
            setEditingNum(false);
            const n = parseCurrency(e.target.value);
            if (n !== (value ?? null)) onCommit({ volume: n });
          }}
        />
      );
    }
    return (
      <div className={'label-fill' + (readOnly ? '' : ' clickable')}
        style={{ justifyContent: 'flex-end', color: 'var(--tx)', paddingRight: 10 }}
        onClick={() => !readOnly && setEditingNum(true)}>
        {fmtCurrency(value) || <span style={{ color: 'var(--tx3)' }}>–</span>}
      </div>
    );
  }

  // --- date (close_date) ---
  if (col.type === 'date') {
    return (
      <input
        type="date"
        value={value ?? ''}
        disabled={readOnly}
        onChange={(e) => onCommit({ close_date: e.target.value || null })}
        style={{
          border: 'none', background: 'transparent', font: 'inherit', fontSize: 12.5,
          color: value ? 'var(--tx)' : 'var(--tx3)', outline: 'none', width: '100%',
          textAlign: 'center', cursor: readOnly ? 'default' : 'pointer',
        }}
      />
    );
  }

  // --- label (colored fill, or centered pill) ---
  if (col.type === 'label') {
    const color = labelColor(options, col.field, value);
    return (
      <>
        {col.pill ? (
          <div className={'label-fill' + (readOnly ? '' : ' clickable')} style={{ color: 'var(--tx3)' }} onClick={openPop}>
            {value ? <span className="pill" style={{ background: color }}>{value}</span> : '–'}
          </div>
        ) : (
          <div
            className={'label-fill' + (readOnly ? '' : ' clickable')}
            style={{ background: value ? color : 'transparent', color: value ? '#fff' : 'var(--tx3)' }}
            onClick={openPop}
          >
            {value || '–'}
          </div>
        )}
        {anchor && (
          <Popover anchorRect={anchor} onClose={close} width={220}>
            {optionList(options, col.field).map((o) => (
              <div key={o.label} className="pop-opt" onClick={() => pick({ [col.key]: o.label })}>
                <span className="pop-swatch" style={{ background: o.color || EMPTY_COLOR }} />
                {o.label}
                {value === o.label && <span className="pop-check">✓</span>}
              </div>
            ))}
            <div className="pop-opt" onClick={() => pick({ [col.key]: null })} style={{ color: 'var(--tx2)' }}>
              <span className="pop-swatch" style={{ background: 'var(--bd2)' }} />
              Clear
            </div>
          </Popover>
        )}
      </>
    );
  }

  // --- dropdown (deal, appraiser) — plain text display ---
  if (col.type === 'dropdown') {
    return (
      <>
        <div className={'label-fill' + (readOnly ? '' : ' clickable')}
          style={{ color: value ? 'var(--tx)' : 'var(--tx3)' }} onClick={openPop}>
          {value || '–'}
        </div>
        {anchor && (
          <Popover anchorRect={anchor} onClose={close} width={200}>
            {optionList(options, col.field).map((o) => (
              <div key={o.label} className="pop-opt" onClick={() => pick({ [col.key]: o.label })}>
                {o.label}
                {value === o.label && <span className="pop-check">✓</span>}
              </div>
            ))}
            <div className="pop-opt" onClick={() => pick({ [col.key]: null })} style={{ color: 'var(--tx2)' }}>Clear</div>
          </Popover>
        )}
      </>
    );
  }

  // --- multi (lender) ---
  if (col.type === 'multi') {
    const arr = Array.isArray(value) ? value : [];
    const toggle = (label) => {
      const next = arr.includes(label) ? arr.filter((x) => x !== label) : [...arr, label];
      onCommit({ [col.key]: next });
    };
    return (
      <>
        <div className={'label-fill' + (readOnly ? '' : ' clickable')}
          style={{ gap: 4, flexWrap: 'nowrap', color: 'var(--tx)', overflow: 'hidden' }} onClick={openPop}>
          {arr.length
            ? arr.map((l) => <span key={l} className="chip">{l}</span>)
            : <span style={{ color: 'var(--tx3)' }}>–</span>}
        </div>
        {anchor && (
          <Popover anchorRect={anchor} onClose={close} width={220}>
            <div style={{ maxHeight: 280, overflow: 'auto' }}>
              {optionList(options, col.field).map((o) => (
                <div key={o.label} className="pop-opt" onClick={() => toggle(o.label)}>
                  <span className="pop-swatch" style={{
                    background: arr.includes(o.label) ? 'var(--blue)' : 'transparent',
                    border: '1.5px solid ' + (arr.includes(o.label) ? 'var(--blue)' : 'var(--bd3)'),
                  }} />
                  {o.label}
                </div>
              ))}
            </div>
          </Popover>
        )}
      </>
    );
  }

  return <div className="label-fill">{String(value ?? '')}</div>;
}
