// Local-dev-only auto-login: mints a real session for clmang@gmail.com and
// sets it as cookies. middleware.js sends signed-out requests here instead of
// /login when DEV_AUTO_LOGIN=1. 404s in a production build or without the
// flag. Remove DEV_AUTO_LOGIN from .env.local to get the login page back.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const DEV_EMAIL = 'clmang@gmail.com';

// Never cache: Next 14 caches fetches made in GET route handlers, and a cached
// generateLink / verify response hands back a one-time token that's already
// been used ("Email link is invalid", "Refresh Token Not Found").
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request) {
  if (process.env.NODE_ENV === 'production' || process.env.DEV_AUTO_LOGIN !== '1') {
    return new NextResponse('Not found', { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // One-time magic-link token, verified server-side: no email is sent and the
  // user's real password (shared with production) is left alone.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: DEV_EMAIL });
  if (linkErr) return new NextResponse(linkErr.message, { status: 500 });

  // Verify it with the cookie-writing client, so the session lands straight
  // in `jar`. The cookies go on the redirect response itself: writing them
  // through next/headers didn't reach a NextResponse.redirect, and errors were
  // ignored, so a failure left the browser signed out and looping back here.
  const jar = [];
  const sb = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (list) => jar.push(...list),
    },
  });
  const { error } = await sb.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  if (error) return new NextResponse(error.message, { status: 500 });

  // Same-origin only, so this can't be used as an open redirect ("//x", "/\x" resolve off-site).
  const next = new URL(request.nextUrl.searchParams.get('next') || '/', request.url);
  const dest = next.origin === request.nextUrl.origin ? next : new URL('/', request.url);
  const res = NextResponse.redirect(dest);
  jar.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
  return res;
}
