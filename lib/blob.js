// Vercel Blob's access key. Vercel names it BLOB_READ_WRITE_TOKEN by default, but a store connected
// with a custom prefix gets <PREFIX>_READ_WRITE_TOKEN, so accept any of those.
export function blobToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const k = Object.keys(process.env).find(n => /READ_WRITE_TOKEN$/.test(n) && String(process.env[n]).startsWith("vercel_blob_"));
  return k ? process.env[k] : "";
}
// Names only (never values), to help check the store is connected
export function blobVarNames() { return Object.keys(process.env).filter(n => /BLOB|READ_WRITE_TOKEN/.test(n)); }
