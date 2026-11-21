// Stripe calls this when a Holiday Pass is paid for (checkout.session.completed, and
// checkout.session.async_payment_succeeded for slower payment methods). It turns the pass on
// for the Clerk account that started Checkout. Add the endpoint in Stripe:
//   https://treestyle.net/api/stripe-webhook   (signing secret -> STRIPE_WEBHOOK_SECRET in Vercel)
import { grantPass } from "../lib/account.js";
import { verifyWebhook } from "../lib/stripe.js";

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  let event;
  try { event = verifyWebhook(await rawBody(req), req.headers["stripe-signature"]); }
  catch (e) { console.error("STRIPE_WEBHOOK_REJECTED", String(e?.message || e)); return res.status(400).json({ error: "Invalid signature" }); }

  const s = event.data?.object || {};
  if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") && ["paid", "no_payment_required"].includes(s.payment_status)) {
    const userId = s.client_reference_id || s.metadata?.clerk_user;
    if (!userId) { console.error("STRIPE_WEBHOOK_NO_USER", s.id); return res.status(200).json({ received: true }); }
    try { await grantPass(userId, s.id); }
    catch (e) { console.error("STRIPE_WEBHOOK_GRANT", String(e?.message || e)); return res.status(500).json({ error: "Try again" }); }   // Stripe retries
  }
  return res.status(200).json({ received: true });
}
