// Booking form on the interactive quotes (quotes.travelagentjake.co.uk/<slug>, the "Book this holiday" box).
//   POST /api/quote-book  { slug, hotel, total, deposit, payToday, payNow, payHow, dd, passengers, address, postcode, mobile, email, agreed }
// Saves the full details in the Blobs store "quote-bookings" (shown on the dashboard behind the admin key),
// emails Jake a short notice with the names and the holiday only (no address, dates of birth or bank details),
// sends the customer a copy without any bank details, and adds a note to the matching enquiry.
import { getStore } from "@netlify/blobs";
import { brevo, SENDER } from "../lib/enquiry-lib.mjs";
import { jakeEmail, emailShell, button, esc, SITE, randomId } from "../lib/pw.mjs";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" };
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" } });
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const gbp = (n) => "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
const nice = (d) => { const t = Date.parse(d); return isNaN(t) ? esc(d) : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); };
const ordinal = (d) => d + ([, "st", "nd", "rd"][(d % 100 >> 3 ^ 1 && d % 10)] || "th");

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b = {};
  try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  if (b.website) return json({ ok: true }); // honeypot, bots fill it in

  const slug = clean(b.slug, 40).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(slug)) return json({ error: "Unknown quote" }, 400);
  const pax = (Array.isArray(b.passengers) ? b.passengers : []).slice(0, 30).map((p) => ({
    room: Math.min(8, Math.max(1, parseInt(p.room, 10) || 1)), title: ["Mr", "Mrs", "Miss", "Ms", "Mx", "Dr", "Master"].includes(clean(p.title, 10)) ? clean(p.title, 10) : "", first: clean(p.first, 60), middle: clean(p.middle, 60), last: clean(p.last, 60), dob: clean(p.dob, 10),
  })).filter((p) => p.first && p.last && /^\d{4}-\d{2}-\d{2}$/.test(p.dob));
  const email = clean(b.email, 120).toLowerCase(), mobile = clean(b.mobile, 20);
  const address = clean(b.address, 400), postcode = clean(b.postcode, 12).toUpperCase();
  if (!pax.length) return json({ error: "Please add the passengers" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Please check the email address" }, 400);
  if (!/^\+?[\d\s]{10,15}$/.test(mobile)) return json({ error: "Please check the mobile number" }, 400);
  if (!address || !postcode) return json({ error: "Please add the home address" }, 400);
  if (b.agreed !== true) return json({ error: "Please agree to the booking conditions" }, 400);

  const payNow = b.payNow === "full" ? "full" : b.payNow === "other" ? "other" : "deposit";
  const payHow = ["bank", "debit", "credit"].includes(b.payHow) ? b.payHow : "card";
  const payLabel = { bank: "bank transfer", debit: "debit card", credit: "credit card" }[payHow] || "card";
  let dd = null;
  if (payNow !== "full" && b.dd && typeof b.dd === "object") {
    const sort = String(b.dd.sort || "").replace(/\D/g, ""), account = String(b.dd.account || "").replace(/\D/g, "");
    if (!/^\d{6}$/.test(sort) || !/^\d{8}$/.test(account) || !clean(b.dd.name, 80)) return json({ error: "Please check the direct debit details" }, 400);
    dd = { day: Math.min(28, Math.max(1, Number(b.dd.day) || 1)), name: clean(b.dd.name, 80), sort, account };
  }
  const extras = (Array.isArray(b.extras) ? b.extras : []).slice(0, 20).map((e) => ({ title: clean(e.title, 120), total: Number(e.total) || 0, separate: !!e.separate }));
  const rec = {
    id: randomId(8), at: new Date().toISOString(), slug, customer: clean(b.customer, 80), title: clean(b.title, 120),
    hotel: clean(b.hotel, 120), hotelTotal: Number(b.hotelTotal) || 0, extras, total: Number(b.total) || 0, deposit: Number(b.deposit) || 0, payToday: Number(b.payToday) || 0,
    payNow, payHow, dd, passengers: pax, address, postcode, mobile, email, departDate: clean(b.departDate, 10),
  };

  // Keep a copy, and link it to the enquiry so the dashboard shows it
  try { await getStore({ name: "quote-bookings", consistency: "strong" }).setJSON(rec.id, rec); } catch (e) { console.error("save booking", e.message); }
  try {
    const reg = await fetch("https://taj-quotes.pages.dev/quotes.json?cb=" + Date.now(), { signal: AbortSignal.timeout(4000) }).then((r) => r.json());
    const q = (reg.quotes || []).find((x) => x.slug === slug);
    if (q && q.enquiryId) {
      const es = getStore({ name: "enquiries", consistency: "strong" });
      const enq = await es.get(q.enquiryId, { type: "json" }).catch(() => null);
      if (enq) {
        (enq.notesLog = enq.notesLog || []).push({ t: rec.at, text: "Booking form sent from the quote: " + rec.hotel + ", " + gbp(rec.total) + ", paying " + (payNow === "full" ? "in full" : payNow === "other" ? "a chosen amount of " + gbp(Number(b.payToday) || 0) : "the deposit") + " by " + payLabel + (dd ? ", direct debit on the " + ordinal(dd.day) : "") + ". Send the payment link.", auto: true });
        enq.wantsToBook = { at: rec.at, slug, bookingId: rec.id, hotel: rec.hotel, total: rec.total };
        await es.setJSON(enq.id, enq);
      }
    }
  } catch (e) { console.error("enquiry note", e.message); }

  const lead = pax[0];
  const name = lead.first + " " + lead.last;
  const row = (k, v) => `<tr><td style="padding:7px 10px 7px 0;color:#5b6478;vertical-align:top;white-space:nowrap;">${k}</td><td style="padding:7px 0;font-weight:bold;vertical-align:top;">${v}</td></tr>`;
  const paxRows = pax.map((p, i) => row("Passenger " + (i + 1), esc([p.first, p.middle, p.last].filter(Boolean).join(" ")) + `<br><span style="font-weight:normal">born ${nice(p.dob)}</span>`)).join("");
  const th = 'style="padding:6px 10px;text-align:left;font-size:12px;color:#5b6478;border-bottom:2px solid #004AAD;white-space:nowrap;"', td = 'style="padding:7px 10px;border-bottom:1px solid #e3e7f5;font-weight:bold;vertical-align:top;"';
  const manyRooms = new Set(pax.map((p) => p.room)).size > 1, roomOrder = [...new Set(pax.map((p) => p.room))].sort((a, b) => a - b);
  const paxRowHtml = (p, i) => `<tr><td ${td}>${i + 1}</td><td ${td}>${esc(p.title || "")}</td><td ${td}>${esc(p.first)}</td><td ${td}>${p.middle ? esc(p.middle) : '&nbsp;'}</td><td ${td}>${esc(p.last)}</td><td ${td}>${nice(p.dob)}</td></tr>`;
  const paxBody = manyRooms ? roomOrder.map((r) => `<tr><td colspan="6" style="padding:9px 10px 5px;background:#f1f4fc;color:#004AAD;font-weight:bold;border-bottom:1px solid #e3e7f5;">Room ${r}</td></tr>` + pax.map((p, i) => [p, i]).filter(([p]) => p.room === r).map(([p, i]) => paxRowHtml(p, i)).join("")).join("") : pax.map(paxRowHtml).join("");
  const paxTable = `<table cellpadding="0" cellspacing="0" style="font-size:15px;border-collapse:collapse;width:100%;max-width:560px;margin:4px 0 6px;"><tr><th ${th}>#</th><th ${th}>Title</th><th ${th}>First name</th><th ${th}>Middle name</th><th ${th}>Surname</th><th ${th}>Date of birth</th></tr>${paxBody}</table>`;
  const addressRow = row("Address", esc(address).replace(/\n/g, "<br>") + "<br>" + esc(postcode));
  const money = `${row("Hotel", esc(rec.hotel) + " " + gbp(rec.hotelTotal))}${extras.length ? row("Extras", extras.map((e) => esc(e.title) + " " + gbp(e.total) + (e.separate ? " (paid in full at booking)" : "")).join("<br>")) : ""}${row("Total", gbp(rec.total))}${row("Paying today", gbp(rec.payToday) + (payNow === "full" ? ", the full amount" : payNow === "other" ? ", the amount chosen (more than the deposit)" : ", the deposit") + " by " + payLabel)}`;
  const quoteUrl = "https://quotes.travelagentjake.co.uk/" + slug;

  const jakeHtml = emailShell(`<h2 style="margin:0 0 6px;color:#004AAD;">${esc(name)} wants to book!</h2>
<p style="margin:0 0 14px;">${esc(name)} has sent the booking form from <a href="${quoteUrl}">${quoteUrl}</a> and agreed to the booking conditions.</p>
<table cellpadding="0" cellspacing="0" style="font-size:15px;">${row("Hotel", esc(rec.hotel))}${row("Total", gbp(rec.total) + (extras.length ? " with " + extras.length + " extra" + (extras.length > 1 ? "s" : "") : ""))}${row("Paying today", gbp(rec.payToday) + (payNow === "full" ? ", the full amount" : payNow === "other" ? ", the amount chosen (more than the deposit)" : ", the deposit") + " by " + payLabel)}${row("Balance", payNow === "full" ? "None" : dd ? "Monthly direct debit on the " + ordinal(dd.day) + (payNow === "other" ? ", balance " + gbp(Math.max(0, rec.total - rec.payToday)) : "") + (clean(b.ddPlan, 200) ? ". " + esc(clean(b.ddPlan, 200)) : "") : "No direct debit, due about 14 weeks before travel")}${rec.departDate ? row("Departs", nice(rec.departDate)) : ""}</table>
<h3 style="margin:18px 0 4px;color:#004AAD;">Who is travelling (as on their passports)</h3>${paxTable}
<p style="margin:16px 0 0;">Their address, contact details and the direct debit details are on the dashboard, under their enquiry.</p>
<p style="margin:14px 0 0;">${button(SITE + "/enquiries-admin.html#booking=" + rec.id, "See the booking details", "#004AAD", "#fff")}</p>
<p style="margin:18px 0 0;font-size:13px;color:#5b6478;">Booking reference ${rec.id}. Hit reply to email ${esc(lead.first)} directly.</p>`);

  const custHtml = emailShell(`<h2 style="margin:0 0 6px;color:#004AAD;">Thank you, ${esc(lead.first)}!</h2>
<p style="margin:0 0 14px;">I have your booking details for <strong>${esc(rec.hotel)}</strong>. Here is what happens next:</p>
<ol style="margin:0 0 16px;padding-left:20px;"><li>I will text <strong>${esc(mobile)}</strong> with a secure payment link for <strong>${gbp(rec.payToday)}</strong>.</li><li>As soon as that is paid I confirm the holiday with the tour operator.</li><li>You then get your booking confirmation and ATOL certificate by email.</li></ol>
<h3 style="margin:18px 0 4px;color:#004AAD;">What you sent</h3><table cellpadding="0" cellspacing="0" style="font-size:15px;">${money}${addressRow}${row("Email", esc(email))}${dd ? row("Direct debit", "Balance by monthly direct debit on the " + ordinal(dd.day) + ", from the account ending " + dd.account.slice(-4) + (clean(b.ddPlan, 200) ? ". " + esc(clean(b.ddPlan, 200)) : "")) : ""}</table>
<h3 style="margin:18px 0 4px;color:#004AAD;">Who is travelling</h3>${paxTable}
<p style="margin:16px 0 0;">Spotted a mistake, or want to change something? Just WhatsApp me on <a href="https://wa.me/447899290262">07899 290262</a> before you pay and I will sort it. Your quote is at <a href="${quoteUrl}">${quoteUrl}</a>.</p>
<p style="margin:16px 0 0;">Jake</p>`);

  try {
    await brevo("/smtp/email", {
      sender: { name: "Travel Agent Jake Website", email: SENDER() }, to: [{ email: jakeEmail() }], replyTo: { email, name },
      subject: `BOOKING: ${name} wants to book ${rec.hotel} (${gbp(rec.total)})`, htmlContent: jakeHtml, tags: ["quote-booking"],
    });
  } catch (e) { console.error("notify Jake failed", e.message); return json({ error: "Could not send to Jake right now" }, 502); }
  try {
    await brevo("/smtp/email", { sender: { name: "Travel Agent Jake", email: SENDER() }, to: [{ email, name }], replyTo: { email: jakeEmail(), name: "Jake" }, subject: `Your booking details for ${rec.hotel}`, htmlContent: custHtml, tags: ["quote-booking"] });
  } catch (e) { console.error("customer copy failed", e.message); }
  return json({ ok: true, id: rec.id });
};

export const config = { path: "/api/quote-book" };
