import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** Returns Authorization header value for authenticated API calls.
 *  Uses refreshSession() so a revoked session returns no token rather than a stale one. */
export async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.refreshSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}