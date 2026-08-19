import { createClient } from "@supabase/supabase-js";

/*
 * Browser Supabase client — auth only. All protected data flows through the
 * Rippit API with a Bearer token; the UI never reads app tables directly, so
 * the SPA pattern (no @supabase/ssr, no middleware) is the right fit.
 */
/* Fallbacks keep module evaluation safe during build/prerender (no env) and
   point local dev at the local Supabase stack. The placeholder anon key only
   exists so createClient doesn't throw at import time — real requests need
   NEXT_PUBLIC_SUPABASE_ANON_KEY set. */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54421",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "unset-anon-key",
  {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
