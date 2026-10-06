// Shared helpers for the enquiry form and the enquiries dashboard.
import { SITE } from "./pw.mjs";

export const SENDER = () => process.env.PW_SENDER_EMAIL || "jake@travelagentjake.co.uk";
export async function brevo(path, body) {
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

export async function loadLogo() {
  try {
    const r = await fetch(SITE + "/images/logo.png", { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch { return null; }
}

export const pdfName = (q) =>
  `enquiry-${String(q.firstName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${String(q.lastName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`.replace(/-+/g, "-");

export const b64 = (bytes) => Buffer.from(bytes).toString("base64");
