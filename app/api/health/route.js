// Diagnostic: which env vars did this deployment actually get?
// Reports presence only — never values.
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    ok: true,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY)
    },
    // The URL is a NEXT_PUBLIC value (not a secret); echoing its host confirms
    // the client bundle was built with the right project.
    supabaseHost: (() => {
      try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host; }
      catch { return null; }
    })()
  });
}
