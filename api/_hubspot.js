// Shared HubSpot API helper (files starting with _ are not routes)
const https = require('https');

function hubspotRequest(method, path, body) {
  const token = process.env.HUBSPOT_API_KEY;
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.hubapi.com', path, method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 204 || !data) { if (res.statusCode >= 400) reject(Object.assign(new Error(`HubSpot ${res.statusCode}`), { status: res.statusCode })); else resolve({}); return; }
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject(Object.assign(new Error(`HubSpot ${res.statusCode}: ${parsed.message || data}`), { status: res.statusCode, category: parsed.category }));
          else resolve(parsed);
        } catch (e) { reject(new Error(`HubSpot parse error: ${data.slice(0, 300)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('HubSpot did not answer in 30 seconds')));
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = { hubspotRequest };
