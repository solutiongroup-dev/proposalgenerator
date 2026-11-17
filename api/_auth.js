// Team login (files starting with _ are not routes).
// Everyone signs in with one shared team password, set as APP_PASSWORD in Vercel.
// A successful sign-in sets a signed, HttpOnly cookie that lasts 30 days. Every API
// route checks it, so the Claude and HubSpot keys can only be used by signed-in people.
// Changing APP_PASSWORD (or AUTH_SECRET, if set) signs everyone out.

const crypto = require('crypto');

const COOKIE = 'sg_session';
const MAX_AGE = 30 * 24 * 60 * 60; // seconds

function secret() {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return null;
  return crypto.createHash('sha256').update('sg-docs|' + (process.env.AUTH_SECRET || '') + '|' + pw).digest();
}

function sign(value, key) {
  return crypto.createHmac('sha256', key).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function isSignedIn(req) {
  const key = secret();
  if (!key) return false;
  const v = readCookie(req, COOKIE);
  if (!v) return false;
  const [exp, sig] = v.split('.');
  if (!exp || !sig || !(Number(exp) > Date.now() / 1000)) return false;
  return safeEqual(sig, sign(exp, key));
}

function passwordMatches(input) {
  const pw = process.env.APP_PASSWORD;
  if (!pw || typeof input !== 'string') return false;
  // Compare hashes so the check takes the same time whatever the length
  const h = s => crypto.createHash('sha256').update(s).digest();
  return crypto.timingSafeEqual(h(input), h(pw));
}

function sessionCookie(req) {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const secure = (req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
  return `${COOKIE}=${exp}.${sign(exp, secret())}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

const clearCookie = `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;

// For JSON routes: returns true if signed in, otherwise answers 401 and returns false
function requireAuth(req, res) {
  if (isSignedIn(req)) return true;
  res.status(401).json({ error: process.env.APP_PASSWORD ? 'Please sign in again.' : 'Login is not set up (APP_PASSWORD missing).' });
  return false;
}

module.exports = { isSignedIn, passwordMatches, sessionCookie, clearCookie, requireAuth };
