// Jake-only API for the enquiries dashboard (/enquiries-admin.html), behind env PW_ADMIN_KEY (header x-admin-key).
//   GET  -> all enquiries, newest first
//   POST { action: "edit", id, fields, rooms? } (correct the details) | { action: "update", id, status?, adminNotes? } | { action: "note", id, text } | { action: "pdf", id } | { action: "delete", id }
// Every note and status change is kept in notesLog [{ t, text, auto }] so there is a full history of what was done.
import { getStore } from "@netlify/blobs";
import { json } from "../lib/pw.mjs";
import { closeEnquiryQuotes } from "../lib/quote-close.mjs";
import { loadLogo, pdfName, b64 } from "../lib/enquiry-lib.mjs";
import { buildEnquiryPdf } from "../lib/enquiry-pdf.mjs";

const STATUSES = ["new", "contacted", "quoted", "booked", "done", "closed"];
const store = () => getStore({ name: "enquiries", consistency: "strong" });

export default async (req) => {
  if (!process.env.PW_ADMIN_KEY || req.headers.get("x-admin-key") !== process.env.PW_ADMIN_KEY) return json({ error: "Wrong admin key" }, 401);
  const s = store();

  if (req.method === "GET") {
    const { blobs } = await s.list();
    const all = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);
    all.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return json({ enquiries: all.map((q) => ({ status: "new", adminNotes: "", ...q })) });
  }

  const b = await req.json().catch(() => ({}));
  const q = await s.get(String(b.id || ""), { type: "json" }).catch(() => null);
  if (!q) return json({ error: "Not found" }, 404);

  if (b.action === "update") {
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) return json({ error: "Unknown status" }, 400);
      if (q.status !== b.status) (q.notesLog = q.notesLog || []).push({ t: new Date().toISOString(), text: "Status changed to " + b.status, auto: true });
      q.status = b.status;
      q.statusAt = new Date().toISOString();
    }
    if (b.adminNotes !== undefined) q.adminNotes = String(b.adminNotes).slice(0, 2000);
    if (b.status === "closed") {
      const gone = await closeEnquiryQuotes(q.id).catch(() => []);
      if (gone.length) (q.notesLog = q.notesLog || []).push({ t: new Date().toISOString(), text: "Quote link closed for the customer: " + gone.join(", "), auto: true });
    }
    await s.setJSON(q.id, q);
    return json({ ok: true, enquiry: q });
  }
  if (b.action === "edit") {
    // Jake corrects an enquiry after checking with the client. The first version the customer sent is kept in originalDetails.
    const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
    const LIM = { firstName: 60, lastName: 60, email: 160, phone: 40, holidayType: 60, destination: 300, dateFlex: 60, dateNotes: 300, nights: 20, accommodation: 40, stars: 30, board: 120, budget: 80, whenBook: 40, notes: 2000, source: 60, month: 30, hotel: 200, deposit: 80 };
    const f = b.fields && typeof b.fields === "object" ? b.fields : {};
    if (f.email !== undefined && clean(f.email, 160) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(f.email, 160))) return json({ error: "That email address does not look right" }, 400);
    if (f.departDate !== undefined && clean(f.departDate, 10) && !/^\d{4}-\d{2}-\d{2}$/.test(clean(f.departDate, 10))) return json({ error: "Use a date like 2027-05-01" }, 400);
    if (!q.originalDetails) q.originalDetails = JSON.parse(JSON.stringify({ ...Object.fromEntries([...Object.keys(LIM), "departDate", "airports", "rooms", "adults", "children", "childAges"].map((k) => [k, q[k]])) }));
    for (const k of Object.keys(LIM)) if (f[k] !== undefined) q[k] = clean(f[k], LIM[k]);
    if (f.departDate !== undefined) q.departDate = clean(f.departDate, 10);
    if (f.airports !== undefined) q.airports = (Array.isArray(f.airports) ? f.airports : String(f.airports).split(",")).map((a) => clean(a, 40)).filter(Boolean).slice(0, 10);
    const num = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : d; };
    if (Array.isArray(b.rooms)) {
      const rooms = [];
      for (const r of b.rooms.slice(0, 10)) {
        const ra = num(r.adults, 1, 20, 1), rc = num(r.children, 0, 10, 0);
        const ages = (Array.isArray(r.childAges) ? r.childAges : String(r.childAges || "").split(",")).map((a) => clean(a, 20)).filter(Boolean).slice(0, rc);
        rooms.push({ adults: ra, children: rc, childAges: ages });
      }
      q.rooms = rooms;
      if (rooms.length) { q.adults = rooms.reduce((n, r) => n + r.adults, 0); q.children = rooms.reduce((n, r) => n + r.children, 0); q.childAges = rooms.flatMap((r) => r.childAges); }
    }
    if (!(q.rooms && q.rooms.length)) {
      if (f.adults !== undefined) q.adults = num(f.adults, 1, 40, q.adults || 1);
      if (f.children !== undefined) q.children = num(f.children, 0, 20, q.children || 0);
      if (f.childAges !== undefined) q.childAges = String(f.childAges).split(",").map((a) => clean(a, 20)).filter(Boolean).slice(0, 20);
    }
    q.editedAt = new Date().toISOString();
    (q.notesLog = q.notesLog || []).push({ t: q.editedAt, text: "Details edited by Jake. Now " + q.adults + " adult" + (q.adults === 1 ? "" : "s") + (q.children ? ", " + q.children + " child" + (q.children === 1 ? "" : "ren") : "") + " travelling.", auto: true });
    await s.setJSON(q.id, q);
    return json({ ok: true, enquiry: q });
  }
  if (b.action === "note") {
    const text = String(b.text || "").trim().slice(0, 2000);
    if (!text) return json({ error: "Type a note first" }, 400);
    (q.notesLog = q.notesLog || []).push({ t: new Date().toISOString(), text });
    q.notesLog = q.notesLog.slice(-300);
    await s.setJSON(q.id, q);
    return json({ ok: true, enquiry: q });
  }
  if (b.action === "pdf") {
    const bytes = await buildEnquiryPdf(q, await loadLogo());
    return json({ ok: true, name: pdfName(q), pdf: b64(bytes) });
  }
  if (b.action === "delete") { await s.delete(q.id); return json({ ok: true, deleted: true }); }
  return json({ error: "Unknown action" }, 400);
};

export const config = { path: "/api/enquiry-admin" };
