/**
 * SG Document Generator — open a Custom Request file
 * Route: GET /api/design-file?p=<blob pathname>
 * The Blob store is private, so links in the request email point here. Each click
 * gets a fresh signed URL (valid one hour) and is redirected to the file.
 */

const { issueSignedToken, presignUrl } = require('@vercel/blob');
const { blobCredentials, REQUEST_PATH_RE } = require('./_blob');

module.exports = async function (req, res) {
  const pathname = String((req.query && req.query.p) || '');
  if (!REQUEST_PATH_RE.test(pathname)) { res.status(400).send('Invalid file link.'); return; }
  const creds = blobCredentials(req);
  if (!creds) { res.status(500).send('File storage not set up.'); return; }
  try {
    const validUntil = Date.now() + 60 * 60 * 1000;
    const token = await issueSignedToken({ ...creds, pathname, operations: ['get'], validUntil });
    const { presignedUrl } = await presignUrl(token, { operation: 'get', pathname, access: 'private', validUntil });
    res.setHeader('Cache-Control', 'no-store');
    res.writeHead(302, { Location: presignedUrl });
    res.end();
  } catch (err) {
    console.error('Custom request file error:', err.message);
    res.status(404).send('File not found or link expired.');
  }
};
