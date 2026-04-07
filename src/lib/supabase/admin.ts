import { createClient } from "./client";

/** Check if the current user has admin role in app_metadata */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  return user.app_metadata?.role === "admin";
}
