import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// `lock` override: the default browser navigator LockManager throws
// "Lock broken by another request with the 'steal' option" when concurrent
// auth acquisitions (React StrictMode double-mount + HMR in dev, or many
// parallel reads firing token retrieval at once) race for the same lock —
// the loser's in-flight queries abort and Supabase returns a bare `{}` error.
// Running the critical section directly (no cross-tab lock) removes the steal
// path. Single-user app, so cross-tab refresh races are a non-issue.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
})

/** Returns Authorization header value for authenticated API calls.
 *  Uses refreshSession() so a revoked session returns no token rather than a stale one. */
export async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.refreshSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}