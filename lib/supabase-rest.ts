import "server-only";

const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, "");
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export function getSupabaseConfig(access: "public" | "secret" = "secret") {
  const key = access === "public" ? publicKey : secretKey;
  if (!url || !key) {
    throw new Error(access === "public"
      ? "Supabase public access is not configured. Add the Supabase URL and publishable key."
      : "Supabase server access is not configured. Add SUPABASE_SECRET_KEY to the server environment.");
  }
  return { url, key };
}

export async function supabaseRest(path: string, init: RequestInit = {}) {
  const method = (init.method || "GET").toUpperCase();
  const config = getSupabaseConfig(method === "GET" || method === "HEAD" ? "public" : "secret");
  const headers = new Headers(init.headers);
  headers.set("apikey", config.key);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${config.url}/rest/v1/${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { code?: string; message?: string } | null;
    if (detail?.code === "PGRST205" || detail?.code === "PGRST202") {
      throw new Error("Supabase is connected. Run supabase/schema.sql in your Supabase SQL Editor to finish setting up the database.");
    }
    throw new Error(detail?.message || `Supabase request failed (${response.status}).`);
  }
  return response;
}
