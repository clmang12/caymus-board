'use client';
import { AUTOMATION_DEFS } from './automationDefs';

export default function AutomationsPanel({ enabledMap, onToggle, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>⚡ Board automations</span>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {AUTOMATION_DEFS.map((a) => {
            const checked = enabledMap[a.key] ?? true;
            return (
              <div key={a.key} className="auto-row">
                <span style={{ flex: 1 }}>{a.text}</span>
                <label className="toggle">
                  <input type="checkbox" checked={checked} onChange={(e) => onToggle(a.key, e.target.checked)} />
                  <span className="toggle-track" />
                  <span className="toggle-thumb" />
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
