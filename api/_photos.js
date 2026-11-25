// Photos people upload with a proposal: the page labels each one "[Photo n: file name]" and
// sends it as an image. Claude reads them like any other source, and also picks which belong in
// the finished document (process, equipment and site photos, not screenshots of prices) and
// writes a caption for each. The builders place them in a photo section.
// Files starting with _ are not routes.

const { Paragraph, ImageRun, TextRun, AlignmentType } = require('docx');

// Width and height of a JPEG or PNG, read from its header (null when it isn't one)
function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: 'png' };
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1], len = buf.readUInt16BE(i + 2);
      // Start-of-frame markers carry the size (C4, C8 and CC are other tables)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), type: 'jpg' };
      i += 2 + len;
    }
  }
  return null;
}

// The uploaded photos, in upload order: a "[Photo n: name]" text block followed by its image
function uploadedPhotos(blocks) {
  const out = [];
  (blocks || []).forEach((b, i) => {
    const m = b?.type === 'text' && /^\[Photo (\d+): ([^\]]*)\]/.exec(b.text);
    const img = m && blocks[i + 1];
    if (img?.type !== 'image') return;
    const data = Buffer.from(img.source.data, 'base64'), size = imageSize(data);
    if (size && size.w > 0 && size.h > 0) out.push({ n: Number(m[1]), name: m[2], data, ...size });
  });
  return out;
}

// What Claude is told when photos are attached
const photoRules = photos => `

PHOTOS: ${photos.length} photo${photos.length === 1 ? ' is' : 's are'} attached, each labeled "[Photo n: file name]" just before it (${photos.map(p => `Photo ${p.n}: ${p.name}`).join('; ')}).
- Add "photos": [{"n": 1, "caption": "..."}] listing the photos that belong in the finished document, in the order they should appear, each with a one-sentence caption saying what it shows (the equipment, process step or site condition). Keep the order that tells the story, e.g. the process from start to finish.
- Include every photo the user asks to include or to show. Leave out photos that are only screenshots of prices, quotes, spreadsheets or documents (read them, don't show them). Use [] if no photo belongs in the document.
- Add "photos_title": a short section heading for them, e.g. "Process Overview" or "Site Photos".
- Do not describe the photos anywhere else in the document; the captions do that.`;

// The photos to place, with captions. Claude's "photos" list wins; if it gave none but the
// person asked for images, every photo goes in, in upload order.
function chosenPhotos(cfg, photos, asked) {
  if (!photos.length) return [];
  const list = Array.isArray(cfg?.photos) ? cfg.photos : asked ? photos.map(p => ({ n: p.n })) : [];
  const byN = new Map(photos.map(p => [p.n, p])), seen = new Set();
  return list.map(x => ({ photo: byN.get(Number(x?.n)), caption: String(x?.caption || '').trim().slice(0, 300) }))
    .filter(x => x.photo && !seen.has(x.photo.n) && seen.add(x.photo.n));
}

// Did the person ask for the photos to appear? (fallback when Claude returns no list)
const askedForPhotos = text => /\b(include|show|add|insert|use|put)\b[^.\n]{0,60}\b(photos?|pictures?|images?|pics)\b|\b(photos?|pictures?|images?)\b[^.\n]{0,40}\b(in|into)\s+(the\s+)?(proposal|document|report|quote)/i.test(String(text || ''));

// Keep the photos on the document without putting their data in the JSON sent back to the page
function attachPhotos(cfg, items) {
  Object.defineProperty(cfg, '__photos', { value: items, enumerable: false, configurable: true, writable: true });
  return cfg;
}

// Centered photos, each with an italic caption, sized to fit the page width
function photoParagraphs(items, { maxWidth = 600, maxHeight = 380, color = '444444', font = 'Calibri' } = {}) {
  return (items || []).flatMap(({ photo, caption }) => {
    const scale = Math.min(1, maxWidth / photo.w, maxHeight / photo.h);
    return [
      new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 160, after: 60 },
        children: [new ImageRun({ data: photo.data, transformation: { width: Math.round(photo.w * scale), height: Math.round(photo.h * scale) } })] }),
      ...(caption ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 },
        children: [new TextRun({ text: caption, italics: true, size: 18, color, font })] })] : []),
    ];
  });
}

module.exports = { uploadedPhotos, photoRules, chosenPhotos, askedForPhotos, attachPhotos, photoParagraphs, imageSize };
