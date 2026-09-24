/**
 * SG Document Generator — HubSpot Integration
 * Route: POST /api/hubspot
 * Creates or updates deals. File attachment removed.
 */

const https = require('https');

const HUBSPOT_TOKEN = process.env.HUBSPOT_API_KEY;

const PIPELINES = {
  Project:   { pipelineId: '2277462760', stageId: '3670652607' },
  Recurring: { pipelineId: '2276783856', stageId: '3669908170' },
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '2mb' } }
};

// ── HTTP helper ───────────────────────────────────────────────────────────────
function hubspotRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.hubapi.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject(new Error(`HubSpot ${res.statusCode}: ${parsed.message || data}`));
          else resolve(parsed);
        } catch(e) { reject(new Error(`HubSpot parse error: ${data}`)); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

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
    const result = await hubspotRequest('GET', `/crm/v3/objects/deals/${dealId}`);
    return result?.id ? result : null;
  } catch(e) { return null; }
}

// ── Find existing deal by client name (fuzzy) ─────────────────────────────────
async function findExistingDealByClient(clientName, pipeline) {
  if (!clientName) return null;
  try {
    // Search deals by dealname containing the client name
    const cleanName = clientName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const pipelineId = pipeline === 'Project' ? PIPELINES['Project'].pipelineId : PIPELINES['Recurring'].pipelineId;
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

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
    } = body;

    const pipelineConfig = pipeline === 'Project' ? PIPELINES['Project'] : PIPELINES['Recurring'];
    const effectiveClientName = clientName || clientShortName || 'Unknown Client';
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
      ...(pipeline === 'Project' && projectLengthDays && effectiveCloseDate
        ? { estimated_project_end_date: addDays(effectiveCloseDate, projectLengthDays) } : {}),
      ...(pipeline === 'Recurring' && contractLengthDays && effectiveCloseDate
        ? { estimated_contract_end_date: addDays(effectiveCloseDate, contractLengthDays) } : {}),
    };

    let dealId;
    let isNew = false;

    // Check 1: session-level existingDealId (fastest — same session)
    let existingDeal = await findDealById(existingDealId);

    // Check 2: fuzzy match by client name across all deals (cross-session duplicate prevention)
    if (!existingDeal) {
      const fuzzyId = await findExistingDealByClient(effectiveClientName, pipeline);
      if (fuzzyId) existingDeal = await findDealById(fuzzyId);
    }

    if (existingDeal) {
      const foundId = existingDeal.id || existingDealId;
      console.log('Updating existing deal:', foundId);
      await hubspotRequest('PATCH', `/crm/v3/objects/deals/${foundId}`, { properties: dealProps });
      dealId = foundId;
    } else {
      console.log('Creating new deal:', dealName);
      // Owner = Primary SG Contact on the deal
      // Falls back to default owner (Chase Cochran) if lookup fails due to scope limitations
      const DEFAULT_OWNER_ID = '163848624';
      let ownerId = null;
      try { ownerId = await findOwnerByEmail(sgContactEmail); } catch(e) {}
      if (!ownerId) ownerId = DEFAULT_OWNER_ID;
      if (ownerId) dealProps.hubspot_owner_id = ownerId;

      const deal = await hubspotRequest('POST', '/crm/v3/objects/deals', { properties: dealProps });
      dealId = deal.id;
      isNew = true;
      console.log('Deal created:', dealId);

      // Associate contact
      const nameParts = (customerContactName || '').trim().split(/\s+/);
      const contactId = await findOrCreateContact(
        customerContactEmail,
        nameParts[0] || '',
        nameParts.slice(1).join(' ') || ''
      );
      if (contactId && dealId) {
        try {
          await hubspotRequest('PUT',
            `/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/deal_to_contact`,
            {}
          );
          console.log('Contact associated:', contactId);
        } catch(e) { console.warn('Contact association failed:', e.message); }
      }
    }

    res.status(200).json({ success: true, dealId, dealName, isNew });

  } catch(err) {
    console.error('HubSpot error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
