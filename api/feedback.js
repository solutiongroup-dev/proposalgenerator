/**
 * SG Portal — feedback
 * POST /api/feedback { name, area, rating, message, page, docType, context, errorOnScreen, browser, screen, at [, owner, t] }
 *
 * Every report reaches Chase:
 *  1. a HubSpot task assigned to him (HubSpot emails him that a task was assigned), and
 *  2. an email, once EMAILJS_FEEDBACK_TEMPLATE is set in Vercel.
 * It is also written to the site logs (Vercel → Logs, search "FEEDBACK"), so nothing is lost
 * even if both of those fail. Open to the team sign-in and to the weekly-review email link.
 */

const https = require('https');
const { isSignedIn, ownerLinkValid } = require('./_auth');
const { hubspotRequest } = require('./_hubspot');

const FEEDBACK_OWNER = process.env.FEEDBACK_OWNER_ID || '163848624';   // Chase in HubSpot
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function emailjs(params) {
  const body = JSON.stringify({
    service_id: process.env.EMAILJS_SERVICE || 'service_71nz8kc', template_id: process.env.EMAILJS_FEEDBACK_TEMPLATE,
    user_id: process.env.EMAILJS_PUBLIC_KEY || 'uITaQIb_MQzLk8dQ7', accessToken: process.env.EMAILJS_PRIVATE_KEY, template_params: params,
  });
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'api.emailjs.com', path: '/api/v1.0/email/send', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => res.statusCode < 300 ? resolve() : reject(new Error(`EmailJS ${res.statusCode}: ${d.slice(0, 200)}`)));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('EmailJS did not answer in 20 seconds')));
    req.write(body); req.end();
  });
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const b = req.body || {};
  const viaLink = b.owner && b.t && ownerLinkValid(String(b.owner), b.t);
  if (!isSignedIn(req) && !viaLink) { res.status(401).json({ error: 'Please sign in again.' }); return; }

  const clip = (v, n) => String(v ?? '').slice(0, n);
  const report = {
    name: clip(b.name, 120), area: clip(b.area, 80), rating: clip(b.rating, 40), message: clip(b.message, 5000),
    page: clip(b.page, 40), docType: clip(b.docType, 40), context: clip(b.context, 300), errorOnScreen: clip(b.errorOnScreen, 600),
    browser: clip(b.browser, 300), screen: clip(b.screen, 20), at: clip(b.at, 60),
  };
  if (!report.message.trim()) { res.status(400).json({ error: 'Feedback is empty.' }); return; }
  console.log('FEEDBACK ' + JSON.stringify(report));

  const delivered = [];
  // 1. HubSpot task for Chase: works today, and doubles as a feedback inbox he can tick off
  if (process.env.HUBSPOT_API_KEY) {
    try {
      const first = report.message.replace(/\s+/g, ' ').slice(0, 70);
      const body = [
        `<strong>${esc(report.rating)}</strong> · ${esc(report.area)}`,
        esc(report.message).replace(/\n/g, '<br>'),
        `From: ${esc(report.name)} · ${esc(report.at)}`,
        `Page: ${esc(report.page || '–')}${report.docType ? ` · ${esc(report.docType)}` : ''}${report.context ? ` · ${esc(report.context)}` : ''}`,
        report.errorOnScreen && `Error on screen: ${esc(report.errorOnScreen)}`,
        `<span style="color:#888">${esc(report.browser)} (${esc(report.screen)})</span>`,
      ].filter(Boolean).join('<br><br>');
      await hubspotRequest('POST', '/crm/v3/objects/tasks', { properties: {
        hs_timestamp: new Date().toISOString(), hs_task_subject: `Portal feedback from ${report.name}: ${first}${report.message.length > 70 ? '…' : ''}`,
        hs_task_body: body, hs_task_status: 'NOT_STARTED', hs_task_priority: /didn't work/i.test(report.rating) ? 'HIGH' : 'MEDIUM',
        hs_task_type: 'TODO', hubspot_owner_id: FEEDBACK_OWNER,
      } });
      delivered.push('hubspot');
    } catch (e) { console.error('Feedback → HubSpot task failed:', e.message); }
  }
  // 2. Email, once the template exists
  if (process.env.EMAILJS_FEEDBACK_TEMPLATE && process.env.EMAILJS_PRIVATE_KEY) {
    try {
      await emailjs({
        from_name: report.name, area: report.area, rating: report.rating, message: report.message,
        page: report.page, doc_type: report.docType || 'None', context: report.context || 'None',
        error_on_screen: report.errorOnScreen || 'None', browser: `${report.browser} (${report.screen})`, submitted_at: report.at,
      });
      delivered.push('email');
    } catch (e) { console.error('Feedback → email failed:', e.message); }
  }
  res.status(200).json({ ok: true, delivered });
};
