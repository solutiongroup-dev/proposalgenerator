/**
 * SG Document Generator — Design Request file uploads
 * Route: POST /api/design-upload
 * Issues short-lived Vercel Blob tokens so the browser can upload photos and
 * files of any size straight to Blob storage (bypassing the 4.5 MB request limit).
 * Requires BLOB_READ_WRITE_TOKEN, which Vercel sets when a Blob store is connected.
 */

const { handleUpload } = require('@vercel/blob/client');

const MAX_BYTES = 500 * 1024 * 1024;
const PATH_RE   = /^design-requests\/DR-\d{6}-[A-Z0-9]{4}\/[\w.\- ]{1,140}$/;

module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(500).json({ error: 'File storage not set up (BLOB_READ_WRITE_TOKEN missing).' });
    return;
  }
  try {
    const result = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!PATH_RE.test(pathname)) throw new Error('Invalid upload path');
        return {
          allowedContentTypes: [
            'image/*', 'application/pdf', 'text/*', 'application/zip', 'application/octet-stream',
            'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/postscript', 'application/illustrator', 'video/*',
          ],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,   // makes each file link unguessable
        };
      },
    });
    res.status(200).json(result);
  } catch (err) {
    console.error('Design upload error:', err.message);
    res.status(400).json({ error: err.message });
  }
};
