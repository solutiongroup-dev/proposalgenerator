const https = require("https");
const { requireAuth } = require("./_auth");

module.exports = async function (req, res) {
  if (!requireAuth(req, res)) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: { message: "ANTHROPIC_API_KEY not configured." } }); return; }

  const body = JSON.stringify(req.body);
  const options = {
    hostname: "api.anthropic.com", path: "/v1/messages", method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  };

  try {
    const result = await new Promise((resolve, reject) => {
      const proxyReq = https.request(options, (proxyRes) => {
        let data = "";
        proxyRes.on("data", (chunk) => (data += chunk));
        proxyRes.on("end", () => resolve({ status: proxyRes.statusCode, body: data }));
      });
      proxyReq.on("error", reject);
      proxyReq.write(body);
      proxyReq.end();
    });
    res.status(result.status).send(result.body);
  } catch (err) {
    res.status(502).json({ error: { message: `Proxy error: ${err.message}` } });
  }
};
