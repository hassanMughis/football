import { getSupabaseConfig } from "@/lib/supabase-rest";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose an image first." }, { status: 400 });
    if (!allowedTypes.has(file.type)) return Response.json({ error: "Use a JPG, PNG, WebP or GIF image." }, { status: 400 });
    if (file.size > 3 * 1024 * 1024) return Response.json({ error: "Images must be smaller than 3 MB." }, { status: 400 });

    const config = getSupabaseConfig();
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${crypto.randomUUID()}.${extension}`;
    const response = await fetch(`${config.url}/storage/v1/object/player-images/${path}`, {
      method: "POST",
      headers: { apikey: config.key, "content-type": file.type, "x-upsert": "false" },
      body: await file.arrayBuffer(),
    });
    if (!response.ok) throw new Error((await response.text()) || "The image upload failed.");
    return Response.json({ imageUrl: `${config.url}/storage/v1/object/public/player-images/${path}` });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The image upload failed." }, { status: 500 });
  }
}
