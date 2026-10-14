import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerTools, SERVER_INSTRUCTIONS } from '@/lib/mcp/tools';
import { userClient, verifyToken } from '@/lib/mcp/auth';

// MCP endpoint (Streamable HTTP) for outside AI assistants. Sign-in is OAuth
// through Supabase Auth; the consent screen is app/oauth/consent.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const mcp = createMcpHandler(
  (server) => registerTools(server, (extra) => {
    const auth = extra?.http?.authInfo;
    return { sb: userClient(auth.token), userId: auth.extra.userId };
  }),
  { serverInfo: { name: 'caymus-board', version: '1.0.0' }, instructions: SERVER_INSTRUCTIONS },
);

const handler = withMcpAuth(mcp, verifyToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource/api/mcp',
});

export { handler as GET, handler as POST, handler as DELETE };
