// One-off setup (admin key): creates the Brevo contact fields and the
// "Price Watch - Alerts" list. Safe to run more than once.
import { json } from "../lib/pw.mjs";

export default async (req) => {
  if (!process.env.PW_ADMIN_KEY || req.headers.get("x-admin-key") !== process.env.PW_ADMIN_KEY) return json({ error: "Wrong admin key" }, 401);
  const key = process.env.BREVO_API_KEY;
  const h = { "api-key": key, "content-type": "application/json", accept: "application/json" };
  const out = {};
  for (const [name, type] of [["PW_OPERATOR", "text"], ["PW_HOTEL", "text"], ["PW_BOARD", "text"], ["PW_DEPART_MONTH", "text"], ["PW_ACTIVE", "boolean"]]) {
    const r = await fetch(`https://api.brevo.com/v3/contacts/attributes/normal/${name}`, { method: "POST", headers: h, body: JSON.stringify({ type }) });
    out[name] = r.status;
  }
  const lists = await (await fetch("https://api.brevo.com/v3/contacts/lists?limit=50", { headers: h })).json();
  let list = (lists.lists || []).find((l) => l.name === "Price Watch - Alerts");
  if (!list) {
    const r = await fetch("https://api.brevo.com/v3/contacts/lists", { method: "POST", headers: h, body: JSON.stringify({ name: "Price Watch - Alerts", folderId: 1 }) });
    list = await r.json();
  }
  out.priceWatchListId = list.id;
  return json(out);
};

export const config = { path: "/api/price-watch-setup" };
