// Every hour, start the background booking check (see booking-sync-background.mjs).
import { SITE } from "../lib/pw.mjs";

export default async () => {
  await fetch(SITE + "/.netlify/functions/booking-sync-background", { method: "POST", headers: { "x-admin-key": process.env.PW_ADMIN_KEY || "" } }).catch(() => {});
  return new Response("", { status: 202 });
};

export const config = { schedule: "@hourly" };
