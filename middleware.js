import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  const path = request.nextUrl.pathname;
  const isApiRoute = path.startsWith('/api');
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/auth');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Misconfigured deployment: don't crash every route. Let API routes answer
  // (they return their own 401), let auth routes render, redirect the rest to
  // /login where the problem is at least visible.
  if (!url || !anonKey) {
    console.error('middleware: Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
    if (isApiRoute || isAuthRoute) return NextResponse.next({ request });
    const to = request.nextUrl.clone();
    to.pathname = '/login';
    return NextResponse.redirect(to);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  let user = null;
  try {
    ({ data: { user } } = await supabase.auth.getUser());
  } catch (err) {
    // Auth service unreachable — don't 500 the whole site.
    console.error('middleware: auth.getUser failed:', err?.message ?? err);
    if (isApiRoute || isAuthRoute) return response;
    const to = request.nextUrl.clone();
    to.pathname = '/login';
    return NextResponse.redirect(to);
  }

  // Local dev convenience: skip the login page entirely (see app/api/dev-login).
  // Never active in a production build, and off unless .env.local opts in.
  const devAutoLogin = process.env.NODE_ENV !== 'production' && process.env.DEV_AUTO_LOGIN === '1';
  if (!user && devAutoLogin && !isApiRoute && !path.startsWith('/auth')) {
    const to = request.nextUrl.clone();
    to.pathname = '/api/dev-login';
    to.search = '?next=' + encodeURIComponent(path === '/login' ? '/' : path + request.nextUrl.search);
    return NextResponse.redirect(to);
  }

  if (!user && !isAuthRoute && !isApiRoute) {
    const to = request.nextUrl.clone();
    to.pathname = '/login';
    return NextResponse.redirect(to);
  }
  if (user && path === '/login') {
    const to = request.nextUrl.clone();
    to.pathname = '/';
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
};
