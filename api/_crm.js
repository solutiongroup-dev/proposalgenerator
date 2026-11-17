// Shared HubSpot CRM helpers for the lead form and proposal sync (files starting with _ are not routes)
const { hubspotRequest } = require('./_hubspot');

// Free email providers: their domain says nothing about the company
const FREE_MAIL = /^(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|aol|icloud|me|mac|comcast|att|sbcglobal|verizon|bellsouth|charter|cox|earthlink|protonmail|proton|gmx|mail|zoho)\./i;


// ── Company ───────────────────────────────────────────────────────────────────
function splitLocation(location) {
  const parts = String(location || '').split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { city: parts.slice(0, -1).join(', '), state: parts[parts.length - 1] };
  return parts.length ? { city: parts[0] } : {};
}

// A full address like "123 Main St, Ennis, TX 75119" or "37 Davis Swan Lane\nPurvis, MS 39475"
// becomes HubSpot's address / city / state / zip. Anything that doesn't parse is left out.
function parseAddress(text) {
  const parts = String(text || '').split(/[\n,]+/).map(x => x.trim()).filter(Boolean);
  if (!parts.length) return {};
  const out = {};
  const last = parts[parts.length - 1];
  const m = last.match(/^([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/) || last.match(/^(.*?)[\s,]+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (m && m.length === 3) {           // "TX" or "TX 75119"
    out.state = m[1].toUpperCase(); if (m[2]) out.zip = m[2];
    if (parts.length >= 2) out.city = parts[parts.length - 2];
    if (parts.length >= 3 && /^\d/.test(parts[parts.length - 3])) out.address = parts[parts.length - 3];
  } else if (m && m.length === 4) {    // "Ennis TX 75119"
    out.city = m[1]; out.state = m[2].toUpperCase(); out.zip = m[3];
    if (parts.length >= 2 && /^\d/.test(parts[parts.length - 2])) out.address = parts[parts.length - 2];
  } else if (parts.length === 2) {     // "Ennis, Texas"
    return splitLocation(parts.join(', '));
  }
  return out;
}

async function searchOne(objectType, propertyName, value, properties) {
  const r = await hubspotRequest('POST', `/crm/v3/objects/${objectType}/search`, {
    filterGroups: [{ filters: [{ propertyName, operator: 'EQ', value }] }],
    properties, limit: 1,
  });
  return r.results?.[0] || null;
}

// Companies matching what's typed, plus every company on the contact's email domain.
// Several sites can share one domain (Agropur Lake Norden, Agropur Hull…), so the
// person picks the right one rather than the app guessing.
async function searchCompanies(q, domain) {
  const props = ['name', 'domain', 'city', 'state'];
  const found = new Map();
  const add = (results, sameDomain) => (results || []).forEach(c => {
    const p = c.properties || {};
    const prev = found.get(c.id);
    found.set(c.id, { id: c.id, name: p.name || '(no name)', domain: p.domain || '', city: p.city || '', state: p.state || '', sameDomain: sameDomain || prev?.sameDomain || false });
  });
  const jobs = [];
  if (q.length >= 2) {
    jobs.push(hubspotRequest('POST', '/crm/v3/objects/companies/search', { query: q, properties: props, limit: 20 }).then(r => add(r.results)));
    const word = q.split(/\s+/).find(w => w.length >= 3);
    if (word) jobs.push(hubspotRequest('POST', '/crm/v3/objects/companies/search', {
      filterGroups: [{ filters: [{ propertyName: 'name', operator: 'CONTAINS_TOKEN', value: `*${word.replace(/[^\w-]/g, '')}*` }] }],
      properties: props, limit: 20,
    }).then(r => add(r.results)).catch(() => {}));
  }
  if (domain) jobs.push(hubspotRequest('POST', '/crm/v3/objects/companies/search', {
    filterGroups: [{ filters: [{ propertyName: 'domain', operator: 'EQ', value: domain }] }],
    properties: props, limit: 50,
  }).then(r => add(r.results, true)));
  await Promise.all(jobs);
  const ql = q.toLowerCase();
  return [...found.values()]
    .sort((a, b) => (b.name.toLowerCase().startsWith(ql) - a.name.toLowerCase().startsWith(ql)) || a.name.localeCompare(b.name))
    .slice(0, 25);
}

async function useOrCreateCompany({ companyId, companyName, location, address, domain, ownerId }) {
  if (companyId) {
    const c = await hubspotRequest('GET', `/crm/v3/objects/companies/${companyId}?properties=name`);
    return { id: c.id, name: c.properties?.name || companyName, existing: true };
  }
  // Safety net: a company with exactly this name already exists, so use it instead of a duplicate
  const same = await searchOne('companies', 'name', companyName, ['name']);
  if (same) return { id: same.id, name: same.properties?.name || companyName, existing: true };
  const created = await hubspotRequest('POST', '/crm/v3/objects/companies', {
    properties: { name: companyName, ...(address ? parseAddress(address) : splitLocation(location)), ...(domain ? { domain } : {}), ...(ownerId ? { hubspot_owner_id: ownerId } : {}) },
  });
  return { id: created.id, name: companyName, existing: false };
}


const link = (from, fromId, to, toId) =>
  hubspotRequest('PUT', `/crm/v4/objects/${from}/${fromId}/associations/default/${to}/${toId}`);


let portalIdCache = null;
async function dealUrl(dealId) {
  try {
    if (!portalIdCache) portalIdCache = (await hubspotRequest('GET', '/account-info/v3/details')).portalId;
    return portalIdCache ? `https://app.hubspot.com/contacts/${portalIdCache}/record/0-3/${dealId}` : null;
  } catch (e) { return null; }
}

function scopeHint(err, what) {
  if (err.status === 403 || err.category === 'MISSING_SCOPES') {
    return `${what} (the HubSpot private app is missing a permission; ask Chase to add it)`;
  }
  return `${what}: ${err.message}`;
}


// ── Contact ─────────────────────────────────────────────────────────────────
async function findOrCreateContact({ contactName, email, phone, jobtitle, companyName, ownerId }) {
  const [firstname, ...rest] = String(contactName || '').trim().split(/\s+/).filter(Boolean);
  const lastname = rest.join(' ');
  if (email) {
    const found = await searchOne('contacts', 'email', email, ['firstname', 'lastname', 'phone', 'jobtitle', 'company']);
    if (found) {
      // Fill in only what's missing; never overwrite what's already in HubSpot
      const p = found.properties || {}, fill = {};
      if (phone && !p.phone) fill.phone = phone;
      if (firstname && !p.firstname) fill.firstname = firstname;
      if (lastname && !p.lastname) fill.lastname = lastname;
      if (jobtitle && !p.jobtitle) fill.jobtitle = jobtitle;
      if (companyName && !p.company) fill.company = companyName;
      if (Object.keys(fill).length) await hubspotRequest('PATCH', `/crm/v3/objects/contacts/${found.id}`, { properties: fill }).catch(() => {});
      return { id: found.id, existing: true };
    }
  } else if (!contactName && !phone) {
    return null;
  } else if (phone) {
    const byPhone = await searchOne('contacts', 'phone', phone, ['firstname', 'lastname']).catch(() => null);
    const n = byPhone?.properties || {};
    if (byPhone && (!firstname || String(n.firstname || '').toLowerCase() === firstname.toLowerCase())) return { id: byPhone.id, existing: true };
  }
  const props = {
    ...(firstname ? { firstname } : {}), ...(lastname ? { lastname } : {}),
    ...(phone ? { phone } : {}), ...(jobtitle ? { jobtitle } : {}), ...(companyName ? { company: companyName } : {}), ...(ownerId ? { hubspot_owner_id: ownerId } : {}),
  };
  try {
    const created = await hubspotRequest('POST', '/crm/v3/objects/contacts', { properties: { ...(email ? { email } : {}), ...props } });
    return { id: created.id, existing: false };
  } catch (err) {
    // HubSpot refuses emails it considers invalid; keep the contact, without the email
    if (email && /INVALID_EMAIL/.test(err.message) && (firstname || phone)) {
      const created = await hubspotRequest('POST', '/crm/v3/objects/contacts', { properties: props });
      return { id: created.id, existing: false, emailRejected: email };
    }
    if (email && /INVALID_EMAIL/.test(err.message)) throw Object.assign(new Error(`HubSpot says the email address ${email} is not valid, and there is no contact name or phone to save instead.`), { friendly: true });
    throw err;
  }
}

// ── Open deals linked to a company, for the proposal form's deal picker ─────
let pipelinesCache = null;
async function pipelineStages() {
  if (pipelinesCache && pipelinesCache.at > Date.now() - 10 * 60 * 1000) return pipelinesCache.map;
  const r = await hubspotRequest('GET', '/crm/v3/pipelines/deals');
  const map = {};
  for (const p of r.results || []) {
    map[p.id] = { label: p.label, stages: Object.fromEntries((p.stages || []).map(st => [st.id, {
      label: st.label, order: st.displayOrder, closed: st.metadata?.isClosed === 'true' || st.metadata?.isClosed === true,
    }])) };
  }
  pipelinesCache = { at: Date.now(), map };
  return map;
}

async function companyDeals(companyId) {
  const assoc = await hubspotRequest('GET', `/crm/v4/objects/companies/${companyId}/associations/deals?limit=100`);
  const ids = (assoc.results || []).map(r => String(r.toObjectId)).slice(0, 100);
  if (!ids.length) return [];
  const [batch, pipes] = await Promise.all([
    hubspotRequest('POST', '/crm/v3/objects/deals/batch/read', {
      inputs: ids.map(id => ({ id })),
      properties: ['dealname', 'pipeline', 'dealstage', 'amount', 'createdate', 'hs_is_closed'],
    }),
    pipelineStages(),
  ]);
  return (batch.results || []).map(d => {
    const p = d.properties || {}, pipe = pipes[p.pipeline], stage = pipe?.stages[p.dealstage];
    const closed = p.hs_is_closed === 'true' || stage?.closed;
    return { id: d.id, name: p.dealname || '(no name)', pipeline: pipe?.label || '', stage: stage?.label || '', amount: p.amount ? Number(p.amount) : null, created: p.createdate || '', closed };
  }).filter(d => !d.closed).sort((a, b) => String(b.created).localeCompare(String(a.created)));
}

module.exports = { FREE_MAIL, splitLocation, parseAddress, searchOne, findOrCreateContact, searchCompanies, useOrCreateCompany, companyDeals, pipelineStages, link, dealUrl, scopeHint };
