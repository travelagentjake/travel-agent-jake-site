// Every hour: close the enquiries that have had all 6 chases and gone quiet.
// The rulebook (netlify/lib/chase-engine.mjs, copied from js/chase-engine.js) decides. An enquiry only closes when the final chase was
// sent at least 4 days ago AND the customer has not opened a quote, replied or been written to since. Closing also takes the quote links away.
import { getStore } from "@netlify/blobs";
import C from "../lib/chase-engine.mjs";
import { loadChaseData, ctxFor } from "../lib/chase-ctx.mjs";
import { closeEnquiryQuotes } from "../lib/quote-close.mjs";

export default async () => {
  const es = getStore({ name: "enquiries", consistency: "strong" });
  const { blobs } = await es.list();
  const data = await loadChaseData();
  const now = Date.now(), closed = [];
  for (const b of blobs) {
    const q = await es.get(b.key, { type: "json" }).catch(() => null);
    if (!q || !["new", "contacted", "quoted"].includes(q.status || "new")) continue;
    if (q.kind === "prereg2028" || !q.chase || (q.chase.count || 0) < C.MAX_CHASES) continue;
    const p = C.plan(q, ctxFor(q, data, now), now);
    if (p.track !== "final" || p.interested || !p.closeAt || now < p.closeAt) continue;
    q.status = "closed"; q.statusAt = new Date().toISOString();
    (q.notesLog = q.notesLog || []).push({ t: q.statusAt, text: "Status changed to closed", auto: true });
    const slugs = await closeEnquiryQuotes(q.id).catch(() => []);
    q.notesLog.push({ t: q.statusAt, text: "Closed automatically after " + C.MAX_CHASES + " chases and no reply." + (slugs.length ? " Quote link closed: " + slugs.join(", ") + "." : ""), auto: true });
    await es.setJSON(q.id, q);
    closed.push(q.id);
  }
  return new Response(JSON.stringify({ closed }), { status: 200, headers: { "content-type": "application/json" } });
};

export const config = { schedule: "@hourly" };
