'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// OAuth consent screen. Supabase Auth's OAuth 2.1 server sends the browser
// here (Authentication > OAuth Server > Authorization Path) with an
// authorization_id when an AI assistant asks to connect to the board.
// Middleware has already made sure the user is signed in.

const primaryBtn = {
  flex: 1, padding: '10px 12px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
  color: '#fff', background: '#0073ea', border: 'none', borderRadius: 8, cursor: 'pointer'
};
const secondaryBtn = {
  ...primaryBtn, color: '#323338', background: '#fff', border: '1px solid #d0d4e4'
};

const CAN = [
  'Read every board: deals, conditions, updates and file names',
  'Edit deal fields and move deals between groups',
  'Add deals, add and update conditions, post updates as you',
  'Delete deals, conditions and updates, after you approve each one in the assistant (they go to Trash)',
];
const CANNOT = 'It can’t restore or empty the Trash, download files, or change boards, groups, automations or dropdown lists.';

function hostOf(uri) {
  try { return new URL(uri).host; } catch { return uri; }
}

export default function OAuthConsent() {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('authorization_id');
    if (!id) { setError('This link is missing its authorization request. Start connecting again from your AI assistant.'); return; }
    (async () => {
      const { data, error } = await createClient().auth.oauth.getAuthorizationDetails(id);
      if (error) { setError(error.message); return; }
      // Already approved earlier: Supabase hands back the redirect straight away.
      if (!('authorization_id' in data)) { window.location.replace(data.redirect_url); return; }
      setDetails(data);
    })();
  }, []);

  async function decide(approve) {
    setBusy(true);
    const sb = createClient();
    const call = approve ? sb.auth.oauth.approveAuthorization : sb.auth.oauth.denyAuthorization;
    const { data, error } = await call.call(sb.auth.oauth, details.authorization_id, { skipBrowserRedirect: true });
    if (error) { setBusy(false); setError(error.message); return; }
    window.location.assign(data.redirect_url);
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f6f7fb', padding: 24 }}>
      <div style={{
        width: '100%', maxWidth: 420, background: '#fff', border: '1px solid #e6e9ef',
        borderRadius: 12, padding: 28, boxShadow: '0 4px 20px rgba(30,40,80,.06)'
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: '#0073ea', marginBottom: 6 }}>
          CAYMUS MORTGAGE CAPITAL
        </div>

        {error ? (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 12px' }}>Can’t connect</h1>
            <p style={{ fontSize: 14, color: '#df2f4a', lineHeight: 1.5, margin: 0 }}>{error}</p>
          </>
        ) : !details ? (
          <p style={{ fontSize: 14, color: '#676879', margin: 0 }}>Loading…</p>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>
              Connect {details.client.name || 'this app'}?
            </h1>
            <p style={{ fontSize: 14, color: '#676879', lineHeight: 1.5, margin: '0 0 16px' }}>
              <strong style={{ color: '#323338' }}>{details.client.name || 'An app'}</strong>
              {' '}({hostOf(details.redirect_uri)}) wants to use the board as{' '}
              <strong style={{ color: '#323338' }}>{details.user.email}</strong>. It will be able to:
            </p>
            <ul style={{ fontSize: 14, color: '#323338', lineHeight: 1.6, margin: '0 0 12px', paddingLeft: 20 }}>
              {CAN.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <p style={{ fontSize: 13, color: '#676879', lineHeight: 1.5, margin: '0 0 20px' }}>
              {CANNOT} The board holds client information. Only connect assistants you trust. You can disconnect it any time under “AI assistants” in the sidebar.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" style={secondaryBtn} disabled={busy} onClick={() => decide(false)}>Deny</button>
              <button type="button" style={primaryBtn} disabled={busy} onClick={() => decide(true)}>
                {busy ? 'Connecting…' : 'Allow'}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
