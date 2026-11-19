/**
 * SG Portal — weekly deal review
 * GET  /api/review?who=<name or email>            → matching HubSpot users (team sign-in)
 * GET  /api/review?owner=<id>[&scope=all][&t=<link token>]
 *      → "My deals" (that person's open deals) or, with scope=all, every deal in Recurring,
 *        Projects and WaterSolve. With BD unlocked, the BD / M&A pipeline too.
 * POST /api/review { login: { email, password } }  → unlocks BD for that person (30-day cookie)
 * POST /api/review { logout: true }                → locks BD again
 * POST /api/review { owner, t?, dealId, noUpdates, context, changes, original }
 *      → saves the edits to HubSpot and logs a review note on the deal
 *
 * Access: the team sign-in (or the personal link from the weekly email) opens a person's
 * deals, which they can update. Only BD (M&A) needs more: Tim, John, Chris and Brian unlock
 * it with their personal password (see personalPassword in _auth.js), and once unlocked
 * they can update any deal. Personal-password problems answer 403 (never 401, which would
 * bring up the team sign-in screen).
 */

const { isSignedIn, ownerLinkValid, personalPasswordMatches, personCookie, personClearCookie, signedInPerson } = require('./_auth');
const { hubspotRequest } = require('./_hubspot');
const { pipelineStages, findOrCreateContact, link } = require('./_crm');
const { PIPELINES, BD_PIPELINES, hasBdAccess, REVIEW_MARK, DEAL_PROPS, listOwners, matchOwners, ownerReview, dateOnly } = require('./_review');

const DAY = 86400000;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = n => '$' + Math.round(Number(n)).toLocaleString('en-US');
const midnight = d => String(Date.parse(`${d}T00:00:00Z`));   // HubSpot date fields take UTC midnight
const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !isNaN(Date.parse(d));
const wait = ms => new Promise(r => setTimeout(r, ms));

let ownersCache = null;
async function owners() {
  if (!ownersCache || ownersCache.at < Date.now() - 10 * 60 * 1000) ownersCache = { at: Date.now(), list: await listOwners() };
  return ownersCache.list;
}

// Whose deals, and whether BD is unlocked. The personal link from the weekly email or the team
// sign-in opens a person's deals; BD is unlocked only by that person's own password cookie.
function whoIs(req, ownerId, token) {
  const id = /^\d{1,20}$/.test(String(ownerId || '')) ? String(ownerId) : '';
  const person = signedInPerson(req);
  if (id && token) return ownerLinkValid(id, token) ? { id, unlocked: person === id } : { expired: true };
  if (id && isSignedIn(req)) return { id, unlocked: person === id };
  if (!id && person) return { id: person, unlocked: true };
  return null;
}
const needLogin = (res, error = 'Enter your personal password to open BD.') => res.status(403).json({ error, needLogin: true });
const noAccess = (req, res, w) => w?.expired
  ? res.status(403).json({ error: 'This review link has expired. Open the SG Portal and choose Review my deals.', linkExpired: true })
  : isSignedIn(req) ? res.status(200).json({ needWho: true })
  : res.status(401).json({ error: 'Please sign in again.' });

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.HUBSPOT_API_KEY) { res.status(500).json({ error: 'HUBSPOT_API_KEY not configured.' }); return; }
  const q = req.query || {}, b = req.body || {};

  try {
    if (req.method === 'POST' && b.logout) {
      res.setHeader('Set-Cookie', personClearCookie);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'GET' && q.who !== undefined) {
      if (!isSignedIn(req)) { res.status(401).json({ error: 'Please sign in again.' }); return; }
      const list = matchOwners(await owners(), q.who).map(o => ({ id: o.id, name: o.name, email: o.email }));
      res.status(200).json({ owners: list });
      return;
    }

    if (req.method === 'POST' && b.login) {
      if (!process.env.REVIEW_PASSWORD_SECRET) { res.status(500).json({ error: 'Personal passwords are not set up yet (REVIEW_PASSWORD_SECRET missing). Let the portal admin know.' }); return; }
      const email = String(b.login.email || '').trim().toLowerCase();
      const owner = (await owners()).find(o => o.email === email);
      if (!owner || !personalPasswordMatches(email, String(b.login.password || ''))) {
        await wait(1000);   // slows down guessing
        needLogin(res, "That email and password don't match. Use your work email and your personal password.");
        return;
      }
      if (!hasBdAccess(email)) { needLogin(res, 'BD (M&A) is only open to Tim, John, Chris and Brian.'); return; }
      res.setHeader('Set-Cookie', personCookie(req, owner.id));
      res.status(200).json({ ok: true, owner: { id: owner.id, name: owner.name } });
      return;
    }

    if (req.method === 'GET') {
      const w = whoIs(req, q.owner, q.t);
      if (!w || w.expired) { noAccess(req, res, w); return; }
      const ownerId = w.id;
      const owner = (await owners()).find(o => o.id === ownerId);
      if (!owner) { res.status(404).json({ error: 'That person was not found in HubSpot.', needWho: true }); return; }
      const bdEligible = hasBdAccess(owner.email), bd = bdEligible && w.unlocked;
      const names = Object.fromEntries((await owners()).map(o => [o.id, o.name]));
      const all = q.scope === 'all';
      res.status(200).json({ owner: { id: owner.id, name: owner.name, email: owner.email }, bd, bdEligible, scope: all ? 'all' : 'mine', viaLink: !!(q.t && q.owner),
        deals: await ownerReview(ownerId, { bd, all, owners: names }) });
      return;
    }

    if (req.method !== 'POST') { res.status(405).json({ error: 'GET or POST only' }); return; }

    const dealId = String(b.dealId || '');
    if (!/^\d{1,20}$/.test(dealId)) { res.status(400).json({ error: 'Missing deal.' }); return; }
    const w = whoIs(req, b.owner, b.t);
    if (!w || w.expired) { noAccess(req, res, w); return; }
    const ownerId = w.id;
    const owner = (await owners()).find(o => o.id === ownerId);
    if (!owner) { res.status(404).json({ error: 'That person was not found in HubSpot.' }); return; }
    const bdUnlocked = w.unlocked && hasBdAccess(owner.email);

    const deal = await hubspotRequest('GET', `/crm/v3/objects/deals/${dealId}?properties=${DEAL_PROPS.join(',')}&associations=contacts`);
    const p = deal.properties || {};
    const isBd = BD_PIPELINES.includes(p.pipeline);
    if (!PIPELINES[p.pipeline]) { res.status(400).json({ error: 'This deal is not in a pipeline the review covers.' }); return; }
    // With BD unlocked, the BD group can update any deal; otherwise only your own (never BD)
    if (!bdUnlocked && (isBd || String(p.hubspot_owner_id) !== ownerId)) {
      if (isBd && hasBdAccess(owner.email)) { needLogin(res); return; }
      res.status(403).json({ error: isBd ? 'Only the BD group can update BD deals.' : `This deal belongs to someone else in HubSpot, so ${owner.name} can't update it here.` });
      return;
    }

    const changes = b.changes || {}, original = b.original || {};
    // The customer contact: the first linked contact who isn't one of our own people
    let contactId = '', contactEmail = '', contactName = '';
    for (const r of (deal.associations?.contacts?.results || []).slice(0, 20)) {
      const cp = (await hubspotRequest('GET', `/crm/v3/objects/contacts/${r.id}?properties=email,firstname,lastname`)).properties || {};
      if (!/@solutionmgt\.com$/i.test(cp.email || '')) {
        contactId = String(r.id); contactEmail = cp.email || ''; contactName = [cp.firstname, cp.lastname].filter(Boolean).join(' ');
        break;
      }
    }

    // Current values, in the same form the page shows them
    const close = dateOnly(p.closedate), startup = dateOnly(p.estimated_startup_date), end = dateOnly(p.estimated_contract_end_date);
    const current = {
      customerName: contactName, customerEmail: contactEmail, closeDate: close, amount: p.amount ? Number(p.amount) : null,
      startupDate: startup, stageId: p.dealstage,
      probability: p.hs_deal_stage_probability !== null && p.hs_deal_stage_probability !== undefined && p.hs_deal_stage_probability !== '' ? Math.round(Number(p.hs_deal_stage_probability) * 100) : null,
      contractDays: (startup || close) && end ? Math.round((Date.parse(end) - Date.parse(startup || close)) / DAY) : null,
    };
    const same = (a, c) => String(a ?? '') === String(c ?? '');

    // Someone changed a field in HubSpot after this page loaded: don't overwrite it silently
    const conflicts = Object.keys(changes).filter(k => k in current && !same(original[k], current[k]));
    if (conflicts.length) {
      res.status(409).json({ error: 'This deal was changed in HubSpot after you opened the page. Reload to see the latest, then make your update again.', conflicts });
      return;
    }

    // Validate and build the HubSpot update
    const stages = (await pipelineStages())[p.pipeline]?.stages || {};
    const patch = {}, lines = [], problems = [];
    const label = { customerName: 'Customer name', customerEmail: 'Customer email', closeDate: 'Close date', amount: 'Amount', startupDate: 'Estimated startup date', stageId: 'Deal stage', probability: 'Close probability', contractDays: 'Contract length' };
    const show = (k, v) => v === null || v === undefined || v === '' ? '(blank)'
      : k === 'amount' ? money(v) : k === 'probability' ? `${v}%` : k === 'contractDays' ? `${v} days` : k === 'stageId' ? (stages[v]?.label || v) : v;
    const changed = k => k in changes && !same(changes[k], current[k]);

    if (changed('closeDate')) { if (validDate(changes.closeDate)) patch.closedate = midnight(changes.closeDate); else problems.push('Close date is not a valid date.'); }
    if (changed('amount')) { const n = Number(String(changes.amount).replace(/[$,\s]/g, '')); if (changes.amount === '' || changes.amount === null) patch.amount = ''; else if (isFinite(n) && n >= 0) { patch.amount = String(Math.round(n * 100) / 100); changes.amount = n; } else problems.push('Amount should be a number.'); }
    if (changed('stageId')) { if (stages[changes.stageId]) patch.dealstage = changes.stageId; else problems.push('That stage is not in this pipeline.'); }
    if (changed('probability')) { const n = Number(changes.probability); if (isFinite(n) && n >= 0 && n <= 100) patch.hs_deal_stage_probability = String(n / 100); else problems.push('Close probability should be 0 to 100.'); }
    if (changed('startupDate')) { if (!changes.startupDate) patch.estimated_startup_date = ''; else if (validDate(changes.startupDate)) patch.estimated_startup_date = midnight(changes.startupDate); else problems.push('Startup date is not a valid date.'); }
    // Contract length is kept as the contract end date: start (startup, else close date) + days.
    // A new startup date moves the end date too, so the length stays the same unless it was changed.
    const newStart = changed('startupDate') ? changes.startupDate : (changed('closeDate') && !current.startupDate ? changes.closeDate : (current.startupDate || current.closeDate));
    const days = changed('contractDays') ? Number(changes.contractDays) : current.contractDays;
    if (changed('contractDays') && !(Number.isInteger(days) && days > 0 && days < 3700)) problems.push('Contract length should be a whole number of days.');
    else if ((changed('contractDays') || (current.contractDays !== null && newStart !== (current.startupDate || current.closeDate))) && days && newStart) {
      if (!validDate(newStart)) problems.push('Set a startup or close date before the contract length.');
      else patch.estimated_contract_end_date = midnight(new Date(Date.parse(newStart) + days * DAY).toISOString().slice(0, 10));
    } else if (changed('contractDays') && !newStart) problems.push('Set a startup or close date before the contract length.');
    if (changed('customerEmail') && changes.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(changes.customerEmail).trim())) problems.push('The customer email does not look right.');
    if (problems.length) { res.status(400).json({ error: problems.join(' ') }); return; }

    for (const k of Object.keys(label)) if (changed(k)) lines.push(`${label[k]}: ${show(k, current[k])} → ${show(k, changes[k])}`);
    const context = String(b.context || '').trim().slice(0, 5000);
    if (!lines.length && !context && !b.noUpdates) { res.status(400).json({ error: 'Nothing to save. Make a change, add context, or choose No updates.' }); return; }

    if (Object.keys(patch).length) await hubspotRequest('PATCH', `/crm/v3/objects/deals/${dealId}`, { properties: patch });
    let contactNote = '';

    // Customer name and email: fix them on the deal's contact, or add a contact if the deal has none
    const newName = changed('customerName') ? String(changes.customerName || '').trim().slice(0, 120) : '';
    const newEmail = changed('customerEmail') ? String(changes.customerEmail || '').trim().toLowerCase() : '';
    if (contactId && (newName || newEmail)) {
      const props = {};
      if (newEmail) props.email = newEmail;
      if (newName) { const [first, ...rest] = newName.split(/\s+/); props.firstname = first; props.lastname = rest.join(' '); }
      await hubspotRequest('PATCH', `/crm/v3/objects/contacts/${contactId}`, { properties: props }).catch(e => {
        if (/INVALID_EMAIL/.test(e.message)) throw Object.assign(new Error('HubSpot says that email address is not valid.'), { status: 400 });
        if (/already has that value|CONFLICT|409/.test(e.message)) throw Object.assign(new Error('Another contact in HubSpot already uses that email. Link that contact to the deal in HubSpot instead.'), { status: 409 });
        throw e;
      });
    } else if (!contactId && (newName || newEmail)) {
      const name = newName || String(b.customerName || '').trim().slice(0, 120);
      const c = await findOrCreateContact({ email: newEmail, contactName: name, ownerId });
      if (c) {
        await link('deals', dealId, 'contacts', c.id);
        // Emails are unique in HubSpot: an existing contact with this email is linked, not duplicated
        if (c.existing) {
          const cp = (await hubspotRequest('GET', `/crm/v3/objects/contacts/${c.id}?properties=firstname,lastname`).catch(() => ({}))).properties || {};
          const who = [cp.firstname, cp.lastname].filter(Boolean).join(' ') || 'a contact with no name';
          contactNote = `Linked existing HubSpot contact ${who} (${newEmail})`;
        } else contactNote = `Added new contact ${name || '(no name)'}${newEmail ? ` (${newEmail})` : ''}`;
        lines.push(contactNote);
      }
    }

    // The review note: who, when, what changed, and their context
    const when = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });
    const body = [`<strong>${REVIEW_MARK}</strong> by ${esc(owner.name)} on ${when}`,
      lines.length ? lines.map(esc).join('<br>') : 'No updates. Details confirmed as current.',
      context && `<strong>Context:</strong> ${esc(context).replace(/\n/g, '<br>')}`].filter(Boolean).join('<br><br>');
    await hubspotRequest('POST', '/crm/v3/objects/notes', {
      properties: { hs_timestamp: new Date().toISOString(), hs_note_body: body, hubspot_owner_id: ownerId },
      associations: [{ to: { id: dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] }],
    });

    console.log(`Deal review saved: ${dealId} by ${owner.name}${lines.length ? ` (${lines.length} changes)` : ' (no updates)'}`);
    res.status(200).json({ ok: true, changes: lines, contactNote });
  } catch (err) {
    console.error('Review error:', err.message);
    res.status(err.status && err.status < 500 ? err.status : 500).json({ error: err.status === 403 ? 'HubSpot refused the update (the website key is missing a permission).' : err.message });
  }
};
