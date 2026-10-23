// Vercel Blob's access key. Vercel names it BLOB_READ_WRITE_TOKEN by default, but a store connected
// with a custom prefix gets <PREFIX>_READ_WRITE_TOKEN, so accept any of those.
export function blobToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const k = Object.keys(process.env).find(n => /READ_WRITE_TOKEN$/.test(n) && String(process.env[n]).startsWith("vercel_blob_"));
  return k ? process.env[k] : undefined;   // undefined: let the SDK sign in with the project's Vercel identity (OIDC)
}
// Connected either the classic way (a token) or the newer way (a store ID; the SDK authenticates itself)
export function blobConnected() { return !!(blobToken() || process.env.BLOB_STORE_ID); }
// Names only (never values), to help check the store is connected
export function blobVarNames() { return Object.keys(process.env).filter(n => /BLOB|READ_WRITE_TOKEN/.test(n)); }

// Preview copies of the app (any branch other than main) keep their own Studio photos and feedback,
// so design work never changes the live site. A preview starts from the live photos and overrides them.
export const IS_PREVIEW = !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production";
export const envPath = p => (IS_PREVIEW ? "preview/" : "") + p;
