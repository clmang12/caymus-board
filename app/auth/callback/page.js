'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Handles both auth flows Supabase can send here:
//  - PKCE / server flow:   ?code=...           (normal magic-link login)
//  - implicit flow:        #access_token=...   (admin-generated links, OAuth)
export default function AuthCallback() {
  const [error, setError] = useState(null);

  useEffect(() => {
    const sb = createClient();
    const url = new URL(window.location.href);
    const next = url.searchParams.get('next') || '/';
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const code = url.searchParams.get('code');

    (async () => {
      try {
        if (hash.get('access_token') && hash.get('refresh_token')) {
          const { error } = await sb.auth.setSession({
            access_token: hash.get('access_token'),
            refresh_token: hash.get('refresh_token'),
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          throw new Error(hash.get('error_description') || 'No auth code or token in callback URL');
        }
        window.location.replace(next);
      } catch (e) {
        setError(e.message || 'Sign-in failed');
      }
    })();
  }, []);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f6f7fb', padding: 24 }}>
      <div style={{ fontSize: 14, color: error ? '#df2f4a' : '#676879', fontFamily: 'Figtree, system-ui, sans-serif' }}>
        {error ? (
          <>Sign-in failed: {error}. <a href="/login" style={{ color: '#0073ea' }}>Try again</a></>
        ) : (
          'Signing you in…'
        )}
      </div>
    </main>
  );
}
