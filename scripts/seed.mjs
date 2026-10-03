// Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed.mjs path/to/export.json
// Upserts every record from a JSON export of the app into the properties table.
import fs from "node:fs";
const [,, file] = process.argv;
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key || !file) { console.error("need SUPABASE_URL, SUPABASE_SERVICE_KEY and a file"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const props = data.properties || data;
const rows = Object.entries(props).map(([id, p]) => ({ id, data: { ...p, id }, updated_at: new Date().toISOString(), updated_by: "seed" }));
for (let i = 0; i < rows.length; i += 100) {
  const r = await fetch(`${url}/rest/v1/properties?on_conflict=id`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows.slice(i, i + 100)),
  });
  if (!r.ok) { console.error(r.status, await r.text()); process.exit(1); }
}
console.log(`seeded ${rows.length} records`);
