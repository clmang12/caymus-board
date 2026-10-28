'use client';
import { useEffect, useRef, useState } from 'react';
import { COLUMNS, parseCurrency } from '@/components/board/columns';
import OptionMenu, { StatusPill } from './OptionMenu';
import ConditionList from './ConditionList';
import UpdateBody from '@/components/board/UpdateBody';
import RichEditor from '@/components/board/RichEditor';
import { isRichText, sanitizeHtml, textToHtml } from '@/lib/richtext';
import { BackIcon } from './icons';
import {
  agentColor, agentInitials, condProgress, dealColor, money, optionColor, optionsFor,
  personInitials, shortDate, swatch, timeAgo,
} from './format';

// Every deal field except status (it's in the header) and the computed
// progress column, in the desktop grid's order and with its labels.
const FIELDS = COLUMNS.filter((c) => c.key !== 'conditions_progress' && c.key !== 'status');

const TABS = [['details', 'Details'], ['conds', 'Conditions'], ['updates', 'Updates']];

function display(col, item, options) {
  const v = item[col.key];
  if (col.key === 'agent') {
    return (
      <span className="m-agent">
        <span className="m-avatar lg" style={{ background: agentColor(options, v) }} aria-hidden="true">{agentInitials(v)}</span>
        <span className="m-field-text">{v || 'Unassigned'}</span>
      </span>
    );
  }
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return <span className="m-field-none">Add</span>;
  if (col.key === 'deal') return <span className="m-chip" style={{ background: dealColor(options, v) }}>{v}</span>;
  if (col.type === 'label') return <span className="m-pill static" style={{ background: optionColor(options, col.field, v) }}>{v}</span>;
  if (col.type === 'multi') return v.map((l) => <span key={l} className="m-lender">{l}</span>);
  if (col.type === 'date') return <span className="m-field-text">{shortDate(v, true)}</span>;
  if (col.type === 'currency') return <span className="m-field-text">{money(v)}</span>;
  return <span className="m-field-text wrap">{v}</span>;
}

function TextField({ col, value, onCommit, onDone }) {
  const ref = useRef(null);
  const settled = useRef(false);
  useEffect(() => { ref.current?.focus(); }, []);
  const finish = (save) => {
    if (settled.current) return;
    settled.current = true;
    if (save) {
      const raw = ref.current.value;
      let next = col.type === 'currency' ? parseCurrency(raw) : raw.trim() || null;
      if (col.key === 'name' && !next) next = undefined; // a deal always needs a name
      if (next !== undefined && next !== (value ?? null)) onCommit(next);
    }
    onDone();
  };
  const props = {
    ref,
    className: 'm-field-input',
    defaultValue: value ?? '',
    'aria-label': col.label,
    onBlur: () => finish(true),
    onKeyDown: (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      if (e.key === 'Enter' && col.key !== 'notes') { e.preventDefault(); finish(true); }
    },
  };
  if (col.key === 'notes') return <textarea rows={3} {...props} />;
  return (
    <input
      {...props}
      type={col.key === 'email' ? 'email' : 'text'}
      inputMode={col.type === 'currency' ? 'decimal' : undefined}
    />
  );
}

// Native date input laid over the row. iOS can fire change on every wheel
// tick, so commits are debounced and flushed on blur.
function DateField({ col, value, onCommit }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const latest = useRef(value ?? '');
  const flush = () => {
    clearTimeout(timer.current);
    const next = latest.current || null;
    if (next !== (value ?? null)) onCommit(next);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  // Show changes made elsewhere (undo, a teammate) unless it's being edited.
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.value = value ?? '';
      latest.current = value ?? '';
    }
  }, [value]);
  return (
    <input
      ref={ref}
      type="date"
      className="m-date-overlay"
      aria-label={col.label}
      defaultValue={value ?? ''}
      onChange={(e) => { latest.current = e.target.value; clearTimeout(timer.current); timer.current = setTimeout(flush, 700); }}
      onBlur={flush}
    />
  );
}

// Bottom sheet for label / dropdown / multi-select fields.
function FieldPicker({ col, value, options, onPick, onClose }) {
  const list = optionsFor(options, col.field);
  const multi = col.type === 'multi';
  const chosen = multi ? (value || []) : [value];
  const colored = col.type === 'label';
  return (
    <div className="m-sheet-wrap" role="dialog" aria-label={col.label}>
      <div className="m-scrim" onClick={onClose} />
      <div className="m-sheet">
        <div className="m-grabber" aria-hidden="true" />
        <div className="m-sheet-head">
          <div className="m-sheet-title">{col.label}</div>
          <button type="button" className="m-sheet-done" onClick={onClose}>Done</button>
        </div>
        <div className="m-sheet-list">
          {!list.length && <div className="m-conds-empty">No options on this board yet.</div>}
          {list.map(([label, color]) => {
            const on = chosen.includes(label);
            return (
              <button
                key={label}
                type="button"
                role={multi ? 'menuitemcheckbox' : 'menuitemradio'}
                aria-checked={on}
                className={'m-sheet-opt' + (on ? ' on' : '')}
                onClick={() => {
                  if (multi) onPick(on ? chosen.filter((l) => l !== label) : [...chosen, label]);
                  else { onPick(on ? value : label); onClose(); }
                }}
              >
                {colored && <span className="m-dot" style={{ background: swatch(color) }} aria-hidden="true" />}
                {col.key === 'agent' && <span className="m-avatar" style={{ background: color || '#9699a6' }} aria-hidden="true">{agentInitials(label)}</span>}
                <span className="m-sheet-opt-label">{label}</span>
                {on && <span className="m-sheet-check" aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
        {(multi ? chosen.length > 0 : !!value) && (
          <button
            type="button"
            className="m-sheet-clear"
            onClick={() => { onPick(multi ? [] : null); onClose(); }}
          >Clear</button>
        )}
      </div>
    </div>
  );
}

function UpdateActions({ onEdit, onDelete, onClose }) {
  return (
    <div className="m-sheet-wrap" role="dialog" aria-label="Update options">
      <div className="m-scrim" onClick={onClose} />
      <div className="m-sheet">
        <div className="m-grabber" aria-hidden="true" />
        <div className="m-sheet-head">
          <div className="m-sheet-title">Update</div>
          <button type="button" className="m-sheet-done" onClick={onClose}>Cancel</button>
        </div>
        <div className="m-sheet-list">
          <button type="button" className="m-sheet-opt" onClick={() => { onClose(); onEdit(); }}>
            <span className="m-sheet-opt-label">Edit update</span>
          </button>
          <button type="button" className="m-sheet-opt m-danger" onClick={() => { onClose(); onDelete(); }}>
            <span className="m-sheet-opt-label">Delete update</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DealDetail({
  item, options, tab, open, statusMenu, condMenu, selected, updates,
  onTab, onClose, onOpenStatus, onPickStatus, onCommit, condHandlers, onPostUpdate, onEditUpdate, onDeleteUpdate,
}) {
  const [editing, setEditing] = useState(null);
  const [picker, setPicker] = useState(null);
  const [updateMenuId, setUpdateMenuId] = useState(null);
  const [editingUpdateId, setEditingUpdateId] = useState(null);
  const { done, total, pct } = condProgress(item);
  const vol = money(item.volume);
  const statusOptions = optionsFor(options, 'status');

  const startEdit = (col) => {
    if (col.type === 'label' || col.type === 'dropdown' || col.type === 'multi') setPicker(col.key);
    else if (col.type !== 'date') setEditing(col.key);
  };
  const pickerCol = picker && FIELDS.find((c) => c.key === picker);

  return (
    <div className={'m-detail' + (open ? ' open' : '')} role="dialog" aria-label={item.name} aria-modal="true">
      <header className="m-detail-head">
        <div className="m-detail-row">
          <button type="button" className="m-back" aria-label="Back to board" onClick={onClose}><BackIcon /></button>
          <h1 className="m-detail-name">{item.name}</h1>
        </div>
        <div className="m-detail-row status">
          <div className="m-anchor">
            <StatusPill
              big
              status={item.status}
              color={optionColor(options, 'status', item.status)}
              open={!!statusMenu}
              onOpen={(el) => onOpenStatus(item.id, el, statusOptions.length, 'detail')}
            />
            {statusMenu && (
              <OptionMenu
                align="left"
                label={`Status for ${item.name}`}
                options={statusOptions}
                current={item.status}
                up={false}
                onPick={(label) => onPickStatus(item.id, label)}
              />
            )}
          </div>
          {vol && <span className="m-detail-vol">{vol}</span>}
        </div>
        <div className="m-tabs" role="tablist">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={'m-tab' + (tab === key ? ' on' : '')}
              onClick={() => onTab(key)}
            >
              {label}{key === 'conds' && total ? ` ${done}/${total}` : ''}
            </button>
          ))}
        </div>
      </header>

      <div className="m-detail-scroll">
        {tab === 'details' && (
          <div className="m-fields">
            {FIELDS.map((col) => (
              <div
                key={col.key}
                className={'m-field' + (editing === col.key ? ' editing' : '')}
                onClick={() => editing !== col.key && startEdit(col)}
              >
                <span className="m-field-label">{col.label}</span>
                <div className="m-field-val">
                  {editing === col.key ? (
                    <TextField
                      col={col}
                      value={item[col.key]}
                      onCommit={(v) => onCommit(item.id, col, v)}
                      onDone={() => setEditing(null)}
                    />
                  ) : display(col, item, options)}
                  {col.type === 'date' && (
                    <DateField col={col} value={item[col.key]} onCommit={(v) => onCommit(item.id, col, v)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'conds' && (
          <>
            {total > 0 && (
              <div className="m-progress-row">
                <div className="m-bar thick"><div className={'m-bar-fill' + (pct >= 1 ? ' full' : '')} style={{ width: Math.round(pct * 100) + '%' }} /></div>
                <span className="m-progress-txt">{done}/{total} accepted</span>
              </div>
            )}
            <ConditionList variant="detail" item={item} options={options} selected={selected} menu={condMenu} {...condHandlers} />
          </>
        )}

        {tab === 'updates' && (
          <>
            <div className="m-composer">
              <RichEditor placeholder="Write an update…" inlineMenus onSubmit={(body) => onPostUpdate(item.id, body)} />
            </div>
            {updates?.loading && !updates.list.length && <div className="m-empty"><span className="m-spinner" aria-label="Loading updates" /></div>}
            {updates && !updates.loading && !updates.list.length && (
              <div className="m-empty"><div className="m-empty-icon">💬</div>No updates yet.</div>
            )}
            {(updates?.list || []).map((u) => {
              const author = u.author?.full_name || u.author?.email || 'Automation';
              return (
                <div key={u.id} className="m-update">
                  <div className="m-update-head">
                    <span className="m-avatar lg" style={{ background: u.author ? '#66ccff' : '#9699a6' }} aria-hidden="true">{personInitials(author)}</span>
                    <span className="m-update-author">{author}</span>
                    <span className="m-update-time">{timeAgo(u.created_at)}</span>
                    {editingUpdateId !== u.id && (
                      <button type="button" className="m-update-more" aria-label="Update options" onClick={() => setUpdateMenuId(u.id)}>⋯</button>
                    )}
                  </div>
                  {editingUpdateId === u.id ? (
                    <div className="m-composer m-update-edit">
                      <RichEditor
                        initialHtml={isRichText(u.body) ? sanitizeHtml(u.body) : textToHtml(u.body)}
                        placeholder="Edit update"
                        submitLabel="Save"
                        inlineMenus
                        autoFocus
                        onCancel={() => setEditingUpdateId(null)}
                        onSubmit={(body) => { if (body !== u.body) onEditUpdate(item.id, u, body); setEditingUpdateId(null); }}
                      />
                    </div>
                  ) : (
                    <UpdateBody body={u.body} className="m-update-body" />
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {updateMenuId && (
        <UpdateActions
          onClose={() => setUpdateMenuId(null)}
          onEdit={() => setEditingUpdateId(updateMenuId)}
          onDelete={() => {
            const u = (updates?.list || []).find((x) => x.id === updateMenuId);
            if (u) onDeleteUpdate(item.id, u);
          }}
        />
      )}

      {pickerCol && (
        <FieldPicker
          col={pickerCol}
          value={item[pickerCol.key]}
          options={options}
          onPick={(v) => onCommit(item.id, pickerCol, v)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
