// Accounts, free previews and the Holiday Pass.
//
// Sign-in is Clerk (email code, no passwords). Everything we track lives on the person's Clerk account
// (private metadata, never sent to the browser as-is), so there is no separate database:
//   free_used   previews painted on the free allowance
//   pass_until  when their Holiday Pass ends (set by the Stripe webhook or the return from Checkout)
//   day, day_count   previews painted today (Pacific time), for the pass's quiet daily cap
//
// Who gets through:
//   - the test password (Studio, Lab, Eric's testers): unlimited, never counted
//   - STAFF_EMAILS (comma-separated): unlimited, never counted
//   - a Holiday Pass: unlimited until PASS_UNTIL, up to PASS_DAILY_CAP previews a day
//   - everyone else: FREE_PREVIEWS previews, then the pass
// Until CLERK_SECRET_KEY is set, the site behaves exactly as before (the test password).
import { createClerkClient, verifyToken } from "@clerk/backend";
import { checkPassword } from "./util.js";

export const FREE_PREVIEWS = Number(process.env.FREE_PREVIEWS) || 2;
export const PASS_UNTIL = process.env.PASS_UNTIL || "2027-01-16T07:59:59Z";   // the end of Jan 15, 2027, Pacific time
export const DAILY_CAP = Number(process.env.PASS_DAILY_CAP) || 40;
export const PRICE_LABEL = process.env.PASS_PRICE_LABEL || "$19.99";

const secret = () => process.env.CLERK_SECRET_KEY || "";
export const publishableKey = () => process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
export const accountsOn = () => !!(secret() && publishableKey());

let client = null;
const clerk = () => client || (client = createClerkClient({ secretKey: secret(), publishableKey: publishableKey() }));
const staffEmails = () => (process.env.STAFF_EMAILS || "").toLowerCase().split(/[\s,]+/).filter(Boolean);
const pacificDay = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

function testPassword(req) {
  const want = process.env.TEST_PASSWORD;
  return !!want && (req.headers["x-test-password"] || "") === want;
}

// What this person can do right now
export function standing(user) {
  const m = user.privateMetadata || {};
  const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || "";
  const staff = staffEmails().includes(email.toLowerCase());
  const passUntil = m.pass_until && Date.parse(m.pass_until) > Date.now() ? m.pass_until : null;
  const freeUsed = Number(m.free_used) || 0;
  const today = m.day === pacificDay() ? Number(m.day_count) || 0 : 0;
  let reason = null;
  if (!staff) {
    if (passUntil) { if (today >= DAILY_CAP) reason = "daily_cap"; }
    else if (freeUsed >= FREE_PREVIEWS) reason = m.pass_until ? "pass_ended" : "pass_required";
  }
  return { id: user.id, email, staff, passUntil, freeUsed, freeLeft: Math.max(0, FREE_PREVIEWS - freeUsed), freeLimit: FREE_PREVIEWS, allowed: !reason, reason };
}

// The signed-in person behind a request, or null. { staff: true } for the test password.
export async function whoIs(req) {
  if (testPassword(req)) return { staff: true, viaPassword: true };
  if (!accountsOn()) return checkPassword(req) ? { staff: true, viaPassword: true } : null;
  const token = (/^Bearer (.+)$/.exec(req.headers.authorization || "") || [])[1];
  // Preview copies keep the Studio and Lab open (they send no sign-in); the app signs in first, so it is checked like the live site
  if (!token) return process.env.VERCEL_ENV === "preview" ? { staff: true, viaPassword: true } : null;
  try {
    const claims = await verifyToken(token, { secretKey: secret() });
    const user = await clerk().users.getUser(claims.sub);
    return { user, ...standing(user) };
  } catch (e) {
    console.error("ACCOUNT_CHECK", String(e?.message || e).slice(0, 200));
    return null;
  }
}

const COPY = {
  sign_in: "Please sign in to continue.",
  pass_required: `You've used your ${FREE_PREVIEWS} free previews. Get the Holiday Pass to keep designing.`,
  pass_ended: "Your Holiday Pass has ended.",
  daily_cap: "You've made a lot of previews today. Come back tomorrow for more."
};

// Use at the top of a handler. Returns the person, or answers the request (401 sign in, 402 pass) and returns null.
// needsAllowance: false lets a signed-in person through even with no previews left (step instructions for a tree they already have).
export async function gate(req, res, { needsAllowance = true } = {}) {
  const who = await whoIs(req);
  if (!who) { res.status(401).json({ error: COPY.sign_in, code: "sign_in" }); return null; }
  if (needsAllowance && !who.staff && !who.allowed) { res.status(402).json({ error: COPY[who.reason], code: who.reason }); return null; }
  return who;
}

// Count one painted preview. Failed previews are never counted (call this only after a picture came back).
export async function countPreview(who) {
  if (!who || who.staff || !who.id) return;
  try {
    const user = await clerk().users.getUser(who.id);   // fresh, in case another preview just finished
    const m = user.privateMetadata || {}, day = pacificDay();
    const pass = m.pass_until && Date.parse(m.pass_until) > Date.now();
    const next = pass
      ? { day, day_count: (m.day === day ? Number(m.day_count) || 0 : 0) + 1 }
      : { free_used: (Number(m.free_used) || 0) + 1 };
    await clerk().users.updateUserMetadata(who.id, { privateMetadata: next });
  } catch (e) { console.error("COUNT_PREVIEW", String(e?.message || e).slice(0, 200)); }
}

// Turn on the Holiday Pass (safe to call twice: the webhook and the return from Checkout both do)
export async function grantPass(userId, sessionId) {
  const user = await clerk().users.getUser(userId);
  const m = user.privateMetadata || {};
  if (m.pass_session === sessionId && m.pass_until) return standing(user);
  const updated = await clerk().users.updateUserMetadata(userId, { privateMetadata: { pass_until: PASS_UNTIL, pass_session: sessionId, pass_at: new Date().toISOString() } });
  console.log("PASS_GRANTED", JSON.stringify({ userId, sessionId }));
  return standing(updated);
}
