// Shared helpers for the enquiry form, the enquiries dashboard and the printer email.
import { SITE } from "./pw.mjs";

export const SENDER = () => process.env.PW_SENDER_EMAIL || "jake@travelagentjake.co.uk";
// HP ePrint address for Jake's printer. PRINT_ENQUIRIES=off switches auto printing off.
export const PRINT_EMAIL = () => process.env.PRINT_EMAIL || "tgeahereford@hpeprint.com";
export const printingOn = () => (process.env.PRINT_ENQUIRIES || "on").toLowerCase() !== "off";

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

// Emails just the PDF to the printer so it prints straight away.
export async function sendToPrinter(q, pdfBytes) {
  if (!printingOn()) return false;
  await brevo("/smtp/email", {
    sender: { name: "Travel Agent Jake Website", email: SENDER() },
    to: [{ email: PRINT_EMAIL() }],
    subject: `${q.kind === "prereg2028" ? "2028 pre-registration" : "Holiday enquiry"}: ${q.firstName} ${q.lastName}`,
    htmlContent: "<p>Enquiry sheet attached.</p>",
    attachment: [{ name: pdfName(q), content: b64(pdfBytes) }],
    tags: ["enquiry-print"],
  });
  return true;
}
