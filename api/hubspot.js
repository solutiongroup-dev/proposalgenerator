/**
 * SG Document Generator — HubSpot Integration
 * Route: POST /api/hubspot
 * Creates or updates deals. The document itself is attached by /api/hubspot-attach.
 */

const { requireAuth } = require('./_auth');

const HUBSPOT_TOKEN = process.env.HUBSPOT_API_KEY;

const PIPELINES = {
  Project:   { pipelineId: '2277462760', stageId: '3670652607' },
  Recurring: { pipelineId: '2276783856', stageId: '3669908170' },
};

// WaterSolve deals go to the WaterSolve pipeline, in its first stage
const WATERSOLVE_PIPELINE_ID = '2504421073';
let waterSolvePipelineCache = null;
async function waterSolvePipeline() {
  if (waterSolvePipelineCache) return waterSolvePipelineCache;
  const p = await hubspotRequest('GET', `/crm/v3/pipelines/deals/${WATERSOLVE_PIPELINE_ID}`);
  const stage = [...(p.stages || [])].filter(st => !st.archived).sort((a, b) => a.displayOrder - b.displayOrder)[0];
  if (!stage) throw new Error(`The WaterSolve pipeline (${WATERSOLVE_PIPELINE_ID}) has no stages`);
  waterSolvePipelineCache = { pipelineId: WATERSOLVE_PIPELINE_ID, stageId: stage.id, label: p.label || 'WaterSolve', stageLabel: stage.label };
  console.log(`WaterSolve pipeline: ${waterSolvePipelineCache.label}, stage ${stage.label} (${stage.id})`);
  return waterSolvePipelineCache;
}

// Pipeline for a deal: WaterSolve documents always go to the WaterSolve pipeline
async function resolvePipeline(pipeline, docType) {
  if (docType === 'watersolve' || pipeline === 'WaterSolve') return { key: 'WaterSolve', ...(await waterSolvePipeline()) };
  return pipeline === 'Project' ? { key: 'Project', ...PIPELINES.Project } : { key: 'Recurring', ...PIPELINES.Recurring };
}

module.exports.config = {
  api: { bodyParser: { sizeLimit: '2mb' } }
};

// HTTP helper is shared with the lead route
const { hubspotRequest } = require('./_hubspot');
const { FREE_MAIL, useOrCreateCompany, pipelineStages, link } = require('./_crm');

// ── Find or create contact ────────────────────────────────────────────────────
async function findOrCreateContact(email, firstName, lastName) {
  if (!email) return null;
  try {
    const search = await hubspotRequest('POST', '/crm/v3/objects/contacts/search', {
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
      properties: ['email', 'firstname', 'lastname'],
      limit: 1,
    });
    if (search.results?.length > 0) return search.results[0].id;
  } catch(e) { console.log('Contact search failed, trying create:', e.message); }

  try {
    const contact = await hubspotRequest('POST', '/crm/v3/objects/contacts', {
      properties: { email, firstname: firstName || '', lastname: lastName || '' },
    });
    return contact.id;
  } catch(e) {
    console.warn('Contact create failed:', e.message);
    return null;
  }
}

// ── Find HubSpot owner by email ───────────────────────────────────────────────
async function findOwnerByEmail(email) {
  if (!email) return null;
  try {
    const result = await hubspotRequest('GET', `/crm/v3/owners/?email=${encodeURIComponent(email)}&limit=1`);
    if (result.results?.length > 0) return result.results[0].id;
  } catch(e) { console.warn('Owner lookup failed:', e.message); }
  return null;
}

// ── Find existing deal ────────────────────────────────────────────────────────
async function findDealById(dealId) {
  if (!dealId) return null;
  try {
    const result = await hubspotRequest('GET', `/crm/v3/objects/deals/${encodeURIComponent(dealId)}?properties=dealname,pipeline,dealstage`);
    return result?.id ? result : null;
  } catch(e) { return null; }
}

// ── Find existing deal by client name (fuzzy) ─────────────────────────────────
async function findExistingDealByClient(clientName, pipelineId) {
  if (!clientName) return null;
  try {
    // Search deals by dealname containing the client name
    const cleanName = clientName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const result = await hubspotRequest('POST', '/crm/v3/objects/deals/search', {
      filterGroups: [{
        filters: [
          { propertyName: 'pipeline', operator: 'EQ', value: pipelineId },
          { propertyName: 'closedate', operator: 'GT', value: String(Date.now() - 365 * 24 * 60 * 60 * 1000) }, // within last year
        ]
      }],
      properties: ['dealname', 'amount', 'closedate', 'pipeline'],
      limit: 50,
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
    });

    if (!result.results?.length) return null;

    // Fuzzy match — find deals whose name contains the client name words
    const clientWords = cleanName.split(/\s+/).filter(w => w.length > 2);
    const matches = result.results.filter(deal => {
      const dealNameClean = (deal.properties?.dealname || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
      return clientWords.every(word => dealNameClean.includes(word));
    });

    if (matches.length > 0) {
      console.log(`Found existing deal for "${clientName}": ${matches[0].properties?.dealname} (${matches[0].id})`);
      return matches[0].id;
    }
  } catch(e) {
    console.warn('Fuzzy deal search failed:', e.message);
  }
  return null;
}
function buildDealName(clientName, docType, projectTitle) {
  if (projectTitle) {
    const words = projectTitle.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).slice(0, 4).join(' ');
    return `${clientName} - ${words}`;
  }
  return `${clientName} - ${docType === 'project' ? 'Capital Project' : 'O&M Services'}`;
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function (req, res) {
  if (!requireAuth(req, res)) return;

  if (!HUBSPOT_TOKEN) {
    console.error('HUBSPOT_API_KEY not set');
    res.status(500).json({ error: 'HUBSPOT_API_KEY not configured.' });
    return;
  }

  try {
    const body = req.body;
    console.log('HubSpot request — docType:', body.docType, 'pipeline:', body.pipeline, 'existingDealId:', body.existingDealId);

    const {
      docType, clientName, clientShortName, projectTitle,
      pipeline, dealAmount, closeDate, closeProbability,
      sgContactName, sgContactEmail, customerContactName, customerContactEmail,
      existingDealId, generatedBy, dealSource,
      managementCost, equipmentCost, laborCost, technologyCost,
      projectLengthDays, contractLengthDays,
      companyId: rawCompanyId, newCompanyName, dealChoice: rawDealChoice, hubspotCompanyName,
    } = body;
    // From the form's HubSpot section: the company picked (or a confirmed new one) and the
    // deal to update ('new' for a new deal). Older pages send neither and fall back to name matching.
    const companyId = /^\d{1,20}$/.test(String(rawCompanyId || '')) ? String(rawCompanyId) : '';
    const dealChoice = rawDealChoice === 'new' || /^\d{1,20}$/.test(String(rawDealChoice || '')) ? String(rawDealChoice) : '';
    const usesPicker = Boolean(companyId || (newCompanyName && String(newCompanyName).trim()));

    const pipelineConfig = await resolvePipeline(pipeline, docType);
    const isProjectLike = pipelineConfig.key !== 'Recurring';
    // New deals are named after the HubSpot company picked (e.g. "Agropur - Hull") so sites stay distinct
    const effectiveClientName = (usesPicker && String(hubspotCompanyName || newCompanyName || '').trim()) || clientName || clientShortName || 'Unknown Client';
    const dealName = buildDealName(effectiveClientName, docType, projectTitle);

    const parseCost = v => v ? parseFloat(String(v).replace(/[$,]/g, '')) || undefined : undefined;
    const amountNum = dealAmount ? parseFloat(String(dealAmount).replace(/[$,]/g, '')) || undefined : undefined;

    const addDays = (dateStr, days) => {
      if (!dateStr || !days) return undefined;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return undefined;
      d.setDate(d.getDate() + Number(days));
      return String(d.getTime());
    };

    // Default close date to 3 months from today if not specified
    const effectiveCloseDate = closeDate || (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 3);
      return d.toISOString().split('T')[0];
    })();

    const dealProps = {
      dealname:  dealName,
      pipeline:  pipelineConfig.pipelineId,
      dealstage: pipelineConfig.stageId,
      ...(amountNum        ? { amount: String(amountNum) }                                    : {}),
      closedate: String(new Date(effectiveCloseDate).getTime()),
      ...(closeProbability ? { hs_deal_stage_probability: String(Number(closeProbability) / 100) } : {}),
      ...(parseCost(managementCost) ? { management_cost: String(parseCost(managementCost)) } : {}),
      ...(parseCost(equipmentCost)  ? { equipment_cost:  String(parseCost(equipmentCost))  } : {}),
      ...(parseCost(laborCost)      ? { labor_cost:      String(parseCost(laborCost))      } : {}),
      ...(parseCost(technologyCost) ? { technology_cost: String(parseCost(technologyCost)) } : {}),
      ...(dealSource ? { deal_source: dealSource } : {}),
      ...(isProjectLike && projectLengthDays && effectiveCloseDate
        ? { estimated_project_end_date: addDays(effectiveCloseDate, projectLengthDays) } : {}),
      ...(!isProjectLike && contractLengthDays && effectiveCloseDate
        ? { estimated_contract_end_date: addDays(effectiveCloseDate, contractLengthDays) } : {}),
    };

    let dealId;
    let isNew = false;
    const warnings = [];

    // Owner = Primary SG Contact; falls back to the default owner (Chase Cochran)
    const DEFAULT_OWNER_ID = '163848624';
    let ownerId = null;
    try { ownerId = await findOwnerByEmail(sgContactEmail); } catch(e) {}
    if (!ownerId) ownerId = DEFAULT_OWNER_ID;

    // 1. Same session (a revision of the document just generated)
    let existingDeal = await findDealById(existingDealId);
    // 2. The deal picked in the form
    if (!existingDeal && dealChoice && dealChoice !== 'new') {
      existingDeal = await findDealById(dealChoice);
      if (!existingDeal) warnings.push('The deal picked in the form was not found in HubSpot, so a new deal was created.');
    }
    // 3. Older pages without the HubSpot section: match by client name
    if (!existingDeal && !usesPicker && !dealChoice) {
      const fuzzyId = await findExistingDealByClient(effectiveClientName, pipelineConfig.pipelineId);
      if (fuzzyId) existingDeal = await findDealById(fuzzyId);
    }

    if (existingDeal) {
      dealId = existingDeal.id;
      const cur = existingDeal.properties || {};
      const update = { ...dealProps };
      delete update.dealname;   // keep the name people already know it by
      // Never move a deal backward (e.g. from Negotiation back to Proposal) within the same pipeline
      if (cur.pipeline === pipelineConfig.pipelineId) {
        try {
          const stages = (await pipelineStages())[cur.pipeline]?.stages || {};
          const now = stages[cur.dealstage]?.order, target = stages[pipelineConfig.stageId]?.order;
          if (now != null && target != null && now > target) delete update.dealstage;
        } catch (e) { console.warn('Stage order check failed:', e.message); }
      }
      console.log('Updating existing deal:', dealId);
      await hubspotRequest('PATCH', `/crm/v3/objects/deals/${dealId}`, { properties: update });
    } else {
      console.log('Creating new deal:', dealName);
      if (ownerId) dealProps.hubspot_owner_id = ownerId;
      const deal = await hubspotRequest('POST', '/crm/v3/objects/deals', { properties: dealProps });
      dealId = deal.id;
      isNew = true;
      console.log('Deal created:', dealId);
    }

    // Company: the one picked in the form, or the confirmed new one
    let company = null;
    if (usesPicker) {
      const emailDomain = String(customerContactEmail || '').toLowerCase().split('@')[1] || '';
      try {
        company = await useOrCreateCompany({
          companyId, companyName: String(newCompanyName || effectiveClientName).trim(),
          location: '', domain: emailDomain && !FREE_MAIL.test(emailDomain) ? emailDomain : '', ownerId,
        });
        await link('deals', dealId, 'companies', company.id);
      } catch (e) {
        console.warn('Company step failed:', e.message);
        warnings.push(e.status === 403 ? 'The company could not be linked (the HubSpot private app is missing a permission).' : `The company could not be linked: ${e.message}`);
      }
    }

    // Contact, linked to the deal and the company
    const nameParts = (customerContactName || '').trim().split(/\s+/);
    const contactId = await findOrCreateContact(customerContactEmail, nameParts[0] || '', nameParts.slice(1).join(' ') || '');
    if (contactId) {
      try { await link('deals', dealId, 'contacts', contactId); console.log('Contact associated:', contactId); }
      catch(e) { console.warn('Contact association failed:', e.message); }
      if (company) await link('contacts', contactId, 'companies', company.id).catch(e => console.warn('Contact-company link failed:', e.message));
    }

    res.status(200).json({ success: true, dealId, dealName: existingDeal?.properties?.dealname || dealName, isNew, pipeline: pipelineConfig.label || pipelineConfig.key,
      company: company && { id: company.id, name: company.name, existing: company.existing }, warnings });

  } catch(err) {
    console.error('HubSpot error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
