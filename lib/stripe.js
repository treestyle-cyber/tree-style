// Stripe, called directly (no SDK). Uses a restricted key (STRIPE_SECRET_KEY, "rk_live_…" or "rk_test_…")
// with Checkout Sessions: Write. STRIPE_PRICE_ID is the Holiday Pass price. STRIPE_TAX=on turns on Stripe Tax.
import crypto from "node:crypto";

function form(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out);
    else out.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(v)));
  }
  return out.join("&");
}

async function stripe(method, path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set in Vercel");
  const r = await fetch("https://api.stripe.com/v1" + path, {
    method,
    headers: { authorization: "Bearer " + key, "content-type": "application/x-www-form-urlencoded" },
    body: params ? form(params) : undefined
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.error?.message || `Stripe error ${r.status}`);
  return body;
}

export function createCheckout({ userId, email, origin }) {
  if (!process.env.STRIPE_PRICE_ID) throw new Error("STRIPE_PRICE_ID is not set in Vercel");
  return stripe("POST", "/checkout/sessions", {
    mode: "payment",
    line_items: { 0: { price: process.env.STRIPE_PRICE_ID, quantity: 1 } },
    client_reference_id: userId,
    customer_email: email || undefined,
    metadata: { clerk_user: userId, product: "holiday_pass" },
    allow_promotion_codes: "true",
    automatic_tax: process.env.STRIPE_TAX === "on" ? { enabled: "true" } : undefined,
    success_url: origin + "/try/?paid={CHECKOUT_SESSION_ID}",
    cancel_url: origin + "/try/?paid=cancelled"
  });
}

export const getCheckout = id => stripe("GET", "/checkout/sessions/" + encodeURIComponent(id));

// Checks the Stripe-Signature header against STRIPE_WEBHOOK_SECRET ("whsec_…"). Returns the event or throws.
export function verifyWebhook(raw, header) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set in Vercel");
  const parts = Object.fromEntries(String(header || "").split(",").map(p => p.split("=").map(s => s.trim())).filter(p => p.length === 2 && p[0] === "t"));
  const t = parts.t, sigs = String(header || "").split(",").filter(p => p.trim().startsWith("v1=")).map(p => p.trim().slice(3));
  if (!t || !sigs.length) throw new Error("No signature");
  if (Math.abs(Date.now() / 1000 - Number(t)) > 600) throw new Error("Signature too old");
  const want = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  const ok = sigs.some(s => s.length === want.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want)));
  if (!ok) throw new Error("Bad signature");
  return JSON.parse(raw);
}
