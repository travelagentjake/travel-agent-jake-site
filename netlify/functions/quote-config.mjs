// Amendments for the interactive quotes, saved from the business dashboard.
//   GET  /api/quote-config?slug=cori          (public, read by the quote page)  -> { amendments }
//   POST /api/quote-config { slug, amendments } (Jake only, header x-admin-key)  -> saves them
// amendments: { hidden: [hotel ids], edits: { <hotel id>: { why, badge, rooms, total, pp, tax } }, intro, subtitle, note,
//               priceIntro, extrasIntro, touristTax: { amount, note }, extras: [full list, replaces the page's own], updatedAt }
// Stored in the Netlify Blobs store "quote-config", one blob per quote slug.
import { getStore } from "@netlify/blobs";
import { sanitizeAmendments } from "../lib/quote-amend.mjs";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, x-admin-key" };
const out = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" } });
const clean = (s, n) => String(s ?? "").trim().slice(0, n);
const okSlug = (s) => /^[a-z0-9][a-z0-9-]{0,39}$/.test(s);

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const store = getStore({ name: "quote-config", consistency: "strong" });

  if (req.method === "GET") {
    const sp = new URL(req.url).searchParams, status = getStore({ name: "quote-status", consistency: "strong" });
    // ?closed=1 lists the links Jake has closed (slugs only). The "Close quotes" GitHub Action uses it to remove their pages.
    if (sp.get("closed")) {
      const list = (await status.list().catch(() => ({ blobs: [] }))).blobs;
      const closed = [];
      await Promise.all(list.map(async (b) => { const r = await status.get(b.key, { type: "json" }).catch(() => null); if (r && r.status === "closed") closed.push(b.key); }));
      return out({ closed });
    }
    const slug = clean(sp.get("slug"), 40).toLowerCase();
    if (!okSlug(slug)) return out({ error: "Bad slug" }, 400);
    const a = await store.get(slug, { type: "json" }).catch(() => null);
    const stat = await status.get(slug, { type: "json" }).catch(() => null);
    // the rooms the customer asked for (counts only, no names): the booking form groups the passengers into them
    let party = null;
    try {
      const reg = await fetch("https://taj-quotes.pages.dev/quotes.json", { signal: AbortSignal.timeout(2500) }).then((r) => r.json());
      const q = (reg.quotes || []).find((x) => x.slug === slug);
      const enq = q && q.enquiryId ? await getStore({ name: "enquiries", consistency: "strong" }).get(q.enquiryId, { type: "json" }).catch(() => null) : null;
      if (enq && Array.isArray(enq.rooms) && enq.rooms.length > 1) party = enq.rooms.slice(0, 8).map((r) => ({ adults: Math.min(20, Number(r.adults) || 0), children: Math.min(10, Number(r.children) || 0) }));
    } catch {}
    return out({ amendments: a || null, closed: !!(stat && stat.status === "closed"), party });
  }

  if (req.method !== "POST") return out({ error: "Method not allowed" }, 405);
  if (!process.env.PW_ADMIN_KEY || req.headers.get("x-admin-key") !== process.env.PW_ADMIN_KEY) return out({ error: "Wrong admin key" }, 401);
  const b = await req.json().catch(() => ({}));
  const slug = clean(b.slug, 40).toLowerCase();
  if (!okSlug(slug)) return out({ error: "Bad slug" }, 400);
  const saved = { ...sanitizeAmendments(b.amendments), updatedAt: new Date().toISOString() };
  await store.setJSON(slug, saved);
  return out({ ok: true, amendments: saved });
};

export const config = { path: "/api/quote-config" };
