import { createClient } from '@supabase/supabase-js';

// Server-side helpers for the MCP endpoint. Callers authenticate with a
// Supabase access token: normally one issued by Supabase's OAuth 2.1 server
// to an AI assistant (it carries a client_id claim), but a regular session
// token works too.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const AUTH_SERVER_URL = `${url}/auth/v1`;

// A client that acts as the token's user, so RLS applies.
export function userClient(token) {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// mcp-handler's verifyToken: AuthInfo for a valid user token, else undefined
// (which becomes a 401 with the resource-metadata challenge). getClaims
// checks the signature against the project's JWKS and the expiry.
export async function verifyToken(_req, token) {
  if (!token) return undefined;
  const { data, error } = await userClient(token).auth.getClaims(token);
  const c = data?.claims;
  if (error || !c || c.role !== 'authenticated' || c.iss !== AUTH_SERVER_URL || !c.sub) return undefined;
  return {
    token,
    clientId: c.client_id || 'session',
    scopes: typeof c.scope === 'string' ? c.scope.split(' ').filter(Boolean) : [],
    expiresAt: c.exp,
    extra: { userId: c.sub },
  };
}
