// Background job (up to 15 minutes, so a slow Google reply never times out):
// checks Jake's sales dashboard for new bookings and marks matching enquiries and quotes as booked.
// Started every hour by booking-sync-cron, or straight away from the dashboard's "Check bookings now" button.
import { syncBookings } from "../lib/booking-sync.mjs";

export default async (req) => {
  if (!process.env.PW_ADMIN_KEY || req.headers.get("x-admin-key") !== process.env.PW_ADMIN_KEY) return new Response("", { status: 401 });
  await syncBookings();
  return new Response("", { status: 202 });
};
