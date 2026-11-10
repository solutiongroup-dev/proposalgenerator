/**
 * SG Document Generator — Azure Function
 * Route: POST /api/generate-document
 *
 * Accepts: { docType, formData, pastedText, fileContents[] }
 * Returns: branded .docx binary (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
 *
 * Flow:
 *   1. Receive form data + any extracted file text from the frontend
 *   2. Call Claude API to generate a structured JSON config
 *   3. Pass that config into the appropriate docx builder (proposal / assessment / project)
 *   4. Return the .docx binary as a download
 */

const https  = require('https');
const path   = require('path');
const fs     = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType,
  PageBreak, ImageRun, LevelFormat, TabStopType, TabStopPosition, SimpleField
} = require('docx');

const { buildWaterSolve, waterSolveConfigPrompt, parseLineItems } = require('./watersolve');

const API_KEY  = process.env.ANTHROPIC_API_KEY;
const LOGO     = fs.readFileSync(path.join(__dirname, 'sg_logo.png'));

// ── Colors ────────────────────────────────────────────────────────────────────
const BLUE  = '2B579A';
const LBLUE = 'D5E8F0';
const GRAY  = '333333';
const WHITE = 'FFFFFF';
const BGRAY = 'CCCCCC';
const LGRAY = 'F2F2F2';

// ── Optional section content library ─────────────────────────────────────────
// CLIENT_NAME is a placeholder replaced with the actual client name at render time
const OPTIONAL_SECTION_CONTENT = {
  sg_academy: {
    title: 'Solution Group Academy',
    content: `A skilled, knowledgeable workforce is essential to sustainable wastewater operations. Solution Group's Education and Training program, anchored by the Solution Group Academy, provides a comprehensive curriculum spanning certification preparation, continuing education, workforce development, and hands-on technical training.

Solution Group Academy is a proprietary training platform that delivers structured, industry-recognized curricula for wastewater operators at every level, from new hires to experienced professionals seeking advanced certification. Coursework covers biological treatment processes, chemistry, regulatory requirements, safety, and equipment operation.

Licensed operators are required to maintain their certifications through ongoing continuing education. Solution Group Academy provides accredited continuing education units (CEUs) covering regulatory updates, emerging treatment technologies, and best management practices.

All new wastewater personnel joining CLIENT_NAME facilities undergo a structured onboarding program developed in partnership with Solution Group. This includes facility-specific procedures, safety protocols, regulatory requirements, and equipment familiarization. Beyond classroom instruction, Solution Group provides practical, site-based technical training covering equipment operation and maintenance, process control, troubleshooting, and emergency response.`,
  },

  opticlear: {
    title: 'OptiClear Remote Monitoring and Management',
    content: `The OptiClear platform provides CLIENT_NAME with a comprehensive, real-time view of wastewater operations across all facilities. Accessible to authorized personnel at any level, from site managers to corporate leadership, OptiClear delivers role-based visibility into the data that matters most.

The platform includes site-by-site real-time process data visualization, long-term historical data archiving for trend analysis and benchmarking, monthly and annual cost reporting by site and program-wide, and unit cost metrics for operational benchmarking. Compliance KPIs include permit limit tracking, exceedance alerts, and reporting status dashboards. Laboratory data integration provides analytical results, trend analysis, and QC monitoring.

Remote access and control capabilities allow authorized Solution Group and CLIENT_NAME personnel to monitor systems and respond to conditions without requiring on-site presence. Automated alarm notification is delivered via email, SMS, and dashboard alerts. In the event of an alarm, Corrective Action Reports are automatically generated to ensure rapid documentation and response.`,
  },

  safety: {
    title: 'Operational Safety Support',
    content: `Safety is a non-negotiable value at Solution Group. Our Operational Safety Support program integrates structured auditing, training, near-miss management, and continuous improvement into CLIENT_NAME's day-to-day wastewater operations, building a durable safety culture at every facility.

Solution Group conducts periodic safety audits at each CLIENT_NAME site, evaluating compliance with OSHA regulations, site-specific safety plans, lockout/tagout procedures, confined space entry protocols, personal protective equipment requirements, chemical handling practices, and emergency response preparedness. Audit findings are documented, prioritized, and tracked to closure.

All site personnel receive training on applicable regulatory safety requirements, including OSHA Hazard Communication, confined space entry, respiratory protection, and emergency action plans. Training records are maintained in the OptiClear platform. Solution Group implements a proactive near-miss reporting and analysis program at each facility. Near-miss events are captured, investigated, and used to identify and correct systemic hazards before they result in injury or regulatory incident.

In the event of a safety incident or environmental exceedance, Solution Group conducts a structured root cause analysis using proven investigation methodologies. Corrective and preventive actions are identified, assigned, tracked, and verified through the OptiClear platform. Solution Group also implements and sustains the 5S workplace organization methodology at each CLIENT_NAME wastewater facility, delivering tangible operational and safety benefits through a well-organized, visually managed treatment environment.`,
  },

  kpi_reporting: {
    title: 'KPI Reporting and Executive Dashboard',
    content: `Solution Group provides CLIENT_NAME leadership with a standardized, automated operating view through the Site Executive Dashboard, delivered on a monthly cadence. This single consistent view spans safety, people, financials, compliance, and operations across every site, enabling leadership to understand performance at a glance without manual data assembly.

The Executive KPI Framework tracks five core categories: Safety (recordables, near misses, open actions), People (headcount, open roles, overtime), Financial (revenue, program cost, EBITDA), Operations (water volume, efficiency, reliability), and Compliance (exceedances, permit metrics). Each KPI has a named owner and a defined reporting cadence.

The dashboard surfaces Executive Attention Items, rules-based exceptions that flag items requiring leadership action, so that nothing critical is missed across a multi-site portfolio. Cost per treated gallon provides a consistent benchmarking metric across facilities and periods. Site Financials breakdowns show cost mix by category, enabling program-wide visibility into where dollars are being spent and where variances exist relative to target.`,
  },
};

// ── Dates (Vercel runs in UTC; Solution Group is in Indianapolis) ─────────────
const TZ = 'America/Indiana/Indianapolis';
const todayLong  = () => new Date().toLocaleDateString('en-US', { timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric' });
const todayShort = () => {
  const [m, d] = new Date().toLocaleDateString('en-US', { timeZone: TZ, month: 'numeric', day: '2-digit' }).split('/');
  return `${m}.${d}`;
};

// ── Commercial statements: written once, here, never by Claude ───────────────
const CANONICAL_TAX      = 'Sales tax is not included in the investment figures above and will be added by Solution Group Accounting.';
const CANONICAL_VALIDITY = 'This proposal is valid for 30 days from the date above.';
const TAX_RE      = /\btax(es|ed)?\b/i;
const VALIDITY_RE = /\b(proposal|quote|quotation|pricing|offer)\b[^.]*\bvalid\b|\bvalid (for|through|until)\b[^.]*\d+\s*days?\b/i;
const MARKUP_RE   = /\b(mark-?up|margin)\b|\d+(\.\d+)?\s*%[^.]*\b(contingency|markup|margin)\b|\bcontingency\b[^.]*\d+(\.\d+)?\s*%/i;
const LEADTIME_RE = /\blead.?times?\b|\bpricing\b[^.]*\bbudgetary\b/i;

// Remove whole sentences that match from a paragraph
const stripSentences = (text, re) => typeof text !== 'string' ? text
  : (text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [text]).filter(sn => !re.test(sn)).join('').trim();

/**
 * Enforce one tax statement and one validity statement, both in the Commercial Summary
 * pricing notes, and keep markup/contingency percentages out of the document.
 * Applies to every text field Claude writes, including sections a revision added.
 * When a revision explicitly asks to change tax or validity wording (allowCustom),
 * Claude's pricing_notes are kept as written, deduplicated.
 */
function enforceCommercialRules(cfg, allowCustom = false) {
  const both = new RegExp(`${TAX_RE.source}|${VALIDITY_RE.source}`, 'i');
  const scrub = v => typeof v === 'string' ? stripSentences(v, both)
    : Array.isArray(v) ? v.filter(x => typeof x !== 'string' || !both.test(x)).map(scrub)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrub(x)])) : v;

  for (const key of ['sections', 'additional_sections', 'intro_text', 'service_confirmation_text', 'executive_summary']) {
    if (cfg[key]) cfg[key] = scrub(cfg[key]);
  }
  const bulletOk = b => typeof b !== 'string' || (!both.test(b) && !MARKUP_RE.test(b));
  if (Array.isArray(cfg.assumptions_exclusions)) cfg.assumptions_exclusions = cfg.assumptions_exclusions.filter(bulletOk);
  if (Array.isArray(cfg.next_steps))             cfg.next_steps             = cfg.next_steps.filter(bulletOk);

  const pricing = cfg.pricing = cfg.pricing || {};
  if (Array.isArray(pricing.contingency_notes)) pricing.contingency_notes = pricing.contingency_notes.filter(bulletOk);
  const notes = Array.isArray(pricing.pricing_notes) ? pricing.pricing_notes.filter(n => typeof n === 'string') : [];
  if (allowCustom) {
    const firstTax = notes.find(n => TAX_RE.test(n)), firstValid = notes.find(n => VALIDITY_RE.test(n));
    pricing.pricing_notes = [firstTax || CANONICAL_TAX, firstValid || CANONICAL_VALIDITY,
      ...notes.filter(n => !both.test(n) && !MARKUP_RE.test(n) && !LEADTIME_RE.test(n))];
  } else {
    pricing.pricing_notes = [CANONICAL_TAX, CANONICAL_VALIDITY,
      ...notes.filter(n => !both.test(n) && !MARKUP_RE.test(n) && !LEADTIME_RE.test(n))];
  }
  return cfg;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
const sp  = (before = 0, after = 120) => ({ before, after });
const cb  = { style: BorderStyle.SINGLE, size: 1, color: BGRAY };
const brd = { top: cb, bottom: cb, left: cb, right: cb };
const nb  = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: nb, bottom: nb, left: nb, right: nb };
const mg  = { top: 80, bottom: 80, left: 120, right: 120 };
const fmt = (n, cfg) => {
  if (n == null || n === '') return '';
  if (Number(n) === 0) return 'Included';
  const sym = cfg?.currency_symbol || '$';
  return sym + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
};
const annual = n => n != null ? n * 12 : null;

function blueBar(text, size = 16) {
  return new Paragraph({
    spacing: sp(240, 120),
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE, space: 4 } },
    children: [new TextRun({ text, bold: true, size: size * 2, color: BLUE, font: 'Calibri' })]
  });
}
function body(text, opts = {}) {
  return new Paragraph({
    spacing: sp(0, 120),
    children: [new TextRun({ text: text || '', size: 22, color: GRAY, font: 'Calibri', ...opts })]
  });
}
function bullet(text) {
  return new Paragraph({
    spacing: sp(0, 80),
    numbering: { reference: 'bullets', level: 0 },
    children: [new TextRun({ text: text || '', size: 22, color: GRAY, font: 'Calibri' })]
  });
}
function spacer(n = 1) {
  return Array.from({ length: n }, () => new Paragraph({ spacing: sp(0, 0), children: [] }));
}
function pb() { return new Paragraph({ children: [new PageBreak()] }); }

function makeHeader(clientShortName, docLabel) {
  return new Header({
    children: [new Paragraph({
      spacing: sp(0, 60),
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 2 } },
      children: [
        new ImageRun({ data: LOGO, transformation: { width: 53, height: 44 }, type: 'png' }),
        new TextRun({ text: `   ${(clientShortName || '').toUpperCase()} | ${docLabel}`, size: 16, color: BLUE, font: 'Calibri' })
      ]
    })]
  });
}

function makeFooter() {
  return new Footer({
    children: [new Paragraph({
      spacing: sp(60, 0),
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 2 } },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [
        new TextRun({ text: '6239 S. East Street, Suite F, Indianapolis, IN 46227  |  (800) 465-8200  |  solutionmgt.com', size: 16, color: '666666', font: 'Calibri' }),
        new TextRun({ text: '\tPage ', size: 16, color: '666666', font: 'Calibri' }),
        new SimpleField('PAGE')
      ]
    })]
  });
}

function coverPage(cfg) {
  const c = cfg.client || {};
  const sg = cfg.sg_signer || {};

  // Only show contact if we have a meaningful name (not single word like "Gram")
  const hasFullClientContact = c.site_contact && c.site_contact.trim().includes(' ');
  const hasFullSgName = sg.name && sg.name.trim().includes(' ');

  // Build "Prepared by" line without em dash
  const sgLine = hasFullSgName
    ? `${sg.name}${sg.title ? ', ' + sg.title : ''}, Solution Group`
    : 'Solution Group';

  return [
    ...spacer(2),
    new Paragraph({ spacing: sp(0, 200), children: [new ImageRun({ data: LOGO, transformation: { width: 120, height: 100 }, type: 'png' })] }),
    new Paragraph({ spacing: sp(0, 80), children: [new TextRun({ text: 'SOLUTION GROUP', bold: true, size: 52, color: BLUE, font: 'Calibri' })] }),
    new Paragraph({ spacing: sp(0, 240), children: [new TextRun({ text: cfg.proposal_title || cfg.document_title || 'Document', bold: true, size: 32, color: BLUE, font: 'Calibri' })] }),
    new Paragraph({ spacing: sp(0, 240), border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BLUE } }, children: [] }),
    new Paragraph({ spacing: sp(200, 40), children: [new TextRun({ text: 'Prepared for:', bold: true, size: 20, color: GRAY, font: 'Calibri' })] }),
    new Paragraph({ spacing: sp(0, 40), children: [new TextRun({ text: c.name || '[Client]', bold: true, size: 28, color: BLUE, font: 'Calibri' })] }),
    ...(c.address ? [new Paragraph({ spacing: sp(0, 40), children: [new TextRun({ text: c.address, size: 22, color: GRAY, font: 'Calibri' })] })] : []),
    ...(hasFullClientContact ? [new Paragraph({ spacing: sp(0, 160), children: [new TextRun({ text: `${c.site_contact}${c.site_contact_title ? ', ' + c.site_contact_title : ''}`, size: 22, color: GRAY, font: 'Calibri' })] })] : []),
    new Paragraph({ spacing: sp(0, 40), children: [new TextRun({ text: 'Prepared by:', bold: true, size: 20, color: GRAY, font: 'Calibri' })] }),
    new Paragraph({ spacing: sp(0, 40), children: [new TextRun({ text: sgLine, size: 22, color: GRAY, font: 'Calibri' })] }),
    new Paragraph({ spacing: sp(0, 40), children: [new TextRun({ text: `Date: ${cfg.proposal_date || cfg.date || todayLong()}`, size: 22, color: GRAY, font: 'Calibri' })] }),
    pb()
  ];
}

// ── Table sections (e.g. a chemistry program priced per product) ─────────────
function tableSection(num, t) {
  const cols = t.columns || [];
  const total = 9360;
  const first = Math.round(total * (cols.length > 4 ? 0.32 : 0.4));
  const rest = cols.length > 1 ? Math.floor((total - first) / (cols.length - 1)) : total;
  const widths = cols.map((_, i) => i === 0 ? first : rest);
  const right = i => (t.align || [])[i] === 'right';
  const row = (vals, o = {}) => new TableRow({ tableHeader: o.header, children: vals.map((v, i) => new TableCell({
    borders: brd, width: { size: widths[i], type: WidthType.DXA }, margins: mg,
    shading: { fill: o.header ? BLUE : o.total ? LBLUE : (o.idx % 2 ? LGRAY : WHITE), type: ShadingType.CLEAR },
    children: [new Paragraph({ alignment: right(i) && !o.header ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [new TextRun({ text: String(v ?? ''), bold: o.header || o.total, size: 20, color: o.header ? WHITE : o.total ? BLUE : GRAY, font: 'Calibri' })] })],
  })) });
  return [
    blueBar(`${num}. ${t.title}`), ...spacer(1),
    ...(t.intro ? [body(t.intro)] : []),
    new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, rows: [
      row(cols, { header: true }),
      ...(t.rows || []).map((r, idx) => row(r, { idx })),
      ...(t.total_row ? [row(t.total_row, { total: true })] : []),
    ] }),
    ...(t.notes || []).map(n => body(n, { italic: true })),
    ...spacer(2),
  ];
}

// ── PROPOSAL BUILDER ──────────────────────────────────────────────────────────
function buildProposal(cfg) {
  const pricing = cfg.pricing || {};
  const lineItems = pricing.line_items || [];

  const pricingHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({ borders: brd, width: { size: 5400, type: WidthType.DXA }, shading: { fill: BLUE, type: ShadingType.CLEAR }, margins: mg,
        children: [new Paragraph({ children: [new TextRun({ text: 'Service Component', bold: true, size: 20, color: WHITE, font: 'Calibri' })] })] }),
      new TableCell({ borders: brd, width: { size: 1980, type: WidthType.DXA }, shading: { fill: BLUE, type: ShadingType.CLEAR }, margins: mg,
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Monthly', bold: true, size: 20, color: WHITE, font: 'Calibri' })] })] }),
      new TableCell({ borders: brd, width: { size: 1980, type: WidthType.DXA }, shading: { fill: BLUE, type: ShadingType.CLEAR }, margins: mg,
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Annual', bold: true, size: 20, color: WHITE, font: 'Calibri' })] })] }),
    ]
  });

  const pricingLineRows = lineItems.map((li, i) => new TableRow({
    children: [
      new TableCell({ borders: brd, width: { size: 5400, type: WidthType.DXA }, shading: { fill: i % 2 === 0 ? WHITE : LGRAY, type: ShadingType.CLEAR }, margins: mg,
        children: [new Paragraph({ children: [new TextRun({ text: li.description || '', size: 20, color: GRAY, font: 'Calibri' })] })] }),
      new TableCell({ borders: brd, width: { size: 1980, type: WidthType.DXA }, shading: { fill: i % 2 === 0 ? WHITE : LGRAY, type: ShadingType.CLEAR }, margins: mg,
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(li.monthly, cfg), size: 20, color: GRAY, font: 'Calibri' })] })] }),
      new TableCell({ borders: brd, width: { size: 1980, type: WidthType.DXA }, shading: { fill: i % 2 === 0 ? WHITE : LGRAY, type: ShadingType.CLEAR }, margins: mg,
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(annual(li.monthly), cfg), size: 20, color: GRAY, font: 'Calibri' })] })] }),
    ]
  }));

  const totalRow = new TableRow({
    children: [
      new TableCell({ borders: brd, width: { size: 5400, type: WidthType.DXA }, shading: { fill: LBLUE, type: ShadingType.CLEAR }, margins: mg,
        children: [new Paragraph({ children: [new TextRun({ text: 'Total Monthly Service Fee', bold: true, size: 22, color: BLUE, font: 'Calibri' })] })] }),
      new TableCell({ borders: brd, width: { size: 1980, type: WidthType.DXA }, shading: { fill: LBLUE, type: ShadingType.CLEAR }, margins: mg,
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(pricing.monthly_total, cfg), bold: true, size: 22, color: BLUE, font: 'Calibri' })] })] }),
      new TableCell({ borders: brd, width: { size: 1980, type: WidthType.DXA }, shading: { fill: LBLUE, type: ShadingType.CLEAR }, margins: mg,
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(pricing.annual_total || annual(pricing.monthly_total), cfg), bold: true, size: 22, color: BLUE, font: 'Calibri' })] })] }),
    ]
  });

  // Section numbering
  let sectionNum = 1;
  const sn = () => sectionNum++;

  // Flexible section renderers — keyed so user order is respected
  const PROPOSAL_SECTION_RENDERERS = {
    introduction: () => [
      blueBar(`${sn()}. Proposal Introduction`), ...spacer(1),
      body(cfg.sections?.introduction || cfg.intro_text || ''), ...spacer(2),
    ],
    service_confirmation: () => [
      blueBar(`${sn()}. Service Confirmation`), ...spacer(1),
      body(cfg.sections?.service_confirmation || cfg.service_confirmation_text || ''), ...spacer(2),
    ],
    commercial_summary: () => [
      blueBar(`${sn()}. Commercial Summary`), ...spacer(1),
      new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [5400, 1980, 1980], rows: [pricingHeaderRow, ...pricingLineRows, totalRow] }),
      ...spacer(1),
      body('Fees adjust annually by the greater of 3% or the annualized regional CPI.', { italic: true }),
      ...(pricing.pricing_notes || []).map(n => body(n, { italic: true })),
      ...spacer(2),
    ],
    assumptions: () => [
      blueBar(`${sn()}. Key Assumptions & Exclusions`), ...spacer(1),
      ...(cfg.assumptions_exclusions || []).map(bullet), ...spacer(2),
    ],
    next_steps: () => [
      blueBar(`${sn()}. Next Steps`), ...spacer(1),
      ...(cfg.next_steps || []).map(bullet), ...spacer(1),
      body('We look forward to moving forward on your timeline.'),
    ],
  };

  const proposalDefaultOrder = ['introduction','service_confirmation','commercial_summary','assumptions','next_steps'];
  const proposalSectionOrder = Array.isArray(cfg.section_order) && cfg.section_order.length > 0
    ? cfg.section_order
    : proposalDefaultOrder;

  const sectionContent = proposalSectionOrder.flatMap(key => {
    if (PROPOSAL_SECTION_RENDERERS[key]) return PROPOSAL_SECTION_RENDERERS[key]();
    if (cfg.table_sections?.[key]) return tableSection(sn(), cfg.table_sections[key]);
    // Custom / optional section
    const customContent = (cfg.additional_sections || {})[key];
    if (customContent) {
      const title = OPTIONAL_SECTION_CONTENT[key]?.title || key.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());
      return [
        blueBar(`${sn()}. ${title}`), ...spacer(1),
        ...(Array.isArray(customContent)
          ? customContent.map(bullet)
          : String(customContent).split('\n\n').filter(Boolean).map(p => body(p))),
        ...spacer(2),
      ];
    }
    return [];
  });

  const children = [
    ...coverPage(cfg),
    ...sectionContent,
  ];

  return new Document({
    numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 900, left: 1080 } } },
      headers: { default: makeHeader(cfg.client?.short_name, cfg.proposal_title || 'Executive Service Proposal') },
      footers: { default: makeFooter() },
      children
    }]
  });
}

// ── ASSESSMENT BUILDER ────────────────────────────────────────────────────────
function buildAssessment(cfg) {
  const c = cfg.client || {};
  const site = cfg.site_overview || {};
  const regs = cfg.regulatory || {};
  const systems = cfg.systems || [];
  const sm = cfg.staffing_model || {};

  function hdrCell(text, width) {
    return new TableCell({ borders: brd, width: { size: width, type: WidthType.DXA }, shading: { fill: BLUE, type: ShadingType.CLEAR }, margins: mg,
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, color: WHITE, font: 'Calibri' })] })] });
  }

  const allRisks = systems.flatMap(sys => (sys.risks || []).map(r => ({
    system: sys.name,
    description: typeof r === 'string' ? r : r.description,
    severity: typeof r === 'string' ? 'Medium' : (r.severity || 'Medium'),
    business_impact: typeof r === 'string' ? null : r.business_impact,
  })));

  const allRecs = systems.flatMap(sys => sys.recommendations || []);
  const quickWins = allRecs.filter(r => r.priority?.toLowerCase().includes('quick'));
  const medTerm   = allRecs.filter(r => r.priority?.toLowerCase().includes('medium'));
  const major     = allRecs.filter(r => r.priority?.toLowerCase().includes('major'));

  function recTier(label, color, items) {
    if (!items.length) return [];
    return [
      new Paragraph({ spacing: sp(200, 60), children: [new TextRun({ text: label, bold: true, size: 24, color, font: 'Calibri' })] }),
      ...items.flatMap(r => [
        new Paragraph({ spacing: sp(80, 20), numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: r.action || r, bold: true, size: 22, color: GRAY, font: 'Calibri' })] }),
        ...(r.business_goal ? [new Paragraph({ spacing: sp(0, 100), children: [
          new TextRun({ text: '     Business goal: ', bold: true, size: 20, color, font: 'Calibri' }),
          new TextRun({ text: r.business_goal, size: 20, color: GRAY, font: 'Calibri' }),
        ]})] : []),
      ]),
      ...spacer(1),
    ];
  }

  const children = [
    ...coverPage(cfg),

    // S1 Executive Summary
    blueBar('1. Executive Summary'), ...spacer(1),
    body(cfg.executive_summary || '[Executive summary to be completed.]'),
    ...spacer(1), pb(),

    // S2 Site Overview
    blueBar('2. Site & Operations Overview'), ...spacer(1),
    ...(Object.entries({ 'Industry': site.industry, 'Operating Hours': site.operating_hours, 'Annual Production': site.annual_production, 'Primary Contact': c.site_contact }).map(([k, v]) =>
      v ? new Paragraph({ spacing: sp(0, 80), children: [new TextRun({ text: `${k}: `, bold: true, size: 22, color: BLUE, font: 'Calibri' }), new TextRun({ text: v, size: 22, color: GRAY, font: 'Calibri' })] }) : null
    ).filter(Boolean)),
    ...spacer(1), pb(),

    // S3 Regulatory
    blueBar('3. Regulatory & Compliance'), ...spacer(1),
    ...(regs.authority ? [new Paragraph({ spacing: sp(0, 80), children: [new TextRun({ text: 'Regulatory Authority: ', bold: true, size: 22, color: BLUE, font: 'Calibri' }), new TextRun({ text: regs.authority, size: 22, color: GRAY, font: 'Calibri' })] })] : []),
    ...(regs.permit_number ? [new Paragraph({ spacing: sp(0, 80), children: [new TextRun({ text: 'Permit Number: ', bold: true, size: 22, color: BLUE, font: 'Calibri' }), new TextRun({ text: regs.permit_number, size: 22, color: GRAY, font: 'Calibri' })] })] : []),
    body(regs.compliance_status || ''),
    ...spacer(1), pb(),

    // S4–S6 Systems
    ...systems.flatMap(sys => [
      blueBar(`4. ${sys.name} — System Assessment`), ...spacer(1),
      body(sys.current_state || ''),
      ...spacer(1),
      ...(sys.findings?.length ? [new Paragraph({ spacing: sp(160, 60), children: [new TextRun({ text: 'Key Findings', bold: true, size: 24, color: BLUE, font: 'Calibri' })] }), ...sys.findings.map(bullet)] : []),
      ...spacer(1),
    ]),

    // S7 Staffing
    blueBar('7. Operations & Maintenance Practices'), ...spacer(1),
    body(sm.current || '[Staffing model to be confirmed.]'),
    ...spacer(1), pb(),

    // S8 Risks
    blueBar('8. Risks, Deficiencies & Observations'), ...spacer(1),
    ...allRisks.flatMap(item => [
      new Paragraph({ spacing: sp(160, 40), children: [new TextRun({ text: item.description || '', bold: true, size: 22, color: BLUE, font: 'Calibri' })] }),
      new Paragraph({ spacing: sp(0, 40), children: [new TextRun({ text: `System: ${item.system}     Severity: `, size: 20, color: GRAY, font: 'Calibri' }), new TextRun({ text: item.severity, bold: true, size: 20, color: item.severity?.toLowerCase() === 'high' ? 'C0392B' : item.severity?.toLowerCase() === 'medium' ? 'E67E22' : '27AE60', font: 'Calibri' })] }),
      ...(item.business_impact ? [body(`Business Impact: ${item.business_impact}`, { size: 20 })] : []),
      ...spacer(1),
    ]),
    pb(),

    // S9 Recommendations
    blueBar('9. Recommendations'), ...spacer(1),
    ...recTier('Quick Wins  (0–60 days)', '27AE60', quickWins),
    ...recTier('Medium-Term Improvements  (60–180 days)', 'E67E22', medTerm),
    ...recTier('Major Projects', 'C0392B', major),
    ...(allRecs.length === 0 ? [body('Recommendations to be documented following site visit analysis.')] : []),

    // Closing
    new Paragraph({ spacing: sp(0, 120), border: { top: { style: BorderStyle.SINGLE, size: 6, color: BLUE } }, children: [] }),
    body(`This assessment provides ${c.short_name || 'your team'} with an operational baseline and actionable recommendations. Contact Solution Group at (800) 465-8200 or info@solutionmgt.com to discuss next steps.`, { italic: true }),
  ];

  return new Document({
    numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 900, left: 1080 } } },
      headers: { default: makeHeader(c.short_name, 'Site Assessment Report') },
      footers: { default: makeFooter() },
      children
    }]
  });
}

// ── PROJECT PROPOSAL BUILDER (v6-aligned) ────────────────────────────────────
function buildProject(cfg) {
  const pricing = cfg.pricing || {};
  const categories = pricing.categories || [];
  const timeline = cfg.timeline || [];
  const sections = cfg.sections || {};
  const c = cfg.client || {};
  const sg = cfg.sg_signer || {};

  // Pricing table — 2 columns: Cost Category | Amount
  const pricingHeaderRow = new TableRow({ tableHeader: true, children: [
    new TableCell({ borders: brd, width: { size: 7200, type: WidthType.DXA }, shading: { fill: BLUE, type: ShadingType.CLEAR }, margins: mg,
      children: [new Paragraph({ children: [new TextRun({ text: 'Cost Category', bold: true, size: 20, color: WHITE, font: 'Calibri' })] })] }),
    new TableCell({ borders: brd, width: { size: 2160, type: WidthType.DXA }, shading: { fill: BLUE, type: ShadingType.CLEAR }, margins: mg,
      children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Amount', bold: true, size: 20, color: WHITE, font: 'Calibri' })] })] }),
  ]});

  const categoryRows = categories.map((cat, i) => new TableRow({ children: [
    new TableCell({ borders: brd, width: { size: 7200, type: WidthType.DXA }, shading: { fill: i % 2 === 0 ? WHITE : LGRAY, type: ShadingType.CLEAR }, margins: mg,
      children: [new Paragraph({ children: [new TextRun({ text: cat.name || '', size: 20, color: GRAY, font: 'Calibri' })] })] }),
    new TableCell({ borders: brd, width: { size: 2160, type: WidthType.DXA }, shading: { fill: i % 2 === 0 ? WHITE : LGRAY, type: ShadingType.CLEAR }, margins: mg,
      children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(cat.amount, cfg), size: 20, color: GRAY, font: 'Calibri' })] })] }),
  ]}));

  const totalRow = new TableRow({ children: [
    new TableCell({ borders: brd, width: { size: 7200, type: WidthType.DXA }, shading: { fill: BLUE, type: ShadingType.CLEAR }, margins: mg,
      children: [new Paragraph({ children: [new TextRun({ text: 'Total Project Investment', bold: true, size: 22, color: WHITE, font: 'Calibri' })] })] }),
    new TableCell({ borders: brd, width: { size: 2160, type: WidthType.DXA }, shading: { fill: BLUE, type: ShadingType.CLEAR }, margins: mg,
      children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(pricing.total, cfg), bold: true, size: 22, color: WHITE, font: 'Calibri' })] })] }),
  ]});

  // Timeline table — Timeframe | Activity
  const timelineHeaderRow = timeline.length ? new TableRow({ tableHeader: true, children: [
    new TableCell({ borders: brd, width: { size: 2880, type: WidthType.DXA }, shading: { fill: BLUE, type: ShadingType.CLEAR }, margins: mg,
      children: [new Paragraph({ children: [new TextRun({ text: 'Timeframe', bold: true, size: 20, color: WHITE, font: 'Calibri' })] })] }),
    new TableCell({ borders: brd, width: { size: 6480, type: WidthType.DXA }, shading: { fill: BLUE, type: ShadingType.CLEAR }, margins: mg,
      children: [new Paragraph({ children: [new TextRun({ text: 'Activity', bold: true, size: 20, color: WHITE, font: 'Calibri' })] })] }),
  ]}) : null;

  const timelineRows = timeline.map((row, i) => new TableRow({ children: [
    new TableCell({ borders: brd, width: { size: 2880, type: WidthType.DXA }, shading: { fill: i % 2 === 0 ? WHITE : LGRAY, type: ShadingType.CLEAR }, margins: mg,
      children: [new Paragraph({ children: [new TextRun({ text: row.timeframe || '', bold: true, size: 20, color: GRAY, font: 'Calibri' })] })] }),
    new TableCell({ borders: brd, width: { size: 6480, type: WidthType.DXA }, shading: { fill: i % 2 === 0 ? WHITE : LGRAY, type: ShadingType.CLEAR }, margins: mg,
      children: [new Paragraph({ children: [new TextRun({ text: row.activity || '', size: 20, color: GRAY, font: 'Calibri' })] })] }),
  ]}));

  // Signature block — optional
  const sigBlock = cfg.include_signature ? [
    pb(),
    blueBar('Proposal Acceptance'), ...spacer(1),
    new Table({
      width: { size: 9360, type: WidthType.DXA }, columnWidths: [4680, 4680],
      borders: { top: nb, bottom: nb, left: nb, right: nb, insideH: nb, insideV: nb },
      rows: [new TableRow({ children: [
        new TableCell({ borders: noBorders, width: { size: 4680, type: WidthType.DXA }, children: [
          new Paragraph({ spacing: sp(0, 120), children: [new TextRun({ text: c.name || 'Client', bold: true, size: 22, color: BLUE, font: 'Calibri' })] }),
          ...(c.site_contact ? [body(c.site_contact)] : []),
          ...(c.site_contact_title ? [body(c.site_contact_title)] : []),
          ...spacer(1),
          body('Signature: ___________________________'),
          body('Name: _______________________________'),
          body('Title: _______________________________'),
          body('Date: ________________________________'),
        ]}),
        new TableCell({ borders: noBorders, width: { size: 4680, type: WidthType.DXA }, children: [
          new Paragraph({ spacing: sp(0, 120), children: [new TextRun({ text: 'Solution Group', bold: true, size: 22, color: BLUE, font: 'Calibri' })] }),
          ...(sg.name ? [body(sg.name)] : []),
          ...(sg.title ? [body(sg.title)] : []),
          ...spacer(1),
          body('Signature: ___________________________'),
          body('Name: _______________________________'),
          body('Title: _______________________________'),
          body('Date: ________________________________'),
        ]}),
      ]})]
    }),
  ] : [];

  // Section numbering
  let sectionNum = 1;
  const sn = () => sectionNum++;

  // Core section renderers — keyed so Claude can order and include/exclude them
  const SECTION_RENDERERS = {
    introduction: () => [
      blueBar(`${sn()}. Proposal Introduction`), ...spacer(1),
      body(sections.introduction || ''), ...spacer(2),
    ],
    project_confirmation: () => [
      blueBar(`${sn()}. Project Confirmation`), ...spacer(1),
      body(sections.project_confirmation || 'The scope of work for this project is documented in the site assessment. This proposal reflects the commercial terms for that project scope.'), ...spacer(2),
    ],
    engineering_scope: () => [
      blueBar(`${sn()}. Engineering Scope Summary`), ...spacer(1),
      body(sections.engineering_scope || ''), ...spacer(2),
    ],
    commercial_summary: () => [
      blueBar(`${sn()}. Commercial Summary`), ...spacer(1),
      new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [7200, 2160], rows: [pricingHeaderRow, ...categoryRows, totalRow] }),
      ...spacer(1),
      ...(pricing.contingency_notes || []).map(n => body(n, { italic: true })),
      ...(pricing.pricing_notes || []).map(n => body(n, { italic: true })),
      body('Standard Solution Group progress billing terms apply: deposit at signing, progress billing through installation, final balance at substantial completion.', { italic: true }),
      ...spacer(2),
    ],
    timeline: () => timeline.length ? [
      blueBar(`${sn()}. Project Timeline`), ...spacer(1),
      new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2880, 6480], rows: [timelineHeaderRow, ...timelineRows] }),
      ...spacer(2),
    ] : [],
    assumptions: () => [
      blueBar(`${sn()}. Key Assumptions & Exclusions`), ...spacer(1),
      ...(cfg.assumptions_exclusions || []).map(bullet), ...spacer(2),
    ],
    next_steps: () => [
      blueBar(`${sn()}. Next Steps`), ...spacer(1),
      ...(cfg.next_steps || []).map(bullet), ...spacer(1),
      body('We look forward to the conversation and are ready to move forward on your timeline.'),
    ],
  };

  // Default order — Claude can override via section_order ONLY when user explicitly requested changes
  // If section_order is null or contains unknown keys, use the default
  const validKeys = ['introduction','project_confirmation','engineering_scope','commercial_summary','timeline','assumptions','next_steps'];
  const claudeOrder = Array.isArray(cfg.section_order) && cfg.section_order.length > 0 ? cfg.section_order : null;
  const defaultOrder = ['introduction','project_confirmation','engineering_scope','commercial_summary','timeline','assumptions','next_steps'];
  // Only use Claude's order if it contains at least the core valid keys — prevents hallucinated structures
  const sectionOrder = (claudeOrder && claudeOrder.some(k => validKeys.includes(k)))
    ? claudeOrder
    : defaultOrder;

  // Build section content — Claude can add custom sections anywhere via section_order
  const sectionContent = sectionOrder.flatMap(key => {
    if (SECTION_RENDERERS[key]) {
      return SECTION_RENDERERS[key]();
    }
    if (cfg.table_sections?.[key]) return tableSection(sn(), cfg.table_sections[key]);
    // Custom section — look up in additional_sections or sections object
    const customContent = (cfg.additional_sections || {})[key] || (cfg.sections || {})[key];
    if (customContent) {
      const title = OPTIONAL_SECTION_CONTENT[key]?.title || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return [
        blueBar(`${sn()}. ${title}`), ...spacer(1),
        ...(Array.isArray(customContent)
          ? customContent.map(bullet)
          : String(customContent).split('\n\n').filter(Boolean).map(p => body(p))),
        ...spacer(2),
      ];
    }
    return [];
  });

  const children = [
    ...coverPage(cfg),
    ...sectionContent,
    ...sigBlock,
  ];

  return new Document({
    numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 900, left: 1080 } } },
      headers: { default: makeHeader(c.short_name || c.name, cfg.proposal_title || 'Project Proposal') },
      footers: { default: makeFooter() },
      children
    }]
  });
}

// ── Claude API call ───────────────────────────────────────────────────────────
function callClaude(messages, maxTokens = 8192) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages });
    const req = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          if (parsed.stop_reason === 'max_tokens') return reject(new Error('The document was too long to finish in one pass. Try a shorter request or fewer source files.'));
          resolve(parsed.content.map(b => b.text || '').join('\n'));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Config extraction prompts ─────────────────────────────────────────────────
// Rules every Solution Group proposal shares. Tax and validity statements are added
// by code (enforceCommercialRules), so Claude is told never to write them.
const SHARED_RULES = `- Always write "Solution Group" in full, never "SG".
- Never use placeholders such as [To be confirmed] or TBD. Omit anything you cannot fill from the data.
- Never use em dashes. Use commas or periods.
- Never write sales tax, tax-exempt, or proposal-validity language anywhere. Those statements are inserted automatically in the Commercial Summary.
- Never disclose markup, margin, or contingency percentages. Bake them into prices silently.
- Executive audience: the reader should understand the whole proposal in under 10 minutes. Detailed scope lives in the assessment document; reference it instead of reproducing it.
- REDUNDANCY RULE: every fact, dollar amount, date, and commitment appears exactly once, in the section a reader would look for it.
  * Dollar amounts and fees: Commercial Summary only.
  * Scope boundaries and exclusions: Key Assumptions & Exclusions only.
  * Action items, procurement steps, lead times, purchase orders: Next Steps only.
  * Third parties (engineering firms, subcontractors): name once, where their work is described.
  * Dates: state once; elsewhere say "the date above".
  * If a fact fits two sections, keep it in the best one and cross-reference ("see Commercial Summary").
  * Before returning, scan every section for any subject that appears twice and delete the weaker copy.`;

function proposalConfigPrompt(formData, fileText) {
  const userInstructions = formData.additionalInstructions ? `
MANDATORY USER INSTRUCTIONS — apply these before anything else. These override defaults:
${formData.additionalInstructions}
` : '';
  return `You are a senior Solution Group proposal writer. Using the provided data, produce a complete JSON config for a branded recurring service proposal.
${userInstructions}
RULES:
${SHARED_RULES}
- Apply ALL user instructions above precisely and completely before returning the config.
- If instructions ask for a currency change, convert all amounts and set currency_symbol.
- Length: Introduction 1 short paragraph. Service Confirmation 2-3 sentences. Assumptions & Exclusions 4-8 bullets. Next Steps 3-5 bullets.
- For operator-staffed O&M (labor in scope), Assumptions include: out-of-scope work is billed back at cost plus 10% with written approval above $5,000, and overtime is billed at $125/hr with a 4-hour minimum. Default term is 36 months with 12-month auto-renewal and 60-day notice unless the data says otherwise.
- Line item names must be client-facing (e.g. Labor, Technology Fee, OptiClear Fee, Corporate Support). Never show internal cost build-ups.

FORM DATA: ${JSON.stringify(formData)}
${fileText ? `FILE CONTENT:
${fileText}` : ''}

Today's date is: ${todayLong()}. Use this as the proposal date if none is specified.

Return ONLY valid JSON (no markdown, no preamble) matching this structure:
{
  "proposal_title": "string — e.g. 'Industrial Wastewater Monitoring & Services'",
  "proposal_date": "string — formatted date",
  "client": { "name": "full legal name", "short_name": "short name", "address": "address or empty string", "site_contact": "contact name or empty string", "site_contact_title": "title or empty string" },
  "sg_signer": { "name": "Solution Group rep name", "title": "title", "phone": "phone or empty string", "email": "email or empty string" },
  "sections": {
    "introduction": "1-2 short paragraphs — concise, professional, no equipment lists",
    "service_confirmation": "2-3 sentences confirming what Solution Group will deliver"
  },
  "pricing": {
    "monthly_total": number,
    "annual_total": number,
    "line_items": [{ "description": "string", "monthly": number }],
    "include_opticlear": true or false
  },
  "timeline": "string or null — timeline description if provided",
  "include_signature": true or false,
  "assumptions_exclusions": ["bullet string"],
  "next_steps": ["bullet string"]
}

Extract everything available. For client/SG contacts: use what you have, leave fields as empty string if unknown.
If the user instructions ask for an extra section, add it under "additional_sections": { "<snake_case_key>": "paragraphs separated by blank lines, or an array of bullets" } and list every section key in order under "section_order". Otherwise omit both.`;
}

function assessmentConfigPrompt(formData, fileText) {
  const userInstructions = formData.additionalInstructions ? `
MANDATORY USER INSTRUCTIONS — apply these before anything else:
${formData.additionalInstructions}
` : '';
  return `You are a senior Solution Group assessment writer. Using the provided data, produce a complete JSON config for a branded site assessment report.
${userInstructions}
RULES:
- Always write "Solution Group" in full — never abbreviate as "SG"
- Apply ALL user instructions above precisely before returning the config

FORM DATA: ${JSON.stringify(formData)}
${fileText ? `FILE CONTENT:\n${fileText}` : ''}

Today's date is: ${todayLong()}. Use this as the proposal date if none is specified.

Return ONLY valid JSON (no markdown, no preamble) matching this structure:
{
  "document_title": "Site Assessment Report",
  "date": "string",
  "client": { "name": "full name", "short_name": "short", "address": "address", "site_contact": "name", "site_contact_title": "title" },
  "sg_signer": { "name": "SG rep", "title": "title" },
  "executive_summary": "2-3 paragraph executive summary string",
  "site_overview": { "industry": "string", "operating_hours": "string", "annual_production": "string" },
  "regulatory": { "authority": "string", "permit_number": "string", "compliance_status": "string" },
  "systems": [{
    "name": "system name",
    "current_state": "description paragraph",
    "findings": ["finding string", ...],
    "risks": [{ "description": "string", "severity": "High|Medium|Low", "business_impact": "string" }],
    "recommendations": [{ "action": "string", "priority": "Quick Win|Medium-Term|Major Project", "business_goal": "string" }]
  }],
  "staffing_model": { "current": "string" },
  "monitoring": { "current": "string", "gaps": ["string"] }
}`;
}

function projectConfigPrompt(formData, fileText) {
  const userInstructions = formData.additionalInstructions ? `
MANDATORY USER INSTRUCTIONS — apply these before anything else. These are requirements, not suggestions:
${formData.additionalInstructions}
` : '';
  return `You are a senior Solution Group proposal writer. Using the provided data, produce a complete JSON config for a branded capital project proposal.
${userInstructions}
SECTION STRUCTURE (follow exactly unless user instructions say otherwise):
1. Proposal Introduction — 1-2 short paragraphs, NO equipment lists, reference assessment doc for detail
2. Project Confirmation — 2 sentences confirming scope is in the assessment document
3. Engineering Scope Summary — narrative by concept (what the system does), NOT by equipment line item
4. Commercial Summary — 4 rolled-up categories ONLY: Parts & Equipment | Engineering & Labor | Operations & Management | OptiClear Remote Management (if applicable)
5. Project Timeline — only if timeline data provided
6. Key Assumptions & Exclusions — brief bullets
7. Next Steps — brief bullets

CRITICAL RULES:
${SHARED_RULES}
- No monthly/annual columns — project proposals have a single total investment figure
- Cover page: use what's available; minimal is fine; never leave blanks
- Pricing MUST be rolled up into max 4 categories — never individual line items
- Engineering scope = 2-3 short paragraphs max, what the system accomplishes and why, NOT a parts list. Concise and executive-readable.
- Timeline: ONLY include if the uploaded documents explicitly contain a schedule with specific timeframes (e.g. "Weeks 1-4", "Phase 1: 3 weeks", "Start: March 1"). Do NOT infer, estimate, or generate a timeline from project scope. Do NOT include a timeline just because there is a start date or project length. If no explicit schedule with phases or week ranges exists in the source material, return timeline as null or an empty array.
- Contact names: only include if you have both first AND last name. Single names (e.g. "Gram") must be omitted entirely from contacts.
- When user instructions introduce a new commitment (e.g. "provide stamped drawings"), place it in exactly one section: Assumptions if it is a scope boundary, Next Steps if it is an action.

FORM DATA: ${JSON.stringify(formData)}
${fileText ? `FILE CONTENT:\n${fileText}` : ''}

Today's date is: ${todayLong()}. Use this as the proposal date if none is specified.

Return ONLY valid JSON (no markdown, no preamble) matching this structure:
{
  "proposal_title": "project title — e.g. 'pH Adjust System Project Proposal'",
  "date": "formatted date string",
  "client": { "name": "full legal name", "short_name": "short name", "address": "address or empty string", "site_contact": "contact name or empty string", "site_contact_title": "title or empty string" },
  "sg_signer": { "name": "Solution Group rep full name", "title": "title or empty string", "email": "email or empty string" },
  "sections": {
    "introduction": "1-2 short paragraphs — concise, no equipment lists",
    "project_confirmation": "2 sentences — scope is in the assessment doc, this covers commercial terms",
    "engineering_scope": "narrative paragraphs describing the system concept, architecture, and what it accomplishes — NOT a parts list"
  },
  "pricing": {
    "total": number — the TOTAL project investment figure,
    "categories": [
      { "name": "Parts & Equipment", "amount": number },
      { "name": "Engineering & Labor", "amount": number },
      { "name": "Operations & Management", "amount": number },
      { "name": "OptiClear Remote Management", "amount": number }
    ],
    "contingency_notes": ["string — note any line items that are budgetary/pending"],
    "pricing_notes": ["optional: other client-facing pricing notes only (no tax, validity, lead time, or markup language)"]
  },
  "timeline": [{ "timeframe": "Weeks 1-4", "activity": "Parts procurement" }] or null,
  "include_signature": true or false,
  "assumptions_exclusions": ["bullet string"],
  "next_steps": ["bullet string"],
  "section_order": null
}

SECTION ORDER RULES — only apply when user explicitly asks to add/remove/reorder sections via additional instructions:
- Default order: introduction, project_confirmation, engineering_scope, commercial_summary, timeline, assumptions, next_steps
- If user asks to add a custom section, include it in section_order at the right position AND add it to additional_sections
- If user asks to remove a section, omit its key from section_order
- If user asks to replace a section, swap the key
- If no section changes requested, return section_order as null
IMPORTANT: Never invent or add sections that were not explicitly requested.

PRICING GUIDANCE:
- Use the FINAL marked-up total from the source data — this is the "Sales Price w/Contingency" or equivalent final total, not the subtotal before contingency markup. If multiple totals exist, always use the largest final figure.
- Roll up line items into max 4 categories using their MARKED-UP sale prices (not estimated costs): Parts & Equipment = parts/equipment/materials. Engineering & Labor = labor, programming, engineering, warranty, freight. Operations & Management = travel, lodging, meals, admin/PM, crane. OptiClear Remote Management = ONLY if a subscription or setup cost is explicitly stated with a dollar value in the source data — a checkbox or "Yes" flag alone is NOT sufficient. If no dollar amount exists for OptiClear, omit the category entirely.
- Category amounts must use the marked-up sale price figures from the source data. If a second contingency markup is applied on top of line item margins (common in SG trackers), apply that same multiplier to each category so they sum to the final total.
- NEVER invent, estimate, or fabricate any dollar amount. If a category has no line items with dollar values, omit it.
- NEVER mention markup percentage, contingency percentage, or margin anywhere in the document — not in pricing notes, assumptions, engineering scope, or anywhere else. The markup is silently baked into the numbers.
- Lead times belong in Next Steps only — never in Commercial Summary pricing notes.
- If the source data contains a fact (lead time, cost, commitment) that you include in one section, do not repeat it in any other section. Cross-reference with "see Commercial Summary" or "as noted above" instead of restating.`;
}

// ── Sections chosen in the section builder (first generation only) ───────────
const DEFAULT_ORDER = {
  proposal: ['introduction','service_confirmation','commercial_summary','assumptions','next_steps'],
  project:  ['introduction','project_confirmation','engineering_scope','commercial_summary','timeline','assumptions','next_steps'],
};
const OPTIONAL_AFTER = { opticlear: 'commercial_summary', sg_academy: 'assumptions', safety: 'assumptions', kpi_reporting: 'assumptions' };

function applySectionChoices(cfg, formData) {
  const selected = formData?.optionalSections || [];
  const clientName = cfg.client?.short_name || cfg.client?.name || 'the client';
  // Keep a section Claude added only when the user's instructions asked for one
  const requested = formData?.additionalInstructions?.trim()
    ? Object.entries(cfg.additional_sections || {}).filter(([k, v]) => !OPTIONAL_SECTION_CONTENT[k] && v && (typeof v === 'string' ? v.trim() : v.length))
    : [];
  const claudeOrder = Array.isArray(cfg.section_order) ? cfg.section_order : [];
  cfg.additional_sections = Object.fromEntries(requested);
  selected.forEach(key => {
    const def = OPTIONAL_SECTION_CONTENT[key];
    if (def) cfg.additional_sections[key] = def.content.replace(/CLIENT_NAME/g, clientName);
  });
  if (formData?.sectionOrder?.length) {
    cfg.section_order = formData.sectionOrder;           // the section builder is the source of truth
  } else if (selected.length) {
    const order = [...(DEFAULT_ORDER[formData?.docType] || DEFAULT_ORDER[cfg.sections?.service_confirmation ? 'proposal' : 'project'])];
    selected.forEach(key => {
      if (!cfg.additional_sections[key] || order.includes(key)) return;
      const idx = order.indexOf(OPTIONAL_AFTER[key] || 'commercial_summary');
      idx === -1 ? order.push(key) : order.splice(idx + 1, 0, key);
    });
    cfg.section_order = order;
  } else if (requested.length) {
    cfg.section_order = [...(DEFAULT_ORDER[formData?.docType] || DEFAULT_ORDER.project)];
  } else {
    delete cfg.section_order;
  }
  // Place requested extra sections where Claude put them, else before Next Steps
  requested.forEach(([key]) => {
    if (cfg.section_order.includes(key)) return;
    const after = claudeOrder[claudeOrder.indexOf(key) - 1];
    const idx = after && cfg.section_order.includes(after) ? cfg.section_order.indexOf(after) + 1
      : cfg.section_order.includes('next_steps') ? cfg.section_order.indexOf('next_steps') : cfg.section_order.length;
    cfg.section_order.splice(idx, 0, key);
  });
}

// ── Revision prompt: edit the existing document as the user asks ─────────────
const REVISABLE = {
  proposal:   'sections.introduction, sections.service_confirmation, pricing (monthly_total, annual_total, line_items[{description, monthly}]), assumptions_exclusions[], next_steps[], include_signature, additional_sections, section_order. Built-in section keys: introduction, service_confirmation, commercial_summary, assumptions, next_steps.',
  project:    'sections.introduction, sections.project_confirmation, sections.engineering_scope, pricing (total, categories[{name, amount}], contingency_notes[], pricing_notes[]), timeline[{timeframe, activity}], assumptions_exclusions[], next_steps[], include_signature, additional_sections, section_order. Built-in section keys: introduction, project_confirmation, engineering_scope, commercial_summary, timeline, assumptions, next_steps.',
  assessment: 'executive_summary, site_overview, regulatory, systems[{name, current_state, findings[], risks[], recommendations[]}], staffing_model.',
  watersolve: 'salutation, opening, executive_summary, bid_items[], includes_products[], includes_equipment[], includes_labor[], schedule_summary, exclusions[], quote_assumptions[], project_description_line, and line_items[{qty, uom, item, description, unitPrice}] (the priced table; amounts are qty x unitPrice and are calculated for you).',
};

function revisionPrompt({ docType, previousConfig, revisionInstructions, revisionHistory, formData, fileText }) {
  const earlier = (revisionHistory || []).slice(0, -1).filter(Boolean);
  const form = { ...(formData || {}) };
  delete form.additionalInstructions; delete form.sectionBuilderState; delete form.wsLineItems;
  return `You are a senior editor at Solution Group revising a ${docType === 'watersolve' ? 'WaterSolve' : 'Solution Group'} ${docType} document. The document is stored as the JSON config below; your edited JSON is rendered directly into the final Word file.

Today's date is ${todayLong()}.

THE REQUESTED CHANGE (apply it fully; it overrides the original writing rules and any earlier choice):
${revisionInstructions}
${earlier.length ? `
EARLIER CHANGES (already applied; keep them in effect unless the new request reverses them):
${earlier.map((r, i) => `${i + 1}. ${r}`).join('\n')}
` : ''}
CURRENT DOCUMENT CONFIG:
${JSON.stringify(previousConfig, null, 2)}

CURRENT FORM VALUES (the user may have edited these since the last version; names, contacts, dates and amounts here win over the config):
${JSON.stringify(form, null, 2)}
${fileText ? `
SOURCE FILES (use for facts the change needs):
${fileText}
` : ''}
WHAT YOU CAN CHANGE: ${REVISABLE[docType] || REVISABLE.project}

HOW TO APPLY THE CHANGE:
- Make the change everywhere it matters, not just the first place. If a price changes, update every dependent total so the numbers add up. If a fact changes, update every sentence that states it.
- Rewrite, shorten, expand, reorder, or change tone with real editorial judgment. "Shorter" means materially shorter.
- To add a section: put its content in additional_sections.<snake_case_key> (paragraphs separated by blank lines, or an array of bullets) and set section_order to the complete ordered list of section keys, including the new one. To remove a section, leave its key out of section_order. To rename one, use a new key with the new title.
- To add or remove a signature block, set include_signature to true or false.
- Leave everything the request does not touch exactly as it is.
- Keep every fact appearing once. If the change introduces something already stated elsewhere, remove the older copy.
- Never use em dashes. Never invent dollar amounts the user or the source files did not give.
- Tax and proposal-validity statements are added automatically. Only write them in pricing.pricing_notes, and only if the request is about tax or validity wording.

Return ONLY the complete updated config as valid JSON, with the same structure. No markdown, no commentary.`;
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (!API_KEY) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured.' }); return;
  }

  try {
    const { docType, formData, fileContents, previousConfig, revisionInstructions, revisionHistory, optionalSections, sectionOrder } = req.body;
    // Merge optionalSections into formData so prompts and injection logic can access it
    if (optionalSections?.length && formData) formData.optionalSections = optionalSections;
    // User-defined section order takes priority over everything
    if (sectionOrder?.length && formData) formData.sectionOrder = sectionOrder;
    if (formData) formData.docType = docType;
    const fileText = (fileContents || []).join('\n\n---\n\n');

    let cfg;

    const isRevision = !!(previousConfig && revisionInstructions);
    if (isRevision) {
      // ── REVISION MODE: edit the current document as the user asked ──
      if (docType === 'watersolve' && !Array.isArray(previousConfig.line_items)) {
        previousConfig.line_items = parseLineItems(formData?.wsLineItems);
      }
      const raw = await callClaude([{ role: 'user', content: revisionPrompt({ docType, previousConfig, revisionInstructions, revisionHistory, formData, fileText }) }]);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Revision did not return valid JSON.');
      cfg = JSON.parse(jsonMatch[0]);
    } else {
      // ── GENERATION MODE: build config from form data ──
      let prompt;
      if (docType === 'proposal')        prompt = proposalConfigPrompt(formData, fileText);
      else if (docType === 'assessment') prompt = assessmentConfigPrompt(formData, fileText);
      else if (docType === 'project')    prompt = projectConfigPrompt(formData, fileText);
      else if (docType === 'watersolve') prompt = waterSolveConfigPrompt(formData, fileText);
      else if (docType === 'custom') {
        // Custom: skip config extraction entirely — call Claude directly and build a simple doc
        const customInstruction = formData.customPrompt || formData.additionalInstructions || 'Generate a professional document.';
        const customRaw = await callClaude([{ role: 'user', content:
          `You are a document writer for Solution Group, an environmental management and water treatment company.

${fileText ? `ATTACHED FILES:\n${fileText}\n\n` : ''}USER INSTRUCTION:\n${customInstruction}

Write a professional, well-structured document based on the instruction above.
- Use ## for section headers
- Use clear, professional language
- Do not use em dashes (-- or —) anywhere
- Format for a business audience
- Solution Group address: 6239 S. East Street Suite F, Indianapolis IN 46227 | (800) 465-8200 | solutionmgt.com

Return ONLY the document content — no preamble, no explanation.`
        }], 4096);

        // Build a simple branded doc from the raw text
        const paragraphs = [];
        for (const line of customRaw.split('\n')) {
          const trimmed = line.replace(/\u2014/g, ',').replace(/\u2013/g, '-').trim();
          if (!trimmed) { paragraphs.push(new Paragraph({ spacing: sp(0,80), children: [] })); continue; }
          if (trimmed.startsWith('## ')) {
            paragraphs.push(blueBar(trimmed.replace(/^##\s+/, '')));
          } else if (trimmed.startsWith('# ')) {
            paragraphs.push(new Paragraph({ spacing: sp(200,120), children: [new TextRun({ text: trimmed.replace(/^#\s+/, ''), bold: true, size: 32, color: BLUE, font: 'Calibri' })] }));
          } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            paragraphs.push(new Paragraph({ spacing: sp(0,80), numbering: { reference: 'bullets', level: 0 }, children: [new TextRun({ text: trimmed.replace(/^[-•]\s+/, ''), size: 22, color: GRAY, font: 'Calibri' })] }));
          } else {
            paragraphs.push(body(trimmed));
          }
        }

        const customDoc = new Document({
          numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] }] },
          sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 900, left: 1080 } } },
            headers: { default: makeHeader('Solution Group', 'Custom Document') },
            footers: { default: makeFooter() },
            children: paragraphs,
          }]
        });

        const customBuffer = await Packer.toBuffer(customDoc);
        const dateShort = todayShort();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="SG Custom Document - ${dateShort}.docx"`);
        res.status(200).send(customBuffer);
        return;
      }
      else throw new Error(`Unknown docType: ${docType}`);

      const raw = await callClaude([{ role: 'user', content: prompt }]);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Claude did not return valid JSON config.');
      cfg = JSON.parse(jsonMatch[0]);
    }

    // On first generation: use formData for include_signature (form dropdown is authoritative)
    // On revision: trust Claude's output (user may have asked to add/remove signature via revision)
    if (!isRevision) {
      cfg.include_signature = formData.includeSignature === 'yes';
    }

    // Strip em dashes from all string values in cfg — replace with comma or hyphen
    const stripEmDashes = obj => {
      if (typeof obj === 'string') return obj.replace(/\u2014/g, ',').replace(/\u2013/g, '-');
      if (Array.isArray(obj)) return obj.map(stripEmDashes);
      if (obj && typeof obj === 'object') {
        const out = {};
        for (const [k,v] of Object.entries(obj)) out[k] = stripEmDashes(v);
        return out;
      }
      return obj;
    };
    cfg = stripEmDashes(cfg);

    // Additional instructions are now applied in the config extraction prompt directly

    // Hard timeline gate — only keep timeline if entries have actual timeframe values
    // (e.g. "Weeks 1-4", "Phase 1", specific dates). Wipe it otherwise.
    if (cfg.timeline && Array.isArray(cfg.timeline)) {
      const hasRealTimeframes = cfg.timeline.some(row =>
        row.timeframe && /(\d|week|phase|month|day|q[1-4])/i.test(row.timeframe)
      );
      if (!hasRealTimeframes) cfg.timeline = [];
    }

    if (docType === 'watersolve') {
      cfg.line_items = parseLineItems(isRevision && Array.isArray(cfg.line_items) ? cfg.line_items : formData?.wsLineItems);
    } else if (!isRevision) {
      applySectionChoices(cfg, formData);
    }
    if (docType !== 'assessment' && docType !== 'watersolve') {
      enforceCommercialRules(cfg, isRevision && /\btax|\bvalid/i.test(revisionInstructions));
    }

    // 3. Build the docx
    let doc;
    if (docType === 'proposal')        doc = buildProposal(cfg);
    else if (docType === 'assessment') doc = buildAssessment(cfg);
    else if (docType === 'watersolve') doc = buildWaterSolve(cfg, formData);
    else                               doc = buildProject(cfg);

    const buffer = await Packer.toBuffer(doc);

    const dateShort = todayShort();
    const clientName = (cfg.client?.short_name || cfg.client?.name || formData?.clientShortName || formData?.clientLegalName || 'Client').trim();
    const projectDesc = (cfg.proposal_title || formData?.projectTitle || '')
      .replace(/[-\u2013\u2014]/g, ' ')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
    const filename = `${clientName}${projectDesc ? ' ' + projectDesc : ''} - ${dateShort}.docx`;

    // JSON, not a binary download: the client needs the config to make later revisions,
    // and a large config does not fit in a response header.
    res.status(200).json({ filename, docBase64: buffer.toString('base64'), config: cfg });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
