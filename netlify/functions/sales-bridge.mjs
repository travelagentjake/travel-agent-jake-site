// Jake-only proxy between the Business Dashboard (/enquiries-admin.html, Sales tab)
// and his Google Apps Script sales app. The browser never talks to Google: it sends
// { fn, args } here with the admin key, and this function forwards ONLY a fixed list
// of webapp_* calls to the Apps Script "bridge" deployment together with a shared secret.
//
// Env vars (Netlify): PW_ADMIN_KEY (already used by the enquiries dashboard),
//   SALES_BRIDGE_URL    the /exec URL of the "Anyone" web app deployment
//   SALES_BRIDGE_SECRET the same random string stored in Apps Script (Script property BRIDGE_SECRET)
import { json } from "../lib/pw.mjs";

const ALLOW = new Set([
  "webapp_getAll",
  "webapp_addBooking",
  "webapp_updateBooking",
  "webapp_setBookingCancelled",
  "webapp_setCommissionPaid",
  "webapp_setPreTravelCheckDone",
  "webapp_setJet2CodeOutcome",
  "webapp_addJet2CodeFromPhoto",
  "webapp_processReconciliationCsv",
  "webapp_rerunReconciliation",
  "webapp_cancelWithCommission",
  "webapp_undoCancelCommission",
]);

export default async (req) => {
  if (!process.env.PW_ADMIN_KEY || req.headers.get("x-admin-key") !== process.env.PW_ADMIN_KEY) return json({ error: "Wrong admin key" }, 401);
  if (req.method === "GET") return json({ configured: !!(process.env.SALES_BRIDGE_URL && process.env.SALES_BRIDGE_SECRET) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = process.env.SALES_BRIDGE_URL, secret = process.env.SALES_BRIDGE_SECRET;
  if (!url || !secret) return json({ error: "not_configured" }, 503);

  const b = await req.json().catch(() => ({}));
  const fn = String(b.fn || "");
  if (!ALLOW.has(fn)) return json({ error: "That action is not allowed" }, 400);
  const args = Array.isArray(b.args) ? b.args : [];

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 24000);
  try {
    // Apps Script answers a POST with a redirect to the result, which fetch follows.
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret, fn, args }),
      redirect: "follow",
      signal: ctl.signal,
    });
    const text = await r.text();
    let out;
    try { out = JSON.parse(text); } catch { return json({ error: "bridge_unreachable", detail: "Google did not return data. Check the bridge deployment is set to 'Anyone'." }, 502); }
    if (!out.ok) return json({ error: out.error || "Bridge error" }, out.error === "Unauthorised" ? 502 : 500);
    return json({ ok: true, data: out.data });
  } catch (e) {
    return json({ error: e.name === "AbortError" ? "timeout" : "bridge_failed" }, 504);
  } finally {
    clearTimeout(timer);
  }
};

export const config = { path: "/api/sales-bridge" };
