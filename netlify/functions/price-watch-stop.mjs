// Customer-facing "stop watching" link included in every alert email.
import { getWatch, saveWatch, esc, SITE } from "../lib/pw.mjs";

const page = (msg) => new Response(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Price Watch | Travel Agent Jake</title><link rel="stylesheet" href="/css/style.css"></head><body><section class="theme-light"><div class="wrap" style="text-align:center;padding:60px 16px;"><img src="/images/logo.png" alt="Travel Agent Jake" style="height:60px;margin-bottom:20px;"><h2>${msg}</h2><p><a class="btn btn-primary" href="${SITE}">Back to Travel Agent Jake</a></p></div></section></body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });

export default async (req) => {
  const u = new URL(req.url);
  const w = await getWatch(u.searchParams.get("id") || "");
  if (!w || w.token !== u.searchParams.get("t")) return page("Sorry, that link isn't valid.");
  if (w.status === "active") { w.status = "stopped"; w.stoppedAt = new Date().toISOString(); await saveWatch(w); }
  return page(`Done ${esc(w.firstName)}, I've stopped watching ${esc(w.hotel || "this holiday")} for you.`);
};

export const config = { path: "/api/price-watch-stop" };
