# Shared data layer

Everything in this folder is platform-neutral: it imports only
\`@supabase/supabase-js\` types and takes a client as its first argument. The
web app and the mobile app both import these functions unchanged.

Rules:
- No \`next/*\` imports.
- No React.
- No \`window\`, no \`document\`, no \`localStorage\`.
- Every function takes the Supabase client as its first parameter.

If a board rule does not live here, the mobile app cannot use it.
