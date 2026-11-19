/**
 * SG Document Generator — team sign-in
 * GET  /api/login            → { signedIn, configured }
 * POST /api/login {password} → sets the session cookie
 * POST /api/login {logout:true} → clears it
 */

const { isSignedIn, passwordMatches, sessionCookie, clearCookie } = require('./_auth');

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const configured = Boolean(process.env.APP_PASSWORD);

  if (req.method === 'GET') { res.status(200).json({ signedIn: isSignedIn(req), configured }); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'GET or POST only' }); return; }

  const body = req.body || {};
  if (body.logout) { res.setHeader('Set-Cookie', clearCookie); res.status(200).json({ signedIn: false }); return; }

  if (!configured) { res.status(503).json({ error: 'Login is not set up yet. Ask the portal admin to add APP_PASSWORD in Vercel.' }); return; }
  if (!passwordMatches(body.password)) {
    await new Promise(r => setTimeout(r, 1000)); // slow down guessing
    res.status(401).json({ error: 'That password is not right.' });
    return;
  }
  res.setHeader('Set-Cookie', sessionCookie(req));
  res.status(200).json({ signedIn: true });
};
