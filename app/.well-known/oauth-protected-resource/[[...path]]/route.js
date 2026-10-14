import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from 'mcp-handler';
import { AUTH_SERVER_URL } from '@/lib/mcp/auth';

// RFC 9728 metadata telling MCP clients that Supabase Auth issues the tokens
// for /api/mcp. Served both bare and path-suffixed (/.../api/mcp).
const handler = protectedResourceHandler({ authServerUrls: [AUTH_SERVER_URL] });

export { handler as GET };
export const OPTIONS = metadataCorsOptionsRequestHandler();
