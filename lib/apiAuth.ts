/**
 * Server-side Supabase token verification for API routes.
 * Client passes `Authorization: Bearer <access_token>` with every request.
 */
import { createClient } from "@supabase/supabase-js";

import type { User } from "@supabase/supabase-js";

/** Returns the verified Supabase user, or null if the token is missing/invalid. */
export async function getAuthUser(authHeader: string | null): Promise<User | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data, error } = await supabase.auth.getUser(token);
  return !error && data.user ? data.user : null;
}

export async function verifyAuth(authHeader: string | null): Promise<boolean> {
  return (await getAuthUser(authHeader)) !== null;
}
