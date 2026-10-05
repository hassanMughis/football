import { readFileSync } from "node:fs";

const configuration = { ...process.env };
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index > 0 && !line.startsWith("#")) configuration[line.slice(0, index)] ??= line.slice(index + 1).trim();
  }
} catch {}

const url = configuration.NEXT_PUBLIC_SUPABASE_URL;
const key = configuration.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase environment variables are missing.");

for (const path of ["players?select=id&limit=1", "squad_settings?select=id&limit=1"]) {
  const response = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key } });
  const result = await response.json();
  console.log(JSON.stringify({ resource: path.split("?")[0], status: response.status, result }));
  if (!response.ok) process.exitCode = 1;
}

const probePath = `player-images/squad-sheet/connection-check-${Date.now()}.json`;
const upload = await fetch(`${url}/storage/v1/object/${probePath}`, {
  method: "POST",
  headers: { apikey: key, "content-type": "image/png", "x-upsert": "true" },
  body: JSON.stringify({ checked: true }),
});
console.log(JSON.stringify({ resource: "storage", action: "write", status: upload.status, ok: upload.ok }));
if (!upload.ok) {
  console.error(await upload.text());
  process.exitCode = 1;
} else {
  const cleanup = await fetch(`${url}/storage/v1/object/${probePath}`, {
    method: "DELETE",
    headers: { apikey: key },
  });
  console.log(JSON.stringify({ resource: "storage", action: "cleanup", status: cleanup.status, ok: cleanup.ok }));
  if (!cleanup.ok) process.exitCode = 1;
}
