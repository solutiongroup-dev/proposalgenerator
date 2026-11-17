/**
 * SG Portal — weekly deal-review email
 * Runs Monday mornings (Vercel Cron, see vercel.json). Each owner of open deals gets a list
 * of the deals that most need an update, with a personal link to review them.
 *
 * GET /api/weekly-review                     (Vercel Cron, with CRON_SECRET) → sends to everyone
 * GET /api/weekly-review?preview=<ownerId>   (signed in) → shows that owner's email, sends nothing
 * GET /api/weekly-review?test=<ownerId>&to=<you@solutionmgt.com> (signed in) → sends that one email to you
 *
 * Sending uses EmailJS's server API: needs EMAILJS_PRIVATE_KEY and EMAILJS_REVIEW_TEMPLATE in Vercel,
 * and "Allow EmailJS API for non-browser applications" switched on in the EmailJS dashboard.
 */

const https = require('https');
const { isSignedIn, ownerLinkToken } = require('./_auth');
const { listOwners, ownerReview } = require('./_review');

const PORTAL = process.env.PORTAL_URL || 'https://proposalgenerator-ten.vercel.app';
const EMAILJS = {
  service: process.env.EMAILJS_SERVICE || 'service_71nz8kc',
  publicKey: process.env.EMAILJS_PUBLIC_KEY || 'uITaQIb_MQzLk8dQ7',
  privateKey: process.env.EMAILJS_PRIVATE_KEY,
  template: process.env.EMAILJS_REVIEW_TEMPLATE,
};
const LIST_MAX = 10;
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = n => n == null ? '' : '$' + Math.round(n).toLocaleString('en-US');

function buildEmail(owner, deals) {
  const todo = deals.filter(d => !d.reviewedRecently);
  const shown = todo.slice(0, LIST_MAX);
  const link = `${PORTAL}/?review=${owner.id}&t=${encodeURIComponent(ownerLinkToken(owner.id))}`;
  const word = owner.name.includes('@') ? '' : owner.name.split(/\s+/)[0];
  const first = word ? word[0].toUpperCase() + word.slice(1) : 'there';
  const rows = shown.map(d => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #edf0f5">
      <div style="font-weight:600;color:#1a2332">${esc(d.name)}</div>
      <div style="font-size:13px;color:#5a6a80">${esc(d.pipeline)} · ${esc(d.stage)}${d.amount != null ? ` · ${money(d.amount)}` : ''}${d.closeDate ? ` · closes ${esc(d.closeDate)}` : ''}</div>
      ${d.reasons.length ? `<div style="font-size:12px;color:#b54708;margin-top:3px">${esc(d.reasons.join(' · '))}</div>` : ''}
    </td></tr>`).join('');
  const html = `
    <p>Hi ${esc(first)},</p>
    <p>Here are your open deals that need a quick check this week. For each one, confirm nothing has changed, or update the details and add any context. It takes about a minute per deal.</p>
    <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${rows}</table>
    ${todo.length > shown.length ? `<p style="font-size:13px;color:#5a6a80">Plus ${todo.length - shown.length} more on the review page.</p>` : ''}
    <p style="margin:22px 0"><a href="${link}" style="background:#2B579A;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600">Review my deals</a></p>
    <p style="font-size:12px;color:#9aa5b4">This link opens your deals only and works for 14 days.</p>`;
  const text = `Hi ${first},\n\nYour open deals that need a check this week:\n\n` +
    shown.map(d => `- ${d.name} (${d.pipeline} · ${d.stage})${d.reasons.length ? `: ${d.reasons.join(', ')}` : ''}`).join('\n') +
    (todo.length > shown.length ? `\n…plus ${todo.length - shown.length} more.` : '') + `\n\nReview them here: ${link}\n`;
  return {
    to_name: owner.name, to_first_name: first, to_email: owner.email,
    todo_count: String(todo.length), deal_count: String(deals.length),
    subject: `Weekly deal review: ${todo.length} deal${todo.length === 1 ? '' : 's'} to check`,
    review_link: link, deals_html: html, deals_text: text,
  };
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

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};
  const fromCron = process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  if (!fromCron && !isSignedIn(req)) { res.status(401).json({ error: 'Not allowed.' }); return; }
  if (!process.env.HUBSPOT_API_KEY) { res.status(500).json({ error: 'HUBSPOT_API_KEY not configured.' }); return; }
  const ready = EMAILJS.privateKey && EMAILJS.template;

  try {
    const owners = await listOwners();

    // One person's email: preview it, or send it to a solutionmgt.com address to test
    const one = q.preview || q.test;
    if (one && !fromCron) {
      const owner = owners.find(o => o.id === String(one));
      if (!owner) { res.status(404).json({ error: 'Owner not found.' }); return; }
      const email = buildEmail(owner, await ownerReview(owner.id));
      if (q.preview) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.status(200).send(`<h3>${esc(email.subject)}</h3><p>To: ${esc(email.to_email)}</p><hr>${email.deals_html}`); return; }
      const to = String(q.to || '').trim().toLowerCase();
      if (!/^[^\s@]+@solutionmgt\.com$/.test(to)) { res.status(400).json({ error: 'Test emails go only to a solutionmgt.com address (add &to=you@solutionmgt.com).' }); return; }
      if (!ready) { res.status(503).json({ error: 'Email sending is not set up yet (EMAILJS_PRIVATE_KEY / EMAILJS_REVIEW_TEMPLATE).' }); return; }
      await sendEmailJS({ ...email, to_email: to, subject: `[TEST for ${owner.name}] ${email.subject}` });
      res.status(200).json({ sent: to, owner: owner.name, todo: email.todo_count });
      return;
    }

    if (!fromCron) { res.status(400).json({ error: 'Use ?preview=<ownerId> or ?test=<ownerId>&to=<email>. The full send runs on its schedule.' }); return; }
    if (!ready) { console.warn('Weekly review: email not set up, skipping'); res.status(200).json({ skipped: 'Email sending not set up' }); return; }

    const results = [];
    for (const owner of owners) {
      if (!owner.email) continue;
      try {
        const deals = await ownerReview(owner.id);
        const email = buildEmail(owner, deals);
        if (!deals.length || email.todo_count === '0') { results.push({ owner: owner.name, skipped: deals.length ? 'all reviewed' : 'no open deals' }); continue; }
        await sendEmailJS(email);
        results.push({ owner: owner.name, sent: email.todo_count });
      } catch (e) {
        console.error(`Weekly review for ${owner.name} failed:`, e.message);
        results.push({ owner: owner.name, error: e.message });
      }
    }
    console.log('Weekly review:', JSON.stringify(results));
    res.status(200).json({ results });
  } catch (err) {
    console.error('Weekly review error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
