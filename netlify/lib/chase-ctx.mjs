// What the chase rulebook needs to know about a customer's quotes: how many, when sent, how often opened.
import { getStore } from "@netlify/blobs";

export async function loadChaseData() {
  const reg = await fetch("https://taj-quotes.pages.dev/quotes.json?cb=" + Date.now(), { signal: AbortSignal.timeout(8000) }).then((r) => r.json()).catch(() => ({ quotes: [] }));
  const vs = getStore({ name: "quote-views", consistency: "strong" });
  const list = (await vs.list().catch(() => ({ blobs: [] }))).blobs;
  const views = {};
  await Promise.all(list.map(async (b) => { views[b.key] = await vs.get(b.key, { type: "json" }).catch(() => null); }));
  return { quotes: reg.quotes || [], views };
}

export function ctxFor(enq, data, now = Date.now()) {
  const mine = data.quotes.filter((q) => q.enquiryId && String(q.enquiryId).toLowerCase() === String(enq.id).toLowerCase());
  let nViews = 0, last = 0, sent = 0, recent = 0;
  for (const q of mine) {
    const v = data.views[q.slug] || {};
    nViews += v.views || 0;
    const lv = v.lastView ? Date.parse(v.lastView) : 0; if (lv > last) last = lv;
    const c = q.created ? Date.parse(q.created + "T12:00:00Z") : 0; if (c > sent) sent = c;
    for (const o of v.opens || []) if (now - Date.parse(o.t) < 7 * 86400000) recent++;
  }
  return { quotes: mine.map((q) => ({ slug: q.slug, title: q.title, created: q.created, url: "https://quotes.travelagentjake.co.uk/" + q.slug })), views: nViews, lastView: last, sentAt: sent, recentViews: recent };
}
