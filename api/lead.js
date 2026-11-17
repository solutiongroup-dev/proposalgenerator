/**
 * SG Portal — sales lead (prequalification) entry
 * GET  /api/lead  → { owners: [{id, name, email}] } for the "Solution Group lead" picker
 * GET  /api/lead?company=…&domain=…  → matching HubSpot companies (lead and proposal forms)
 * GET  /api/lead?deals=<companyId>   → that company's open deals (proposal form)
 * POST /api/lead  → creates the deal in the chosen pipeline's Prequalification stage,
 *                   finds or creates the company and contact, and links all three.
 *
 * Body: { companyName, location, contactName, phone, email, ownerId, pipeline: 'Project'|'Recurring',
 *         nextSteps, estimatedValue, requestId }
 */

const { requireAuth } = require('./_auth');
const { hubspotRequest } = require('./_hubspot');
const { FREE_MAIL, splitLocation, searchOne, searchCompanies, useOrCreateCompany, findOrCreateContact, companyDeals, link, dealUrl, scopeHint } = require('./_crm');

const PIPELINES = {
  Project:   { id: '2277462760', label: 'Project' },
  Recurring: { id: '2276783856', label: 'Recurring' },
};

// ── Owners (Solution Group lead) ──────────────────────────────────────────────
async function listOwners() {
  const owners = [];
  let after;
  for (let i = 0; i < 10; i++) {
    const page = await hubspotRequest('GET', `/crm/v3/owners/?limit=100&archived=false${after ? `&after=${after}` : ''}`);
    for (const o of page.results || []) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(' ').trim() || o.email;
      if (o.id && name) owners.push({ id: String(o.id), name, email: o.email || '' });
    }
    after = page.paging?.next?.after;
    if (!after) break;
  }
  return owners.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Prequalification stage of a pipeline ──────────────────────────────────────
const stageCache = {};
async function prequalStage(pipelineKey) {
  if (stageCache[pipelineKey]) return stageCache[pipelineKey];
  const p = PIPELINES[pipelineKey];
  const data = await hubspotRequest('GET', `/crm/v3/pipelines/deals/${p.id}`);
  const stages = (data.stages || []).filter(s => !s.archived);
  const stage = stages.find(s => /pre[\s-]*qual/i.test(s.label || ''));
  if (!stage) {
    throw Object.assign(new Error(`The ${data.label || p.label} pipeline in HubSpot has no Prequalification stage. Its stages are: ${stages.map(s => s.label).join(', ')}.`), { status: 500 });
  }
  return (stageCache[pipelineKey] = { pipelineId: p.id, pipelineLabel: data.label || p.label, stageId: stage.id, stageLabel: stage.label });
}

// ── Contact ───────────────────────────────────────────────────────────────────
function parseMoney(v) {
  const s = String(v || '').trim().toLowerCase().replace(/[$,\s]/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)(k|m|mm)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]) * (m[2] === 'k' ? 1e3 : m[2] ? 1e6 : 1);
  return Math.round(n);
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function (req, res) {
  if (!requireAuth(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.HUBSPOT_API_KEY) { res.status(500).json({ error: 'HUBSPOT_API_KEY not configured.' }); return; }

  if (req.method === 'GET' && req.query && req.query.deals !== undefined) {
    const id = String(req.query.deals);
    if (!/^\d{1,20}$/.test(id)) { res.status(400).json({ error: 'Bad company ID' }); return; }
    try { res.status(200).json({ deals: await companyDeals(id) }); }
    catch (err) {
      console.error('Company deals failed:', err.message);
      res.status(200).json({ deals: [], dealsError: err.status === 403 || err.category === 'MISSING_SCOPES' ? scopeHint(err, "Could not load this company's deals") : "Could not load this company's deals" });
    }
    return;
  }
  if (req.method === 'GET' && req.query && (req.query.company !== undefined || req.query.domain)) {
    const q = String(req.query.company || '').trim().slice(0, 100);
    const d = String(req.query.domain || '').trim().toLowerCase();
    const domain = /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) && !FREE_MAIL.test(d) ? d : '';
    try { res.status(200).json({ companies: await searchCompanies(q, domain) }); }
    catch (err) {
      console.error('Company search failed:', err.message);
      res.status(200).json({ companies: [], searchError: err.status === 403 || err.category === 'MISSING_SCOPES' ? scopeHint(err, 'Could not search HubSpot companies') : 'Could not search HubSpot companies' });
    }
    return;
  }
  if (req.method === 'GET') {
    try { res.status(200).json({ owners: await listOwners() }); }
    catch (err) {
      console.error('Owner list failed:', err.message);
      res.status(200).json({ owners: [], ownersError: err.status === 403 || err.category === 'MISSING_SCOPES' ? scopeHint(err, 'Could not load the list of HubSpot users') : 'Could not load the list of HubSpot users' });
    }
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ error: 'GET or POST only' }); return; }

  const b = req.body || {};
  const clean = v => String(v || '').trim();
  const companyName = clean(b.companyName), location = clean(b.location), contactName = clean(b.contactName);
  const phone = clean(b.phone), email = clean(b.email).toLowerCase(), nextSteps = clean(b.nextSteps);
  const ownerId = clean(b.ownerId), ownerName = clean(b.ownerName), pipelineKey = clean(b.pipeline);
  const amount = parseMoney(b.estimatedValue);
  const companyId = /^\d{1,20}$/.test(clean(b.companyId)) ? clean(b.companyId) : '';

  const problems = [];
  if (!companyName) problems.push('Company name is required.');
  if (!PIPELINES[pipelineKey]) problems.push('Choose Project or Recurring.');
  if (!ownerId && !ownerName) problems.push('Choose the Solution Group lead.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push('The email address does not look right.');
  if (clean(b.estimatedValue) && amount === null) problems.push('Estimated value should be a number, like 250000 or 250k.');
  if (problems.length) { res.status(400).json({ error: problems.join(' ') }); return; }

  const warnings = [];
  try {
    const stage = await prequalStage(pipelineKey);
    // Skip the location in the deal name when the company name already says which site it is
    const city = (splitLocation(location).city || '').toLowerCase();
    const dealname = location && !(city && companyName.toLowerCase().includes(city)) ? `${companyName} - ${location}` : companyName;

    // A double-tap or a retry after a slow network must not create a second deal
    const recent = await hubspotRequest('POST', '/crm/v3/objects/deals/search', {
      filterGroups: [{ filters: [
        { propertyName: 'dealname', operator: 'EQ', value: dealname },
        { propertyName: 'pipeline', operator: 'EQ', value: stage.pipelineId },
        { propertyName: 'createdate', operator: 'GT', value: String(Date.now() - 15 * 60 * 1000) },
      ] }],
      properties: ['dealname'], limit: 1,
    }).catch(() => null);
    if (recent?.results?.[0]) {
      const id = recent.results[0].id;
      res.status(200).json({ success: true, duplicate: true, dealId: id, dealName: dealname, dealUrl: await dealUrl(id), pipeline: stage.pipelineLabel, stage: stage.stageLabel, warnings });
      return;
    }

    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });
    const description = [
      `Lead entered through the SG Portal on ${today}.`,
      location && `Location: ${location}`,
      contactName && `Contact: ${contactName}${phone ? `, ${phone}` : ''}${email ? `, ${email}` : ''}`,
      !ownerId && ownerName && `Solution Group lead: ${ownerName}`,
      nextSteps && `Next steps: ${nextSteps}`,
    ].filter(Boolean).join('\n');

    const dealProps = {
      dealname, pipeline: stage.pipelineId, dealstage: stage.stageId, description,
      ...(amount !== null ? { amount: String(amount) } : {}),
      ...(ownerId ? { hubspot_owner_id: ownerId } : {}),
      ...(nextSteps ? { hs_next_step: nextSteps.slice(0, 1000) } : {}),
    };
    let deal;
    try {
      deal = await hubspotRequest('POST', '/crm/v3/objects/deals', { properties: dealProps });
    } catch (err) {
      // If this HubSpot account lacks the "Next step" field, keep it in the description only
      if (dealProps.hs_next_step && /hs_next_step/.test(err.message)) {
        delete dealProps.hs_next_step;
        deal = await hubspotRequest('POST', '/crm/v3/objects/deals', { properties: dealProps });
      } else throw err;
    }
    console.log(`Lead deal created: ${dealname} (${deal.id}) in ${stage.pipelineLabel} / ${stage.stageLabel}`);

    // Company and contact: the deal already exists, so a problem here is a warning, not a failure
    const emailDomain = email.split('@')[1] || '';
    const domain = emailDomain && !FREE_MAIL.test(emailDomain) ? emailDomain : '';
    let company = null, contact = null;
    try {
      company = await useOrCreateCompany({ companyId, companyName, location, domain, ownerId });
      await link('deals', deal.id, 'companies', company.id);
    } catch (err) { console.warn('Company step failed:', err.message); warnings.push(scopeHint(err, 'The company could not be added or linked')); }
    try {
      contact = await findOrCreateContact({ contactName, email, phone, companyName, ownerId });
      if (contact) {
        await link('deals', deal.id, 'contacts', contact.id);
        if (company) await link('contacts', contact.id, 'companies', company.id).catch(() => {});
      }
    } catch (err) { console.warn('Contact step failed:', err.message); warnings.push(scopeHint(err, 'The contact could not be added or linked')); }

    res.status(200).json({
      success: true, dealId: deal.id, dealName: dealname, dealUrl: await dealUrl(deal.id),
      pipeline: stage.pipelineLabel, stage: stage.stageLabel,
      company: company && { id: company.id, name: company.name, existing: company.existing },
      contact: contact && { id: contact.id, existing: contact.existing },
      warnings,
    });
  } catch (err) {
    console.error('Lead error:', err.message);
    res.status(500).json({ error: err.status === 403 ? scopeHint(err, 'HubSpot refused to create the deal') : `HubSpot error: ${err.message}` });
  }
};
