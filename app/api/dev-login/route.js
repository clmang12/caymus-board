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

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const pass = 'devpass-' + Math.random().toString(36).slice(2) + 'A1!';

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  const found = list.users.find((u) => u.email === DEV_EMAIL);
  if (!found) return new NextResponse('dev user not found', { status: 500 });
  await admin.auth.admin.updateUserById(found.id, { password: pass });

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: si, error } = await anon.auth.signInWithPassword({ email: DEV_EMAIL, password: pass });
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
