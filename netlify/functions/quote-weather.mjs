// Weather for the interactive quotes: what a place is usually like in the month the customer travels.
//   GET /api/quote-weather?place=Nr+Alanya,+Antalya&country=Turkey&month=7
// Looks the place up with Open-Meteo's free geocoder, averages the last three years of real daily data for that
// month (Open-Meteo archive, no key needed) and adds sea temperature where there is one. Cached for 60 days in the
// Blobs store "quote-weather" so each place is only worked out once. Nothing about the customer is sent anywhere.
import { getStore } from "@netlify/blobs";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS" };
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, "content-type": "application/json", "cache-control": status === 200 ? "public, max-age=86400" : "no-store" } });
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const avg = (a) => { const v = a.filter((x) => x != null && !isNaN(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const r1 = (n) => n == null ? null : Math.round(n * 10) / 10;

async function geocode(place, country) {
  const tries = [];
  const parts = String(place || "").split(",").map((s) => s.replace(/^\s*(nr|near)\s+/i, "").trim()).filter(Boolean);
  for (const p of parts) tries.push(p + (country ? ", " + country : ""), p);
  if (country) tries.push(country);
  for (const q of tries) {
    try {
      const r = await fetch("https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name=" + encodeURIComponent(q), { signal: AbortSignal.timeout(6000) });
      const j = await r.json();
      const hits = (j.results || []);
      const hit = hits.find((h) => !country || !h.country || h.country.toLowerCase().includes(country.toLowerCase().split(" ")[0]) || country.toLowerCase().includes(h.country.toLowerCase())) || hits[0];
      if (hit) return { lat: hit.latitude, lon: hit.longitude, name: hit.name, country: hit.country };
    } catch {}
  }
  return null;
}

async function yearData(lat, lon, year, month) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const m = String(month).padStart(2, "0");
  const u = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${year}-${m}-01&end_date=${year}-${m}-${last}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration&timezone=auto`;
  const j = await fetch(u, { signal: AbortSignal.timeout(8000) }).then((r) => r.json());
  const d = j.daily || {};
  if (!d.time || !d.time.length) return null;
  const rain = d.precipitation_sum || [];
  return {
    high: avg(d.temperature_2m_max || []), low: avg(d.temperature_2m_min || []),
    rainMm: rain.reduce((s, x) => s + (x || 0), 0), rainDays: rain.filter((x) => (x || 0) >= 1).length,
    sun: avg((d.sunshine_duration || []).map((s) => s == null ? null : s / 3600)),
  };
}

async function seaTemp(lat, lon, year, month) {
  try {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate(), m = String(month).padStart(2, "0");
    const u = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&start_date=${year}-${m}-01&end_date=${year}-${m}-${last}&daily=sea_surface_temperature_max&timezone=auto`;
    const j = await fetch(u, { signal: AbortSignal.timeout(6000) }).then((r) => r.json());
    return avg(((j.daily || {}).sea_surface_temperature_max) || []);
  } catch { return null; }
}

function advice(w) {
  const out = [];
  if (w.high >= 33) out.push("Very hot in the middle of the day. Plan pool and beach time for the mornings and late afternoons, keep to the shade over lunch, and use factor 50 with plenty of water.");
  else if (w.high >= 28) out.push("Hot, proper sunbathing weather. Pack high factor sun cream, hats and plenty of swimwear.");
  else if (w.high >= 23) out.push("Warm and comfortable, lovely for the beach without being stifling. Sun cream still needed.");
  else if (w.high >= 17) out.push("Mild and pleasant for exploring. Pack layers, with something warmer for the evenings.");
  else out.push("Cool, so pack a proper coat and layers. Great for sightseeing rather than sunbathing.");
  if (w.low != null && w.low <= 14 && w.high >= 17) out.push("Evenings can feel cool, so take a light jacket or cardigan for dinner.");
  if (w.high >= 23 && w.low >= 22) out.push("Nights stay warm, so air conditioning in the room will be welcome.");
  if (w.rainDays <= 1) out.push("Rain is very rare at this time of year.");
  else if (w.rainDays <= 4) out.push("The odd shower is possible but it rarely lasts long.");
  else if (w.rainDays <= 9) out.push("Expect some showery days, so pack a light waterproof and plan a couple of indoor options.");
  else out.push("Rain is common in this month, so a waterproof and a flexible plan are a must.");
  if (w.sun != null && w.sun >= 10) out.push("Long sunny days with around " + Math.round(w.sun) + " hours of sunshine.");
  else if (w.sun != null && w.sun >= 7) out.push("Around " + Math.round(w.sun) + " hours of sunshine a day on average.");
  if (w.sea != null) {
    if (w.sea >= 25) out.push("The sea is bath warm at around " + Math.round(w.sea) + "°C.");
    else if (w.sea >= 21) out.push("The sea is lovely for swimming at around " + Math.round(w.sea) + "°C.");
    else if (w.sea >= 17) out.push("The sea is refreshing at around " + Math.round(w.sea) + "°C, fine once you are in.");
    else out.push("The sea is chilly at around " + Math.round(w.sea) + "°C, one for the brave.");
  }
  return out;
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const u = new URL(req.url);
  const place = String(u.searchParams.get("place") || "").trim().slice(0, 80), country = String(u.searchParams.get("country") || "").trim().slice(0, 40);
  const month = Number(u.searchParams.get("month"));
  if (!place && !country) return json({ error: "place needed" }, 400);
  if (!(month >= 1 && month <= 12)) return json({ error: "month needed" }, 400);
  const key = (place + "|" + country + "|" + month).toLowerCase().replace(/[^a-z0-9|]+/g, "-");
  const store = getStore({ name: "quote-weather", consistency: "strong" });
  const cached = await store.get(key, { type: "json" }).catch(() => null);
  if (cached && cached.at && Date.now() - Date.parse(cached.at) < 60 * 86400000) return json(cached);

  const g = await geocode(place, country);
  if (!g) return json({ error: "Place not found" }, 404);
  const thisYear = new Date().getUTCFullYear();
  const years = [thisYear - 1, thisYear - 2, thisYear - 3];
  const ys = (await Promise.all(years.map((y) => yearData(g.lat, g.lon, y, month).catch(() => null)))).filter(Boolean);
  if (!ys.length) return json({ error: "No weather data" }, 502);
  const w = {
    high: r1(avg(ys.map((y) => y.high))), low: r1(avg(ys.map((y) => y.low))),
    rainMm: Math.round(avg(ys.map((y) => y.rainMm))), rainDays: Math.round(avg(ys.map((y) => y.rainDays))),
    sun: r1(avg(ys.map((y) => y.sun))), sea: r1(await seaTemp(g.lat, g.lon, years[0], month)),
  };
  const out = { ok: true, at: new Date().toISOString(), place, country, resolved: g.name + (g.country ? ", " + g.country : ""), month, monthName: MONTHS[month - 1], years: years.length ? years[years.length - 1] + " to " + years[0] : "", ...w, advice: advice(w) };
  await store.setJSON(key, out).catch(() => {});
  return json(out);
};

export const config = { path: "/api/quote-weather" };
