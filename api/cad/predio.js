// Details for one cadastre parcel by its NIC. Returns section, parcel, area and the outline in lat/lng.
export const config = { runtime: "edge" };
const SB_URL = "https://onmuenuokmiwmonfdozh.supabase.co", SB_KEY = "sb_publishable_0WS3C6URygYS72m2oV_eLg_qI2KXisC";
const toLatLng = (x, y) => [Math.atan(Math.exp(y / 6378137)) * 360 / Math.PI - 90, x / 6378137 * 180 / Math.PI];
export default async function handler(req) {
  const nic = (new URL(req.url).searchParams.get("nic") || "").replace(/[^A-Z0-9]/g, "");
  if (!nic) return new Response("nic?", { status: 400 });
  const auth = req.headers.get("authorization") || "";
  const who = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: auth } });
  if (!who.ok) return new Response("sign in", { status: 401 });
  const r = await fetch(`https://snic.dgterritorio.gov.pt/geoportal/dgt_snic2/api/app/search/predio/nic?filter=${nic}`, { headers: { Referer: "https://snic.dgterritorio.gov.pt/visualizadorCadastro" } });
  if (!r.ok) return new Response("upstream " + r.status, { status: 502 });
  const d = await r.json();
  const parts = (d.id_cadastro || "").split("_"); // dicofre_section_parcel
  let ring = [];
  const m = (d.wkt_3857 || "").match(/\(\(([^()]+)\)\)/);
  if (m) ring = m[1].split(",").map(p => p.trim().split(/\s+/).map(Number)).map(([x, y]) => toLatLng(x, y).map(v => +v.toFixed(6)));
  const out = { nic: d.nic, label: d.label, nip: d.nip, section: parts[1] || "", parcel: parts[2] || "", area: d.area_m2, parish: d.des_simpli, concelho: d.concelho, dicofre: d.dicofre, ring };
  return new Response(JSON.stringify(out), { headers: { "content-type": "application/json", "cache-control": "public, s-maxage=604800" } });
}
