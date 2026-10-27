/**
 * SG Document Generator — HubSpot Document Attachment
 * Route: POST /api/hubspot-attach
 * Uploads the generated .docx to HubSpot Files and attaches it to the deal
 * as a note, so it shows in the deal's activity timeline and Attachments card.
 *
 * Body: { dealId, filename, docBase64 }
 * Requires private app scopes: files, crm.objects.deals.read, crm.objects.deals.write
 */

const HUBSPOT_TOKEN = process.env.HUBSPOT_API_KEY;
const FOLDER_PATH   = '/SG Document Generator';
const NOTE_TO_DEAL  = 214; // HubSpot-defined association type: note → deal
const DOCX_MIME     = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

module.exports.config = {
  api: { bodyParser: { sizeLimit: '4mb' } }
};

async function hubspotFetch(path, init) {
  const resp = await fetch(`https://api.hubapi.com${path}`, {
    ...init,
    headers: { 'Authorization': `Bearer ${HUBSPOT_TOKEN}`, ...(init.headers || {}) },
  });
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { data = { message: text }; }
  if (!resp.ok) throw new Error(`HubSpot ${resp.status} on ${path}: ${data.message || text}`);
  return data;
}

// ── Upload file to HubSpot File Manager ───────────────────────────────────────
async function uploadFile(buffer, filename) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: DOCX_MIME }), filename);
  form.append('fileName', filename.replace(/\.docx$/i, ''));
  form.append('folderPath', FOLDER_PATH);
  // PRIVATE: only signed-in HubSpot users can open it; it is not a public link.
  // duplicateValidationStrategy NONE: each revision is kept as its own file.
  form.append('options', JSON.stringify({ access: 'PRIVATE', duplicateValidationStrategy: 'NONE' }));
  return hubspotFetch('/files/v3/files', { method: 'POST', body: form });
}

// ── Create a note on the deal with the file attached ──────────────────────────
async function createNoteOnDeal(dealId, fileId, filename) {
  const safeName = filename.replace(/[<>&"]/g, '');
  return hubspotFetch('/crm/v3/objects/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: {
        hs_timestamp:      new Date().toISOString(),
        hs_note_body:      `<p><strong>Generated document:</strong> ${safeName}</p><p>Uploaded automatically by the SG Document Generator.</p>`,
        hs_attachment_ids: String(fileId),
      },
      associations: [{
        to:    { id: String(dealId) },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: NOTE_TO_DEAL }],
      }],
    }),
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (!HUBSPOT_TOKEN) {
    res.status(500).json({ error: 'HUBSPOT_API_KEY not configured.' });
    return;
  }

  const { dealId, filename, docBase64 } = req.body || {};
  if (!dealId || !filename || !docBase64) {
    res.status(400).json({ error: 'dealId, filename and docBase64 are required.' });
    return;
  }

  try {
    const buffer = Buffer.from(docBase64, 'base64');
    console.log(`Attaching "${filename}" (${buffer.length} bytes) to deal ${dealId}`);

    const file = await uploadFile(buffer, filename);
    console.log('File uploaded:', file.id);

    const note = await createNoteOnDeal(dealId, file.id, filename);
    console.log('Note created on deal:', note.id);

    res.status(200).json({ success: true, fileId: file.id, noteId: note.id });
  } catch(err) {
    console.error('HubSpot attach error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
