import { createClient } from '@supabase/supabase-js';

// Service-role client. Bypasses RLS. Server-side only — never import
// this into a file that runs in the browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
