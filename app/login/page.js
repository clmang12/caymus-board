'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const inputStyle = {
  padding: '10px 12px', fontSize: 14, fontFamily: 'inherit',
  border: '1px solid #d0d4e4', borderRadius: 8, outline: 'none'
};
const primaryBtn = {
  padding: '10px 12px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
  color: '#fff', background: '#0073ea', border: 'none',
  borderRadius: 8, cursor: 'pointer'
};
const linkBtn = {
  background: 'none', border: 'none', padding: 0, fontFamily: 'inherit',
  fontSize: 13, color: '#0073ea', cursor: 'pointer', alignSelf: 'center'
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState('idle'); // idle | busy | sent
  const [error, setError] = useState(null);

  async function signInWithPassword(e) {
    e.preventDefault();
    setState('busy'); setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setState('idle');
      setError(error.message === 'Invalid login credentials'
        ? 'Wrong email or password. No password yet? Use "Email me a sign-in link", then choose "Set password" in the sidebar.'
        : error.message);
      return;
    }
    // Full navigation so middleware sees the new session cookies.
    window.location.assign('/');
  }

  async function sendLink() {
    if (!email) { setError('Enter your email first.'); return; }
    setState('busy'); setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin) + '/auth/callback'
      }
    });
    if (error) {
      setState('idle');
      // enforce_invite_only (schema.sql) aborts the new user; Supabase reports it generically.
      setError(/database error (saving|creating) new user/i.test(error.message)
        ? "This email hasn't been invited. Ask the board owner to add you."
        : error.message);
    } else setState('sent');
  }

  return (
    <main style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: '#f6f7fb', padding: 24
    }}>
      <div style={{
        width: '100%', maxWidth: 380, background: '#fff', border: '1px solid #e6e9ef',
        borderRadius: 12, padding: 28, boxShadow: '0 4px 20px rgba(30,40,80,.06)'
      }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '.12em',
          color: '#0073ea', marginBottom: 6
        }}>CAYMUS MORTGAGE CAPITAL</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 18px' }}>Sign in</h1>

        {state === 'sent' ? (
          <p style={{ fontSize: 14, color: '#676879', lineHeight: 1.6, margin: 0 }}>
            Check <strong style={{ color: '#323338' }}>{email}</strong> for a sign-in
            link. It expires in an hour.
          </p>
        ) : (
          <form onSubmit={signInWithPassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email" required value={email} autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@caymusmortgage.ca"
              aria-label="Email"
              style={inputStyle}
            />
            <input
              type="password" required value={password} autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              aria-label="Password"
              style={inputStyle}
            />
            <button type="submit" disabled={state === 'busy'} style={primaryBtn}>
              {state === 'busy' ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="button" onClick={sendLink} disabled={state === 'busy'} style={linkBtn}>
              Email me a sign-in link instead
            </button>
            {error && (
              <p style={{ fontSize: 13, color: '#df2f4a', margin: 0, lineHeight: 1.5 }}>{error}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
