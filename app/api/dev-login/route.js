// Local-dev-only auto-login: mints a real session for clmang@gmail.com and
// sets it as cookies. middleware.js sends signed-out requests here instead of
// /login when DEV_AUTO_LOGIN=1. 404s in a production build or without the
// flag. Remove DEV_AUTO_LOGIN from .env.local to get the login page back.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const DEV_EMAIL = 'clmang@gmail.com';

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

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: si, error } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  if (error) return new NextResponse(error.message, { status: 500 });

  const store = cookies();
  const sb = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
  await sb.auth.setSession({ access_token: si.session.access_token, refresh_token: si.session.refresh_token });

  // Same-origin only, so this can't be used as an open redirect ("//x", "/\x" resolve off-site).
  const next = new URL(request.nextUrl.searchParams.get('next') || '/', request.url);
  const dest = next.origin === request.nextUrl.origin ? next : new URL('/', request.url);
  return NextResponse.redirect(dest);
}
