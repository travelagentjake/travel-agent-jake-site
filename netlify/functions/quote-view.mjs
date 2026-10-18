// Public beacon for the interactive quotes (quotes.travelagentjake.co.uk/<slug>).
// Each open of a quote page posts { slug } here; we keep a running count plus the last 100 opens
// (time, device type and rough town from Netlify geo) in the Netlify Blobs store "quote-views".
// No names, IP addresses or personal data are stored.
import { getStore } from "@netlify/blobs";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" };

export default async (req, context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response("", { status: 405, headers: CORS });
  let b = {};
  try { b = JSON.parse(await req.text()); } catch {}
  const slug = String(b.slug || "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(slug)) return new Response("", { status: 400, headers: CORS });
  const ua = String(req.headers.get("user-agent") || "");
  if (/bot|crawl|spider|headless|lighthouse|preview/i.test(ua)) return new Response(null, { status: 204, headers: CORS });

  const store = getStore({ name: "quote-views", consistency: "strong" });
  const cur = (await store.get(slug, { type: "json" }).catch(() => null)) || { slug, views: 0, opens: [] };
  const geo = (context && context.geo) || {};
  const device = /ipad|tablet/i.test(ua) ? "Tablet" : /mobi|iphone|android/i.test(ua) ? "Mobile" : "Desktop";
  let from = "";
  try { const r = new URL(String(b.ref || "")); from = r.hostname.replace(/^www\./, ""); } catch {}
  const open = { t: new Date().toISOString(), device, place: [geo.city, geo.country && geo.country.name].filter(Boolean).join(", "), from };
  cur.views = (cur.views || 0) + 1;
  cur.firstView = cur.firstView || open.t;
  cur.lastView = open.t;
  cur.opens = [open, ...(cur.opens || [])].slice(0, 100);
  await store.setJSON(slug, cur);
  return new Response(null, { status: 204, headers: CORS });
};

export const config = { path: "/api/quote-view" };
