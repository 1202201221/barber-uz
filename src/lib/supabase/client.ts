import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
