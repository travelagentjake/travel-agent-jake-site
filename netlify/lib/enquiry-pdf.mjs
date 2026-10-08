// Builds the A4 "customer enquiry sheet" PDF used for the email attachment,
// and the dashboard download. Pure JS (pdf-lib), no files.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const BLUE = rgb(0x0b / 255, 0x4c / 255, 0xc4 / 255);
const YELLOW = rgb(0xff / 255, 0xd5 / 255, 0x20 / 255);
const INK = rgb(0x10 / 255, 0x14 / 255, 0x2b / 255);
const MUTED = rgb(0x6b / 255, 0x71 / 255, 0x90 / 255);
const LINE = rgb(0xdf / 255, 0xe3 / 255, 0xee / 255);
const WHITE = rgb(1, 1, 1);

export const roomText = (r) => `${r.adults} adult${Number(r.adults) === 1 ? "" : "s"}` + (Number(r.children) ? `, ${r.children} child${Number(r.children) === 1 ? "" : "ren"} (ages ${(r.childAges || []).join(", ")})` : "");

// Standard fonts only cover WinAnsi, so tidy up anything outside it.
const MAP = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", "•": "-", " ": " ", "€": "EUR " };
const safe = (s) =>
  String(s ?? "")
    .replace(/[‘’“”–—…• €]/g, (c) => MAP[c])
    .replace(/[\r\t]/g, " ")
    .replace(/[^\n\x20-\x7E¡-ÿ]/g, "?");

function wrap(font, size, text, maxW) {
  const out = [];
  for (const para of safe(text).split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const t = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(t, size) <= maxW) line = t;
      else {
        if (line) out.push(line);
        // very long single word: hard split
        let w = word;
        while (font.widthOfTextAtSize(w, size) > maxW) {
          let i = w.length;
          while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > maxW) i--;
          out.push(w.slice(0, i));
          w = w.slice(i);
        }
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

const ukDate = (iso) => {
  try {
    return new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};
const nice = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return "";
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
};

export async function buildEnquiryPdf(q, logoPng) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const W = 595.28, H = 841.89, M = 36;
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pre = q.kind === "prereg2028";

  const text = (t, x, y, { size = 10, font = reg, color = INK } = {}) => page.drawText(safe(t), { x, y, size, font, color });
  const rect = (x, y, w, h, color) => page.drawRectangle({ x, y, width: w, height: h, color });

  // ---- header ----
  rect(0, H - 92, W, 92, WHITE);
  let drewLogo = false;
  if (logoPng) {
    try {
      const img = await pdf.embedPng(logoPng);
      const h = 44, w = (img.width / img.height) * h;
      page.drawImage(img, { x: M, y: H - 22 - h, width: w, height: h });
      drewLogo = true;
    } catch {}
  }
  if (!drewLogo) text("Travel Agent Jake", M, H - 54, { size: 20, font: bold, color: BLUE });
  const tag = safe(pre ? "2028 PRE-REGISTRATION" : "HOLIDAY ENQUIRY");
  const tw = bold.widthOfTextAtSize(tag, 10) + 22;
  rect(W - M - tw, H - 52, tw, 24, YELLOW);
  text(tag, W - M - tw + 11, H - 44, { size: 10, font: bold });
  rect(0, H - 96, W, 4, YELLOW);

  // blue name band
  rect(0, H - 168, W, 72, BLUE);
  const name = `${q.firstName || ""} ${q.lastName || ""}`.trim();
  text(name, M, H - 133, { size: 22, font: bold, color: WHITE });
  text(`Received ${ukDate(q.createdAt)}`, M, H - 152, { size: 9.5, color: WHITE });
  const ref = `Ref ${String(q.id || "").toUpperCase()}`;
  text(ref, W - M - bold.widthOfTextAtSize(safe(ref), 9.5), H - 152, { size: 9.5, font: bold, color: WHITE });

  let y = H - 168 - 22;

  // ---- helpers ----
  const section = (title) => {
    y -= 6;
    text(title.toUpperCase(), M, y, { size: 9.5, font: bold, color: BLUE });
    y -= 5;
    rect(M, y, W - 2 * M, 1.5, BLUE);
    y -= 6;
  };
  // two column grid of label/value
  const colW = (W - 2 * M) / 2;
  const grid = (items) => {
    const list = items.filter(([, v]) => v && String(v).trim());
    for (let i = 0; i < list.length; i += 2) {
      const pair = list.slice(i, i + 2);
      const cells = pair.map(([l, v]) => ({ l, lines: wrap(bold, 11, v, colW - 16) }));
      const lines = Math.max(...cells.map((c) => c.lines.length));
      const h = 12 + lines * 13.5 + 8;
      pair.forEach(([,], k) => {
        const c = cells[k];
        const x = M + k * colW;
        text(c.l.toUpperCase(), x + 2, y - 11, { size: 7.5, font: bold, color: MUTED });
        c.lines.forEach((ln, j) => text(ln, x + 2, y - 11 - 13.5 - j * 13.5 + 2, { size: 11, font: bold }));
      });
      y -= h;
      rect(M, y + 2, W - 2 * M, 0.6, LINE);
    }
    y -= 4;
  };

  const rooms = Array.isArray(q.rooms) ? q.rooms : [];
  const agesText = (q.childAges || []).map((a, i) => `Child ${i + 1}: ${a}`).join(", ");
  const party = `${q.adults || 1} adult${Number(q.adults) === 1 ? "" : "s"}` + (Number(q.children) ? `, ${q.children} child${Number(q.children) === 1 ? "" : "ren"}` : "");
  const ages = (q.childAges || []).map((a, i) => `Child ${i + 1}: ${/^\d+$/.test(a) ? a + " yrs" : a}`).join("   ");
  const when = [nice(q.departDate) && `from ${nice(q.departDate)}`, q.dateFlex, q.dateNotes].filter(Boolean).join(", ");

  section("Contact");
  grid([
    ["Email", q.email],
    ["Mobile / WhatsApp", q.phone],
  ]);

  section("The holiday");
  grid([
    [pre ? "What type of holiday are you after?" : "Type of holiday", q.holidayType],
    ["Which month would you like to depart?", q.month],
    ["Where would you like to go?", q.destination],
    ["Hotel in mind", q.hotel],
    ["Preferred departure date", nice(q.departDate)],
    ["How flexible are your dates?", q.dateFlex],
    ["Date notes", q.dateNotes],
    ["How many nights?", q.nights],
    ["Which airports can you fly from?", (q.airports || []).join(", ")],
  ]);

  section("Who's travelling");
  grid(rooms.length ? [
    ["How many rooms?", String(rooms.length)],
    ...rooms.map((r, i) => [`Room ${i + 1}`, roomText(r)]),
    ["Total travelling", party],
  ] : [
    ["Adults", String(q.adults || 1)],
    ["Children", String(q.children || 0)],
    ["Child ages", agesText],
  ]);

  section(pre ? "Board and budget" : "Stay and budget");
  grid([
    ["Type of accommodation", q.accommodation],
    ["Minimum star rating", q.stars],
    ["Board basis", q.board],
    [pre ? "Total budget for everyone" : "Budget for the whole holiday", q.budget],
    [pre ? "Ready to pay a deposit when 2028 launches?" : "When are you looking to book?", pre ? q.deposit : q.whenBook],
    [pre ? "How did you find me?" : "How did you hear about me?", q.source],
  ]);

  // notes box
  section(pre ? "Anything else I should know?" : "Anything else?");
  const noteLines = wrap(reg, 10.5, q.notes || "Nothing added.", W - 2 * M - 20);
  const maxLines = Math.max(2, Math.floor((y - 176) / 14));
  const shown = noteLines.slice(0, maxLines);
  if (noteLines.length > maxLines) shown[maxLines - 1] = shown[maxLines - 1].replace(/.{0,3}$/, "...");
  const bh = Math.max(40, shown.length * 14 + 18);
  rect(M, y - bh, W - 2 * M, bh, rgb(0.96, 0.97, 0.99));
  shown.forEach((ln, i) => text(ln, M + 10, y - 16 - i * 14, { size: 10.5, color: q.notes ? INK : MUTED }));
  y -= bh + 10;
  text(`Marketing emails: ${q.marketing ? "Yes, opted in" : "No"}`, M, y, { size: 8.5, color: MUTED });
  y -= 14;

  // ---- office use ----
  const boxTop = 150, bottom = 52;
  rect(M, bottom, W - 2 * M, boxTop - bottom, WHITE);
  page.drawRectangle({ x: M, y: bottom, width: W - 2 * M, height: boxTop - bottom, borderColor: INK, borderWidth: 1.2 });
  text("OFFICE USE", M + 10, boxTop - 16, { size: 9, font: bold, color: BLUE });
  const checks = ["Contacted", "Quote sent", "Booked", "Closed"];
  checks.forEach((c, i) => {
    const x = M + 10 + i * 124;
    page.drawRectangle({ x, y: boxTop - 38, width: 11, height: 11, borderColor: INK, borderWidth: 1 });
    text(c, x + 17, boxTop - 36, { size: 10 });
  });
  text("Notes", M + 10, boxTop - 56, { size: 8, font: bold, color: MUTED });
  for (let i = 0; i < 2; i++) rect(M + 10, boxTop - 70 - i * 14, W - 2 * M - 20, 0.6, LINE);

  // ---- footer ----
  rect(M, 40, W - 2 * M, 0.6, LINE);
  text("Travel Agent Jake  |  ABTA P8503  |  travelagentjake.co.uk  |  Internal use only", M, 28, { size: 8, color: MUTED });

  return pdf.save();
}
