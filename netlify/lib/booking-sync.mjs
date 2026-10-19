// Marks enquiries (and their quotes) as booked when the customer appears in Jake's sales dashboard.
// Reads bookings through the existing Google Apps Script bridge (Bridge.gs, webapp_getAll) using the
// Netlify env vars SALES_BRIDGE_URL and SALES_BRIDGE_SECRET. Nothing is ever written back to Google.
// Match rules, an enquiry is booked when a booking made on or after the enquiry date (allowing 3 days)
// has the same email, or the same mobile number, or exactly the same full name.
import { getStore } from "@netlify/blobs";
import { SITE } from "./pw.mjs";

const st = (name) => getStore({ name, consistency: "strong" });
const clean = (s) => String(s ?? "").trim().toLowerCase();
const phone = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length >= 9 ? d.slice(-10) : ""; };

async function bridgeBookings() {
  const url = process.env.SALES_BRIDGE_URL, secret = process.env.SALES_BRIDGE_SECRET;
  if (!url || !secret) throw new Error("not_configured");
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret, fn: "webapp_getAll", args: [] }),
    redirect: "follow",
    signal: AbortSignal.timeout(120000),
  });
  const text = await r.text();
  let out; try { out = JSON.parse(text); } catch { throw new Error("Google did not return data"); }
  if (!out.ok) throw new Error(out.error || "bridge error");
  const d = out.data || {};
  return [].concat(d.bookings || [], d.travelled || []).filter((b) => b && !b.cancelled);
}

export async function syncBookings() {
  const log = st("booking-sync");
  const started = new Date().toISOString();
  try {
    const bookings = await bridgeBookings();
    const es = st("enquiries");
    const { blobs } = await es.list();
    const enquiries = (await Promise.all(blobs.map((b) => es.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);
    const reg = await fetch("https://taj-quotes.pages.dev/quotes.json?cb=" + Date.now()).then((r) => r.json()).catch(() => ({ quotes: [] }));
    const qs = st("quote-status");
    const matched = [];

    for (const q of enquiries) {
      if (q.status === "booked" || q.kind === "prereg2028") continue;
      const email = clean(q.email), mob = phone(q.phone), name = clean([q.firstName, q.lastName].join(" "));
      const since = Date.parse(q.createdAt || 0) - 3 * 86400000;
      const hit = bookings.find((b) => {
        if (b.timestampMs && b.timestampMs < since) return false;
        if (email && clean(b.customerEmail) === email) return true;
        if (mob && phone(b.customerPhone) === mob) return true;
        return name.includes(" ") && clean(b.customerName) === name;
      });
      if (!hit) continue;
      q.status = "booked";
      q.statusAt = new Date().toISOString();
      q.booked = { ref: String(hit.bookingRef || ""), supplier: String(hit.supplier || ""), destination: String(hit.destination || ""), departs: String(hit.departureDate || ""), via: "sales dashboard" };
      (q.notesLog = q.notesLog || []).push({ t: q.statusAt, text: "Booked, found in the sales dashboard" + (q.booked.ref ? " (ref " + q.booked.ref + (q.booked.supplier ? ", " + q.booked.supplier : "") + ")" : ""), auto: true });
      await es.setJSON(q.id, q);
      for (const quote of (reg.quotes || []).filter((x) => x.enquiryId === q.id)) {
        await qs.setJSON(quote.slug, { status: "booked", at: q.statusAt, ref: q.booked.ref, via: "sales dashboard" });
      }
      matched.push({ id: q.id, name: [q.firstName, q.lastName].join(" "), ref: q.booked.ref });
    }
    const res = { ok: true, at: new Date().toISOString(), started, bookings: bookings.length, matched };
    await log.setJSON("last", res);
    return res;
  } catch (e) {
    const res = { ok: false, at: new Date().toISOString(), started, error: e.message === "not_configured" ? "The sales dashboard link is not set up in Netlify (SALES_BRIDGE_URL and SALES_BRIDGE_SECRET)." : String(e.message || e) };
    await log.setJSON("last", res);
    return res;
  }
}
