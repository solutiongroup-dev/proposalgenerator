// Weekly deal review: gathers each owner's open deals with the fields they confirm,
// the latest activity, the customer contact, and when the deal was last reviewed.
// Shared by /api/review (the review page) and /api/weekly-review (the Monday email).
// Files starting with _ are not routes.

const { hubspotRequest } = require('./_hubspot');
const { pipelineStages } = require('./_crm');

const PIPELINES = { '2276783856': 'Recurring', '2277462760': 'Projects', '2504421073': 'WaterSolve' };
const REVIEW_MARK = 'SG Portal deal review';           // starts every review note, so reviews can be found again
const REVIEWED_WITHIN_DAYS = 7;
const DEAL_PROPS = ['dealname', 'pipeline', 'dealstage', 'amount', 'closedate', 'hs_deal_stage_probability',
  'estimated_startup_date', 'estimated_contract_end_date', 'hubspot_owner_id', 'hs_lastmodifieddate', 'notes_last_updated', 'deal_notes'];

const DAY = 86400000;
const chunks = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
const strip = html => String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/\n{3,}/g, '\n\n').trim();

async function listOwners() {
  const owners = [];
  let after;
  for (let i = 0; i < 10; i++) {
    const page = await hubspotRequest('GET', `/crm/v3/owners/?limit=100&archived=false${after ? `&after=${after}` : ''}`);
    for (const o of page.results || []) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(' ').trim();
      owners.push({ id: String(o.id), name: name || o.email, email: (o.email || '').toLowerCase() });
    }
    after = page.paging?.next?.after;
    if (!after) break;
  }
  return owners;
}

// "ted", "Ted Winkelman" or "twinkelman@solutionmgt.com" → the matching HubSpot owner(s)
function matchOwners(owners, who) {
  const q = String(who || '').trim().toLowerCase();
  if (!q) return [];
  const byEmail = owners.filter(o => o.email === q);
  if (byEmail.length) return byEmail;
  const exact = owners.filter(o => o.name.toLowerCase() === q);
  if (exact.length) return exact;
  return owners.filter(o => o.name.toLowerCase().split(/\s+/).some(w => w.startsWith(q)) || o.name.toLowerCase().includes(q) || o.email.startsWith(q));
}

async function ownerOpenDeals(ownerId) {
  const deals = [];
  let after;
  for (let i = 0; i < 5; i++) {
    const r = await hubspotRequest('POST', '/crm/v3/objects/deals/search', {
      filterGroups: [{ filters: [
        { propertyName: 'hubspot_owner_id', operator: 'EQ', value: String(ownerId) },
        { propertyName: 'pipeline', operator: 'IN', values: Object.keys(PIPELINES) },
        { propertyName: 'hs_is_closed', operator: 'EQ', value: 'false' },
      ] }],
      properties: DEAL_PROPS, limit: 100, ...(after ? { after } : {}),
    });
    deals.push(...(r.results || []));
    after = r.paging?.next?.after;
    if (!after) break;
  }
  return deals;
}

// deal id → [associated ids] for one object type, in batches of 100
async function associated(dealIds, toType) {
  const map = {};
  for (const ids of chunks(dealIds, 100)) {
    try {
      const r = await hubspotRequest('POST', `/crm/v4/associations/deals/${toType}/batch/read`, { inputs: ids.map(id => ({ id })) });
      for (const row of r.results || []) map[String(row.from.id)] = (row.to || []).map(t => String(t.toObjectId));
    } catch (e) { console.warn(`Deal→${toType} associations failed:`, e.message); }
  }
  return map;
}

async function readMany(type, ids, properties) {
  const out = {};
  for (const batch of chunks([...new Set(ids)], 100)) {
    try {
      const r = await hubspotRequest('POST', `/crm/v3/objects/${type}/batch/read`, { inputs: batch.map(id => ({ id })), properties });
      for (const o of r.results || []) out[String(o.id)] = o.properties || {};
    } catch (e) { console.warn(`Reading ${type} failed:`, e.message); }
  }
  return out;
}

// The latest activity per deal (note, call, meeting or email), and the latest portal review
async function activity(dealIds) {
  const kinds = [
    { type: 'notes',    props: ['hs_timestamp', 'hs_note_body'], text: p => strip(p.hs_note_body), label: 'Note' },
    { type: 'calls',    props: ['hs_timestamp', 'hs_call_title', 'hs_call_body'], text: p => [p.hs_call_title, strip(p.hs_call_body)].filter(Boolean).join(': '), label: 'Call' },
    { type: 'meetings', props: ['hs_timestamp', 'hs_meeting_title', 'hs_meeting_body', 'hs_internal_meeting_notes'], text: p => [p.hs_meeting_title, strip(p.hs_internal_meeting_notes || p.hs_meeting_body)].filter(Boolean).join(': '), label: 'Meeting' },
    { type: 'emails',   props: ['hs_timestamp', 'hs_email_subject', 'hs_email_text'], text: p => [p.hs_email_subject, String(p.hs_email_text || '').slice(0, 400)].filter(Boolean).join(': '), label: 'Email' },
  ];
  const latest = {}, reviewed = {};
  await Promise.all(kinds.map(async k => {
    const assoc = await associated(dealIds, k.type);
    const objs = await readMany(k.type, Object.values(assoc).flat().slice(0, 1500), k.props);
    for (const [dealId, ids] of Object.entries(assoc)) {
      for (const id of ids) {
        const p = objs[id]; if (!p) continue;
        const at = Date.parse(p.hs_timestamp || '') || 0;
        const text = k.text(p);
        if (k.type === 'notes' && text.startsWith(REVIEW_MARK)) {
          if (!reviewed[dealId] || at > reviewed[dealId].at) reviewed[dealId] = { at, text };
          continue;   // a review note isn't "activity" with the customer
        }
        if (text.startsWith('Generated document:')) continue;   // proposal uploads aren't activity either
        if (!latest[dealId] || at > latest[dealId].at) latest[dealId] = { at, kind: k.label, text: text.slice(0, 600) };
      }
    }
  }));
  return { latest, reviewed };
}

const dateOnly = v => {
  if (!v) return '';
  const t = /^\d+$/.test(String(v)) ? Number(v) : Date.parse(v);
  return isNaN(t) ? '' : new Date(t).toISOString().slice(0, 10);
};

// Why a deal needs attention; the score orders each person's list
function attention(d, now) {
  const reasons = [];
  let score = 0;
  const close = Date.parse(d.closeDate || '');
  if (!d.closeDate) { reasons.push('No close date'); score += 3; }
  else if (close < now - DAY) { reasons.push('Close date has passed'); score += 4; }
  if (!d.amount) { reasons.push('No amount'); score += 3; }
  if (!d.startupDate) { reasons.push('No startup date'); score += 1; }
  if (!d.customer?.email) { reasons.push('No customer email'); score += 1; }
  const lastAct = d.lastActivity?.at || 0;
  if (!lastAct) { reasons.push('No activity logged'); score += 2; }
  else if (lastAct < now - 30 * DAY) { reasons.push(`No activity in ${Math.floor((now - lastAct) / DAY)} days`); score += 2; }
  if (close && close >= now && close < now + 30 * DAY) score += 2;   // closing soon: worth a look
  return { reasons, score };
}

async function ownerReview(ownerId) {
  const [raw, pipes] = await Promise.all([ownerOpenDeals(ownerId), pipelineStages()]);
  const ids = raw.map(d => String(d.id));
  const [{ latest, reviewed }, contactAssoc] = await Promise.all([activity(ids), associated(ids, 'contacts')]);
  const contacts = await readMany('contacts', Object.values(contactAssoc).flat().slice(0, 1500), ['email', 'firstname', 'lastname']);
  // The customer is the first linked contact who isn't one of our own people
  const isCustomer = c => c && !/@solutionmgt\.com$/i.test(c.email || '');
  const now = Date.now();

  const deals = raw.map(r => {
    const p = r.properties || {}, id = String(r.id), pipe = pipes[p.pipeline] || { label: PIPELINES[p.pipeline], stages: {} };
    const cId = (contactAssoc[id] || []).find(x => isCustomer(contacts[x])), c = cId ? contacts[cId] : null;
    const startup = dateOnly(p.estimated_startup_date), end = dateOnly(p.estimated_contract_end_date), close = dateOnly(p.closedate);
    const from = startup || close;
    const d = {
      id, name: p.dealname || '(no name)', pipelineId: p.pipeline, pipeline: PIPELINES[p.pipeline] || pipe.label,
      stageId: p.dealstage, stage: pipe.stages[p.dealstage]?.label || '',
      stages: Object.entries(pipe.stages).sort((a, b) => a[1].order - b[1].order).map(([sid, s]) => ({ id: sid, label: s.label })),
      amount: p.amount ? Number(p.amount) : null,
      closeDate: close, startupDate: startup, contractEndDate: end,
      contractDays: from && end ? Math.round((Date.parse(end) - Date.parse(from)) / DAY) : null,
      probability: p.hs_deal_stage_probability !== undefined && p.hs_deal_stage_probability !== null && p.hs_deal_stage_probability !== '' ? Math.round(Number(p.hs_deal_stage_probability) * 100) : null,
      customer: c ? { id: cId, email: c.email || '', name: [c.firstname, c.lastname].filter(Boolean).join(' ') } : null,
      dealNotes: strip(p.deal_notes || '').slice(0, 600),
      lastActivity: latest[id] || null,
      lastReview: reviewed[id] ? { at: reviewed[id].at } : null,
      modified: p.hs_lastmodifieddate || '',
    };
    const a = attention(d, now);
    d.reasons = a.reasons;
    d.reviewedRecently = !!(d.lastReview && d.lastReview.at > now - REVIEWED_WITHIN_DAYS * DAY);
    d.score = d.reviewedRecently ? -1 : a.score;
    return d;
  });
  // To-dos first (most urgent on top), then what's already been reviewed this week
  deals.sort((a, b) => (b.score - a.score) || String(a.closeDate || '9').localeCompare(String(b.closeDate || '9')));
  return deals;
}

module.exports = { PIPELINES, REVIEW_MARK, DEAL_PROPS, listOwners, matchOwners, ownerReview, dateOnly, strip };
