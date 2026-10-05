import { getSupabaseConfig } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

const stateObjectPath = "player-images/squad-sheet/app-state.json";

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  try {
    const config = getSupabaseConfig();
    const response = await fetch(`${config.url}/storage/v1/object/${stateObjectPath}`, {
      headers: { apikey: config.key },
      cache: "no-store",
    });

    if (response.status === 404) return Response.json({ state: null });
    if (!response.ok) {
      const detail = await response.text();
      if (/Object not found|NoSuchKey|not_found|"404"/i.test(detail)) return Response.json({ state: null });
      throw new Error(detail || `Supabase state request failed (${response.status}).`);
    }

    const state: unknown = await response.json();
    if (!isJsonObject(state)) throw new Error("The saved squad state is not a JSON object.");
    return Response.json({ state });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load the squad state." },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const state: unknown = await request.json();
    if (!isJsonObject(state)) {
      return Response.json({ error: "The squad state must be a JSON object." }, { status: 400 });
    }

    const config = getSupabaseConfig();
    const response = await fetch(`${config.url}/storage/v1/object/${stateObjectPath}`, {
      method: "POST",
      headers: {
        apikey: config.key,
        // This bucket is also used for player photos and its existing MIME
        // allow-list only permits images. Storage objects are opaque bytes, so
        // use an allowed type while keeping the body/path as JSON.
        "content-type": "image/png",
        "x-upsert": "true",
      },
      body: JSON.stringify(state),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error((await response.text()) || `Supabase state save failed (${response.status}).`);
    }

    return Response.json({ state });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "The request body must contain valid JSON." }, { status: 400 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save the squad state." },
      { status: 503 },
    );
  }
}
