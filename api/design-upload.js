/**
 * SG Document Generator — Custom Request file uploads
 * Route: POST /api/design-upload
 * Gives the browser short-lived presigned URLs so it can upload photos and files
 * of any size straight to Vercel Blob (bypassing the 4.5 MB request limit).
 *
 * Auth: the connected Blob store provides BLOB_STORE_ID, and the function proves
 * its identity with Vercel's OIDC token, so no read-write key is needed. A
 * BLOB_READ_WRITE_TOKEN is also accepted if one is ever added.
 */

const { handleUploadPresigned } = require('@vercel/blob/client');
const { issueSignedToken } = require('@vercel/blob');
const { blobCredentials, REQUEST_PATH_RE } = require('./_blob');

const MAX_BYTES = 500 * 1024 * 1024;
const TYPES = [
  'image/*', 'application/pdf', 'text/*', 'application/zip', 'application/octet-stream',
  'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/postscript', 'application/illustrator', 'video/*',
];

module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const creds = blobCredentials(req);
  if (!creds) {
    res.status(500).json({ error: 'File storage not set up (no Blob store connected).' });
    return;
  }
  try {
    const result = await handleUploadPresigned({
      body: req.body,
      request: req,
      getSignedToken: async (pathname) => {
        if (!REQUEST_PATH_RE.test(pathname)) throw new Error('Invalid upload path');
        const token = await issueSignedToken({
          ...creds,
          pathname,
          operations: ['put'],
          allowedContentTypes: TYPES,
          maximumSizeInBytes: MAX_BYTES,
          validUntil: Date.now() + 60 * 60 * 1000,
        });
        return {
          token,
          urlOptions: { allowedContentTypes: TYPES, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true },
        };
      },
    });
    res.status(200).json(result);
  } catch (err) {
    console.error('Custom request upload error:', err.message);
    res.status(400).json({ error: err.message });
  }
};
