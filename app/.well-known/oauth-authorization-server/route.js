import { metadataCorsOptionsRequestHandler } from 'mcp-handler';
import { AUTH_SERVER_URL } from '@/lib/mcp/auth';

// Older MCP clients (2025-03-26 spec) skip protected-resource discovery and
// look for authorization-server metadata on the MCP server's own origin.
// Relay Supabase's, which points every endpoint back at Supabase.
export const dynamic = 'force-dynamic';

export async function GET() {
  const { origin, pathname } = new URL(AUTH_SERVER_URL);
  const res = await fetch(`${origin}/.well-known/oauth-authorization-server${pathname}`, { cache: 'no-store' });
  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
