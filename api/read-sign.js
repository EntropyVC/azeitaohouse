// Reads a gate sign with Claude. Needs ANTHROPIC_API_KEY in Vercel. Callers must be signed in to the app.
export const config = { runtime: "edge" };
const SB_URL = "https://onmuenuokmiwmonfdozh.supabase.co";
const SB_KEY = "sb_publishable_0WS3C6URygYS72m2oV_eLg_qI2KXisC";

export default async function handler(req) {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return new Response(JSON.stringify({ error: "no_key" }), { status: 501, headers: { "content-type": "application/json" } });
  const auth = req.headers.get("authorization") || "";
  const who = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: auth } });
  if (!who.ok) return new Response(JSON.stringify({ error: "not_signed_in" }), { status: 401, headers: { "content-type": "application/json" } });
  const { image, mediaType = "image/jpeg", names = [] } = await req.json();
  if (!image) return new Response(JSON.stringify({ error: "no_image" }), { status: 400 });
  const prompt = `This is a photo taken at the gate of a house in the Arrábida region of Portugal. Read any sign, plaque, tile panel or lettering in the photo and return the exact text on it, as written, one line per sign. Then, from this list of property names, say which one the sign most likely belongs to, or "none".\n\nList:\n${names.slice(0, 120).join("\n")}\n\nAnswer as JSON only: {"text": "...", "match": "<name from list or none>", "confidence": "high|medium|low"}`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001", max_tokens: 300,
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mediaType, data: image } }, { type: "text", text: prompt }] }],
    }),
  });
  if (!r.ok) return new Response(JSON.stringify({ error: "model_error", detail: (await r.text()).slice(0, 300) }), { status: 502, headers: { "content-type": "application/json" } });
  const j = await r.json();
  const txt = (j.content || []).map(c => c.text || "").join("");
  let out = { text: txt, match: "none", confidence: "low" };
  try { const m = txt.match(/\{[\s\S]*\}/); if (m) out = { ...out, ...JSON.parse(m[0]) }; } catch {}
  return new Response(JSON.stringify(out), { headers: { "content-type": "application/json" } });
}
