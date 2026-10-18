// Shared clean-up for quote amendments (used by quote-config and quote-ai), so nothing odd is ever saved.
const clean = (s, n) => String(s ?? "").trim().slice(0, n);
const num = (v) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? undefined : Number(v));
const okLink = (u) => /^https:\/\/[^\s"'<>]+$/.test(String(u || "")) ? clean(u, 600) : "";

export function sanitizeExtras(list) {
  if (!Array.isArray(list)) return undefined;
  return list.slice(0, 40).map((e, i) => {
    e = e || {};
    const o = {
      id: clean(e.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, "") || "x" + (i + 1),
      cat: clean(e.cat, 60) || "Extras", title: clean(e.title, 120), text: clean(e.text, 600),
      unit: clean(e.unit, 60),
    };
    const p = num(e.price); if (p !== undefined) o.price = p;
    const u = num(e.units); if (u) o.units = u;
    if (e.from) o.from = true;
    if (e.separate) o.separate = true;
    if (e.group) o.group = clean(e.group, 40);
    if (Array.isArray(e.hotels) && e.hotels.length) o.hotels = e.hotels.map((x) => clean(x, 40)).slice(0, 20);
    if (e.prices && typeof e.prices === "object") {
      const pr = {};
      for (const [k, v] of Object.entries(e.prices).slice(0, 20)) { const n = num(v); if (n !== undefined) pr[clean(k, 40)] = n; }
      if (Object.keys(pr).length) o.prices = pr;
    }
    return o;
  }).filter((e) => e.title && (e.price !== undefined || e.prices));
}

export function sanitizeDates(list) {
  if (!Array.isArray(list)) return undefined;
  return list.slice(0, 30).map((d, i) => {
    d = d || {};
    const o = { id: clean(d.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, "") || "d" + (i + 1), label: clean(d.label, 120), note: clean(d.note, 200) };
    const t = num(d.total); if (t !== undefined) o.total = t;
    const p = num(d.pp); if (p !== undefined) o.pp = p;
    if (d.current) o.current = true;
    if (d.hidden) o.hidden = true;
    return o;
  }).filter((d) => d.label && d.total !== undefined);
}

export function sanitizeAmendments(a) {
  a = a || {};
  const edits = {};
  for (const [id, e] of Object.entries(a.edits || {}).slice(0, 40)) {
    const o = {};
    for (const k of ["why", "badge", "rooms"]) if (e && e[k]) o[k] = clean(e[k], 1500);
    for (const k of ["total", "pp", "tax"]) { const v = num(e && e[k]); if (v !== undefined) o[k] = v; }
    if (Object.keys(o).length) edits[clean(id, 40)] = o;
  }
  const out = {
    hidden: (Array.isArray(a.hidden) ? a.hidden : []).map((x) => clean(x, 40)).slice(0, 40),
    edits, intro: clean(a.intro, 2000), subtitle: clean(a.subtitle, 200), note: clean(a.note, 1500),
    priceIntro: clean(a.priceIntro, 1500), extrasIntro: clean(a.extrasIntro, 600),
  };
  const ex = sanitizeExtras(a.extras); if (ex) out.extras = ex;
  const ds = sanitizeDates(a.dates); if (ds) out.dates = ds;
  if (a.datesIntro) out.datesIntro = clean(a.datesIntro, 600);
  if (a.touristTax && (num(a.touristTax.amount) !== undefined || a.touristTax.note)) out.touristTax = { amount: num(a.touristTax.amount), note: clean(a.touristTax.note, 200) };
  return out;
}
