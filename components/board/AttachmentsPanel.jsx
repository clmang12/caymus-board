'use client';
import { useRef } from 'react';

function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AttachmentsPanel({ attachments, onUpload, onDelete, onDownload }) {
  const fileRef = useRef(null);
  const list = attachments?.list || [];
  const loading = !!attachments?.loading;

  return (
    <div className="files-wrap">
      <div className="files-box">
        <div className="files-head">
          <span>Files{list.length > 0 ? ` (${list.length})` : ''}</span>
          <button className="board-btn" onClick={() => fileRef.current?.click()}>+ Add file</button>
          <input
            ref={fileRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              Array.from(e.target.files || []).forEach((f) => onUpload(f));
              e.target.value = '';
            }}
          />
        </div>

        {loading && list.length === 0 && <div className="files-empty">Loading…</div>}
        {!loading && list.length === 0 && <div className="files-empty">No files yet.</div>}

        {list.map((a) => (
          <div key={a.id} className="files-row">
            <span className="files-icon">📄</span>
            <button className="files-name" title={`Download ${a.filename}`} onClick={() => onDownload(a.storage_path, a.filename)}>
              {a.filename}
            </button>
            <span className="files-meta">{formatSize(a.size_bytes)} · {formatDate(a.created_at)}</span>
            <button className="sub-del" title="Delete file" onClick={() => onDelete(a.id, a.storage_path)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
