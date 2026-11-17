/**
 * SG Portal — weekly deal review
 * GET  /api/review?who=<name or email>        → matching HubSpot owners (signed-in team members)
 * GET  /api/review?owner=<id>[&t=<link token>] → that owner's open deals, to-dos first
 * POST /api/review { owner, t?, dealId, noUpdates, context, changes, original }
 *      → saves the edits to HubSpot and logs a review note on the deal
 *
 * Access: a signed-in team member, or the personal link from the weekly email (t), which
 * only opens that one owner's deals. Only deals the owner owns can be changed.
 */

const { isSignedIn, ownerLinkValid } = require('./_auth');
const { hubspotRequest } = require('./_hubspot');
const { pipelineStages, findOrCreateContact, link } = require('./_crm');
const { PIPELINES, REVIEW_MARK, DEAL_PROPS, listOwners, matchOwners, ownerReview, dateOnly } = require('./_review');

const DAY = 86400000;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = n => '$' + Math.round(Number(n)).toLocaleString('en-US');
const midnight = d => String(Date.parse(`${d}T00:00:00Z`));   // HubSpot date fields take UTC midnight
const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !isNaN(Date.parse(d));

let ownersCache = null;
async function owners() {
  if (!ownersCache || ownersCache.at < Date.now() - 10 * 60 * 1000) ownersCache = { at: Date.now(), list: await listOwners() };
  return ownersCache.list;
}

function allowed(req, ownerId, token) {
  return isSignedIn(req) || (ownerId && ownerLinkValid(ownerId, token));
}

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.HUBSPOT_API_KEY) { res.status(500).json({ error: 'HUBSPOT_API_KEY not configured.' }); return; }
  const q = req.query || {};

  try {
    if (req.method === 'GET' && q.who !== undefined) {
      if (!isSignedIn(req)) { res.status(401).json({ error: 'Please sign in again.' }); return; }
      const list = matchOwners(await owners(), q.who).map(o => ({ id: o.id, name: o.name, email: o.email }));
      res.status(200).json({ owners: list });
      return;
    }

    if (req.method === 'GET') {
      const ownerId = String(q.owner || '');
      if (!/^\d{1,20}$/.test(ownerId)) { res.status(400).json({ error: 'Missing owner.' }); return; }
      if (!allowed(req, ownerId, q.t)) { res.status(401).json({ error: q.t ? 'This review link has expired. Open the portal and enter your name instead.' : 'Please sign in again.' }); return; }
      const owner = (await owners()).find(o => o.id === ownerId);
      if (!owner) { res.status(404).json({ error: 'That person was not found in HubSpot.' }); return; }
      res.status(200).json({ owner: { id: owner.id, name: owner.name }, deals: await ownerReview(ownerId) });
      return;
    }

    if (req.method !== 'POST') { res.status(405).json({ error: 'GET or POST only' }); return; }

    const b = req.body || {};
    const ownerId = String(b.owner || ''), dealId = String(b.dealId || '');
    if (!/^\d{1,20}$/.test(ownerId) || !/^\d{1,20}$/.test(dealId)) { res.status(400).json({ error: 'Missing deal or owner.' }); return; }
    if (!allowed(req, ownerId, b.t)) { res.status(401).json({ error: 'Please sign in again, or open the latest link from your weekly email.' }); return; }
    const owner = (await owners()).find(o => o.id === ownerId);
    if (!owner) { res.status(404).json({ error: 'That person was not found in HubSpot.' }); return; }

    const deal = await hubspotRequest('GET', `/crm/v3/objects/deals/${dealId}?properties=${DEAL_PROPS.join(',')}&associations=contacts`);
    const p = deal.properties || {};
    if (String(p.hubspot_owner_id) !== ownerId) { res.status(403).json({ error: `This deal belongs to someone else in HubSpot, so ${owner.name} can't update it here.` }); return; }
    if (!PIPELINES[p.pipeline]) { res.status(400).json({ error: 'This deal is not in a pipeline the review covers.' }); return; }

    const changes = b.changes || {}, original = b.original || {};
    // The customer contact: the first linked contact who isn't one of our own people
    let contactId = '', contactEmail = '';
    for (const r of (deal.associations?.contacts?.results || []).slice(0, 20)) {
      const e = (await hubspotRequest('GET', `/crm/v3/objects/contacts/${r.id}?properties=email`)).properties?.email || '';
      if (!/@solutionmgt\.com$/i.test(e)) { contactId = String(r.id); contactEmail = e; break; }
    }

    // Current values, in the same form the page shows them
    const close = dateOnly(p.closedate), startup = dateOnly(p.estimated_startup_date), end = dateOnly(p.estimated_contract_end_date);
    const current = {
      customerEmail: contactEmail, closeDate: close, amount: p.amount ? Number(p.amount) : null,
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
    const label = { customerEmail: 'Customer email', closeDate: 'Close date', amount: 'Amount', startupDate: 'Estimated startup date', stageId: 'Deal stage', probability: 'Close probability', contractDays: 'Contract length' };
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

    // Customer email: fix it on the deal's contact, or add a contact if the deal has none
    if (changed('customerEmail') && changes.customerEmail) {
      const email = String(changes.customerEmail).trim().toLowerCase();
      if (contactId) {
        await hubspotRequest('PATCH', `/crm/v3/objects/contacts/${contactId}`, { properties: { email } }).catch(e => {
          if (/INVALID_EMAIL/.test(e.message)) throw Object.assign(new Error('HubSpot says that email address is not valid.'), { status: 400 });
          if (/already has that value|CONFLICT|409/.test(e.message)) throw Object.assign(new Error('Another contact in HubSpot already uses that email. Link that contact to the deal in HubSpot instead.'), { status: 409 });
          throw e;
        });
      } else {
        const name = String(b.customerName || '').trim().slice(0, 120);
        const c = await findOrCreateContact({ email, contactName: name, ownerId });
        if (c) {
          await link('deals', dealId, 'contacts', c.id);
          // Emails are unique in HubSpot: an existing contact with this email is linked, not duplicated
          if (c.existing) {
            const cp = (await hubspotRequest('GET', `/crm/v3/objects/contacts/${c.id}?properties=firstname,lastname`).catch(() => ({}))).properties || {};
            const who = [cp.firstname, cp.lastname].filter(Boolean).join(' ') || 'a contact with no name';
            contactNote = `Linked existing HubSpot contact ${who} (${email})`;
          } else contactNote = `Added new contact ${name || '(no name)'} (${email})`;
          lines.push(contactNote);
        }
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
