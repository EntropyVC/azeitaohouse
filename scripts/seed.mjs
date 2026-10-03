// Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed.mjs path/to/export.json
// Upserts every record from a JSON export of the app into the properties table.
import fs from "node:fs";
const [,, file] = process.argv;
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key || !file) { console.error("need SUPABASE_URL, SUPABASE_SERVICE_KEY and a file"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const props = data.properties || data;
// never move a pin the user has confirmed in the app
const existing = await (await fetch(`${url}/rest/v1/properties?select=id,data`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })).json();
const lockedPins = new Map(existing.filter(r => r.data && r.data.pinStatus === "confirmed").map(r => [r.id, { lat: r.data.lat, lng: r.data.lng, pinStatus: "confirmed" }]));
const rows = Object.entries(props).map(([id, p]) => ({ id, data: { ...p, id, ...(lockedPins.get(id) || {}) }, updated_at: new Date().toISOString(), updated_by: "seed" }));
if (lockedPins.size) console.log(`${lockedPins.size} confirmed pins kept as they are`);
for (let i = 0; i < rows.length; i += 100) {
  const r = await fetch(`${url}/rest/v1/properties?on_conflict=id`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows.slice(i, i + 100)),
  });
  if (!r.ok) { console.error(r.status, await r.text()); process.exit(1); }
}
console.log(`seeded ${rows.length} records`);
