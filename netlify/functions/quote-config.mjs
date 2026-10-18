// Amendments for the interactive quotes, saved from the business dashboard.
//   GET  /api/quote-config?slug=cori          (public, read by the quote page)  -> { amendments }
//   POST /api/quote-config { slug, amendments } (Jake only, header x-admin-key)  -> saves them
// amendments: { hidden: [hotel ids], edits: { <hotel id>: { why, badge, rooms, total, pp, tax } }, intro, subtitle, note, updatedAt }
// Stored in the Netlify Blobs store "quote-config", one blob per quote slug.
import { getStore } from "@netlify/blobs";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, x-admin-key" };
const out = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" } });
const clean = (s, n) => String(s ?? "").trim().slice(0, n);
const okSlug = (s) => /^[a-z0-9][a-z0-9-]{0,39}$/.test(s);

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const store = getStore({ name: "quote-config", consistency: "strong" });

  if (req.method === "GET") {
    const slug = clean(new URL(req.url).searchParams.get("slug"), 40).toLowerCase();
    if (!okSlug(slug)) return out({ error: "Bad slug" }, 400);
    const a = await store.get(slug, { type: "json" }).catch(() => null);
    return out({ amendments: a || null });
  }

  if (req.method !== "POST") return out({ error: "Method not allowed" }, 405);
  if (!process.env.PW_ADMIN_KEY || req.headers.get("x-admin-key") !== process.env.PW_ADMIN_KEY) return out({ error: "Wrong admin key" }, 401);
  const b = await req.json().catch(() => ({}));
  const slug = clean(b.slug, 40).toLowerCase();
  if (!okSlug(slug)) return out({ error: "Bad slug" }, 400);
  const a = b.amendments || {};
  const edits = {};
  for (const [id, e] of Object.entries(a.edits || {}).slice(0, 40)) {
    const o = {};
    for (const k of ["why", "badge", "rooms"]) if (e && e[k]) o[k] = clean(e[k], 1500);
    for (const k of ["total", "pp", "tax"]) if (e && e[k] !== undefined && e[k] !== "" && !isNaN(Number(e[k]))) o[k] = Number(e[k]);
    if (Object.keys(o).length) edits[clean(id, 40)] = o;
  }
  const saved = {
    hidden: (Array.isArray(a.hidden) ? a.hidden : []).map((x) => clean(x, 40)).slice(0, 40),
    edits, intro: clean(a.intro, 2000), subtitle: clean(a.subtitle, 200), note: clean(a.note, 1500),
    updatedAt: new Date().toISOString(),
  };
  await store.setJSON(slug, saved);
  return out({ ok: true, amendments: saved });
};

export const config = { path: "/api/quote-config" };
