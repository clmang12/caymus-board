'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setState('sending'); setError(null);
    const sb = createClient();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin) + '/auth/callback'
      }
    });
    if (error) { setError(error.message); setState('idle'); }
    else setState('sent');
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
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email" required value={email} autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@caymusmortgage.ca"
              style={{
                padding: '10px 12px', fontSize: 14, fontFamily: 'inherit',
                border: '1px solid #d0d4e4', borderRadius: 8, outline: 'none'
              }}
            />
            <button
              type="submit" disabled={state === 'sending'}
              style={{
                padding: '10px 12px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                color: '#fff', background: '#0073ea', border: 'none',
                borderRadius: 8, cursor: 'pointer'
              }}
            >
              {state === 'sending' ? 'Sending…' : 'Email me a link'}
            </button>
            {error && (
              <p style={{ fontSize: 13, color: '#df2f4a', margin: 0 }}>{error}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
