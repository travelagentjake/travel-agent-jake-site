// Public endpoint: the Holiday Enquiry Form on /enquiry.html.
// Jake gets a full summary email (reply goes straight to the customer), the
// customer gets a short confirmation, and a copy is kept in the Netlify Blobs
// store "enquiries" as a safety net. The Brevo contact is only created when the
// customer ticks the marketing box.
import { getStore } from "@netlify/blobs";
import { json, esc, SITE, waLink, jakeEmail } from "../lib/pw.mjs";
import { SENDER, brevo, loadLogo, pdfName, b64 } from "../lib/enquiry-lib.mjs";
import { buildEnquiryPdf } from "../lib/enquiry-pdf.mjs";

const clean = (v, max = 300) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
const shell = (inner) => `<!doctype html><html><body style="margin:0;background:#f2f5fb;font-family:Arial,Helvetica,sans-serif;color:#14213d;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f5fb;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;">
<tr><td style="background:#ffffff;padding:20px 28px;border-bottom:5px solid #FFD21F;"><img src="${SITE}/images/logo.png" alt="Travel Agent Jake" height="56" style="display:block;height:56px;"></td></tr>
<tr><td style="padding:28px;font-size:16px;line-height:1.55;">${inner}</td></tr>
<tr><td style="background:#004AAD;color:#ffffff;padding:18px 28px;font-size:12px;line-height:1.5;">Travel Agent Jake, ABTA P8503. Holidays booked with me are made through Club Voyages and are financially protected.</td></tr>
</table></td></tr></table></body></html>`;

const btn = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:#FFD21F;color:#14213d;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:999px;margin:6px 6px 6px 0;">${label}</a>`;

const row = (label, value) =>
  value ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #e6eaf3;font-size:13px;color:#5b6478;width:38%;vertical-align:top;">${esc(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #e6eaf3;font-size:15px;vertical-align:top;">${esc(value).replace(/\n/g, "<br>")}</td></tr>` : "";

const nice = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

// 07xxx or +447xxx or 447xxx to a wa.me style number
const waNumber = (p) => {
  const d = String(p).replace(/\D/g, "");
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("0")) return "44" + d.slice(1);
  return d;
};

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  if (b.website) return json({ ok: true }); // honeypot: pretend success for bots

  const kind = b.kind === "prereg2028" ? "prereg2028" : "enquiry";
  const pre = kind === "prereg2028";
  // 2028 pre-registration closes at the end of 15 October 2026 (UK time).
  if (pre && Date.now() >= Date.parse("2026-10-16T00:00:00+01:00")) return json({ error: "Sorry, 2028 pre-registration has now closed. Please use the holiday enquiry form or WhatsApp me and I'll help you straight away." }, 410);
  const email = clean(b.email, 160).toLowerCase();
  const firstName = clean(b.firstName, 60);
  const lastName = clean(b.lastName, 60);
  const phone = clean(b.phone, 30);
  if (!firstName || !lastName) return json({ error: "Please enter your first and last name." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Please enter a valid email address." }, 400);
  if (phone.replace(/\D/g, "").length < 9) return json({ error: "Please enter a mobile number so I can reach you." }, 400);
  if (!b.privacyConsent) return json({ error: "Please tick the box to confirm you're happy for me to use your details to reply to your enquiry." }, 400);

  const adults = Math.min(Math.max(parseInt(b.adults, 10) || 0, 1), 20);
  const children = Math.min(Math.max(parseInt(b.children, 10) || 0, 0), 12);
  const ages = (Array.isArray(b.childAges) ? b.childAges : []).slice(0, children).map((a) => clean(a, 20)).filter(Boolean);
  if (children > 0 && ages.length < children) return json({ error: "Please choose an age for each child." }, 400);

  const airports = (Array.isArray(b.airports) ? b.airports : []).map((a) => clean(a, 40)).filter(Boolean).slice(0, 25);
  const departDate = /^\d{4}-\d{2}-\d{2}$/.test(clean(b.departDate, 10)) ? clean(b.departDate, 10) : "";

  const boards = (Array.isArray(b.boards) ? b.boards : []).map((a) => clean(a, 40)).filter(Boolean).slice(0, 10);
  if (pre) {
    if (!clean(b.month, 30)) return json({ error: "Please choose the month you would like to depart." }, 400);
    if (!/^2028-(0[1-9]|10)-\d{2}$/.test(departDate)) return json({ error: "Please choose a preferred departure date between 1 January and 31 October 2028." }, 400);
    if (!airports.length) return json({ error: "Please tick at least one airport you can fly from." }, 400);
    if (!boards.length) return json({ error: "Please tick at least one board basis you would consider." }, 400);
    if (!clean(b.budget, 80) || !clean(b.deposit, 80)) return json({ error: "Please choose your budget and whether you will be ready to pay a deposit." }, 400);
  }

  const q = {
    kind,
    status: "new",
    adminNotes: "",
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
    firstName, lastName, email, phone,
    holidayType: clean(b.holidayType, 60),
    destination: clean(b.destination, 300),
    departDate,
    dateFlex: clean(b.dateFlex, 60),
    dateNotes: clean(b.dateNotes, 300),
    nights: clean(b.nights, 20),
    airports,
    adults, children, childAges: ages,
    accommodation: clean(b.accommodation, 40),
    stars: clean(b.stars, 30),
    board: pre ? boards.join(", ") : clean(b.board, 40),
    budget: clean(b.budget, 80),
    whenBook: clean(b.whenBook, 40),
    notes: clean(b.notes, 2000),
    source: clean(b.source, 60),
    month: pre ? clean(b.month, 30) : "",
    hotel: pre ? clean(b.hotel, 200) : "",
    deposit: pre ? clean(b.deposit, 80) : "",
    marketing: !!b.marketingConsent,
    consentAt: new Date().toISOString(),
  };

  // Safety net copy (never fails the request).
  try { await getStore({ name: "enquiries", consistency: "strong" }).setJSON(q.id, q); } catch (e) { console.error("Blob save", e.message); }

  const party = `${adults} adult${adults === 1 ? "" : "s"}` + (children ? `, ${children} child${children === 1 ? "" : "ren"} (ages ${ages.join(", ")})` : "");
  const agesText = ages.map((a, i) => `Child ${i + 1}: ${a}`).join(", ");
  const when = [nice(departDate) && `from ${nice(departDate)}`, q.dateFlex, q.dateNotes].filter(Boolean).join(", ");

  const hello = pre
    ? `Hi ${firstName}, it's Jake from Travel Agent Jake. Thanks for registering for 2028 holidays${q.destination ? " (" + q.destination.slice(0, 60) + ")" : ""}! `
    : `Hi ${firstName}, it's Jake from Travel Agent Jake. Thanks for your holiday enquiry${q.destination ? " about " + q.destination.slice(0, 60) : ""}! `;
  const waBtn = `<a href="https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(hello)}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-weight:bold;font-size:17px;padding:15px 26px;border-radius:999px;margin:6px 8px 6px 0;">WhatsApp ${esc(firstName)} on ${esc(phone)}</a>`;
  const jakeHtml = shell(`<p style="margin:0 0 6px;font-size:13px;color:#5b6478;">${pre ? "NEW 2028 PRE-REGISTRATION" : "NEW HOLIDAY ENQUIRY"}</p>
<h2 style="margin:0 0 14px;font-size:22px;">${esc(firstName)} ${esc(lastName)}</h2>
<p style="margin:0 0 16px;">${waBtn}${btn("mailto:" + esc(email), "Email them")}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6eaf3;border-radius:10px;">
${row("Email", email)}${row("Mobile", phone)}
${row(pre ? "What type of holiday are you after?" : "Type of holiday", q.holidayType)}${row("Which month would you like to depart?", q.month)}${row("Where would you like to go?", q.destination)}${row("Have you got a particular hotel in mind?", q.hotel)}
${row("Preferred departure date", nice(departDate))}${row("How flexible are your dates?", q.dateFlex)}${row("Date notes", q.dateNotes)}${row("How many nights?", q.nights)}
${row("Which airports can you fly from?", airports.join(", "))}${row("Adults", String(adults))}${row("Children", String(children))}${row("Child ages", agesText)}
${row("Type of accommodation", q.accommodation)}${row("Minimum star rating", q.stars)}${row("Board basis", q.board)}
${row(pre ? "What is your total budget for everyone?" : "Budget for the whole holiday", q.budget)}${row("Will you be ready to pay a deposit when 2028 launches?", q.deposit)}${row("When are you looking to book?", q.whenBook)}
${row(pre ? "Anything else I should know?" : "Anything else?", q.notes)}${row(pre ? "How did you find me?" : "How did you hear about me?", q.source)}
${row("Marketing opt in", q.marketing ? "Yes" : "No")}
</table>
<p style="margin:16px 0 0;">${btn(SITE + "/enquiries-admin.html", "Open enquiries dashboard")}</p>
<p style="margin:10px 0 0;font-size:13px;color:#5b6478;">Hit reply to answer them directly by email. A printable copy of this enquiry is attached.</p>`);

  let pdfBytes = null;
  try { pdfBytes = await buildEnquiryPdf(q, await loadLogo()); } catch (e) { console.error("PDF build failed", e.message); }

  try {
    await brevo("/smtp/email", {
      sender: { name: "Travel Agent Jake Website", email: SENDER() },
      to: [{ email: jakeEmail() }],
      ...(pdfBytes ? { attachment: [{ name: pdfName(q), content: b64(pdfBytes) }] } : {}),
      replyTo: { email, name: `${firstName} ${lastName}` },
      subject: `${pre ? "New 2028 pre-registration" : "New holiday enquiry"}: ${firstName} ${lastName}${q.destination ? ", " + q.destination.slice(0, 60) : ""}`,
      htmlContent: jakeHtml,
      tags: [pre ? "prereg-2028" : "holiday-enquiry"],
    });
  } catch (e) {
    console.error("Notify Jake failed", e.message, JSON.stringify(q));
    return json({ error: "Sorry, something went wrong sending your enquiry. Please WhatsApp me instead and I'll sort it straight away." }, 502);
  }

  // Confirmation to the customer.
  try {
    await brevo("/smtp/email", {
      sender: { name: "Travel Agent Jake", email: SENDER() },
      to: [{ email, name: `${firstName} ${lastName}` }],
      replyTo: { email: SENDER(), name: "Travel Agent Jake" },
      subject: pre ? "You're on the 2028 list" : "Thanks, I've got your holiday enquiry",
      htmlContent: shell(`<p style="margin:0 0 14px;">Hi ${esc(firstName)},</p>
<p style="margin:0 0 14px;">${pre ? "Thanks for pre-registering. You're on my list for 2028, and I'll message you personally on WhatsApp as soon as 2028 holidays are released so you're first in line for the best prices and availability." : "Thanks for sending your enquiry over. I've got everything I need to start putting some real options together for you, and I'll be in touch personally."}</p>
<p style="margin:0 0 6px;"><strong>Here's what you told me:</strong></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6eaf3;border-radius:10px;margin-bottom:16px;">
${row("Where would you like to go?", q.destination || q.holidayType)}${row("Which month would you like to depart?", q.month)}${row("Preferred departure date", nice(departDate))}${row("How flexible are your dates?", q.dateFlex)}${row("Date notes", q.dateNotes)}${row("How many nights?", q.nights)}${row("Travelling", party)}${row("Flying from", airports.join(", "))}${row("Budget", q.budget)}
</table>
<p style="margin:0 0 14px;">If anything changes, or you've seen a holiday you like the look of, just reply to this email or message me on WhatsApp.</p>
<p style="margin:0 0 14px;">${btn(waLink("Hi Jake, I've just sent a holiday enquiry through your website."), "Message me on WhatsApp")}</p>
<p style="margin:0;">Speak soon,<br><strong>Jake</strong></p>`),
      tags: [pre ? "prereg-2028-confirmation" : "holiday-enquiry-confirmation"],
    });
  } catch (e) { console.error("Confirmation email failed", e.message); }

  // Only add to Brevo when the customer ticked the marketing box.
  if (q.marketing) {
    try {
      const attributes = {
        FIRSTNAME: firstName, LASTNAME: lastName, MOBILE: phone,
        ADULTS: adults, CHILDREN: children, CHILD_AGES: ages.join(", "),
        DEPARTURE_AIRPORT: airports.join(", "),
        DESTINATION_WANTED: q.destination || q.holidayType,
        TRAVEL_DATES: when, BUDGET: q.budget, OPT_IN: true,
      };
      for (const k of Object.keys(attributes)) if (attributes[k] === "" || attributes[k] === undefined) delete attributes[k];
      await brevo("/contacts", { email, attributes, listIds: [Number(process.env.BREVO_MARKETING_LIST_ID || 3)], updateEnabled: true });
    } catch (e) { console.error("Brevo contact", e.message); }
  }

  return json({ ok: true });
};

export const config = { path: "/api/enquiry" };
