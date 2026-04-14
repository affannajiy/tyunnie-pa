/**
 * Server-side Supabase token verification for API routes.
 * Client passes `Authorization: Bearer <access_token>` with every request.
 */
import { createClient } from "@supabase/supabase-js";

export async function verifyAuth(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  if (!token) return false;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data, error } = await supabase.auth.getUser(token);
  return !error && !!data.user;
}
