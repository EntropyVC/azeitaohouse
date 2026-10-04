// Files a Certidão Permanente request on Predial Online for one or more cadastre plots.
// Requester details come from environment variables and never touch the database or the page:
//   CERT_NOME, CERT_NIF, CERT_EMAIL, CERT_MORADA, CERT_CODPOSTAL, CERT_LOCALIDADE, CERT_TELEMOVEL (optional)
// POST { plots: [{ id, natureza: "R"|"U", artigo, seccao, freguesia: "151204"|"151206" }], dryRun: true|false }
// dryRun walks the whole form and returns the registry's own summary and total, then cancels. Nothing is filed.
// Real run confirms with Multibanco and returns the pedido number, MB entity/reference/amount/deadline
// and one certificate code per plot.
export const config = { runtime: "edge" };
const SB_URL = "https://onmuenuokmiwmonfdozh.supabase.co", SB_KEY = "sb_publishable_0WS3C6URygYS72m2oV_eLg_qI2KXisC";
const BASE = "https://www.predialonline.pt/PredialOnline/";
const DIST = "15", CONC = "1512", FREG_MATRIZ = "151209"; // Setúbal, Setúbal, Azeitão (São Lourenço e São Simão)

class Session {
  constructor() { this.cookies = {}; }
  header() { return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; "); }
  absorb(res) {
    const raw = res.headers.get("set-cookie") || "";
    for (const part of raw.split(/,(?=\s*[A-Za-z0-9_]+=)/)) {
      const m = part.match(/^\s*([^=]+)=([^;]*)/);
      if (m) this.cookies[m[1]] = m[2];
    }
  }
  async call(action, fields) {
    let url = BASE + action, body = fields ? new URLSearchParams(fields).toString() : null, method = fields ? "POST" : "GET";
    for (let hop = 0; hop < 6; hop++) {
      const res = await fetch(url, { method, body, redirect: "manual", headers: { cookie: this.header(), ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}), "user-agent": "Mozilla/5.0" } });
      this.absorb(res);
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location"), url).toString(); body = null; method = "GET"; continue;
      }
      if (!res.ok) throw new Error(`${action} ${res.status}`);
      return await res.text();
    }
    throw new Error("redirect loop");
  }
}

const ENT = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', ccedil: "ç", Ccedil: "Ç", atilde: "ã", otilde: "õ", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", acirc: "â", ecirc: "ê", ocirc: "ô", agrave: "à", ordm: "º", ordf: "ª", euro: "€" };
const unesc = s => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&([a-zA-Z]+);/g, (m, k) => ENT[k] ?? m);
const text = h => unesc(h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const err = h => { const m = h.match(/class="[^"]*(?:errorMessage|erro)[^"]*"[^>]*>([^<]+)/i); return m ? m[1].trim() : ""; };

export default async function handler(req) {
  if (req.method !== "POST") return new Response("POST", { status: 405 });
  const auth = req.headers.get("authorization") || "";
  const who = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: auth } });
  if (!who.ok) return new Response("sign in", { status: 401 });

  const env = process.env, requester = { nome: env.CERT_NOME, nif: env.CERT_NIF, email: env.CERT_EMAIL, morada: env.CERT_MORADA, codPostal: env.CERT_CODPOSTAL, localidade: env.CERT_LOCALIDADE, telemovel: env.CERT_TELEMOVEL || "" };
  const missing = Object.entries(requester).filter(([k, v]) => k !== "telemovel" && !v).map(([k]) => "CERT_" + k.toUpperCase());
  if (missing.length) return json({ error: "Requester details not set in Vercel: " + missing.join(", ") }, 501);

  let body; try { body = await req.json(); } catch { return new Response("json?", { status: 400 }); }
  const plots = (body.plots || []).map(p => ({ id: String(p.id || ""), natureza: p.natureza === "U" ? "U" : "R", artigo: String(p.artigo || "").replace(/\D/g, ""), seccao: String(p.seccao || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), freguesia: p.freguesia === "151206" ? "151206" : "151204" })).filter(p => p.artigo);
  if (!plots.length) return new Response("no plots", { status: 400 });
  const dryRun = body.dryRun !== false;

  const s = new Session();
  const req1 = { preparaJSP: "", prepareJSP: "", nome: requester.nome, email: requester.email, residencia: "1", nif: requester.nif, morada: requester.morada, codPostal: requester.codPostal, localidade: requester.localidade, indicativo: "+351", telemovel: requester.telemovel, email2: "", parametro: "" };
  try {
    await s.call("FRM001RPOLCP_input.action");
    for (const p of plots) {
      // Step 1 -> Adicionar Subscrição
      let h = await s.call("FRM001RPOLCP_subscrever.action", req1);
      const e1 = err(h); if (e1) throw new Error("requester: " + e1);
      const loc = { myFlag: "true", edita: "false", selDistrito: DIST, selConcelho: CONC, selFreguesia: p.freguesia, distritoMatriz: DIST, concelhoMatriz: CONC, freguesiaMatriz: FREG_MATRIZ };
      // Cascading selects, each one a form submit on the registry side
      await s.call("FRM002ARPOLCP_getConcelhosFromDB.action", { myFlag: "true", edita: "false", selDistrito: DIST, selConcelho: "", selFreguesia: "" });
      await s.call("FRM002ARPOLCP_getFreguesiasFromDB.action", { myFlag: "true", edita: "false", selDistrito: DIST, selConcelho: CONC, selFreguesia: "" });
      await s.call("FRM002ARPOLCP_loadConcelhosMatriz.action", { ...loc, freguesiaMatriz: "" });
      await s.call("FRM002ARPOLCP_input.action", loc);
      h = await s.call("FRM002ARPOLCP_adicionar.action", { ...loc, radioDesc: "Informação Matricial **", selNaturezaArtigo: p.natureza, selNumArtigo: "", numArtigoBox: p.artigo, fraccao: "", seccao: p.seccao, arvore: "" });
      if (!/Lista de Artigos Adicionados[\s\S]*?Remover[\s\S]*?Azeit/.test(h)) throw new Error("article not accepted: " + (err(h) || text(h).slice(0, 200)));
      h = await s.call("FRM002ARPOLCP_addPredioMatriz.action", { ...loc, radioDesc: "Informação Matricial **", selNaturezaArtigo: "", selNumArtigo: "", numArtigoBox: "", fraccao: "", seccao: "", arvore: "" });
      if (!/Artigo n\.º:/.test(h)) throw new Error("plot not added: " + (err(h) || text(h).slice(0, 200)));
      h = await s.call("FRM002ARPOLCP.action", loc); // back to step 1 with the subscription listed
    }
    // Step 1 -> Continuar -> step 3 (payment method)
    let h = await s.call("FRM001RPOLCP.action", req1);
    const tok = h.match(/name="token" value="([^"]+)"/);
    const t3 = text(h);
    if (!tok || !/Confirmação do Pagamento/.test(t3)) throw new Error("payment step not reached: " + (err(h) || text(h).slice(0, 200)));
    const summary = { lines: [...t3.matchAll(/Prédio \d+ ([^€]*?Artigo n\.º: [^ ]+ [^€]*?) €/g)].map(m => m[1].trim()), total: (t3.match(/TOTAL (\d+) €/) || [])[1] };
    if (dryRun) {
      await s.call("FRM003ARPOLCP_cancelar.action", {}).catch(() => {});
      return json({ dryRun: true, plots, summary });
    }
    h = await s.call("FRM003ARPOLCP.action", { "struts.token.name": "token", token: tok[1], formaPagamento: "Multibanco", tip: "" });
    const t4 = text(h);
    if (!/Comprovativo do Pedido/.test(t4)) throw new Error("no comprovativo: " + (err(h) || t4.slice(0, 200)));
    const pedido = (t4.match(/Pedido: (\d+) \/ ([\d-]+ [\d:]+)/) || []);
    const codes = [...t4.matchAll(/Artigo n\.º: (\S+-Sec\.\s?\S+) Subscrição.*?(PA-[\d-]+)/g)].map(m => ({ artigo: m[1].replace(/\s/g, ""), code: m[2] }));
    const mb = { entity: (t4.match(/Entidade: (\d+)/) || [])[1], reference: (t4.match(/Referência: (\d+)/) || [])[1], amount: (t4.match(/Valor: (\d+) €/) || [])[1], deadline: (t4.match(/Data Limite para Pagamento: ([\d-]+)/) || [])[1] };
    // Match codes back to plots by artigo + section
    for (const p of plots) {
      const key = `${p.natureza === "R" ? "Rústica" : "Urbana"}-${p.artigo}-Sec.${p.seccao}`;
      p.code = (codes.find(c => c.artigo === key) || codes.shift() || {}).code || "";
    }
    return json({ pedido: pedido[1], at: pedido[2], plots, mb, summary });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
