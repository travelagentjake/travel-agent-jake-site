// Shared helpers for the Price Watch tool (travelagentjake.co.uk/price-watch).
// Watches live in the Netlify Blobs store "price-watches", one JSON blob per
// watch keyed by its id. Customer data never goes into the git repo.
import { getStore } from "@netlify/blobs";

export const SITE = "https://travelagentjake.co.uk";
export const WHATSAPP = "447899290262";
export const OPERATORS = {
  tui: { name: "TUI", hosts: ["tui.co.uk"] },
  jet2: { name: "Jet2holidays", hosts: ["jet2holidays.com"] },
  easyjet: { name: "easyJet holidays", hosts: ["easyjet.com"] },
};
// Smallest change in the TOTAL holiday price that triggers an email.
export const MIN_CHANGE_GBP = Number(process.env.PW_MIN_CHANGE_GBP || 20);
// Consecutive failed checks before Jake is told a watch needs attention.
export const MAX_FAILS = 3;

export const store = () => getStore({ name: "price-watches", consistency: "strong" });

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const gbp = (n) => "£" + Number(n).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function operatorFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    for (const [key, op] of Object.entries(OPERATORS)) {
      if (op.hosts.some((h) => host === h || host.endsWith("." + h))) return key;
    }
  } catch {}
  return null;
}

export const randomId = (bytes = 12) => {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
};

export async function listWatches() {
  const s = store();
  const { blobs } = await s.list();
  const out = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })));
  return out.filter(Boolean);
}

export const saveWatch = (w) => store().setJSON(w.id, w);
export const getWatch = (id) => store().get(id, { type: "json" });

// ---------------- Brevo ----------------
async function brevo(path, body) {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY not set");
  const r = await fetch("https://api.brevo.com/v3" + path, {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok && r.status !== 204) throw new Error(`Brevo ${path} ${r.status}: ${await r.text()}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}

export async function upsertContact(w) {
  const listIds = [Number(process.env.BREVO_PRICE_WATCH_LIST_ID)].filter(Boolean);
  if (w.marketing && process.env.BREVO_MARKETING_LIST_ID) listIds.push(Number(process.env.BREVO_MARKETING_LIST_ID));
  const attributes = {
    FIRSTNAME: w.firstName,
    DESTINATION_WANTED: w.destination || w.hotel || "",
    TRAVEL_DATES: [w.departDate, w.nights ? `${w.nights} nights` : ""].filter(Boolean).join(", "),
    ADULTS: Number(w.adults) || undefined,
    CHILDREN: Number(w.children) || 0,
    CHILD_AGES: w.childAges || "",
    DEPARTURE_AIRPORT: w.airport || "",
    PW_OPERATOR: OPERATORS[w.operator]?.name || w.operator || "",
    PW_HOTEL: w.hotel || "",
    PW_BOARD: w.board || "",
    PW_DEPART_MONTH: (w.departDate || "").slice(0, 7),
    PW_ACTIVE: true,
  };
  if (w.phone) attributes.WHATSAPP = w.phone;
  if (w.marketing) attributes.OPT_IN = true;
  for (const k of Object.keys(attributes)) if (attributes[k] === undefined) delete attributes[k];
  return brevo("/contacts", { email: w.email, attributes, listIds, updateEnabled: true });
}

export async function sendEmail({ to, toName, subject, html, replyTo = true }) {
  return brevo("/smtp/email", {
    sender: { name: "Travel Agent Jake", email: process.env.PW_SENDER_EMAIL || "jake@travelagentjake.co.uk" },
    to: [{ email: to, name: toName || undefined }],
    replyTo: replyTo ? { email: process.env.PW_SENDER_EMAIL || "jake@travelagentjake.co.uk", name: "Travel Agent Jake" } : undefined,
    subject,
    htmlContent: html,
    tags: ["price-watch"],
  });
}

export const jakeEmail = () => process.env.PW_NOTIFY_EMAIL || "jake@travelagentjake.co.uk";

// ---------------- Email layout ----------------
export function emailShell(inner) {
  return `<!doctype html><html><body style="margin:0;background:#f2f5fb;font-family:Arial,Helvetica,sans-serif;color:#14213d;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f5fb;padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;">
<tr><td style="background:#ffffff;padding:20px 28px;border-bottom:5px solid #FFD21F;"><img src="${SITE}/images/logo.png" alt="Travel Agent Jake" height="56" style="display:block;height:56px;"></td></tr>
<tr><td style="padding:28px;font-size:16px;line-height:1.55;">${inner}</td></tr>
<tr><td style="background:#004AAD;color:#ffffff;padding:18px 28px;font-size:12px;line-height:1.5;">Travel Agent Jake, ABTA P8503. Holidays booked with me are made through Club Voyages and are financially protected.<br>Prices are checked once a day on the tour operator's own website and can change at any time. Final prices are confirmed at the time of booking.</td></tr>
</table></td></tr></table></body></html>`;
}

export const button = (href, label, bg = "#FFD21F", fg = "#14213d") =>
  `<a href="${href}" style="display:inline-block;background:${bg};color:${fg};text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:999px;margin:6px 6px 6px 0;">${label}</a>`;

export function holidaySummary(w) {
  const bits = [
    w.hotel && `<strong>${esc(w.hotel)}</strong>`,
    w.destination && esc(w.destination),
    OPERATORS[w.operator] && `with ${OPERATORS[w.operator].name}`,
    w.departDate && `departing ${esc(new Date(w.departDate + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}`,
    w.nights && `${esc(w.nights)} nights`,
    w.airport && `from ${esc(w.airport)}`,
    w.board && esc(w.board),
  ].filter(Boolean);
  return bits.join(", ");
}

export const stopLink = (w) => `${SITE}/api/price-watch-stop?id=${w.id}&t=${w.token}`;
export const waLink = (text) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
