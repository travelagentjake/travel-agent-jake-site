// Closing a quote or an enquiry in the dashboard takes the customer's quote link away, so the work cannot be passed on.
// Step 1 (instant): the quote's status becomes "closed" in the Netlify Blobs store "quote-status". quote.js reads it and shows
//   "no longer available" instead of the quote.
// Step 2 (within about 15 minutes): the GitHub Action "Close quotes" replaces the quote's page with a bare stub, so the
//   quote's details are no longer served at all. The old page stays in git history, so Jake can ask for it to be restored.
import { getStore } from "@netlify/blobs";

const st = (name) => getStore({ name, consistency: "strong" });

export async function closeSlug(slug, via) {
  slug = String(slug || "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(slug)) return false;
  await st("quote-status").setJSON(slug, { status: "closed", at: new Date().toISOString(), via: via || "dashboard" });
  return true;
}

// every quote link that belongs to an enquiry (from the published register and from the quote requests)
export async function slugsForEnquiry(enquiryId) {
  const slugs = new Set();
  if (!enquiryId) return [];
  const reg = await fetch("https://taj-quotes.pages.dev/quotes.json?cb=" + Date.now(), { signal: AbortSignal.timeout(5000) }).then((r) => r.json()).catch(() => ({ quotes: [] }));
  for (const q of reg.quotes || []) if (q.enquiryId === enquiryId && q.slug) slugs.add(q.slug);
  const reqs = st("quote-requests");
  const list = (await reqs.list().catch(() => ({ blobs: [] }))).blobs;
  await Promise.all(list.map(async (b) => { const r = await reqs.get(b.key, { type: "json" }).catch(() => null); if (r && r.enquiryId === enquiryId && r.slug) slugs.add(String(r.slug).toLowerCase()); }));
  return [...slugs];
}

export async function closeEnquiryQuotes(enquiryId) {
  const slugs = await slugsForEnquiry(enquiryId);
  for (const s of slugs) await closeSlug(s, "enquiry closed");
  // the quote requests for this customer move to Closed too, so they sit in the closed section of the Quotes tab
  const reqs = st("quote-requests"), list = (await reqs.list().catch(() => ({ blobs: [] }))).blobs;
  await Promise.all(list.map(async (b) => {
    const r = await reqs.get(b.key, { type: "json" }).catch(() => null);
    if (r && r.enquiryId === enquiryId && r.status !== "closed" && r.status !== "booked") { r.status = "closed"; r.statusAt = new Date().toISOString(); await reqs.setJSON(r.id, r); }
  }));
  return slugs;
}
