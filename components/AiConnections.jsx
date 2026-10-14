'use client';
import { useEffect, useState } from 'react';

// Sidebar "AI assistants" popover: the MCP URL to paste into Claude / ChatGPT
// as a custom connector, and the assistants this user has allowed (Supabase
// OAuth grants), each with Disconnect.
export default function AiConnections({ sb }) {
  const mcpUrl = `${window.location.origin}/api/mcp`;
  const [grants, setGrants] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    const { data, error } = await sb.auth.oauth.listGrants();
    if (error) { setError(error.message); setGrants([]); return; }
    setError(null);
    setGrants(data);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function copy() {
    try { await navigator.clipboard.writeText(mcpUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }

  async function revoke(grant) {
    if (!confirm(`Disconnect ${grant.client.name || 'this app'}? It will lose access to the board.`)) return;
    const { error } = await sb.auth.oauth.revokeGrant({ clientId: grant.client.id });
    if (error) { setError(error.message); return; }
    load();
  }

  return (
    <div className="sb-ai">
      <p>Add the board to Claude or ChatGPT as a custom connector with this URL:</p>
      <div className="sb-ai-url">
        <input readOnly value={mcpUrl} aria-label="Connector URL" onFocus={(e) => e.target.select()} />
        <button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <div className="sb-ai-head">Connected</div>
      {grants === null ? <p>Loading…</p>
        : grants.length === 0 ? <p>{error ? '' : 'No assistants connected yet.'}</p>
        : grants.map((g) => (
          <div key={g.client.id} className="sb-ai-row">
            <span title={g.client.uri || ''}>{g.client.name || g.client.id}</span>
            <button type="button" onClick={() => revoke(g)}>Disconnect</button>
          </div>
        ))}
      {error && <p className="err">{error}</p>}
    </div>
  );
}
