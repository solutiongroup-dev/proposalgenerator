/**
 * WaterSolve proposal builder.
 *
 * Two layouts, matching WaterSolve's own documents:
 *   letter: narrative proposal (cover page, letter, executive summary, pricing table,
 *           bid item descriptions, inclusions/exclusions), modeled on
 *           "070626 Dredging and Dewatering Proposal.docx"
 *   quote:  one-page Sales Proposal form, modeled on "100626 Proposal Firestone project.xlsx"
 *
 * Numbers (quantities, prices, totals) come only from the form's line items and are
 * calculated here. Claude writes narrative text only. Legal text is fixed (watersolve-terms.js).
 */

const path = require('path');
const fs   = require('fs');
const {
  Document, Paragraph, TextRun, Table, TableRow, TableCell, Header,
  AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak, ImageRun,
  LevelFormat, VerticalAlign, ExternalHyperlink, PageOrientation,
} = require('docx');
const TERMS = require('./watersolve-terms');

const img = f => fs.readFileSync(path.join(__dirname, f));
const LOGO_COVER  = img('ws_logo_cover.jpg');   // 1173x262
const LOGO_HEADER = img('ws_logo_header.jpg');  // 1200x268
const LOGO_SGCO   = img('ws_logo_sgco.png');    // 343x86 ("A Solution Group Company")
const ISN_BADGE   = img('ws_isn_badge.png');    // 150x150

const TNR   = 'Times New Roman';
const ARIAL = 'Arial';
const SILVER = 'C0C0C0';   // Excel indexed color 22, used for the quote's label cells
const LINK  = '0000FF';

const WS_ADDRESS = ['5031 68th Street SE', 'Caledonia, MI  49316'];
const WS_PHONE = 'ph - 616-575-8693';
const WS_FAX   = 'fax - 616-575-9031';
const WS_WEB   = 'www.gowatersolve.com';

// ── Line items ────────────────────────────────────────────────────────────────
function parseLineItems(raw) {
  let items = raw;
  if (typeof raw === 'string') { try { items = JSON.parse(raw); } catch(e) { items = []; } }
  if (!Array.isArray(items)) return [];
  return items
    .map(li => {
      const qty = Number(String(li.qty ?? '').replace(/[,\s]/g, ''));
      const unitPrice = Number(String(li.unitPrice ?? '').replace(/[$,\s]/g, ''));
      return {
        qty: isFinite(qty) && qty > 0 ? qty : 1,
        uom: String(li.uom || '').trim() || 'Lump Sum',
        item: String(li.item || '').trim(),
        description: String(li.description || '').trim(),
        unitPrice: isFinite(unitPrice) ? unitPrice : 0,
      };
    })
    .filter(li => li.item || li.description || li.unitPrice)
    .map(li => ({ ...li, amount: Math.round(li.qty * li.unitPrice * 100) / 100 }));
}

const isLumpSum = uom => /lump/i.test(uom);
const money = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = n => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const qtyText = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
// "days" -> "day", "totes" -> "tote", "s.f." stays
const singular = uom => uom.trim().replace(/ies$/i, 'y').replace(/([^s])s$/i, '$1').toLowerCase();
const isTimeUnit = uom => /^(day|week|month|hour|hr)s?$/i.test(uom.trim());

// Letter style: "$38,000.00" or "$6,800/day"
const letterUnitPrice = li => isTimeUnit(li.uom) ? `${money0(li.unitPrice)}/${singular(li.uom)}` : money(li.unitPrice);
// Quote style: "Lump sum" or "$4,400.00 /each"
const quoteUnitPrice = li => isLumpSum(li.uom) ? 'Lump sum' : `${money(li.unitPrice)} /${singular(li.uom)}`;

const lines = v => String(v || '').split('\n').map(s => s.replace(/^[-•○*]\s*/, '').trim()).filter(Boolean);
const fmtLongDate = d => {
  const dt = d ? new Date(d + 'T12:00:00') : new Date();
  return (isNaN(dt) ? new Date() : dt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};
const fmtShortDate = d => {
  const dt = d ? new Date(d + 'T12:00:00') : new Date();
  return (isNaN(dt) ? new Date() : dt).toLocaleDateString('en-US');
};

// ── Paragraph helpers ─────────────────────────────────────────────────────────
function p(text, o = {}) {
  const { size = 24, bold, italics, align, after = 160, before = 0, font = TNR, color, indent, keepNext } = o;
  return new Paragraph({
    alignment: align, spacing: { before, after }, indent, keepNext,
    children: [new TextRun({ text: text || '', size, bold, italics, font, color })],
  });
}
const blank = (n = 1, align) => Array.from({ length: n }, () => new Paragraph({ alignment: align, spacing: { after: 160 }, children: [] }));
const bullet = (text, o = {}) => new Paragraph({
  numbering: { reference: 'ws-bullets', level: 0 }, spacing: { after: 60 },
  children: [new TextRun({ text, size: o.size || 24, bold: o.bold, font: TNR })],
});
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const line = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const gridBorders = { top: line, bottom: line, left: line, right: line };
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: none, bottom: none, left: none, right: none };

function cell(content, width, o = {}) {
  const paras = (Array.isArray(content) ? content : [content]).map(c => c instanceof Paragraph ? c
    : new Paragraph({ alignment: o.align, spacing: { after: 0 },
        children: [new TextRun({ text: String(c ?? ''), size: o.size || 24, bold: o.bold, italics: o.italics, font: o.font || TNR })] }));
  return new TableCell({
    width: { size: width, type: WidthType.DXA }, columnSpan: o.span,
    borders: o.borders || gridBorders, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 100, right: 100 },
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children: paras,
  });
}

const BULLETS = { config: [{ reference: 'ws-bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•',
  alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] };
const STYLES = { default: { document: { run: { font: TNR, size: 24 }, paragraph: { spacing: { after: 160, line: 259 } } } } };

// ── Fixed legal blocks ────────────────────────────────────────────────────────
function specialTerms(size) {
  return [
    p(TERMS.SPECIAL_TERMS_INTRO, { size: size, bold: true, before: 240, after: 80 }),
    ...TERMS.SPECIAL_TERMS.map(t => p(`○ ${t}`, { size, after: 40 })),
    p(TERMS.WARRANTY_DISCLAIMER, { size, before: 120 }),
  ];
}
function standardTerms() {
  return [
    pageBreak(),
    p(TERMS.STANDARD_TERMS_TITLE, { size: 16, bold: true, font: 'Calibri', after: 120 }),
    ...TERMS.STANDARD_TERMS.map(t => new Paragraph({
      spacing: { after: 60 }, indent: { left: t.sub ? 720 : 360, hanging: 360 },
      children: [
        new TextRun({ text: `${t.num}\t`, size: 16, font: TNR }),
        new TextRun({ text: t.text, size: 16, font: TNR }),
      ],
    })),
  ];
}

// ── LETTER layout ─────────────────────────────────────────────────────────────
function buildLetter(cfg, f, items, total) {
  const prelim = f.wsPreliminary === 'yes';
  const title = `${prelim ? 'Preliminary ' : ''}${f.wsProposalTitle || 'Dredging and Dewatering Proposal'}`;
  const company = f.clientLegalName || '';
  const addr = lines(f.customerAddress);
  const C = AlignmentType.CENTER;

  const cover = [
    ...blank(8, C),
    new Paragraph({ alignment: C, children: [new ImageRun({ data: LOGO_COVER, transformation: { width: 511, height: 114 } })] }),
    ...blank(2, C),
    p(title, { size: 36, bold: true, align: C, after: 0 }),
    ...(f.projectTitle ? [p(f.projectTitle, { size: 36, bold: true, align: C, after: 0 })] : []),
    p(company.toUpperCase(), { size: 36, bold: true, align: C, after: 0 }),
    ...addr.map(a => p(a, { align: C, after: 0 })),
    ...blank(1, C),
    p(fmtLongDate(f.proposalDate), { size: 36, bold: true, align: C }),
    pageBreak(),
  ];

  const recipient = [
    ...[f.customerContactName, f.customerContactTitle, company, ...addr].filter(Boolean).map(t => p(t, { after: 0 })),
    ...blank(1),
    p(cfg.salutation || `Dear ${f.customerContactName || 'Sir or Madam'},`),
    p(cfg.opening || ''),
  ];

  const W = [692, 3592, 1242, 1132, 1706, 1510];
  const pricingTable = new Table({
    width: { size: W.reduce((a, b) => a + b), type: WidthType.DXA }, columnWidths: W,
    rows: [
      new TableRow({ tableHeader: true, children: ['Item No.', 'Description', 'Estimated Quantity', 'Unit of Measure', 'Unit Price', 'Amount'].map((h, i) => cell(h, W[i])) }),
      ...items.map((li, i) => new TableRow({ children: [
        cell(String(i + 1), W[0]), cell(li.item || li.description, W[1]), cell(qtyText(li.qty), W[2]),
        cell(li.uom, W[3]), cell(letterUnitPrice(li), W[4]), cell(money(li.amount), W[5]),
      ] })),
      new TableRow({ children: [
        cell(`${prelim ? 'PRELIMINARY ' : ''}TOTAL`, W.slice(0, 5).reduce((a, b) => a + b), { span: 5 }),
        cell(money(total), W[5], { bold: true }),
      ] }),
    ],
  });

  // One description block per line item, in table order
  const descs = Array.isArray(cfg.bid_items) ? cfg.bid_items : [];
  const bidItems = items.flatMap((li, i) => {
    const d = descs.find(x => Number(x.item_index) === i + 1) || descs[i] || {};
    return [
      p(`Bid Item ${i + 1}: ${li.item || li.description}`, { size: 22, bold: true, before: 160, after: 80, keepNext: true }),
      ...(d.paragraphs || []).map(t => p(t, { size: 22, after: 80 })),
      ...(d.bullets || []).map(t => bullet(t, { size: 22 })),
      ...(d.note ? [p(`Note: ${d.note}`, { size: 22, bold: true, after: 80 })] : []),
    ];
  });

  const list = (heading, arr, extra = []) => (arr && arr.length) || extra.length ? [
    p(heading, { bold: true, before: 160, after: 80, keepNext: true }),
    ...(arr || []).map(t => bullet(t)), ...extra,
  ] : [];

  const exclusions = lines(f.wsExclusions).length ? lines(f.wsExclusions) : (cfg.exclusions || []);

  const body = [
    ...recipient,
    p('EXECUTIVE SUMMARY', { bold: true, after: 80, keepNext: true }),
    p(cfg.executive_summary || ''),
    p('PRICING', { bold: true, after: 80, keepNext: true }),
    pricingTable,
    ...blank(1),
    p('TERMS', { bold: true, after: 80, keepNext: true }),
    p('WaterSolve Standard Terms and Conditions apply.', { after: 0 }),
    p(`Mobilization due after set-up is completed. ${f.wsPaymentTerms || 'Net 30'} payment terms on other items.`, { after: 0 }),
    p('Pricing does not include taxes.'),
    p('Bid Item Descriptions', { bold: true, align: C, before: 240, after: 80 }),
    ...bidItems,
    ...list('This proposal includes the following products/ consumables:', cfg.includes_products),
    ...list('This proposal includes the following equipment:', cfg.includes_equipment),
    ...list('This proposal includes the following technical services/ labor:', cfg.includes_labor,
      cfg.schedule_summary ? [bullet(cfg.schedule_summary, { bold: true })] : []),
    ...list('Items Specifically not provided in this proposal', exclusions),
    ...specialTerms(16),
    ...(f.wsIncludeStandardTerms === 'yes' ? standardTerms() : []),
  ];

  return new Document({
    styles: STYLES, numbering: BULLETS,
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new ImageRun({ data: LOGO_HEADER, transformation: { width: 224, height: 50 } })] })] }) },
      children: [...cover, ...body],
    }],
  });
}

// ── QUOTE layout ──────────────────────────────────────────────────────────────
function buildQuote(cfg, f, items, total) {
  const company = f.clientLegalName || '';
  const addr = lines(f.customerAddress);
  const site = lines(f.wsSiteLocation);
  const FULL = 10800; // 8.5in - 2 x 0.5in margins
  const bold12 = { size: 24, bold: true };

  const top = new Table({
    width: { size: FULL, type: WidthType.DXA }, columnWidths: [2600, 4400, 3800],
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [new TableRow({ children: [
      cell([new Paragraph({ children: [new ImageRun({ data: LOGO_SGCO, transformation: { width: 180, height: 45 } })] })], 2600, { borders: noBorders }),
      cell([
        p('WaterSolve (A Solution Group Company)', { ...bold12, after: 0 }),
        ...WS_ADDRESS.map(a => p(a, { ...bold12, after: 0 })),
        p(WS_PHONE, { ...bold12, after: 0 }), p(WS_FAX, { ...bold12, after: 0 }),
        new Paragraph({ spacing: { after: 0 }, children: [new ExternalHyperlink({ link: 'http://www.gowatersolve.com/',
          children: [new TextRun({ text: WS_WEB, font: ARIAL, size: 20, color: LINK, underline: {} })] })] }),
      ], 4400, { borders: noBorders }),
      cell([
        p('Sales Proposal', { ...bold12, after: 0 }),
        p(company, { ...bold12, after: 0 }),
        ...(f.projectTitle ? [p(f.projectTitle, { ...bold12, after: 0 })] : []),
        ...(cfg.project_description_line ? [p(cfg.project_description_line, { ...bold12, italics: true, after: 0 })] : []),
      ], 3800, { borders: noBorders }),
    ] })],
  });

  const label = (t, w) => cell(t, w, { bold: true, fill: SILVER, borders: noBorders });
  const plain = (arr, w) => cell(arr.length ? arr : [''], w, { borders: noBorders });
  const toShip = new Table({
    width: { size: FULL, type: WidthType.DXA }, columnWidths: [1100, 4300, 1300, 4100],
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [new TableRow({ children: [
      label('TO:', 1100),
      plain([company, f.customerContactName ? `Attn: ${f.customerContactName}` : '', ...addr].filter(Boolean), 4300),
      label('SHIP TO:', 1300),
      plain(site.length ? site : ['Project Site'], 4100),
    ] })],
  });

  const assumptionLines = lines(f.wsAssumptions).length ? lines(f.wsAssumptions) : (cfg.quote_assumptions || []);
  const assumptions = assumptionLines.length ? new Table({
    width: { size: FULL, type: WidthType.DXA }, columnWidths: [1900, 8900],
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [new TableRow({ children: [
      cell('Assumptions:', 1900, { bold: true, borders: noBorders }),
      cell(assumptionLines, 8900, { borders: noBorders }),
    ] })],
  }) : null;

  const IW = [1500, 1300, 900, 1400, 1900, 1800, 2000];
  const hdr = (t, w) => cell(t, w, { bold: true, fill: SILVER, font: ARIAL, size: 20 });
  const val = (t, w, o = {}) => cell(t, w, { font: ARIAL, size: 20, ...o });
  const info = new Table({
    width: { size: FULL, type: WidthType.DXA }, columnWidths: IW,
    rows: [
      new TableRow({ children: ['Proposal', 'Terms', 'REP', 'Ship Date', 'VIA', 'F.O.B.', 'Date'].map((h, i) => hdr(h, IW[i])) }),
      new TableRow({ children: [
        val(f.wsProposalNumber || '', IW[0]), val(f.wsPaymentTerms || 'Net 30', IW[1]), val('WS', IW[2]),
        val(f.wsShipDate || 'TBD', IW[3]), val(f.wsShipVia || 'Common Carrier', IW[4]),
        val(f.wsFob || 'Delivered', IW[5], { bold: true }), val(fmtShortDate(f.proposalDate), IW[6]),
      ] }),
    ],
  });

  const LW = [1500, 1900, 3800, 1700, 1900];
  const itemsTable = new Table({
    width: { size: FULL, type: WidthType.DXA }, columnWidths: LW,
    rows: [
      new TableRow({ tableHeader: true, children: ['Quantity', 'Item Code', 'Description', 'Unit Price', 'Amount*'].map((h, i) => hdr(h, LW[i])) }),
      ...items.map(li => new TableRow({ children: [
        cell(`${qtyText(li.qty)} ${isLumpSum(li.uom) ? 'each' : li.uom.toLowerCase()}`, LW[0]),
        cell(li.item, LW[1]),
        cell(li.description, LW[2], { size: 20 }),
        cell(quoteUnitPrice(li), LW[3]),
        cell(money(li.amount), LW[4], { align: AlignmentType.RIGHT }),
      ] })),
      ...(f.wsFreight !== 'separate' ? [new TableRow({ children: [
        cell('', LW[0]), cell('Freight', LW[1]), cell('included with items listed above', LW[2], { size: 20 }), cell('', LW[3]), cell('', LW[4]),
      ] })] : []),
      new TableRow({ children: [
        cell('', LW[0], { borders: noBorders }), cell('', LW[1], { borders: noBorders }), cell('', LW[2], { borders: noBorders }),
        cell('Total : ', LW[3], { borders: noBorders, align: AlignmentType.RIGHT }),
        cell(money(total), LW[4], { bold: true, align: AlignmentType.RIGHT }),
      ] }),
    ],
  });

  const signoff = new Table({
    width: { size: FULL, type: WidthType.DXA }, columnWidths: [3600, 5000, 2200],
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [new TableRow({ children: [
      cell([
        p(f.wsRepName || '', { ...bold12, after: 0 }),
        ...(f.wsRepEmail ? [new Paragraph({ children: [new ExternalHyperlink({ link: `mailto:${f.wsRepEmail}`,
          children: [new TextRun({ text: f.wsRepEmail, font: ARIAL, size: 20, color: LINK, underline: {} })] })] })] : []),
      ], 3600, { borders: noBorders }),
      cell('Thank you for this opportunity to provide this sales proposal', 5000, { borders: noBorders }),
      cell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ data: ISN_BADGE, transformation: { width: 110, height: 110 } })] })], 2200, { borders: noBorders }),
    ] })],
  });

  const children = [
    top, ...blank(1),
    toShip, ...blank(1),
    ...(assumptions ? [assumptions, ...blank(1)] : []),
    info, itemsTable,
    p('* Pricing does not include taxes.', { size: 18, italics: true, before: 60 }),
    signoff,
    new Paragraph({ spacing: { before: 120, after: 0 }, children: [new ImageRun({ data: LOGO_SGCO, transformation: { width: 180, height: 45 } })] }),
    p('WaterSolve LLC', { ...bold12, after: 0 }),
    ...WS_ADDRESS.map(a => p(a, { ...bold12, after: 0 })),
    ...specialTerms(18),
    ...(f.wsIncludeStandardTerms !== 'no' ? standardTerms() : []),
  ];

  return new Document({
    styles: STYLES, numbering: BULLETS,
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children,
    }],
  });
}

// ── Entry points ──────────────────────────────────────────────────────────────
function buildWaterSolve(cfg, formData) {
  const f = formData || {};
  const items = parseLineItems(f.wsLineItems);
  const total = items.reduce((s, li) => s + li.amount, 0);
  return f.wsFormat === 'quote' ? buildQuote(cfg, f, items, total) : buildLetter(cfg, f, items, total);
}

function waterSolveConfigPrompt(formData, fileText) {
  const f = formData || {};
  const items = parseLineItems(f.wsLineItems);
  const isQuote = f.wsFormat === 'quote';
  const itemList = items.map((li, i) => `${i + 1}. ${li.item}${li.description ? ': ' + li.description : ''} (qty ${qtyText(li.qty)} ${li.uom})`).join('\n');
  const scope = {
    customer: f.clientLegalName, contact: f.customerContactName, contactTitle: f.customerContactTitle,
    project: f.projectTitle, proposalTitle: f.wsProposalTitle, preliminary: f.wsPreliminary === 'yes',
    site: f.wsSiteLocation, material: f.wsMaterialType, volume: f.wsMaterialVolume, percentSolids: f.wsPercentSolids,
    dredgeDays: f.wsDredgeDays, setupDays: f.wsSetupDays, demobDays: f.wsDemobDays, schedule: f.wsWorkSchedule,
    treatabilityRecommended: f.wsTreatability === 'yes', scopeNotes: f.wsScopeNotes,
    userAssumptions: lines(f.wsAssumptions), userExclusions: lines(f.wsExclusions),
  };

  const letterSchema = `{
  "salutation": "e.g. 'Dear Mr. Williams,' using the contact's last name and an honorific only if gender is clear, otherwise full name",
  "opening": "one sentence thanking them for the opportunity to provide a ${scope.preliminary ? 'preliminary ' : ''}quote for the work, naming the project",
  "executive_summary": "one paragraph: what will be dredged/treated, approximate volume and % solids, where, how it is dewatered/contained${scope.treatabilityRecommended ? ', and a recommendation to send representative samples to the WaterSolve treatability lab in Caledonia, MI to confirm assumptions and pricing' : ''}",
  "bid_items": [{ "item_index": 1, "paragraphs": ["what this bid item covers"], "bullets": ["optional short detail lines"], "note": "optional bold caveat, e.g. that estimated days are informational and actual days may vary; empty string if none" }],
  "includes_products": ["products/consumables delivered to site, with quantities and sizes"],
  "includes_equipment": ["equipment supplied"],
  "includes_labor": ["technical services / labor provided"],
  "schedule_summary": "one sentence: on-site days/week, hours/day, and approximate days of set-up, dredging and tear-down",
  "exclusions": ["only if userExclusions is empty: items specifically not provided"]
}`;
  const quoteSchema = `{
  "project_description_line": "one short italic line, e.g. 'Lagoon sludge dredged and dewatered in Geotextile tubes.'",
  "quote_assumptions": ["only if userAssumptions is empty: 4-7 short lines covering volume/% solids basis, scope exclusions, utilities and equipment the customer must provide, and the work schedule"]
}`;

  return `You write WaterSolve LLC (a Solution Group company) sales proposals for dredging, dewatering, geotextile tube and polymer conditioning projects.
${f.additionalInstructions ? `\nMANDATORY USER INSTRUCTIONS (apply these first):\n${f.additionalInstructions}\n` : ''}
PROJECT FACTS (from the form; these are authoritative):
${JSON.stringify(scope, null, 2)}

PRICED LINE ITEMS (in table order; prices are shown in a table you do not write):
${itemList || '(none provided)'}
${fileText ? `\nSOURCE FILES:\n${fileText}\n` : ''}
RULES:
- Write "WaterSolve", never "Watersolve" or "WS".
- Never state any dollar amount, unit price or total. Pricing appears only in the pricing table.
- Never write tax, payment-terms, validity, liability, warranty or standard-terms language. That text is added separately.
- Use only facts from the form and source files. Do not invent equipment models, quantities or site details. If something is unknown, leave it out.
- Each fact appears once. Bid item descriptions explain the work; the "includes" lists itemize what is supplied. Do not repeat a list in both places.
- ${isQuote ? 'Lines are terse, like a quote form.' : `Write one bid_items entry per priced line item, item_index matching the numbering above (${items.length} items).`}
- No em dashes. Plain, professional, technical tone.

Return ONLY valid JSON (no markdown) with this structure:
${isQuote ? quoteSchema : letterSchema}`;
}

module.exports = { buildWaterSolve, waterSolveConfigPrompt, parseLineItems };
