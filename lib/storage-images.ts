import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase-rest";

const BUCKET = "player-images";
const MANAGED_UPLOAD = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpe?g|png|webp|gif)$/i;
const SWEEP_GRACE_MS = 60_000;

type ListedObject = { name: string; created_at?: string | null };

function storageClient() {
  const config = getSupabaseConfig();
  return {
    config,
    client: createClient(config.url, config.key, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    }),
  };
}

function objectPathFromUrl(value: string, projectUrl: string) {
  try {
    const url = new URL(value);
    const project = new URL(projectUrl);
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    if (url.origin !== project.origin || !url.pathname.startsWith(marker)) return null;
    const path = decodeURIComponent(url.pathname.slice(marker.length));
    return path && !path.includes("..") ? path : null;
  } catch {
    return null;
  }
}

function collectReferencedPaths(value: unknown, projectUrl: string, paths = new Set<string>()) {
  if (typeof value === "string") {
    const path = objectPathFromUrl(value, projectUrl);
    if (path) paths.add(path);
    return paths;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectReferencedPaths(item, projectUrl, paths);
    return paths;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) collectReferencedPaths(item, projectUrl, paths);
  }
  return paths;
}

async function removePaths(paths: string[]) {
  if (!paths.length) return 0;
  const { client } = storageClient();
  let removed = 0;
  for (let index = 0; index < paths.length; index += 1000) {
    const batch = paths.slice(index, index + 1000);
    const { error } = await client.storage.from(BUCKET).remove(batch);
    if (error) throw error;
    removed += batch.length;
  }
  return removed;
}

export async function cleanupUnusedManagedImages(state: unknown) {
  const { client, config } = storageClient();
  const referenced = collectReferencedPaths(state, config.url);
  const removable: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client.storage.from(BUCKET).list("", {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const objects = (data || []) as ListedObject[];
    const now = Date.now();
    for (const object of objects) {
      if (!MANAGED_UPLOAD.test(object.name) || referenced.has(object.name)) continue;
      const createdAt = object.created_at ? Date.parse(object.created_at) : Number.NaN;
      if (Number.isFinite(createdAt) && now - createdAt < SWEEP_GRACE_MS) continue;
      removable.push(object.name);
    }
    if (objects.length < 1000) break;
    offset += objects.length;
  }

  return { removed: await removePaths(removable), paths: removable };
}

export async function deleteManagedImageIfUnused(imageUrl: unknown) {
  if (typeof imageUrl !== "string" || !imageUrl) return { removed: false, reason: "invalid" as const };
  const { client, config } = storageClient();
  const path = objectPathFromUrl(imageUrl, config.url);
  if (!path || !MANAGED_UPLOAD.test(path)) return { removed: false, reason: "unmanaged" as const };

  const references = new Set<string>();
  const requiredQueries = await Promise.all([
    client.from("players").select("image_url"),
    client.from("squad_settings").select("app_state").eq("id", 1),
    client.from("match_history").select("snapshot"),
  ]);
  for (const result of requiredQueries) {
    if (result.error) throw result.error;
    collectReferencedPaths(result.data, config.url, references);
  }
  const cricketResult = await client.from("cricket_players").select("image_url");
  if (cricketResult.error) throw cricketResult.error;
  collectReferencedPaths(cricketResult.data, config.url, references);
  const storageState = await client.storage.from(BUCKET).download("squad-sheet/app-state.json");
  if (storageState.error && !/not found/i.test(storageState.error.message)) throw storageState.error;
  if (storageState.data) {
    const savedState = await storageState.data.text().then((text) => JSON.parse(text)).catch(() => null);
    collectReferencedPaths(savedState, config.url, references);
  }
  if (references.has(path)) return { removed: false, reason: "in-use" as const };

  await removePaths([path]);
  return { removed: true, reason: "deleted" as const };
}
