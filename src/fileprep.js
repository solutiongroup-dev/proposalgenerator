// ── Prepare uploaded files for Claude within Vercel's request size limit ─────
// Vercel rejects request bodies over 4.5 MB (HTTP 413), and base64 adds a third.
// PDFs that fit are sent whole. Larger PDFs are sent as their text, or, when they
// are scans with no text layer, as compressed page images. Images are downscaled.

const BUDGET = 3_300_000;          // base64 bytes for all files in one request (leaves room for the prompt)
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

export class FileTooLargeError extends Error {}

const b64Size = bytes => Math.ceil(bytes / 3) * 4;

function readAsBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = () => rej(new Error("Failed to read file"));
    r.readAsDataURL(blob);
  });
}

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = `${PDFJS}/pdf.min.js`;
    s.onload = res;
    s.onerror = () => rej(new Error("Failed to load the PDF reader"));
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.js`;
  return window.pdfjsLib;
}

function canvasToJpeg(canvas, quality) {
  return new Promise(res => canvas.toBlob(b => res(b), "image/jpeg", quality));
}

async function downscaleImage(file, maxSide = 1568, quality = 0.75) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return canvasToJpeg(c, quality);
}

async function pdfText(pdf) {
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const tc = await (await pdf.getPage(i)).getTextContent();
    pages.push(tc.items.map(it => it.str).join(" "));
  }
  return pages;
}

// Render every page to JPEG, shrinking until the pages fit in `budget` base64 bytes
async function pdfPageImages(pdf, budget) {
  const pages = Math.min(pdf.numPages, 40);
  for (const [maxSide, quality] of [[1400, 0.6], [1100, 0.5], [900, 0.45], [750, 0.4]]) {
    const blobs = [];
    let total = 0;
    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i);
      const v = page.getViewport({ scale: 1 });
      const scale = maxSide / Math.max(v.width, v.height);
      const vp = page.getViewport({ scale });
      const c = document.createElement("canvas");
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const b = await canvasToJpeg(c, quality);
      blobs.push(b); total += b64Size(b.size);
      if (total > budget) break;
    }
    if (total <= budget) return { blobs, truncated: pages < pdf.numPages };
  }
  return null;
}

/**
 * Turn PDFs and images into Claude content blocks that fit one request.
 * Returns { blocks, notes } where notes say how a file was sent (for the UI/log).
 */
export async function prepareBinaryFiles(files) {
  const blocks = [], notes = [];
  let remaining = BUDGET;
  // Smallest first, so one large file doesn't crowd out the rest
  const list = [...files].filter(f => f.type === "application/pdf" || f.type.startsWith("image/")).sort((a, b) => a.size - b.size);

  for (const f of list) {
    if (f.type.startsWith("image/")) {
      const blob = f.size > 400_000 ? await downscaleImage(f) : f;
      const size = b64Size(blob.size);
      if (size > remaining) throw new FileTooLargeError(`"${f.name}" is too large to send. Try fewer or smaller files.`);
      blocks.push({ type: "image", source: { type: "base64", media_type: blob.type || f.type, data: await readAsBase64(blob) } });
      remaining -= size;
      continue;
    }

    // PDF that fits: send it whole (Claude sees layout, tables and scans)
    if (b64Size(f.size) <= remaining) {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: await readAsBase64(f) } });
      remaining -= b64Size(f.size);
      continue;
    }

    const lib = await loadPdfJs();
    const pdf = await lib.getDocument({ data: await f.arrayBuffer() }).promise;
    const text = await pdfText(pdf);
    const textChars = text.join("").replace(/\s/g, "").length;
    if (textChars > 200 * pdf.numPages * 0.5) {
      // Text-based PDF: the text is a fraction of the size
      blocks.push({ type: "text", text: `[PDF: ${f.name}, ${pdf.numPages} pages, text only]\n` + text.map((t, i) => `--- page ${i + 1} ---\n${t}`).join("\n") });
      notes.push(`${f.name}: sent as text`);
      continue;
    }

    // Scanned PDF: compressed page images
    const rendered = await pdfPageImages(pdf, remaining);
    if (!rendered) throw new FileTooLargeError(`"${f.name}" is too large to send, even compressed. Try removing pages or uploading fewer files.`);
    blocks.push({ type: "text", text: `[Scanned PDF: ${f.name}, ${rendered.blobs.length} of ${pdf.numPages} pages follow as images]` });
    for (const b of rendered.blobs) {
      blocks.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: await readAsBase64(b) } });
      remaining -= b64Size(b.size);
    }
    notes.push(`${f.name}: sent as ${rendered.blobs.length} compressed page images`);
  }
  return { blocks, notes };
}
