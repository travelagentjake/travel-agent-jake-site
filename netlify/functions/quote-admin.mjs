// Jake-only API for the Quotes tab of the business dashboard (/enquiries-admin.html), behind env PW_ADMIN_KEY (header x-admin-key).
//   GET  -> { views: { <slug>: { views, firstView, lastView, opens[] } }, requests: [ quote requests, newest first ] }
//   POST { action: "request-create", enquiryId?, customer?, slug, title, urls[], notes, chatNotes, files[{ name, type, b64 }] }
//        { action: "request-update", id, status?, slug?, adminNotes? }
//        { action: "request-file", id, index }   -> { name, type, b64 }
//        { action: "request-delete", id }
//        { action: "views-reset", slug }
//        { action: "quote-status", slug, status: "open" | "booked" | "closed" }  (booked also marks the customer's enquiry booked)
//        { action: "sync-bookings" }  starts a check of the sales dashboard for new bookings
// Quote requests and their uploaded files live in Netlify Blobs ("quote-requests", "quote-files"), never in the git repo.
// A request for someone who is not already in the dashboard also creates their customer profile in "enquiries".
import { getStore } from "@netlify/blobs";
import { json, SITE } from "../lib/pw.mjs";

const STATUSES = ["requested", "building", "sent", "booked", "closed"];
const st = (name) => getStore({ name, consistency: "strong" });
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clean = (s, n = 4000) => String(s ?? "").trim().slice(0, n);
const MAX_FILE_B64 = 6_000_000;

export default async (req) => {
  if (!process.env.PW_ADMIN_KEY || req.headers.get("x-admin-key") !== process.env.PW_ADMIN_KEY) return json({ error: "Wrong admin key" }, 401);
  const views = st("quote-views"), reqs = st("quote-requests"), files = st("quote-files");

  if (req.method === "GET") {
    const vlist = (await views.list()).blobs;
    const v = {};
    await Promise.all(vlist.map(async (b) => { v[b.key] = await views.get(b.key, { type: "json" }).catch(() => null); }));
    const rlist = (await reqs.list()).blobs;
    const r = (await Promise.all(rlist.map((b) => reqs.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);
    r.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const sl = (await st("quote-status").list()).blobs, statuses = {};
    await Promise.all(sl.map(async (b) => { statuses[b.key] = await st("quote-status").get(b.key, { type: "json" }).catch(() => null); }));
    const sync = await st("booking-sync").get("last", { type: "json" }).catch(() => null);
    return json({ views: v, requests: r, statuses, sync });
  }

  const b = await req.json().catch(() => ({}));

  if (b.action === "request-create") {
    const slug = clean(b.slug, 40).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(slug)) return json({ error: "The quote link can only use letters, numbers and hyphens." }, 400);
    let enquiryId = clean(b.enquiryId, 40);
    const c = b.customer || {};
    if (!enquiryId) {
      if (!clean(c.firstName)) return json({ error: "Please add the customer's first name." }, 400);
      const enq = {
        id: newId(), kind: "enquiry", createdAt: new Date().toISOString(), status: "contacted",
        firstName: clean(c.firstName, 60), lastName: clean(c.lastName, 60), email: clean(c.email, 120), phone: clean(c.phone, 40),
        destination: clean(c.destination, 200), notes: clean(c.notes, 2000), source: "Added from the dashboard",
      };
      await st("enquiries").setJSON(enq.id, enq);
      enquiryId = enq.id;
    }
    const id = newId();
    const fileMeta = [];
    const list = Array.isArray(b.files) ? b.files.slice(0, 10) : [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i] || {};
      const data = String(f.b64 || "");
      if (!data || data.length > MAX_FILE_B64) continue;
      await files.setJSON(`${id}/${i}`, { name: clean(f.name, 160), type: clean(f.type, 80), b64: data });
      fileMeta.push({ index: i, name: clean(f.name, 160), type: clean(f.type, 80), size: Math.round(data.length * 0.75) });
    }
    const rq = {
      id, enquiryId, createdAt: new Date().toISOString(), status: "requested", slug,
      customerName: [clean(c.firstName, 60), clean(c.lastName, 60)].filter(Boolean).join(" ") || clean(b.customerName, 120),
      title: clean(b.title, 200), urls: (Array.isArray(b.urls) ? b.urls : []).map((u) => clean(u, 2000)).filter(Boolean).slice(0, 30),
      notes: clean(b.notes, 6000), chatNotes: clean(b.chatNotes, 12000), files: fileMeta, adminNotes: "",
    };
    await reqs.setJSON(id, rq);
    return json({ ok: true, request: rq });
  }

  if (b.action === "quote-status") {
    const slug = clean(b.slug, 40).toLowerCase();
    if (!["open", "booked", "closed"].includes(b.status)) return json({ error: "Unknown status" }, 400);
    const rec = { status: b.status, at: new Date().toISOString(), via: "dashboard" };
    await st("quote-status").setJSON(slug, rec);
    if (b.status === "booked") {
      const reg = await fetch(SITE + "/quotes/quotes.json?cb=" + Date.now()).then((x) => x.json()).catch(() => ({ quotes: [] }));
      const q = (reg.quotes || []).find((x) => x.slug === slug);
      if (q && q.enquiryId) {
        const es = st("enquiries"), e = await es.get(q.enquiryId, { type: "json" }).catch(() => null);
        if (e && e.status !== "booked") { e.status = "booked"; e.statusAt = rec.at; await es.setJSON(e.id, e); }
      }
    }
    return json({ ok: true, status: rec });
  }

  if (b.action === "sync-bookings") {
    await fetch(SITE + "/.netlify/functions/booking-sync-background", { method: "POST", headers: { "x-admin-key": process.env.PW_ADMIN_KEY } }).catch(() => {});
    return json({ ok: true, started: true });
  }

  if (b.action === "views-reset") {
    const slug = clean(b.slug, 40).toLowerCase();
    await views.delete(slug);
    return json({ ok: true });
  }

  const rq = await reqs.get(clean(b.id, 40), { type: "json" }).catch(() => null);
  if (!rq) return json({ error: "Not found" }, 404);

  if (b.action === "request-update") {
    if (b.status !== undefined) { if (!STATUSES.includes(b.status)) return json({ error: "Unknown status" }, 400); rq.status = b.status; rq.statusAt = new Date().toISOString(); }
    if (b.slug !== undefined) rq.slug = clean(b.slug, 40).toLowerCase();
    if (b.adminNotes !== undefined) rq.adminNotes = clean(b.adminNotes, 4000);
    await reqs.setJSON(rq.id, rq);
    return json({ ok: true, request: rq });
  }
  if (b.action === "request-file") {
    const f = await files.get(`${rq.id}/${Number(b.index) || 0}`, { type: "json" }).catch(() => null);
    if (!f) return json({ error: "File not found" }, 404);
    return json({ ok: true, ...f });
  }
  if (b.action === "request-delete") {
    for (const f of rq.files || []) await files.delete(`${rq.id}/${f.index}`).catch(() => {});
    await reqs.delete(rq.id);
    return json({ ok: true, deleted: true });
  }
  return json({ error: "Unknown action" }, 400);
};

export const config = { path: "/api/quote-admin" };
