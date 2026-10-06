// Jake-only API for the enquiries dashboard (/enquiries-admin.html), behind env PW_ADMIN_KEY (header x-admin-key).
//   GET  -> all enquiries, newest first
//   POST { action: "update", id, status?, adminNotes? } | { action: "pdf", id } | { action: "reprint", id } | { action: "delete", id }
import { getStore } from "@netlify/blobs";
import { json } from "../lib/pw.mjs";
import { loadLogo, pdfName, b64, sendToPrinter } from "../lib/enquiry-lib.mjs";
import { buildEnquiryPdf } from "../lib/enquiry-pdf.mjs";

const STATUSES = ["new", "contacted", "quoted", "done", "closed"];
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
      q.status = b.status;
      q.statusAt = new Date().toISOString();
    }
    if (b.adminNotes !== undefined) q.adminNotes = String(b.adminNotes).slice(0, 2000);
    await s.setJSON(q.id, q);
    return json({ ok: true, enquiry: q });
  }
  if (b.action === "pdf") {
    const bytes = await buildEnquiryPdf(q, await loadLogo());
    return json({ ok: true, name: pdfName(q), pdf: b64(bytes) });
  }
  if (b.action === "reprint") {
    try {
      const bytes = await buildEnquiryPdf(q, await loadLogo());
      const sent = await sendToPrinter(q, bytes);
      return json({ ok: true, sent });
    } catch (e) { return json({ error: e.message }, 500); }
  }
  if (b.action === "delete") { await s.delete(q.id); return json({ ok: true, deleted: true }); }
  return json({ error: "Unknown action" }, 400);
};

export const config = { path: "/api/enquiry-admin" };
