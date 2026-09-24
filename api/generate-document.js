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

// ── Shared helpers ─────────────────────────────────────────────────────────────
const sp  = (before = 0, after = 120) => ({ before, after });
const cb  = { style: BorderStyle.SINGLE, size: 1, color: BGRAY };
const brd = { top: cb, bottom: cb, left: cb, right: cb };
const nb  = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: nb, bottom: nb, left: nb, right: nb };
const mg  = { top: 80, bottom: 80, left: 120, right: 120 };
const fmt = (n, cfg) => {
  if (n == null || n === 0) return '[TBD]';
  const sym = cfg?.currency_symbol || '$';
  return sym + Number(n).toLocaleString('en-US');
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
    new Paragraph({ spacing: sp(0, 40), children: [new TextRun({ text: `Date: ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}`, size: 22, color: GRAY, font: 'Calibri' })] }),
    new Paragraph({ spacing: sp(0, 40), children: [new TextRun({ text: 'Valid for 30 days from date above.', size: 18, italic: true, color: '888888', font: 'Calibri' })] }),
    pb()
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
      body('This proposal is valid for 30 days from the date above.', { italic: true }),
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

  // Enforce single canonical tax and validity statements — strip any duplicates
  const canonicalTax = 'Sales tax is not included in the investment figures above and will be added by Solution Group Accounting.';
  const canonicalValidity = 'This proposal is valid for 30 days from the date above.';
  const taxRe = /(sales tax|tax.*not included|tax.*included|proposal.*valid|valid.*\d+ days)/i;
  if (cfg.assumptions_exclusions) cfg.assumptions_exclusions = cfg.assumptions_exclusions.filter(b => !taxRe.test(b));
  if (cfg.next_steps) cfg.next_steps = cfg.next_steps.filter(b => !taxRe.test(b));
  const otherPricingNotes = (pricing.pricing_notes || []).filter(n => !taxRe.test(n));
  pricing.pricing_notes = [canonicalTax, canonicalValidity, ...otherPricingNotes];

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
      body('This proposal is valid for 30 days from the date above. Sales tax is added by Solution Group Accounting on all estimates.', { italic: true }),
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
function callClaude(messages, maxTokens = 4096) {
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
function proposalConfigPrompt(formData, fileText) {
  const userInstructions = formData.additionalInstructions ? `
MANDATORY USER INSTRUCTIONS — apply these before anything else. These override defaults:
${formData.additionalInstructions}
` : '';
  return `You are a senior Solution Group proposal writer. Using the provided data, produce a complete JSON config for a branded recurring service proposal.
${userInstructions}
RULES:
- Always write "Solution Group" in full — never abbreviate as "SG"
- Never use [To be confirmed] or placeholders — omit fields you cannot fill
- Never expose markup as a line item — bake it into pricing
- Apply ALL user instructions above precisely and completely before returning the config
- If instructions ask for a new section, add it as a key in the JSON and populate it fully
- If instructions ask for currency change, convert all amounts and set currency_symbol
- REDUNDANCY RULE: Every fact, term, dollar amount, or commitment must appear exactly once, in the section where a reader would most naturally look for it. Specifically:
  * Recurring or subscription fees: state amount, coverage, and timing once only — in the Commercial Summary line item. Do not repeat in Introduction, Service Confirmation, Assumptions, or Next Steps.
  * Sales tax treatment and proposal validity period: appear once only in the Commercial Summary. Do not restate elsewhere.
  * Dates: reference a date once as the source of truth; use "the date above" or "the start date noted in the Commercial Summary" for any other mention rather than restating the literal date.
  * Procedural commitments (lead times, purchase orders, authorization steps): consolidate into Next Steps only — do not preview earlier and repeat there.
  * If a fact is relevant to two sections, place it in the section where it belongs and cross-reference from the other ("see Commercial Summary") rather than restating it.
  * Before finalizing, mentally scan all sections for any phrase, dollar amount, or commitment that appears more than once and consolidate.

FORM DATA: ${JSON.stringify(formData)}
${fileText ? `FILE CONTENT:
${fileText}` : ''}

Today's date is: ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}. Use this as the proposal date if none is specified.

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
IMPORTANT: Do NOT add any additional_sections or section_order — only return the fields listed above.`;
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

Today's date is: ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}. Use this as the proposal date if none is specified.

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
DOCUMENT STRUCTURE (follow exactly unless user instructions say otherwise):

SECTION STRUCTURE (follow exactly):
1. Proposal Introduction — 1-2 short paragraphs, NO equipment lists, reference assessment doc for detail
2. Project Confirmation — 2 sentences confirming scope is in the assessment document
3. Engineering Scope Summary — narrative by concept (what the system does), NOT by equipment line item
4. Commercial Summary — 4 rolled-up categories ONLY: Parts & Equipment | Engineering & Labor | Operations & Management | OptiClear Remote Management (if applicable)
5. Project Timeline — only if timeline data provided
6. Key Assumptions & Exclusions — brief bullets
7. Next Steps — brief bullets

CRITICAL RULES:
- Always write "Solution Group" in full — NEVER abbreviate as "SG"  
- Never use [To be confirmed] or any placeholder — use only available info; omit unknown fields
- Never expose markup/margin as a line item — bake it into category totals silently
- No monthly/annual columns — project proposals have a single total investment figure
- Cover page: use what's available; minimal is fine; never leave blanks
- Pricing MUST be rolled up into max 4 categories — never individual line items
- Engineering scope = 2-3 short paragraphs max, what the system accomplishes and why, NOT a parts list. Concise and executive-readable.
- Timeline: ONLY include if the uploaded documents explicitly contain a schedule with specific timeframes (e.g. "Weeks 1-4", "Phase 1: 3 weeks", "Start: March 1"). Do NOT infer, estimate, or generate a timeline from project scope. Do NOT include a timeline just because there is a start date or project length. If no explicit schedule with phases or week ranges exists in the source material, return timeline as null or an empty array.
- Contact names: only include if you have both first AND last name. Single names (e.g. "Gram") must be omitted entirely from contacts.
- Never use em dashes anywhere. Use commas or periods instead.
- REDUNDANCY RULE: Every fact, term, dollar amount, or commitment must appear exactly once, in the section where a reader would most naturally look for it. Specifically:
  * Recurring or subscription fees: state amount, coverage, and timing once only — in the Commercial Summary line item. Do not repeat in Engineering Scope, Assumptions, or Next Steps.
  * Sales tax treatment and proposal validity period: appear once only in the Commercial Summary. Do not restate elsewhere.
  * Dates (start date, mobilization date, proposal date): reference each date once as the source of truth; use "the date above" or "the start date noted in the Commercial Summary" for any other mention rather than restating the literal date.
  * Procedural commitments (lead times, purchase orders, authorization steps): consolidate into Next Steps only — do not preview earlier and repeat there.
  * If a fact is relevant to two sections, place it in the section where it belongs and cross-reference from the other ("see Commercial Summary") rather than restating it.
  * Before finalizing, mentally scan all sections for any phrase, dollar amount, or commitment that appears more than once and consolidate.

FORM DATA: ${JSON.stringify(formData)}
${fileText ? `FILE CONTENT:\n${fileText}` : ''}

Today's date is: ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}. Use this as the proposal date if none is specified.

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
    "pricing_notes": ["string — e.g. sales tax note, validity period"]
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

PRICING GUIDANCE: Roll up all individual tracker line items into the 4 categories. Parts & Equipment = all parts/equipment/materials. Engineering & Labor = all labor, programming, warranty, freight. Operations & Management = travel, lodging, meals, admin/PM. OptiClear Remote Management = only if OptiClear subscription is explicitly included in the source data.
- The "total" must equal the exact figure from the source data — never calculate or estimate it.
- Category amounts must come directly from the source data. If category-level breakdown is NOT present in the source data, return each category amount as 0 and add a contingency_note saying "Category breakdown not provided — total reflects full project investment."
- NEVER invent, estimate, or split the total across categories based on assumptions. Only populate category amounts if they are explicitly stated or clearly calculable from the source data.
- pricing_notes must contain exactly ONE entry about sales tax: "Sales tax is not included in the investment figures above and will be added by Solution Group Accounting." Do not add any other tax statement anywhere in the document.
- Do not put the proposal validity period anywhere except pricing_notes. One entry only: "This proposal is valid for 30 days from the date above."`;
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
    const { docType, formData, fileContents, previousConfig, revisionInstructions, optionalSections, sectionOrder } = req.body;
    // Merge optionalSections into formData so prompts and injection logic can access it
    if (optionalSections?.length && formData) formData.optionalSections = optionalSections;
    // User-defined section order takes priority over everything
    if (sectionOrder?.length && formData) formData.sectionOrder = sectionOrder;
    const fileText = (fileContents || []).join('\n\n---\n\n');

    let cfg;

    if (previousConfig && revisionInstructions) {
      // ── REVISION MODE: edit the previous config surgically ──
      const revisionPrompt = `You are a senior proposal writer and editor at Solution Group. You are making specific revisions to an existing proposal config JSON.

Today's date is: ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}

CURRENT CONFIG:
${JSON.stringify(previousConfig, null, 2)}

REVISION INSTRUCTIONS:
${revisionInstructions}

Apply these instructions with full reasoning ability:
- If asked to convert currency, use your knowledge of current exchange rates, do the actual math on every monetary value, and add a pricing_note showing the rate used
- If asked to change tone or rewrite sections, use genuine editorial judgment
- If asked to add a timeline, generate a realistic one based on the project scope
- If asked to update a date, use today's date unless a specific date is given
- Make ONLY the changes requested — copy all other fields verbatim
- If asked to add a signature block, set "include_signature": true
- If asked to remove a signature block, set "include_signature": false
- Never use em dashes
- REDUNDANCY RULE: Every fact, dollar amount, or commitment must appear exactly once in the most relevant section. If a change introduces a fact already stated elsewhere, remove the duplicate rather than keeping both.
- Return ONLY valid JSON, no markdown, no preamble`;

      const raw = await callClaude([{ role: 'user', content: revisionPrompt }], 4096);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Revision did not return valid JSON.');
      cfg = JSON.parse(jsonMatch[0]);
    } else {
      // ── GENERATION MODE: build config from form data ──
      let prompt;
      if (docType === 'proposal')        prompt = proposalConfigPrompt(formData, fileText);
      else if (docType === 'assessment') prompt = assessmentConfigPrompt(formData, fileText);
      else if (docType === 'project')    prompt = projectConfigPrompt(formData, fileText);
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
        const now = new Date();
        const dateShort = `${now.getMonth()+1}.${String(now.getDate()).padStart(2,'0')}`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="SG Custom Document - ${dateShort}.docx"`);
        res.status(200).send(customBuffer);
        return;
      }
      else throw new Error(`Unknown docType: ${docType}`);

      const raw = await callClaude([{ role: 'user', content: prompt }], 4096);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Claude did not return valid JSON config.');
      cfg = JSON.parse(jsonMatch[0]);
    }

    // On first generation: use formData for include_signature (form dropdown is authoritative)
    // On revision: trust Claude's output (user may have asked to add/remove signature via revision)
    if (!previousConfig) {
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

    // Inject optional sections selected by the user
    const selectedSections = formData?.optionalSections || [];
    const clientNameForSections = cfg.client?.short_name || cfg.client?.name || 'the client';

    // ALWAYS wipe Claude-generated additional_sections
    cfg.additional_sections = {};

    // Inject optional section content
    if (selectedSections.length > 0) {
      selectedSections.forEach(key => {
        const sectionDef = OPTIONAL_SECTION_CONTENT[key];
        if (!sectionDef) return;
        const sectionContent = sectionDef.content.replace(/CLIENT_NAME/g, clientNameForSections);
        cfg.additional_sections[key] = sectionContent;
      });
    }

    // ALWAYS apply user-defined section order if provided — regardless of optional sections
    // This is the source of truth from the section builder page
    if (formData?.sectionOrder?.length) {
      cfg.section_order = formData.sectionOrder;
    } else if (selectedSections.length > 0) {
      // No explicit order but has optional sections — insert at logical positions
      const defaultOrder = ['introduction','project_confirmation','engineering_scope','commercial_summary','timeline','assumptions','next_steps'];
      const optionalOrder = {
        opticlear:    'commercial_summary',
        sg_academy:   'assumptions',
        safety:       'assumptions',
        kpi_reporting:'assumptions',
      };
      selectedSections.forEach(key => {
        if (cfg.additional_sections[key] && !defaultOrder.includes(key)) {
          const insertAfter = optionalOrder[key] || 'commercial_summary';
          const idx = defaultOrder.indexOf(insertAfter);
          idx !== -1 ? defaultOrder.splice(idx + 1, 0, key) : defaultOrder.push(key);
        }
      });
      cfg.section_order = defaultOrder;
    } else {
      // No optional sections, no user order — wipe any Claude-generated order
      delete cfg.section_order;
    }

    // 3. Build the docx
    let doc;
    if (docType === 'proposal')        doc = buildProposal(cfg);
    else if (docType === 'assessment') doc = buildAssessment(cfg);
    else                               doc = buildProject(cfg);

    const buffer = await Packer.toBuffer(doc);

    const now = new Date();
    const dateShort = `${now.getMonth()+1}.${String(now.getDate()).padStart(2,'0')}`;
    const clientName = (cfg.client?.short_name || cfg.client?.name || 'Client').trim();
    const projectDesc = (cfg.proposal_title || '')
      .replace(/[-\u2013\u2014]/g, ' ')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
    const filename = `${clientName}${projectDesc ? ' ' + projectDesc : ''} - ${dateShort}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Document-Config', Buffer.from(JSON.stringify(cfg)).toString('base64'));
    res.setHeader('Access-Control-Expose-Headers', 'X-Document-Config');
    res.status(200).send(buffer);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
