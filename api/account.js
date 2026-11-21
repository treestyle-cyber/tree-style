// The person's account and the Holiday Pass.
// GET                                 -> { accounts, publishableKey, freeLimit, passUntil, price, me }
// POST { action: "checkout" }         -> { url }   Stripe-hosted Checkout for the Holiday Pass (signed in)
// POST { action: "confirm", session } -> { me }    back from Checkout: turns the pass on right away if Stripe says it's paid
import { accountsOn, publishableKey, whoIs, grantPass, FREE_PREVIEWS, PASS_UNTIL, PRICE_LABEL } from "../lib/account.js";
import { createCheckout, getCheckout } from "../lib/stripe.js";

const pub = who => who && !who.viaPassword ? { email: who.email, staff: who.staff, passUntil: who.passUntil, freeUsed: who.freeUsed, freeLeft: who.freeLeft, freeLimit: who.freeLimit, allowed: who.allowed, reason: who.reason } : null;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const info = { accounts: accountsOn(), publishableKey: publishableKey(), freeLimit: FREE_PREVIEWS, passUntil: PASS_UNTIL, price: PRICE_LABEL };
  if (req.method === "GET") return res.status(200).json({ ...info, me: info.accounts ? pub(await whoIs(req)) : null });
  if (req.method !== "POST") return res.status(405).json({ error: "GET or POST" });

  const who = await whoIs(req);
  if (!who || !who.id) return res.status(401).json({ error: "Please sign in to continue.", code: "sign_in" });
  const { action, session } = req.body || {};
  try {
    if (action === "checkout") {
      if (who.passUntil) return res.status(200).json({ already: true, me: pub(who) });
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const s = await createCheckout({ userId: who.id, email: who.email, origin: "https://" + host });
      return res.status(200).json({ url: s.url });
    }
    if (action === "confirm") {
      const s = await getCheckout(String(session || ""));
      if (s.client_reference_id !== who.id) return res.status(403).json({ error: "That payment belongs to a different account." });
      if (s.payment_status !== "paid") return res.status(200).json({ pending: true, me: pub(who) });
      const st = await grantPass(who.id, s.id);
      return res.status(200).json({ me: pub({ ...who, ...st }) });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("ACCOUNT_API", String(e?.message || e).slice(0, 300));
    return res.status(502).json({ error: "We couldn't reach the payment service. Please try again." });
  }
}
