import { createClient } from "@/lib/supabase/server";
import type { AppRole, Profile } from "@/lib/types";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, locale, created_at")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}

export async function hasRole(roles: readonly AppRole[]): Promise<boolean> {
  const profile = await getCurrentProfile();
  return !!profile && roles.includes(profile.role);
}
