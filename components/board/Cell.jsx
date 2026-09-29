'use client';
import { useContext, useState } from 'react';
import Popover from './Popover';
import { OptionsContext } from './OptionsContext';
import SyncedInput from './SyncedInput';
import {
  labelColor, optionList, fmtCurrency, parseCurrency, fmtDate, EMPTY_COLOR,
} from './columns';

const commitOnEnter = (e) => {
  if (e.key === 'Enter') e.currentTarget.blur();
  if (e.key === 'Escape') { e.currentTarget.value = e.currentTarget.defaultValue; e.currentTarget.blur(); }
};

// Footer action that clears the value, set apart from the option list.
export function ClearOption({ onClick }) {
  return (
    <div className="pop-footer">
      <button type="button" className="pop-clear" onClick={onClick}>
        <span aria-hidden="true">✕</span> Clear selection
      </button>
    </div>
  );
}

// Dropdown list with a filter box; `onAdd` (when given) offers to add a missing entry.
// `renderOption(o)` draws a row (defaults to label + check). In `multi` mode picking
// toggles and the popover stays open, so the query resets after each pick.
function SearchableOptions({ options, value, onPick, onAdd, placeholder, renderOption, multi }) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const q = query.trim();
  const matches = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;
  const exact = options.find((o) => o.label.toLowerCase() === q.toLowerCase());
  const canAdd = !!onAdd && !!q && !exact;

  const choose = (label) => { onPick(label); if (multi) setQuery(''); };
  const add = async () => {
    setAdding(true); setError(null);
    try { await onAdd(q); choose(q); }
    catch (e) { setError(e.message || 'Could not add'); }
    setAdding(false);
  };

  return (
    <>
      <input
        className="pop-search"
        autoFocus
        value={query}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => { setQuery(e.target.value); setError(null); }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (exact) choose(exact.label);
          else if (matches.length === 1) choose(matches[0].label);
          else if (canAdd && !adding) add();
        }}
      />
      <div className="pop-scroll">
        {matches.map((o) => (
          <div key={o.label} className="pop-opt" onClick={() => choose(o.label)}>
            {renderOption ? renderOption(o) : (
              <>
                {o.label}
                {value === o.label && <span className="pop-check">✓</span>}
              </>
            )}
          </div>
        ))}
        {!matches.length && !canAdd && <div className="pop-empty">No matches</div>}
      </div>
      {canAdd && (
        <button type="button" className="pop-add" onClick={add} disabled={adding}>
          {adding ? 'Adding…' : <>+ Add “{q}”</>}
        </button>
      )}
      {error && <div className="pop-error">{error}</div>}
    </>
  );
}

// One grid cell. `col` is the column def, `onCommit(patch)` persists a change.
export default function Cell({ col, item, options, onCommit, readOnly }) {
  const optionsApi = useContext(OptionsContext);
  const addOption = optionsApi?.addOption;
  const [anchor, setAnchor] = useState(null);
  const [editingNum, setEditingNum] = useState(false);
  const value = item[col.key];
  const openPop = (e) => { if (!readOnly) setAnchor(e.currentTarget.getBoundingClientRect()); };
  const close = () => setAnchor(null);
  const pick = (patch) => { onCommit(patch); close(); };

  // Removes the choice from the board's list only; deals that use it keep it.
  const removeChoice = async (label) => {
    const noun = col.label.toLowerCase();
    const inUse = optionsApi.countUses?.(col.key, label) ?? 0;
    const msg = `Delete "${label}" from the ${noun} list?`
      + (inUse ? `\n\n${inUse} deal${inUse === 1 ? '' : 's'} still use${inUse === 1 ? 's' : ''} it and will keep it.` : '');
    if (!confirm(msg)) return;
    try {
      await optionsApi.removeOption(col.field, label);
      optionsApi.notify(`Deleted ${noun} "${label}"`);
    } catch (e) {
      optionsApi.notify(`Couldn't delete "${label}": ${e.message}`);
    }
  };
  const canDelete = col.deletable && optionsApi?.removeOption;
  const deleteButton = (label) => canDelete && (
    <button
      type="button"
      className="pop-opt-del"
      title={`Delete "${label}" from the list`}
      aria-label={`Delete ${label} from the ${col.label.toLowerCase()} list`}
      onClick={(e) => { e.stopPropagation(); removeChoice(label); }}
    >✕</button>
  );

  // --- text (name, notes, email) ---
  if (col.type === 'text') {
    return (
      <SyncedInput
        className={'cell-input' + (col.key === 'email' ? ' email' : '')}
        value={value ?? ''}
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
            <ClearOption onClick={() => pick({ [col.key]: null })} />
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
          <Popover anchorRect={anchor} onClose={close} width={col.creatable ? 230 : 200}>
            {col.creatable ? (
              <SearchableOptions
                options={optionList(options, col.field)}
                value={value}
                placeholder={`Search or add ${col.label.toLowerCase()}`}
                onPick={(label) => pick({ [col.key]: label })}
                onAdd={addOption ? (label) => addOption(col.field, label) : null}
                renderOption={(o) => (
                  <>
                    <span className="pop-opt-label">{o.label}</span>
                    {value === o.label && <span className="pop-check">✓</span>}
                    {deleteButton(o.label)}
                  </>
                )}
              />
            ) : optionList(options, col.field).map((o) => (
              <div key={o.label} className="pop-opt" onClick={() => pick({ [col.key]: o.label })}>
                {o.label}
                {value === o.label && <span className="pop-check">✓</span>}
              </div>
            ))}
            <ClearOption onClick={() => pick({ [col.key]: null })} />
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
          <Popover anchorRect={anchor} onClose={close} width={230}>
            <SearchableOptions
              multi
              options={optionList(options, col.field)}
              placeholder={`Search or add ${col.label.toLowerCase()}`}
              onPick={toggle}
              onAdd={col.creatable && addOption ? (label) => addOption(col.field, label) : null}
              renderOption={(o) => (
                <>
                  <span className="pop-swatch" style={{
                    background: arr.includes(o.label) ? 'var(--blue)' : 'transparent',
                    border: '1.5px solid ' + (arr.includes(o.label) ? 'var(--blue)' : 'var(--bd3)'),
                  }} />
                  <span className="pop-opt-label">{o.label}</span>
                  {deleteButton(o.label)}
                </>
              )}
            />
            <ClearOption onClick={() => pick({ [col.key]: [] })} />
          </Popover>
        )}
      </>
    );
  }

  return <div className="label-fill">{String(value ?? '')}</div>;
}
