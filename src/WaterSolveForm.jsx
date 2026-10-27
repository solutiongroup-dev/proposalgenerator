import React from "react";

// ── WaterSolve proposal: fields, defaults and form ───────────────────────────
// Field set is based on WaterSolve's own proposals (dredging/dewatering letter and
// the Sales Proposal quote form). Prices live only in the line items; the server
// calculates amounts and totals from them.

export const WS_FIELDS = [
  { key:"clientLegalName",      label:"Customer Company",            required:true,  placeholder:"Complete Environmental" },
  { key:"customerContactTitle", label:"Contact Title",               required:false, placeholder:"Senior Project Manager" },
  { key:"customerAddress",      label:"Customer Mailing Address",    required:false, type:"textarea", placeholder:"37 Davis Swan Lane\nPurvis, MS 39475" },
  { key:"projectTitle",         label:"Project Name",                required:true,  placeholder:"Firestone Lagoon Project" },
  { key:"wsProposalTitle",      label:"Proposal Title (cover page)", required:false, placeholder:"Dredging and Dewatering Proposal", letterOnly:true },
  { key:"proposalDate",         label:"Proposal Date",               required:false, type:"date" },
  { key:"wsSiteLocation",       label:"Project Site / Ship To",      required:false, type:"textarea", placeholder:"Project Site\nSulphur, LA" },
  { key:"wsProposalNumber",     label:"Proposal Number",             required:false, placeholder:"Auto: customer initials + date", quoteOnly:true },

  { key:"wsMaterialType",       label:"Material",                    required:false, placeholder:"Industrial lagoon sludge" },
  { key:"wsMaterialVolume",     label:"Estimated Volume",            required:false, placeholder:"6,000 CY" },
  { key:"wsPercentSolids",      label:"% Solids",                    required:false, placeholder:"5%" },
  { key:"wsWorkSchedule",       label:"Work Schedule",               required:false, placeholder:"10 hrs/day, 6 days/week (Mon-Sat)" },
  { key:"wsSetupDays",          label:"Set-up Days",                 required:false, type:"number", placeholder:"3" },
  { key:"wsDredgeDays",         label:"Dredging / Operating Days",   required:false, type:"number", placeholder:"24" },
  { key:"wsDemobDays",          label:"Tear-down Days",              required:false, type:"number", placeholder:"2" },
  { key:"wsScopeNotes",         label:"Scope Notes",                 required:false, type:"textarea", placeholder:"Anything the writer should know: number of ponds, equipment to use, site constraints, sampling status..." },

  { key:"wsPaymentTerms",       label:"Payment Terms",               required:false, placeholder:"Net 30" },
  { key:"wsShipVia",            label:"Ship Via",                    required:false, placeholder:"Common Carrier", quoteOnly:true },
  { key:"wsFob",                label:"F.O.B.",                      required:false, placeholder:"Delivered", quoteOnly:true },
  { key:"wsShipDate",           label:"Ship Date",                   required:false, placeholder:"TBD", quoteOnly:true },

  { key:"wsRepName",            label:"WaterSolve Rep Name",         required:true,  placeholder:"Daniel Wilcox" },
  { key:"wsRepEmail",           label:"WaterSolve Rep Email",        required:false, placeholder:"name@gowatersolve.com" },

  { key:"additionalInstructions", label:"Any Additional Instructions", required:false, type:"textarea",
    placeholder:"Optional: guide Claude on tone, emphasis, or anything specific to this customer." },
];

// Keys the parser fills that are not plain form fields
export const WS_PARSE_KEYS = [...WS_FIELDS.map(f => f.key), "wsLineItems", "wsExclusions", "wsAssumptions", "wsFormat", "wsPreliminary"];

export const WS_DEFAULTS = {
  wsFormat: "letter", wsPreliminary: "", wsPaymentTerms: "Net 30", wsShipVia: "Common Carrier",
  wsFob: "Delivered", wsShipDate: "TBD", wsFreight: "included", wsIncludeStandardTerms: "",
  wsTreatability: "yes", dealSource: "WaterSolve", pipeline: "Project",
};

export const WS_PARSE_GUIDE = `- "wsLineItems": the priced bid items as a JSON-encoded string of an array: [{"qty":number,"uom":"Lump Sum|each|Days|month|s.f.|totes|...","item":"short item name","description":"one line","unitPrice":number}]. Use the source's own line items and prices. Never invent prices.
- "wsFormat": "quote" if the source looks like a one-page sales quote/order form, otherwise "letter"
- "wsPreliminary": "yes" if the source calls the pricing preliminary/budgetary, else ""
- "customerAddress"/"wsSiteLocation"/"wsExclusions"/"wsAssumptions": newline-separated lines
- "wsMaterialVolume" e.g. "13,000 CY"; "wsPercentSolids" e.g. "8%"; days fields are plain numbers
- "wsRepName"/"wsRepEmail": the WaterSolve sales rep, not the customer`;

const EXCLUSION_PRESETS = [
  "Geotextile tube laydown area grading and construction",
  "Permitting and engineering",
  "Excavation and removal of dewatered sediment",
  "Filtrate return pump and piping",
  "Electricity (110 V, 30 AMP) and polymer make-down water (30 gpm at 60 psi)",
  "Material handling equipment (10K telehandler or similar)",
  "Fuel for equipment",
  "Removal of debris and non-native materials",
];

const LINE_PRESETS = [
  { item:"Mobilization",     uom:"Lump Sum", qty:1, description:"Mobilization of personnel and equipment to project site" },
  { item:"Geotextile tube",  uom:"each",     qty:1, description:"60' circ x 100' length geotextile dewatering tubes" },
  { item:"Liner",            uom:"s.f.",     qty:1, description:"16-mil reinforced polyethylene liner" },
  { item:"Polymer",          uom:"totes",    qty:1, description:"Liquid emulsion polymer tote (2,300 lbs/tote)" },
  { item:"Equipment Rental", uom:"month",    qty:1, description:"" },
  { item:"Dredging",         uom:"Days",     qty:1, description:"Hydraulic dredging and dewatering in geotextile tubes" },
  { item:"Technical",        uom:"Days",     qty:1, description:"On site operation of dredging equipment, polymer feed and geotextile tubes" },
  { item:"Demobilization",   uom:"Lump Sum", qty:1, description:"Demobilization of personnel and equipment from project site" },
];
const UOMS = ["Lump Sum","each","Days","month","week","s.f.","l.f.","totes","drums","gallons","lbs"];

export function parseWsItems(raw) {
  try { const v = typeof raw === "string" ? JSON.parse(raw || "[]") : raw; return Array.isArray(v) ? v : []; }
  catch(e) { return []; }
}
const num = v => { const n = Number(String(v ?? "").replace(/[$,\s]/g, "")); return isFinite(n) ? n : 0; };
export const wsItemsTotal = items => items.reduce((s, li) => s + num(li.qty || 1) * num(li.unitPrice), 0);
const money = n => "$" + n.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });

// "Complete Environmental" + 2026-10-06 -> "CE100626"
export function wsProposalNumber(company, date) {
  const initials = (company || "").split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).map(w => w[0].toUpperCase()).join("").slice(0, 3) || "WS";
  const d = date ? new Date(date + "T12:00:00") : new Date();
  const p2 = n => String(n).padStart(2, "0");
  return `${initials}${p2(d.getMonth()+1)}${p2(d.getDate())}${String(d.getFullYear()).slice(2)}`;
}

const css = `
  .ws-toggle { display:flex; gap:10px; }
  .ws-toggle button { flex:1; text-align:left; padding:12px 14px; border:2px solid #CCCCCC; border-radius:6px; background:white; cursor:pointer; font-family:'DM Sans',sans-serif; }
  .ws-toggle button.on { border-color:#2B579A; background:#f0f5ff; }
  .ws-toggle strong { display:block; font-size:13px; color:#1a2332; margin-bottom:2px; }
  .ws-toggle span { font-size:11px; color:#7a8a9a; }
  .ws-check { display:flex; align-items:flex-start; gap:8px; font-size:13px; color:#333; padding:4px 0; cursor:pointer; }
  .ws-check input { margin-top:3px; }
  .ws-items { width:100%; border-collapse:collapse; font-size:12px; }
  .ws-items th { text-align:left; font-size:10px; font-weight:600; color:#4a5568; text-transform:uppercase; letter-spacing:0.5px; padding:6px 4px; border-bottom:1px solid #e2e8f0; }
  .ws-items td { padding:4px; vertical-align:top; }
  .ws-items input, .ws-items select { width:100%; padding:6px 7px; border:1px solid #CCCCCC; border-radius:4px; font-size:12px; font-family:inherit; }
  .ws-items .amt { text-align:right; white-space:nowrap; padding-top:10px; font-weight:500; }
  .ws-items .rm { background:none; border:none; color:#b0bbc8; cursor:pointer; font-size:16px; padding-top:6px; }
  .ws-presets { display:flex; flex-wrap:wrap; gap:6px; margin-top:12px; }
  .ws-presets button { font-size:11px; padding:4px 10px; border:1px solid #c8d4e8; border-radius:12px; background:#f8faff; color:#2B579A; cursor:pointer; font-family:inherit; }
  .ws-total { display:flex; justify-content:flex-end; gap:16px; margin-top:12px; padding-top:10px; border-top:1px solid #e2e8f0; font-size:14px; }
  .ws-total strong { color:#2B579A; }
  .ws-items-err { border:1px solid #e24b4a; border-radius:6px; padding:8px; }
`;

export default function WaterSolveForm({ formData, setField, renderField, errors, aiKeys }) {
  const isQuote = formData.wsFormat === "quote";
  const items = parseWsItems(formData.wsLineItems);
  const total = wsItemsTotal(items);
  const fieldsFor = keys => WS_FIELDS.filter(f => keys.includes(f.key) && !(isQuote && f.letterOnly) && !(!isQuote && f.quoteOnly));
  const grid = keys => (
    <div className="field-grid">
      {fieldsFor(keys).map(f => f.type === "textarea" ? <div key={f.key}>{renderField(f)}</div> : renderField(f))}
    </div>
  );

  // Keep the HubSpot deal amount and project length in step with the proposal
  const setItems = next => {
    setField("wsLineItems", JSON.stringify(next));
    const t = wsItemsTotal(next);
    if (t > 0) setField("dealAmount", money(t));
  };
  const setDays = (key, val) => {
    setField(key, val);
    const d = { wsSetupDays: formData.wsSetupDays, wsDredgeDays: formData.wsDredgeDays, wsDemobDays: formData.wsDemobDays, [key]: val };
    const sum = num(d.wsSetupDays) + num(d.wsDredgeDays) + num(d.wsDemobDays);
    if (sum > 0) setField("projectLengthDays", String(sum));
  };
  const updateItem = (i, key, val) => setItems(items.map((li, j) => j === i ? { ...li, [key]: val } : li));

  // wsExclusions (what the server reads) = checked presets + the free-text "other" lines.
  // The raw "other" text is kept separately so typing a new line isn't swallowed.
  const exclusions = (formData.wsExclusions || "").split("\n").map(s => s.trim()).filter(Boolean);
  const checkedPresets = EXCLUSION_PRESETS.filter(t => exclusions.includes(t));
  const otherText = formData.wsExclusionsOther ?? exclusions.filter(e => !EXCLUSION_PRESETS.includes(e)).join("\n");
  const setExclusions = (presets, other) => {
    setField("wsExclusionsOther", other);
    setField("wsExclusions", [...presets, ...other.split("\n").map(s => s.trim()).filter(Boolean)].join("\n"));
  };
  const toggleExclusion = text => setExclusions(
    checkedPresets.includes(text) ? checkedPresets.filter(e => e !== text) : EXCLUSION_PRESETS.filter(t => t === text || checkedPresets.includes(t)),
    otherText);

  const dayField = key => {
    const f = WS_FIELDS.find(x => x.key === key);
    return renderField({ ...f, onChange: v => setDays(key, v) });
  };

  return (
    <>
      <style>{css}</style>

      <div className="section">
        <div className="section-title">WaterSolve Format</div>
        <div className="ws-toggle">
          <button className={!isQuote ? "on" : ""} onClick={() => setField("wsFormat", "letter")}>
            <strong>Proposal Letter</strong>
            <span>Cover page, letter, executive summary, pricing, bid item descriptions. For dredging and dewatering projects.</span>
          </button>
          <button className={isQuote ? "on" : ""} onClick={() => setField("wsFormat", "quote")}>
            <strong>Sales Quote</strong>
            <span>One-page Sales Proposal form: To / Ship To, assumptions, itemized quote, full terms.</span>
          </button>
        </div>
        <div style={{display:"flex",gap:24,marginTop:14}}>
          <label className="ws-check">
            <input type="checkbox" checked={formData.wsPreliminary === "yes"} onChange={e => setField("wsPreliminary", e.target.checked ? "yes" : "")} />
            Preliminary pricing (based on assumptions)
          </label>
          <label className="ws-check">
            <input type="checkbox" checked={isQuote ? formData.wsIncludeStandardTerms !== "no" : formData.wsIncludeStandardTerms === "yes"}
              onChange={e => setField("wsIncludeStandardTerms", e.target.checked ? "yes" : "no")} />
            Attach full Standard Terms &amp; Conditions
          </label>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Customer &amp; Project</div>
        {grid(["clientLegalName","customerContactTitle","projectTitle","wsProposalTitle","proposalDate","wsProposalNumber","customerAddress","wsSiteLocation"])}
      </div>

      <div className="section">
        <div className="section-title">Scope Basis</div>
        {grid(["wsMaterialType","wsMaterialVolume","wsPercentSolids","wsWorkSchedule"])}
        <div className="field-grid" style={{gridTemplateColumns:"1fr 1fr 1fr",marginTop:12}}>
          {dayField("wsSetupDays")}{dayField("wsDredgeDays")}{dayField("wsDemobDays")}
        </div>
        <div style={{marginTop:12}}>{renderField(WS_FIELDS.find(f => f.key === "wsScopeNotes"))}</div>
        {!isQuote && (
          <label className="ws-check" style={{marginTop:10}}>
            <input type="checkbox" checked={formData.wsTreatability === "yes"} onChange={e => setField("wsTreatability", e.target.checked ? "yes" : "")} />
            Recommend sending samples to the WaterSolve treatability lab (Caledonia, MI)
          </label>
        )}
      </div>

      <div className="section" data-field="wsLineItems">
        <div className="section-title">
          Pricing{aiKeys.has("wsLineItems") && <span className="pill green">Auto-filled</span>}
        </div>
        <div className={errors.wsLineItems ? "ws-items-err" : ""}>
          <table className="ws-items">
            <thead><tr>
              <th style={{width:"9%"}}>Qty</th><th style={{width:"13%"}}>Unit</th><th style={{width:"20%"}}>Item</th>
              <th>Description</th><th style={{width:"13%"}}>Unit Price</th><th style={{width:"12%",textAlign:"right"}}>Amount</th><th style={{width:24}}></th>
            </tr></thead>
            <tbody>
              {items.map((li, i) => (
                <tr key={i}>
                  <td><input value={li.qty ?? ""} onChange={e => updateItem(i, "qty", e.target.value)} /></td>
                  <td>
                    <select value={li.uom || "Lump Sum"} onChange={e => updateItem(i, "uom", e.target.value)}>
                      {[...new Set([...UOMS, li.uom || "Lump Sum"])].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </td>
                  <td><input value={li.item || ""} onChange={e => updateItem(i, "item", e.target.value)} /></td>
                  <td><input value={li.description || ""} onChange={e => updateItem(i, "description", e.target.value)} /></td>
                  <td><input value={li.unitPrice ?? ""} placeholder="$0" onChange={e => updateItem(i, "unitPrice", e.target.value)} /></td>
                  <td className="amt">{money(num(li.qty || 1) * num(li.unitPrice))}</td>
                  <td><button className="rm" title="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ws-presets">
            {LINE_PRESETS.map(pr => <button key={pr.item} onClick={() => setItems([...items, { ...pr, unitPrice:"" }])}>+ {pr.item}</button>)}
            <button onClick={() => setItems([...items, { qty:1, uom:"each", item:"", description:"", unitPrice:"" }])}>+ Blank line</button>
          </div>
        </div>
        {isQuote && (
          <label className="ws-check" style={{marginTop:10}}>
            <input type="checkbox" checked={formData.wsFreight !== "separate"} onChange={e => setField("wsFreight", e.target.checked ? "included" : "separate")} />
            Freight included with items listed
          </label>
        )}
        <div className="ws-total">
          <span>{formData.wsPreliminary === "yes" ? "Preliminary total" : "Total"}</span>
          <strong>{money(total)}</strong>
        </div>
        <div style={{fontSize:11,color:"#9aa5b4",textAlign:"right",marginTop:4}}>Deal Amount is set from this total. Taxes are excluded automatically.</div>
      </div>

      <div className="section">
        <div className="section-title">Terms</div>
        {grid(["wsPaymentTerms","wsShipVia","wsFob","wsShipDate"])}
      </div>

      <div className="section">
        <div className="section-title">{isQuote ? "Assumptions & Exclusions" : "Items Not Provided"}</div>
        {isQuote && (
          <div className="field" style={{marginBottom:14}}>
            <label>Assumptions <span className="opt"> optional, one per line. Leave blank to have Claude draft them.</span></label>
            <textarea value={formData.wsAssumptions || ""} onChange={e => setField("wsAssumptions", e.target.value)}
              placeholder={"Approx. 6,000 CY of residuals at 5% solids, dewatered in geotextile tubes\nOn site work to be performed 10 hrs/day, 6 days/week Mon-Sat"} />
          </div>
        )}
        <div style={{fontSize:11,fontWeight:500,color:"#4a5568",marginBottom:6}}>Not provided by WaterSolve (customer or others)</div>
        {EXCLUSION_PRESETS.map(t => (
          <label key={t} className="ws-check">
            <input type="checkbox" checked={checkedPresets.includes(t)} onChange={() => toggleExclusion(t)} />{t}
          </label>
        ))}
        <div className="field" style={{marginTop:10}}>
          <label>Other exclusions <span className="opt"> one per line</span></label>
          <textarea value={otherText} onChange={e => setExclusions(checkedPresets, e.target.value)} />
        </div>
      </div>

      <div className="section">
        <div className="section-title">WaterSolve Rep &amp; Instructions</div>
        {grid(["wsRepName","wsRepEmail"])}
        <div style={{marginTop:12}}>{renderField(WS_FIELDS.find(f => f.key === "additionalInstructions"))}</div>
      </div>
    </>
  );
}
