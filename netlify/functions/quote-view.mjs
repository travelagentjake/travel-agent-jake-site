// Public beacon for the interactive quotes (quotes.travelagentjake.co.uk/<slug>).
// Each open of a quote page posts { slug } here; we keep a running count plus the last 100 opens
// (time, device type and rough town from Netlify geo) in the Netlify Blobs store "quote-views".
// No names, IP addresses or personal data are stored.
// If a quote is opened again 24 hours or more after its last open, Jake gets an email: a sign the customer is keen.
import { getStore } from "@netlify/blobs";
import { sendEmail, jakeEmail, SITE } from "../lib/pw.mjs";

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
  const prev = cur.lastView ? Date.parse(cur.lastView) : 0;
  const comeback = prev && Date.now() - prev >= 24 * 60 * 60 * 1000;
  cur.views = (cur.views || 0) + 1;
  cur.firstView = cur.firstView || open.t;
  cur.lastView = open.t;
  cur.opens = [open, ...(cur.opens || [])].slice(0, 100);
  await store.setJSON(slug, cur);
  if (comeback) {
    try { await comebackEmail(slug, cur, prev, open); } catch (e) { console.error("comeback email", e.message); }
  }
  return new Response(null, { status: 204, headers: CORS });
};

export const config = { path: "/api/quote-view" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const waNum = (p) => { let d = String(p || "").replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2); else if (d.startsWith("0")) d = "44" + d.slice(1); return d; };
function nice(t) { return new Date(t).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
function gap(ms) { const h = Math.round(ms / 3600000); return h < 48 ? h + " hours" : Math.round(h / 24) + " days"; }

async function comebackEmail(slug, v, prev, open) {
  const reg = await fetch("https://quotes.travelagentjake.co.uk/quotes.json", { signal: AbortSignal.timeout(4000) }).then((r) => r.json()).catch(() => ({ quotes: [] }));
  const q = (reg.quotes || []).find((x) => x.slug === slug) || { slug, customer: slug };
  let enq = null;
  if (q.enquiryId) enq = await getStore({ name: "enquiries", consistency: "strong" }).get(q.enquiryId, { type: "json" }).catch(() => null);
  const name = q.customer || (enq && enq.firstName) || slug;
  const url = "https://quotes.travelagentjake.co.uk/" + slug;
  const hello = `Hi ${name}, it's Jake from Travel Agent Jake. Just checking in on your holiday quote, have you had any more thoughts? Happy to answer any questions or tweak anything for you.`;
  const btn = (href, label, bg) => `<a href="${href}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:999px;margin:6px 8px 6px 0;">${label}</a>`;
  const html = `<div style="font-family:Arial,sans-serif;color:#10142B;max-width:560px">
<h2 style="color:#004AAD;margin:0 0 10px">${esc(name)} is looking at their quote again</h2>
<p style="font-size:16px;margin:0 0 12px">They opened <b>${esc(q.title || "their quote")}</b> on ${esc(nice(open.t))} (${esc(open.device)}${open.place ? ", " + esc(open.place) : ""}), ${esc(gap(Date.parse(open.t) - prev))} after their last look. A great moment to get in touch.</p>
<p style="font-size:15px;margin:0 0 16px">Total views so far: <b>${v.views}</b>. First opened ${esc(nice(v.firstView))}.</p>
${enq && enq.phone ? btn("https://wa.me/" + waNum(enq.phone) + "?text=" + encodeURIComponent(hello), "WhatsApp " + esc(name), "#25D366") : ""}${btn(url + "?jake=1", "View the quote", "#004AAD")}${btn(SITE + "/enquiries-admin.html", "Open dashboard", "#10142B")}
</div>`;
  await sendEmail({ to: jakeEmail(), toName: "Jake", subject: `${name} is looking at their quote again`, html, replyTo: false });
}
