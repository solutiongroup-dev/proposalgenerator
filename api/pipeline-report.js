/**
 * SG Portal — weekly pipeline reports
 * Runs Monday mornings (Vercel Cron, see vercel.json), right after the deal-review emails.
 * One email per pipeline, to that pipeline's list below: totals, deals by stage, what closed
 * last week, what needs attention, and every open deal grouped by stage. Built for the
 * weekly pipeline meeting: everyone walks in with the same, current picture.
 *
 * GET /api/pipeline-report                    (Vercel Cron, with CRON_SECRET) → sends all reports
 * GET /api/pipeline-report?preview=projects   (signed in) → shows that report, sends nothing
 *     (projects | recurring | bd)
 *
 * Sends with the "SG Portal – Weekly deal review" EmailJS template (To {{to_email}},
 * subject {{subject}}, body {{{deals_html}}}), so it needs no template of its own.
 */

const https = require('https');
const { isSignedIn } = require('./_auth');
const { listOwners, ownerReview } = require('./_review');
const { pipelineStages } = require('./_crm');

const PORTAL = process.env.PORTAL_URL || 'https://proposalgenerator-ten.vercel.app';
const EMAILJS = {
  service: process.env.EMAILJS_SERVICE || 'service_71nz8kc',
  publicKey: process.env.EMAILJS_PUBLIC_KEY || 'uITaQIb_MQzLk8dQ7',
  privateKey: process.env.EMAILJS_PRIVATE_KEY,
  template: process.env.EMAILJS_REPORT_TEMPLATE || process.env.EMAILJS_REVIEW_TEMPLATE,
};

// Who gets which report
const REPORTS = [
  { key: 'projects', pipelineId: '2277462760', name: 'Projects', to: [
    'jbrenan@solutionmgt.com', 'ccarr@solutionmgt.com', 'ekasparian@solutionmgt.com', 'msilver@solutionmgt.com',
    'twinkelman@solutionmgt.com', 'bkoepsel@solutionmgt.com', 'tbatterson@solutionmgt.com', 'clutelle@solutionmgt.com'] },
  { key: 'recurring', pipelineId: '2276783856', name: 'Recurring', to: [
    'msilver@solutionmgt.com', 'twinkelman@solutionmgt.com', 'tbatterson@solutionmgt.com', 'cpierce@solutionmgt.com',
    'clutelle@solutionmgt.com', 'jbrenan@solutionmgt.com', 'bkoepsel@solutionmgt.com'] },
  { key: 'bd', pipelineId: '2710441665', name: 'BD (M&A)', to: [
    'cpierce@solutionmgt.com', 'bkoepsel@solutionmgt.com', 'tbatterson@solutionmgt.com', 'jbrenan@solutionmgt.com'] },
];

const DAY = 86400000;
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = n => '$' + Math.round(n || 0).toLocaleString('en-US');
const short = n => n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : money(n);
const day = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' });

const TD = 'padding:6px 8px;border-bottom:1px solid #edf0f5;vertical-align:top';
const TH = 'padding:6px 8px;border-bottom:2px solid #d5dce6;text-align:left;font-size:12px;color:#5a6a80;font-weight:600';
const H = 'margin:24px 0 8px;font-size:16px;color:#1a2332';

function buildReport(report, deals, stageOrder, now = Date.now()) {
  const open = deals.filter(d => !d.closed);
  const total = open.reduce((s, d) => s + (d.amount || 0), 0);
  const weighted = open.reduce((s, d) => s + (d.amount || 0) * ((d.probability ?? 0) / 100), 0);
  const closedRecent = deals.filter(d => d.closed && d.closeDate && Date.parse(d.closeDate) >= now - 8 * DAY);
  const reviewed = open.filter(d => d.lastReview && d.lastReview.at >= now - 7 * DAY).length;
  const attention = open.filter(d => d.reasons.some(r => /Close date has passed|No close date|No amount/.test(r)));

  // Stages in pipeline order, open ones only
  const byStage = {};
  for (const d of open) (byStage[d.stage || 'No stage'] = byStage[d.stage || 'No stage'] || []).push(d);
  const stages = Object.keys(byStage).sort((a, b) => (stageOrder[a] ?? 99) - (stageOrder[b] ?? 99));

  const week = new Date(now).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });
  const subject = `${report.name} pipeline: ${open.length} open deal${open.length === 1 ? '' : 's'}, ${short(total)} (week of ${week})`;
  // Kept compact: EmailJS caps a message at about 50 KB, and Projects has 70+ deals
  const dealRow = (d, i) => `<tr${i % 2 ? '' : ' bgcolor="#f5f7fa"'}><td><b>${esc(d.name)}</b>${d.reasons.length ? `<br><font size="1" color="#b54708">${esc(d.reasons.slice(0, 3).join(' · '))}</font>` : ''}</td><td>${esc(d.ownerName)}</td><td align="right">${d.amount != null ? money(d.amount) : '–'}</td><td>${esc(d.closeDate || '–')}</td><td><font color="#5a6a80">${d.lastUpdate ? `${day(d.lastUpdate.at)}${d.lastUpdate.by ? `, ${esc(d.lastUpdate.by)}` : ''}` : 'None'}</font></td></tr>`;
  const head = `<tr><th style="${TH}">Deal</th><th style="${TH}">Owner</th><th style="${TH};text-align:right">Amount</th><th style="${TH}">Close</th><th style="${TH}">Last update</th></tr>`;
  const table = rows => `<table width="100%" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">${head}${rows}</table>`;

  const html = `
    <p style="font-size:13px;color:#5a6a80;margin:0 0 4px">SG Portal · weekly pipeline report · ${esc(week)}</p>
    <h2 style="margin:0 0 14px;color:#1a2332">${esc(report.name)} pipeline</h2>
    <table style="border-collapse:collapse;font-family:Arial,sans-serif"><tr>
      ${[['Open deals', String(open.length)], ['Open value', money(total)], ['Weighted value', money(weighted)], ['Reviewed last 7 days', `${reviewed} of ${open.length}`]]
        .map(([k, v]) => `<td style="padding:10px 14px;background:#f4f7fb;border:3px solid #fff;border-radius:6px"><div style="font-size:11px;color:#5a6a80">${k}</div><div style="font-size:18px;font-weight:700;color:#1a2332">${v}</div></td>`).join('')}
    </tr></table>

    <h3 style="${H}">Deals by stage</h3>
    <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">
      <tr><th style="${TH}">Stage</th><th style="${TH};text-align:right">Deals</th><th style="${TH};text-align:right">Value</th></tr>
      ${stages.map(s => `<tr><td style="${TD}">${esc(s)}</td><td style="${TD};text-align:right">${byStage[s].length}</td><td style="${TD};text-align:right">${money(byStage[s].reduce((t, d) => t + (d.amount || 0), 0))}</td></tr>`).join('')}
    </table>

    <h3 style="${H}">Closed in the last week</h3>
    ${closedRecent.length ? `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">${closedRecent.map(d => `<tr><td style="${TD}"><span style="color:${d.closed === 'won' ? '#0a6554' : '#8a94a6'};font-weight:600">${d.closed === 'won' ? 'Won' : 'Lost'}</span></td><td style="${TD}">${esc(d.name)}</td><td style="${TD}">${esc(d.ownerName)}</td><td style="${TD};text-align:right">${d.amount != null ? money(d.amount) : '–'}</td></tr>`).join('')}</table>` : '<p style="font-size:13px;color:#5a6a80;margin:0">None.</p>'}

    <h3 style="${H}">Needs attention (${attention.length})</h3>
    <p style="font-size:12px;color:#5a6a80;margin:0 0 6px">Close date passed, no close date, or no amount. Owners can fix these in a minute on the review page.</p>
    ${attention.length ? table(attention.slice(0, 15).map(dealRow).join('')) + (attention.length > 15 ? `<p style="font-size:12px;color:#5a6a80">Plus ${attention.length - 15} more below.</p>` : '') : '<p style="font-size:13px;color:#5a6a80;margin:0">Nothing. Every open deal has a current close date and an amount.</p>'}

    <h3 style="${H}">All open deals by stage</h3>
    %%ALL%%

    <p style="margin:24px 0"><a href="${PORTAL}/?review" style="background:#2B579A;color:#ffffff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:600">Open All Deals in the portal</a></p>
    <p style="font-size:11px;color:#9aa5b4">Straight from HubSpot this morning. "Last update" is the latest portal review, note, call, meeting or email on the deal, and who logged it.</p>`;
  // The full list, unless the email would be too big for EmailJS (then the portal has it)
  const all = stages.map(s => `<div style="margin:14px 0 4px;font-weight:700;color:#2B579A">${esc(s)} · ${byStage[s].length}</div>${table(byStage[s].map(dealRow).join(''))}`).join('');
  const full = html.replace('%%ALL%%', () => all);
  return { subject, open: open.length, html: Buffer.byteLength(full) < 46000 ? full
    : html.replace('%%ALL%%', () => `<p style="font-size:13px;color:#5a6a80">${open.length} open deals: too many to list in one email. Open All Deals in the portal for the full list.</p>`) };
}

function sendEmailJS(params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ service_id: EMAILJS.service, template_id: EMAILJS.template, user_id: EMAILJS.publicKey, accessToken: EMAILJS.privateKey, template_params: params });
    const req = https.request({ hostname: 'api.emailjs.com', path: '/api/v1.0/email/send', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => res.statusCode < 300 ? resolve(data) : reject(new Error(`EmailJS ${res.statusCode}: ${data.slice(0, 200)}`)));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('EmailJS did not answer in 20 seconds')));
    req.write(body); req.end();
  });
}

async function buildAll(only) {
  const owners = await listOwners();
  const names = Object.fromEntries(owners.map(o => [o.id, o.name]));
  // Every deal in every pipeline, open and closed, with last update and what needs attention
  const [deals, pipes] = await Promise.all([ownerReview(null, { bd: true, all: true, owners: names }), pipelineStages()]);
  return REPORTS.filter(r => !only || r.key === only).map(r => {
    const order = Object.fromEntries(Object.values(pipes[r.pipelineId]?.stages || {}).map(s => [s.label, s.order]));
    return { report: r, email: buildReport(r, deals.filter(d => d.pipelineId === r.pipelineId), order) };
  });
}

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};
  const fromCron = process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  if (!fromCron && !isSignedIn(req)) { res.status(401).json({ error: 'Not allowed.' }); return; }
  if (!process.env.HUBSPOT_API_KEY) { res.status(500).json({ error: 'HUBSPOT_API_KEY not configured.' }); return; }

  try {
    if (!fromCron) {
      const key = String(q.preview || '');
      if (!REPORTS.some(r => r.key === key)) { res.status(400).json({ error: 'Use ?preview=projects, recurring or bd. The reports send on their schedule.' }); return; }
      const [{ report, email }] = await buildAll(key);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(`<h3>${esc(email.subject)}</h3><p>To: ${esc(report.to.join(', '))}</p><hr><div style="max-width:760px">${email.html}</div>`);
      return;
    }
    if (!EMAILJS.privateKey || !EMAILJS.template) { console.warn('Pipeline reports: email not set up, skipping'); res.status(200).json({ skipped: 'Email sending not set up' }); return; }

    const results = [];
    for (const { report, email } of await buildAll()) {
      try {
        await sendEmailJS({ to_email: report.to.join(', '), subject: email.subject, deals_html: email.html });
        results.push({ report: report.key, sent: report.to.length, open: email.open });
      } catch (e) { results.push({ report: report.key, error: e.message }); }
    }
    console.log('Pipeline reports: ' + JSON.stringify(results));
    res.status(200).json({ results });
  } catch (err) {
    console.error('Pipeline report error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports.buildReport = buildReport;
module.exports.REPORTS = REPORTS;
