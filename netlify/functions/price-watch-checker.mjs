// Private endpoint used by the daily price checker (a scheduled task on
// Jake's Mac that opens each holiday in a real browser).
//   GET  /api/price-watch-checker        -> watches due a check today
//   POST /api/price-watch-checker        -> { id, ok, price, error, note }
// Auth: header "x-checker-key" must equal env PW_CHECKER_KEY.
// Emails only go out when the total price moves by MIN_CHANGE_GBP or more
// compared with the last price we told the customer about (or the first
// price seen). Nothing is sent when the price is unchanged.
import { json, esc, gbp, getWatch, saveWatch, listWatches, sendEmail, jakeEmail, emailShell, button, holidaySummary, stopLink, waLink, MIN_CHANGE_GBP, MAX_FAILS, OPERATORS } from "../lib/pw.mjs";

const todayUK = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

function priceEmail(w, oldP, newP) {
  const diff = Math.abs(newP - oldP);
  const down = newP < oldP;
  const name = esc(w.firstName);
  const hol = holidaySummary(w);
  const wa = waLink(`Hi Jake, I've had your price watch email about ${w.hotel || w.destination || "my holiday"} (now ${gbp(newP)}). Can you help me book it?`);
  const subject = down
    ? `Good news ${w.firstName}, your holiday price has dropped by ${gbp(diff)}`
    : `${w.firstName}, the price of your holiday has gone up by ${gbp(diff)}`;
  const body = down
    ? `<h1 style="margin:0 0 12px;font-size:24px;color:#004AAD;">Your holiday just got cheaper</h1>
<p>Hi ${name},</p>
<p>I've been keeping an eye on the price of your holiday and it has <strong>dropped by ${gbp(diff)}</strong>.</p>
<p style="font-size:20px;margin:18px 0;"><span style="text-decoration:line-through;color:#6b7280;">${gbp(oldP)}</span> &nbsp;<strong style="color:#004AAD;">${gbp(newP)}</strong> total</p>
<p>${hol}</p>
<p>Prices can change at any time, so if you're ready to go, message me and I'll check it and get it booked for you while it's at this price. You get the same holiday, ABTA protection and me looking after you from booking to landing home, at no extra cost.</p>
<p>${button(wa, "WhatsApp me to book")}</p>`
    : `<h1 style="margin:0 0 12px;font-size:24px;color:#004AAD;">Heads up, your holiday price has gone up</h1>
<p>Hi ${name},</p>
<p>I've been keeping an eye on the price of your holiday and it has <strong>gone up by ${gbp(diff)}</strong>.</p>
<p style="font-size:20px;margin:18px 0;"><span style="color:#6b7280;">${gbp(oldP)}</span> &nbsp;→&nbsp; <strong style="color:#004AAD;">${gbp(newP)}</strong> total</p>
<p>${hol}</p>
<p>If these dates matter to you, it's worth acting before the price moves again. Message me and I'll check what's available right now, including nearby dates, other airports or similar hotels that could bring the price back down.</p>
<p>${button(wa, "WhatsApp me")}</p>`;
  const foot = `<p style="font-size:13px;color:#6b7280;margin-top:22px;">You're getting this because you asked me to watch this holiday's price on travelagentjake.co.uk. I'll only email when the price changes. <a href="${stopLink(w)}" style="color:#6b7280;">Stop watching this holiday</a>.</p>`;
  return { subject, html: emailShell(body + foot) };
}

export default async (req) => {
  if (!process.env.PW_CHECKER_KEY || req.headers.get("x-checker-key") !== process.env.PW_CHECKER_KEY) return json({ error: "Unauthorised" }, 401);

  if (req.method === "GET") {
    const today = todayUK();
    const all = await listWatches();
    const due = [];
    for (const w of all) {
      if (w.status !== "active") continue;
      if (w.departDate && w.departDate <= today) { w.status = "expired"; await saveWatch(w); continue; }
      if (w.needsLink || !w.url) continue;
      if (w.lastCheckedAt && w.lastCheckedAt.slice(0, 10) === today && w.lastResult === "ok") continue;
      due.push({ id: w.id, operator: w.operator, operatorName: OPERATORS[w.operator]?.name, url: w.url, hotel: w.hotel, departDate: w.departDate, nights: w.nights, board: w.board, airport: w.airport, adults: w.adults, children: w.children, childAges: w.childAges, lastPrice: w.lastPrice });
    }
    return json({ today, count: due.length, minChange: MIN_CHANGE_GBP, watches: due });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const r = await req.json().catch(() => null);
  if (!r?.id) return json({ error: "Missing id" }, 400);
  const w = await getWatch(r.id);
  if (!w) return json({ error: "Not found" }, 404);
  const now = new Date().toISOString();
  w.lastCheckedAt = now;
  const dry = !!r.dryRun;

  if (!r.ok) {
    w.failCount = (w.failCount || 0) + 1;
    w.lastResult = "fail";
    w.lastError = String(r.error || "unknown").slice(0, 300);
    let notified = false;
    if (w.failCount === MAX_FAILS && !dry) {
      try {
        await sendEmail({ to: jakeEmail(), replyTo: false, subject: `Price watch needs a look: ${w.hotel || w.id}`, html: emailShell(`<p>The price for <strong>${esc(w.firstName)}</strong>'s watch couldn't be read ${MAX_FAILS} days running.</p><p>${holidaySummary(w)}</p><p>Last error: ${esc(w.lastError)}</p><p><a href="${esc(w.url)}">Open the holiday</a>. The holiday may have sold out or the link may have expired. You can update or stop it on the Price Watch admin page.</p>`) });
        notified = true;
      } catch (e) { console.error(e.message); }
    }
    if (!dry) await saveWatch(w);
    return json({ ok: true, recorded: "fail", failCount: w.failCount, notifiedJake: notified });
  }

  const price = Math.round(Number(r.price) * 100) / 100;
  if (!(price > 50 && price < 200000)) return json({ error: "Implausible price" }, 400);
  if (r.hotel && !w.hotel) w.hotel = String(r.hotel).slice(0, 120);
  w.failCount = 0;
  w.lastResult = "ok";
  w.lastError = null;
  w.history = [...(w.history || []), { at: now, price }].slice(-120);
  if (w.firstPrice == null) w.firstPrice = price;
  const ref = w.lastAlertPrice ?? w.firstPrice;
  w.lastPrice = price;
  let emailed = null;
  if (ref != null && Math.abs(price - ref) >= MIN_CHANGE_GBP) {
    const { subject, html } = priceEmail(w, ref, price);
    if (!dry) {
      await sendEmail({ to: w.email, toName: w.firstName, subject, html });
      w.lastAlertPrice = price;
      w.alertsSent = (w.alertsSent || 0) + 1;
      w.lastAlertAt = now;
    }
    emailed = price < ref ? "drop" : "rise";
  }
  if (!dry) await saveWatch(w);
  return json({ ok: true, price, reference: ref, emailed, dryRun: dry });
};

export const config = { path: "/api/price-watch-checker" };
