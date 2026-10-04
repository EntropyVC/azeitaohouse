// Relays one cadastre vector tile from the DGT viewer's tile service. Query: z, x, y (XYZ scheme).
export const config = { runtime: "edge" };
const SB_URL = "https://onmuenuokmiwmonfdozh.supabase.co", SB_KEY = "sb_publishable_0WS3C6URygYS72m2oV_eLg_qI2KXisC";
export default async function handler(req) {
  const u = new URL(req.url); const z = +u.searchParams.get("z"), x = +u.searchParams.get("x"), y = +u.searchParams.get("y");
  if (!(z >= 12 && z <= 19) || !(x >= 0) || !(y >= 0)) return new Response("bad tile", { status: 400 });
  const auth = req.headers.get("authorization") || "";
  const who = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: auth } });
  if (!who.ok) return new Response("sign in", { status: 401 });
  const tmsY = Math.pow(2, z) - 1 - y;
  const r = await fetch(`https://snic.dgterritorio.gov.pt/geoserver/gwc/service/tms/1.0.0/snic:x_predios@EPSG%3A900913@pbf/${z}/${x}/${tmsY}.pbf`, { headers: { Referer: "https://snic.dgterritorio.gov.pt/visualizadorCadastro" } });
  if (r.status === 404) return new Response(null, { status: 204 });
  if (!r.ok) return new Response("upstream " + r.status, { status: 502 });
  return new Response(r.body, { headers: { "content-type": "application/x-protobuf", "cache-control": "public, s-maxage=604800, max-age=86400" } });
}
