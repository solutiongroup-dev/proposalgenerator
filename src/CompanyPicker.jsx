import { useEffect, useState } from "react";

// ── HubSpot company and deal pickers ──────────────────────────────────────────
// Shared by the sales lead form and the proposal form. Several sites can share one
// email domain (Agropur Lake Norden, Agropur Hull…), so people pick the exact HubSpot
// company and deal instead of the app guessing, and new companies are only created
// when someone confirms it's a different company or site.

const BLUE = "#2B579A";

const css = `
  .co-list { border: 1px solid #e2e8f0; border-radius: 8px; margin-top: 8px; overflow: hidden; background: white; }
  .co-list.err { border-color: #e24b4a; box-shadow: 0 0 0 3px rgba(226,75,74,0.1); }
  .co-head { font-size: 12px; color: #4a5568; background: #f8f9fc; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  .co-item { display: block; width: 100%; text-align: left; background: white; border: none; border-bottom: 1px solid #edf0f5; padding: 10px 12px; font-family: inherit; cursor: pointer; }
  .co-item:last-child { border-bottom: none; }
  .co-item:hover { background: #f2f6fc; }
  .co-item strong { display: block; font-size: 14px; color: #1a2332; font-weight: 600; }
  .co-item span { font-size: 12px; color: #7a8a9a; }
  .co-item .tag { display: inline-block; font-size: 10px; font-weight: 600; color: #7a4b00; background: #fffaeb; border-radius: 3px; padding: 1px 5px; margin-left: 6px; }
  .co-item.new strong { color: ${BLUE}; }
  .co-item.on { background: #eef3fb; box-shadow: inset 3px 0 0 ${BLUE}; }
  .co-picked { display: flex; align-items: center; gap: 10px; margin-top: 2px; background: #e1f5ee; border: 1px solid #1D9E75; border-radius: 8px; padding: 10px 12px; font-size: 14px; color: #0a6554; }
  .co-picked button { margin-left: auto; background: none; border: none; color: #0a6554; text-decoration: underline; cursor: pointer; font-family: inherit; font-size: 13px; }
  .co-hint { font-size: 12px; color: #7a8a9a; margin-top: 5px; line-height: 1.5; }
  .co-hint.warn { color: #7a4b00; }
`;

export const emailDomainOf = email => (/^[^\s@]+@([^\s@]+\.[^\s@]+)$/.exec(String(email || "").trim()) || [])[1]?.toLowerCase() || "";
const place = c => [[c.city, c.state].filter(Boolean).join(", "), c.domain].filter(Boolean).join(" · ");
const money = n => n == null ? "" : "$" + Math.round(n).toLocaleString("en-US");

/**
 * value: { companyId, companyName, newCompanyOk }
 * onChange(patch): patch may include companyId, companyName, newCompanyOk, and on pick: city, state
 * onMatches(count): how many existing companies are listed (the form requires a choice when > 0)
 */
export function CompanyPicker({ value, onChange, domain = "", error = false, onMatches, inputId = "co-input", inputClassName = "" }) {
  const { companyId = "", companyName = "", newCompanyOk = false } = value;
  const [s, setS] = useState({ key: "", list: [], loading: false, error: "" });

  useEffect(() => {
    const q = companyName.trim();
    if (companyId || (q.length < 2 && !domain)) { setS({ key: "", list: [], loading: false, error: "" }); return; }
    const key = q + "|" + domain;
    setS(prev => ({ ...prev, loading: true }));
    const t = setTimeout(() => {
      fetch(`/api/lead?company=${encodeURIComponent(q)}&domain=${encodeURIComponent(domain)}`)
        .then(r => r.json())
        .then(d => setS({ key, list: d.companies || [], loading: false, error: d.searchError || "" }))
        .catch(() => setS({ key, list: [], loading: false, error: "Could not search HubSpot companies" }));
    }, 350);
    return () => clearTimeout(t);
  }, [companyName, companyId, domain]);

  useEffect(() => { onMatches && onMatches(companyId ? 0 : s.list.length); }, [s.list.length, companyId]);

  if (companyId) return (
    <div className="co-picked">
      <style>{css}</style>
      <span>✓ Existing HubSpot company: <strong>{companyName}</strong></span>
      <button type="button" onClick={() => onChange({ companyId: "" })}>Change</button>
    </div>
  );

  const typed = companyName.trim();
  return (<>
    <style>{css}</style>
    <input id={inputId} className={inputClassName} value={companyName} autoComplete="off"
      onChange={e => onChange({ companyName: e.target.value, newCompanyOk: false })} />
    <div className="co-hint">Start typing to find it in HubSpot. For a company with several sites, use <em>Company – Site</em>, like “Agropur – Hull”.</div>
    {s.list.length > 0 && (
      <div className={"co-list" + (error ? " err" : "")}>
        <div className="co-head">Already in HubSpot. Tap the right one so no duplicate is created:</div>
        {s.list.map(c => (
          <button type="button" key={c.id} className="co-item" onClick={() => onChange({ companyId: c.id, companyName: c.name, newCompanyOk: false, city: c.city, state: c.state })}>
            <strong>{c.name}{c.sameDomain && <span className="tag">same email domain</span>}</strong>
            <span>{place(c) || "No location in HubSpot"}</span>
          </button>
        ))}
        {typed && (
          <button type="button" className={"co-item new" + (newCompanyOk ? " on" : "")} onClick={() => onChange({ newCompanyOk: !newCompanyOk })}>
            <strong>{newCompanyOk ? "✓ " : "+ "}None of these. Create new company “{typed}”</strong>
            <span>Choose this only for a different company or a different site.</span>
          </button>
        )}
      </div>
    )}
    {!s.loading && !s.error && s.key && s.list.length === 0 && typed.length >= 2 && (
      <div className="co-hint">Not in HubSpot yet. A new company will be created.</div>
    )}
    {s.error && <div className="co-hint warn">{s.error}. A company with exactly this name will be reused; otherwise a new one is created.</div>}
  </>);
}

/**
 * The open deals of a picked company. value: a deal ID, "new", or "" (not chosen yet).
 * onDeals(count): how many open deals exist (the form requires a choice when > 0)
 */
export function DealPicker({ companyId, value, onChange, error = false, onDeals }) {
  const [s, setS] = useState({ id: "", deals: [], loading: false, error: "" });

  useEffect(() => {
    if (!companyId) { setS({ id: "", deals: [], loading: false, error: "" }); return; }
    setS({ id: companyId, deals: [], loading: true, error: "" });
    fetch(`/api/lead?deals=${encodeURIComponent(companyId)}`)
      .then(r => r.json())
      .then(d => setS({ id: companyId, deals: d.deals || [], loading: false, error: d.dealsError || "" }))
      .catch(() => setS({ id: companyId, deals: [], loading: false, error: "Could not load this company's deals" }));
  }, [companyId]);

  useEffect(() => { onDeals && onDeals(s.loading ? -1 : s.deals.length); }, [s.loading, s.deals.length]);

  if (!companyId) return null;
  if (s.loading) return <div className="co-hint"><style>{css}</style>Loading this company's open deals…</div>;
  if (s.error) return <div className="co-hint warn"><style>{css}</style>{s.error}. A new deal will be created.</div>;
  if (!s.deals.length) return <div className="co-hint"><style>{css}</style>This company has no open deals in HubSpot. A new deal will be created.</div>;

  return (
    <div className={"co-list" + (error ? " err" : "")}>
      <style>{css}</style>
      <div className="co-head">Which deal is this document for? The document is attached to it and its amount and close date are updated.</div>
      {s.deals.map(d => (
        <button type="button" key={d.id} className={"co-item" + (value === d.id ? " on" : "")} onClick={() => onChange(d.id)}>
          <strong>{value === d.id ? "✓ " : ""}{d.name}</strong>
          <span>{[d.pipeline, d.stage].filter(Boolean).join(" · ")}{d.amount != null ? ` · ${money(d.amount)}` : ""}{d.created ? ` · created ${new Date(d.created).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}</span>
        </button>
      ))}
      <button type="button" className={"co-item new" + (value === "new" ? " on" : "")} onClick={() => onChange("new")}>
        <strong>{value === "new" ? "✓ " : "+ "}New deal</strong>
        <span>This document is for a separate opportunity.</span>
      </button>
    </div>
  );
}
