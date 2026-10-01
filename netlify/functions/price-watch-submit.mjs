// Public endpoint: a customer asks Jake to watch the price of a holiday.
// No email goes to the customer here (alerts only on a real price change);
// Jake gets a short "new lead" email unless PW_NOTIFY_NEW=off.
import { json, esc, randomId, operatorFromUrl, saveWatch, upsertContact, sendEmail, jakeEmail, emailShell, holidaySummary, listWatches, OPERATORS, SITE } from "../lib/pw.mjs";

const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);

// Fill in trend fields from the operator link when the customer left them blank.
const BOARD = { AI: "All Inclusive", HB: "Half Board", FB: "Full Board", BB: "Bed and Breakfast", SC: "Self Catering", RO: "Room Only" };
function fromLink(url, operator) {
  const o = {};
  try {
    const u = new URL(url); const q = u.searchParams;
    const dmy = (v) => { const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v || ""); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
    if (operator === "jet2") {
      o.departDate = dmy(q.get("date")); o.nights = q.get("duration") || "";
      const occ = /^r(\d+)c?([\d_]*)/.exec(q.get("occupancy") || ""); if (occ) { o.adults = occ[1]; const kids = occ[2] ? occ[2].split("_").filter(Boolean) : []; o.children = String(kids.length); o.childAges = kids.join(", "); }
      const parts = u.pathname.split("/").filter(Boolean); o.hotel = (parts.at(-1) || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); o.destination = (parts.at(-2) || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    } else if (operator === "tui" || operator === "crystal") {
      o.departDate = dmy(q.get("when")); o.nights = q.get("duration") && q.get("duration").length <= 2 ? q.get("duration") : "";
      o.adults = q.get("noOfAdults") || ""; o.children = q.get("noOfChildren") || ""; o.childAges = (q.get("childrenAge") || "").replace(/,/g, ", ");
      o.airport = q.getAll("airports[]").join(", "); o.board = BOARD[q.get("bb")] || "";
    } else if (operator === "easyjet") {
      o.departDate = q.get("startDate") || q.get("departureDate") || ""; o.nights = q.get("nights") || q.get("duration") || "";
    }
  } catch {}
  return o;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  if (b.website) return json({ ok: true }); // honeypot: pretend success for bots

  const email = clean(b.email, 160).toLowerCase();
  const firstName = clean(b.firstName, 60);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Please enter a valid email address." }, 400);
  if (!firstName) return json({ error: "Please enter your first name." }, 400);
  if (!b.alertsConsent) return json({ error: "Please tick the box so I can email you about price changes." }, 400);

  const url = clean(b.url, 2000);
  let operator = clean(b.operator, 20);
  if (url) {
    operator = operatorFromUrl(url);
    if (!operator) return json({ error: "That link isn't from TUI, Jet2holidays, easyJet holidays or Crystal Ski. Please paste the link from one of those sites, or use the 'enter details' option instead." }, 400);
  } else if (!OPERATORS[operator]) {
    return json({ error: "Please choose TUI, Jet2holidays, easyJet holidays or Crystal Ski." }, 400);
  }

  const departDate = clean(b.departDate, 10);
  if (departDate && !/^\d{4}-\d{2}-\d{2}$/.test(departDate)) return json({ error: "Please check the departure date." }, 400);
  if (!url && (!clean(b.hotel) || !departDate)) return json({ error: "Please add the hotel and departure date, or paste the holiday link." }, 400);

  // Capacity cap (env PW_MAX_ACTIVE, default 300) so the daily checker can
  // always keep up; plus max 5 active watches per email address.
  const active = (await listWatches()).filter((w) => w.status === "active");
  if (active.length >= Number(process.env.PW_MAX_ACTIVE || 300)) return json({ error: "full", full: true }, 503);
  const existing = active.filter((w) => w.email === email);
  if (existing.length >= 5) return json({ error: "You're already watching 5 holidays. WhatsApp me and I'll help you narrow it down." }, 429);

  const now = new Date().toISOString();
  const w = {
    id: randomId(8),
    token: randomId(16),
    createdAt: now,
    status: "active",
    mode: url ? "link" : "details",
    needsLink: !url, // details-only watches wait for Jake to attach the operator link in the admin page
    firstName,
    email,
    phone: clean(b.phone, 30),
    operator,
    url,
    hotel: clean(b.hotel, 120),
    destination: clean(b.destination, 120),
    airport: clean(b.airport, 60),
    departDate,
    nights: clean(b.nights, 3),
    board: clean(b.board, 40),
    adults: clean(b.adults, 2),
    children: clean(b.children, 2),
    childAges: clean(b.childAges, 60),
    budget: clean(b.budget, 40),
    notes: clean(b.notes, 500),
    marketing: !!b.marketingConsent,
    consent: { alerts: now, marketing: b.marketingConsent ? now : null, page: SITE + "/price-watch.html" },
    firstPrice: null,
    lastPrice: null,
    lastAlertPrice: null,
    lastCheckedAt: null,
    failCount: 0,
    alertsSent: 0,
    history: [],
  };
  if (url) { const f = fromLink(url, operator); for (const [k, v] of Object.entries(f)) if (v && (!w[k] || w[k] === "0")) w[k] = clean(v, 120); }
  await saveWatch(w);

  try { await upsertContact(w); } catch (e) { console.error("Brevo contact", e.message); }

  if ((process.env.PW_NOTIFY_NEW || "on") !== "off") {
    try {
      await sendEmail({
        to: jakeEmail(),
        subject: `New price watch: ${w.hotel || w.destination || OPERATORS[operator].name} (${firstName})`,
        replyTo: false,
        html: emailShell(`<p><strong>${esc(firstName)}</strong> (${esc(email)}${w.phone ? ", " + esc(w.phone) : ""}) has started a price watch.</p>
<p>${holidaySummary(w)}${w.adults ? `, ${esc(w.adults)} adults` : ""}${w.children && w.children !== "0" ? `, ${esc(w.children)} children (${esc(w.childAges)})` : ""}</p>
${url ? `<p><a href="${esc(url)}">Operator link</a></p>` : `<p style="color:#b00020;"><strong>No link given.</strong> Add the operator link in the <a href="${SITE}/price-watch-admin.html">Price Watch admin page</a> so it can be checked.</p>`}
${w.notes ? `<p>Notes: ${esc(w.notes)}</p>` : ""}
<p>Marketing opt in: ${w.marketing ? "yes" : "no"}</p>`),
      });
    } catch (e) { console.error("Notify Jake", e.message); }
  }
  return json({ ok: true, needsLink: w.needsLink });
};

export const config = { path: "/api/price-watch" };
