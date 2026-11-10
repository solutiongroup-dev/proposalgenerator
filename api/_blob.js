// Shared Vercel Blob helpers for Custom Request routes (files starting with _ are not routes)

// The connected store provides BLOB_STORE_ID; the function authenticates with its
// Vercel OIDC token. A BLOB_READ_WRITE_TOKEN is also accepted if one is ever added.
function blobCredentials(req) {
  if (process.env.BLOB_READ_WRITE_TOKEN) return { token: process.env.BLOB_READ_WRITE_TOKEN };
  if (!process.env.BLOB_STORE_ID) return null;
  const oidcToken = req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN;
  return { storeId: process.env.BLOB_STORE_ID, ...(oidcToken ? { oidcToken } : {}) };
}

// Only files under a Custom Request folder may be uploaded or opened
const REQUEST_PATH_RE = /^design-requests\/DR-\d{6}-[A-Z0-9]{4}\/[\w.\- ]{1,200}$/;

module.exports = { blobCredentials, REQUEST_PATH_RE };
