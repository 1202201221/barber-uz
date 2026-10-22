const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const anonKey = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  ""
).trim();

export const isSupabaseConfigured = url.length > 0 && anonKey.length > 0;

// Placeholders keep `npm run build` and the dev server alive before the real
// keys are copied into .env.local.
export const supabaseUrl = url || "https://placeholder.supabase.co";
export const supabaseAnonKey = anonKey || "public-anon-key-placeholder";
