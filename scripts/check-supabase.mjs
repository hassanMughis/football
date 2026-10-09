import { readFileSync } from "node:fs";

const configuration = { ...process.env };
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index > 0 && !line.startsWith("#")) configuration[line.slice(0, index)] ??= line.slice(index + 1).trim();
  }
} catch {}

const url = configuration.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = configuration.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = configuration.SUPABASE_SECRET_KEY;
if (!url || !publicKey || !secretKey) throw new Error("Supabase URL, publishable key, or server-only secret key is missing.");

for (const path of [
  "players?select=id,client_id,rating,speciality,card_style,position,flag,overall,pac,sho,pas,dri,def,phy,in_match_squad,is_captain&limit=1",
  "squad_settings?select=id,app_state,match_team_name,opponent_name,opponent_goals,match_status&limit=1",
  "match_events?select=id,scorer_client_id,assist_client_id,minute&limit=1",
]) {
  const response = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: publicKey } });
  const result = await response.json();
  console.log(JSON.stringify({ resource: path.split("?")[0], status: response.status, result }));
  if (!response.ok) process.exitCode = 1;
}

const probePath = `player-images/squad-sheet/connection-check-${Date.now()}.json`;
const rejectedPublicUpload = await fetch(`${url}/storage/v1/object/${probePath}`, {
  method: "POST",
  headers: { apikey: publicKey, "content-type": "application/json", "x-upsert": "true" },
  body: JSON.stringify({ checked: true }),
});
console.log(JSON.stringify({ resource: "storage", action: "public write rejected", status: rejectedPublicUpload.status, ok: !rejectedPublicUpload.ok }));
if (rejectedPublicUpload.ok) {
  console.error("Public Storage writes are still enabled. Run supabase/secure-server-writes.sql.");
  process.exitCode = 1;
  await fetch(`${url}/storage/v1/object/${probePath}`, { method: "DELETE", headers: { apikey: secretKey } });
}

const upload = await fetch(`${url}/storage/v1/object/${probePath}`, {
  method: "POST",
  headers: { apikey: secretKey, "content-type": "application/json", "x-upsert": "true" },
  body: JSON.stringify({ checked: true }),
});
console.log(JSON.stringify({ resource: "storage", action: "server write", status: upload.status, ok: upload.ok }));
if (!upload.ok) {
  console.error(await upload.text());
  process.exitCode = 1;
} else {
  const cleanup = await fetch(`${url}/storage/v1/object/${probePath}`, {
    method: "DELETE",
    headers: { apikey: secretKey },
  });
  console.log(JSON.stringify({ resource: "storage", action: "cleanup", status: cleanup.status, ok: cleanup.ok }));
  if (!cleanup.ok) process.exitCode = 1;
}
