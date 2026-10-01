// Jake-only admin API behind env PW_ADMIN_KEY (header x-admin-key).
//   GET  -> all watches (newest first)
//   POST { action: "setUrl"|"stop"|"reactivate", id, url? }
import { json, listWatches, getWatch, saveWatch, operatorFromUrl, store } from "../lib/pw.mjs";

export default async (req) => {
  if (!process.env.PW_ADMIN_KEY || req.headers.get("x-admin-key") !== process.env.PW_ADMIN_KEY) return json({ error: "Wrong admin key" }, 401);
  if (req.method === "GET") {
    const all = (await listWatches()).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return json({ watches: all.map(({ token, ...w }) => w) });
  }
  const b = await req.json().catch(() => ({}));
  const w = await getWatch(b.id || "");
  if (!w) return json({ error: "Not found" }, 404);
  if (b.action === "setUrl") {
    const op = operatorFromUrl(b.url || "");
    if (!op) return json({ error: "Link must be from TUI, Jet2holidays, easyJet holidays or Crystal Ski" }, 400);
    Object.assign(w, { url: b.url.trim(), operator: op, needsLink: false, failCount: 0, firstPrice: null, lastPrice: null, lastAlertPrice: null, lastCheckedAt: null, lastResult: null, lastError: null, history: [] });
  } else if (b.action === "stop") w.status = "stopped";
  else if (b.action === "delete") { await store().delete(w.id); return json({ ok: true, deleted: true }); }
  else if (b.action === "reactivate") { w.status = "active"; w.failCount = 0; }
  else return json({ error: "Unknown action" }, 400);
  await saveWatch(w);
  return json({ ok: true });
};

export const config = { path: "/api/price-watch-admin" };
