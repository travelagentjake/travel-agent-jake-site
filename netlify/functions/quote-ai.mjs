// Jake-only: turn a plain English request ("take out anything over an hour's transfer, add sea view upgrades at £15pp a night")
// into quote amendments. Uses Claude through the Netlify AI Gateway (billed as Netlify credits, no API key to manage).
//   POST /api/quote-ai { slug, prompt, quote (the page's own data), amendments (what is saved now) }  header x-admin-key
//   -> { ok, summary, amendments }   Nothing is saved here: the dashboard shows the summary and Jake presses Save.
import { sanitizeAmendments } from "../lib/quote-amend.mjs";
import { json } from "../lib/pw.mjs";

const MODEL = process.env.QUOTE_AI_MODEL || "claude-sonnet-5-5";

const SYSTEM = `You edit holiday quotes for Jake, a self employed UK travel agent (Travel Agent Jake). A quote page is built from DATA, and Jake's changes are stored as AMENDMENTS applied on top of it. Jake writes what he wants changed; you return the complete new AMENDMENTS object.

AMENDMENTS shape (every field optional):
{
  "hidden": [hotel ids to hide],
  "edits": { "<hotel id>": { "why", "badge", "rooms", "total", "pp", "tax" } },   // only fields that change. total, pp and tax are numbers in GBP. tax = tourist tax paid at the hotel for the whole party
  "intro": "", "subtitle": "", "note": "",          // note = "A note from Jake" banner at the top of the quote
  "priceIntro": "", "extrasIntro": "",
  "touristTax": { "amount": number, "note": "" },   // default tourist tax for every hotel
  "extras": [ { "id", "cat", "title", "text", "price", "unit", "units", "separate", "group", "prices": { "<hotel id>": number }, "hotels": [hotel ids] } ],
  "dates": [ { "id", "label", "total", "pp", "note", "current", "hidden" } ], "datesIntro": ""   // other dates with prices. If given it REPLACES the full list, so start from the current list
}
Extras are optional add ons the customer can tick (airport parking, lounges, fast track security, pre booked seats, room upgrades, private transfers and so on). Every extra MUST have a real price that Jake has given you or that is already in the data: either "price" (unit price in GBP) or "prices" (total for the whole party per hotel id, for things that change by hotel such as room upgrades). An extra with no price is never shown, so do not add one without a price. unit is wording like "per person", "per car for 8 days", "for all five rooms". units is how many units to charge (leave it out for "per person", it then uses the party size). separate = true for things Jake books outside the tour operator booking (airport parking, lounges, fast track), so they are not added to the monthly direct debits. Never add links to other sellers. If "extras" is given it REPLACES the full list, so always include every extra that should stay, starting from the current list.

Rules:
- Start from CURRENT AMENDMENTS and change only what Jake asks for. Keep everything else exactly as it is.
- Never invent prices, ratings or facts. If Jake asks for something that needs a price he has not given, leave price out and say so in the summary.
- Plain British English, warm and simple. Never use dashes (no hyphens as punctuation, no en or em dashes) in any customer facing text.
- Hotel ids must come from DATA.
- Reply with ONLY a JSON object: {"summary": "one or two short sentences telling Jake what you changed", "amendments": { ... }}`;

export default async (req) => {
  if (!process.env.PW_ADMIN_KEY || req.headers.get("x-admin-key") !== process.env.PW_ADMIN_KEY) return json({ error: "Wrong admin key" }, 401);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const b = await req.json().catch(() => ({}));
  const prompt = String(b.prompt || "").trim().slice(0, 3000);
  if (!prompt) return json({ error: "Type what you would like changed." }, 400);
  const key = process.env.NETLIFY_AI_GATEWAY_KEY || process.env.ANTHROPIC_API_KEY;
  const base = process.env.NETLIFY_AI_GATEWAY_KEY ? (process.env.ANTHROPIC_BASE_URL || process.env.NETLIFY_AI_GATEWAY_URL) : (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com");
  if (!key || !base) return json({ error: "AI is not switched on for this site yet (Netlify AI Gateway or ANTHROPIC_API_KEY needed)." }, 503);

  const q = b.quote || {};
  const data = {
    customer: q.customer, title: q.title, subtitle: q.subtitle, intro: q.intro, partyLabel: q.partyLabel, partyCount: q.partyCount,
    departDate: q.departDate, dates: q.dates, datesIntro: q.datesIntro, priceIntro: q.priceIntro, touristTax: q.touristTax, extras: q.extras, extrasIntro: q.extrasIntro,
    hotels: (q.hotels || []).map((h) => ({ id: h.id, name: h.name, area: h.area, rating: h.rating, transfer_minutes: h.transfer, slides: h.slides, badge: h.badge, total: h.total, pp: h.pp, tax: h.tax, rooms: h.rooms, board: h.board, why: h.why })),
  };
  const user = `DATA:\n${JSON.stringify(data)}\n\nCURRENT AMENDMENTS:\n${JSON.stringify(b.amendments || {})}\n\nJAKE'S REQUEST:\n${prompt}`;

  let r;
  try {
    r = await fetch(base.replace(/\/$/, "") + "/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 4000, system: SYSTEM, messages: [{ role: "user", content: user }] }),
      signal: AbortSignal.timeout(24000),
    });
  } catch (e) { return json({ error: "The AI took too long to answer. Please try again." }, 504); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: "AI error: " + ((j.error && j.error.message) || r.status) }, 502);
  const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  const m = text.match(/\{[\s\S]*\}/);
  let parsed; try { parsed = JSON.parse(m ? m[0] : ""); } catch { return json({ error: "The AI reply could not be read. Try wording it a little differently." }, 502); }
  const ids = new Set((q.hotels || []).map((h) => h.id));
  const a = sanitizeAmendments(parsed.amendments || {});
  a.hidden = a.hidden.filter((id) => ids.has(id));
  for (const id of Object.keys(a.edits)) if (!ids.has(id)) delete a.edits[id];
  if (ids.size && a.hidden.length >= ids.size) return json({ error: "That would hide every hotel, so I have not done it." }, 400);
  return json({ ok: true, summary: String(parsed.summary || "Done.").slice(0, 600), amendments: a });
};

export const config = { path: "/api/quote-ai" };
