/**
 * SG Portal — feedback
 * POST /api/feedback { name, area, rating, message, page, docType, context, errorOnScreen, browser, screen, at }
 * Writes each report to the site logs (Vercel → Logs, search "FEEDBACK"), so nothing is lost
 * even before the EmailJS feedback template is set up. The page emails it too.
 */

const { requireAuth } = require('./_auth');

module.exports = async function (req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const b = req.body || {};
  const clip = (v, n) => String(v ?? '').slice(0, n);
  const report = {
    name: clip(b.name, 120), area: clip(b.area, 80), rating: clip(b.rating, 40), message: clip(b.message, 5000),
    page: clip(b.page, 40), docType: clip(b.docType, 40), context: clip(b.context, 300), errorOnScreen: clip(b.errorOnScreen, 600),
    browser: clip(b.browser, 300), screen: clip(b.screen, 20), at: clip(b.at, 60),
  };
  if (!report.message.trim()) { res.status(400).json({ error: 'Feedback is empty.' }); return; }
  console.log('FEEDBACK ' + JSON.stringify(report));
  res.status(200).json({ ok: true });
};
