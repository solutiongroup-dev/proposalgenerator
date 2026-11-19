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

// Personal links in the weekly deal-review email: open one owner's review page without
// signing in. Signed with the same secret, valid for 14 days; changing APP_PASSWORD voids them.
function ownerLinkToken(ownerId, days = 14) {
  const key = secret();
  if (!key) return null;
  const exp = String(Math.floor(Date.now() / 1000) + days * 86400);
  return `${exp}.${sign(`review|${ownerId}|${exp}`, key)}`;
}
function ownerLinkValid(ownerId, token) {
  const key = secret();
  if (!key || !token) return false;
  const [exp, sig] = String(token).split('.');
  if (!exp || !sig || !(Number(exp) > Date.now() / 1000)) return false;
  return safeEqual(sig, sign(`review|${ownerId}|${exp}`, key));
}

// ── Personal passwords for "Review my deals" ─────────────────────────────────
// Every HubSpot user gets their own simple password (a word and four digits, like
// "cedar4821"), worked out from their email and REVIEW_PASSWORD_SECRET, so nothing
// has to be stored and anyone new in HubSpot automatically has one. Changing the
// secret gives everyone a new password. Signing in sets a 30-day personal cookie.
const WORDS = ['acorn', 'amber', 'anchor', 'aspen', 'atlas', 'badger', 'beacon', 'birch', 'bison', 'canyon',
  'cedar', 'cobalt', 'comet', 'copper', 'coral', 'cypress', 'delta', 'ember', 'falcon', 'fern',
  'fjord', 'flint', 'garnet', 'glacier', 'granite', 'harbor', 'hawk', 'heron', 'hickory', 'indigo',
  'island', 'jasper', 'juniper', 'kestrel', 'lagoon', 'lantern', 'laurel', 'linden', 'lotus', 'maple',
  'marble', 'meadow', 'mesa', 'oak', 'onyx', 'orchid', 'osprey', 'otter', 'pebble', 'pine',
  'prairie', 'quartz', 'raven', 'redwood', 'ridge', 'river', 'saddle', 'sage', 'sequoia', 'sierra',
  'spruce', 'summit', 'tundra', 'valley', 'willow', 'zephyr', 'walnut', 'timber', 'thistle', 'sparrow'];
const PERSON_COOKIE = 'sg_person';

function personalSecret() {
  const s = process.env.REVIEW_PASSWORD_SECRET;
  return s ? crypto.createHash('sha256').update('sg-person|' + s).digest() : null;
}
function personalPassword(email) {
  const key = personalSecret();
  if (!key || !email) return null;
  const h = crypto.createHmac('sha256', key).update('pw|' + String(email).trim().toLowerCase()).digest();
  return WORDS[h.readUInt16BE(0) % WORDS.length] + String(1000 + (h.readUInt32BE(2) % 9000));
}
function personalPasswordMatches(email, input) {
  const pw = personalPassword(email);
  if (!pw || typeof input !== 'string') return false;
  return safeEqual(input.trim().toLowerCase(), pw);
}
function personCookie(req, ownerId) {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const secure = (req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
  const v = `${ownerId}.${exp}.${sign(`person|${ownerId}|${exp}`, personalSecret())}`;
  return `${PERSON_COOKIE}=${v}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}
const personClearCookie = `${PERSON_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
// The HubSpot owner id of the person signed in to "Review my deals", or null
function signedInPerson(req) {
  const key = personalSecret();
  const v = readCookie(req, PERSON_COOKIE);
  if (!key || !v) return null;
  const [id, exp, sig] = v.split('.');
  if (!/^\d{1,20}$/.test(id || '') || !(Number(exp) > Date.now() / 1000) || !sig) return null;
  return safeEqual(sig, sign(`person|${id}|${exp}`, key)) ? id : null;
}

module.exports = { isSignedIn, passwordMatches, sessionCookie, clearCookie, requireAuth, ownerLinkToken, ownerLinkValid,
  personalPassword, personalPasswordMatches, personCookie, personClearCookie, signedInPerson };
