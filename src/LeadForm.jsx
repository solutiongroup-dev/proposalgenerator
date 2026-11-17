import { useEffect, useState } from "react";
import { loadDraft, saveDraft, clearDraft, store } from "./draft.js";

// ── Sales lead (prequalification) ────────────────────────────────────────────
// Field staff enter a new lead; /api/lead creates the deal in the Project or
// Recurring pipeline's Prequalification stage and links the company and contact.
// Built for phones first. What's typed is autosaved until HubSpot confirms it.

const BLUE = "#2B579A";
const EMPTY = { companyName: "", location: "", contactName: "", phone: "", email: "", ownerId: "", ownerName: "", pipeline: "", estimatedValue: "", nextSteps: "" };

const css = `
  .lead-page { max-width: 640px; margin: 0 auto; padding: 40px 16px 80px; }
  .lead-card { background: white; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 24px; }
  .lead-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .lead-grid .full { grid-column: 1 / -1; }
  .lead-section { font-size: 12px; font-weight: 600; color: ${BLUE}; text-transform: uppercase; letter-spacing: 0.6px; margin: 22px 0 10px; }
  .lead-section:first-child { margin-top: 0; }
  .lead-grid > *, .lead-type button { min-width: 0; }
  .lead-page .field input, .lead-page .field select, .lead-page .field textarea { font-size: 16px; width: 100%; min-width: 0; box-sizing: border-box; }  /* 16px stops iPhone zooming in */
  .lead-page .field label { font-size: 12px; }
  .lead-type { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .lead-type button { border: 1.5px solid #e2e8f0; background: white; border-radius: 8px; padding: 12px; text-align: left; cursor: pointer; font-family: inherit; }
  .lead-type button.on { border-color: ${BLUE}; background: #eef3fb; box-shadow: 0 0 0 3px rgba(43,87,154,0.1); }
  .lead-type button.err { border-color: #e24b4a; }
  .lead-type strong { display: block; font-size: 15px; color: #1a2332; }
  .lead-type span { font-size: 12px; color: #7a8a9a; }
  .lead-submit { width: 100%; margin-top: 22px; background: ${BLUE}; color: white; border: none; border-radius: 8px; padding: 15px; font-size: 16px; font-weight: 600; font-family: inherit; cursor: pointer; }
  .lead-submit:disabled { opacity: 0.6; cursor: default; }
  .lead-msg { overflow-wrap: anywhere; border-radius: 8px; padding: 11px 14px; font-size: 14px; line-height: 1.5; margin-top: 14px; }
  .lead-msg.bad { color: #b42318; background: #fef3f2; border: 1px solid #fecdca; }
  .lead-msg.warn { color: #7a4b00; background: #fffaeb; border: 1px solid #fedf89; }
  @media (max-width: 560px) { .lead-grid { grid-template-columns: 1fr; } .lead-card { padding: 18px 16px; } }
`;

export default function LeadForm({ onBack }) {
  const [f, setF] = useState(EMPTY);
  const [owners, setOwners] = useState(null);       // null while loading
  const [ownersError, setOwnersError] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [ready, setReady] = useState(false);

  // Restore an unsent lead, and load HubSpot users for the "Solution Group lead" picker
  useEffect(() => {
    loadDraft("lead").then(d => {
      const lastOwner = store.get("sg_lead_owner") || "";
      if (d && d.form) setF({ ...EMPTY, ...d.form });
      else if (lastOwner) setF(prev => ({ ...prev, ownerId: lastOwner }));
      setReady(true);
    });
    fetch("/api/lead").then(r => r.json()).then(d => {
      setOwners(d.owners || []);
      if (d.ownersError) setOwnersError(d.ownersError);
    }).catch(() => { setOwners([]); setOwnersError("Could not load the list of HubSpot users."); });
  }, []);

  useEffect(() => {
    if (!ready || done) return;
    const t = setTimeout(() => {
      const empty = Object.keys(EMPTY).every(k => !f[k] || k === "ownerId");
      if (empty) clearDraft("lead"); else saveDraft("lead", { form: f });
    }, 400);
    return () => clearTimeout(t);
  }, [f, ready, done]);

  const set = (k, v) => { setF(prev => ({ ...prev, [k]: v })); if (errors[k]) setErrors(prev => ({ ...prev, [k]: false })); };
  const ownerList = owners || [];
  const useFreeText = owners !== null && ownerList.length === 0;

  const submit = async e => {
    e.preventDefault();
    if (busy) return;
    const errs = {};
    if (!f.companyName.trim()) errs.companyName = true;
    if (!f.pipeline) errs.pipeline = true;
    if (useFreeText ? !f.ownerName.trim() : !f.ownerId) errs.owner = true;
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) errs.email = true;
    setErrors(errs);
    if (Object.keys(errs).length) { setError(errs.email && Object.keys(errs).length === 1 ? "Check the email address." : "Fill in the fields marked in red."); return; }

    setBusy(true); setError("");
    const owner = ownerList.find(o => o.id === f.ownerId);
    try {
      const r = await fetch("/api/lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, ownerId: useFreeText ? "" : f.ownerId, ownerName: useFreeText ? f.ownerName : owner?.name || "" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error(d.error || `Something went wrong (${r.status}). Your entries are saved; try again.`);
      if (!useFreeText) store.set("sg_lead_owner", f.ownerId);
      await clearDraft("lead");
      setDone({ ...d, company: f.companyName.trim(), ownerName: owner?.name || f.ownerName });
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Could not reach the server. Check your signal and try again; your entries are saved." : /saved/.test(err.message) ? err.message : `${err.message} Your entries are saved; try again.`);
    }
    setBusy(false);
  };

  const another = () => { setDone(null); setErrors({}); setError(""); setF({ ...EMPTY, ownerId: store.get("sg_lead_owner") || "" }); };

  if (done) return (
    <div className="lead-page">
      <style>{css}</style>
      <div className="lead-card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 6 }}>✅</div>
        <h2 style={{ color: BLUE, fontSize: 22, marginBottom: 8 }}>{done.duplicate ? "Already in HubSpot" : "Lead added to HubSpot"}</h2>
        <p style={{ color: "#4a5568", fontSize: 15, lineHeight: 1.6 }}>
          {done.duplicate
            ? <>This lead was entered a few minutes ago, so no second deal was created.</>
            : <><strong>{done.dealName}</strong> is in the <strong>{done.pipeline}</strong> pipeline, <strong>{done.stage}</strong> stage{done.ownerName ? <>, owned by <strong>{done.ownerName}</strong></> : null}.</>}
        </p>
        {!done.duplicate && (done.company || done.contact) && (
          <p style={{ color: "#7a8a9a", fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
            {done.company && <>{done.company.existing ? "Linked to the existing company" : "New company created"}: {done.company.name}. </>}
            {done.contact && <>{done.contact.existing ? "Linked to the existing contact." : "New contact created."}</>}
          </p>
        )}
        {done.warnings?.length > 0 && <div className="lead-msg warn" style={{ textAlign: "left" }}>{done.warnings.join(" ")} The deal itself was created.</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
          {done.dealUrl && <a href={done.dealUrl} target="_blank" rel="noreferrer" className="btn-gen" style={{ textDecoration: "none" }}>Open in HubSpot</a>}
          <button className="btn-revise" onClick={another}>Enter another lead</button>
        </div>
        <button className="form-back" style={{ margin: "20px auto 0", display: "block" }} onClick={onBack}>← Back to the portal</button>
      </div>
    </div>
  );

  return (
    <div className="lead-page">
      <style>{css}</style>
      <button className="form-back" onClick={onBack}>← Back</button>
      <div className="form-title">Enter a sales lead</div>
      <div className="form-subtitle">Goes straight into HubSpot at the Prequalification stage. What you type is saved on this device until it's sent.</div>

      <form className="lead-card" onSubmit={submit} noValidate>
        <div className="lead-section">Opportunity type <span style={{ color: "#e24b4a" }}>*</span></div>
        <div className="lead-type">
          {[["Project", "Capital project, one-time work"], ["Recurring", "O&M or ongoing service"]].map(([k, sub]) => (
            <button type="button" key={k} className={(f.pipeline === k ? "on " : "") + (errors.pipeline ? "err" : "")} onClick={() => set("pipeline", k)} aria-pressed={f.pipeline === k}>
              <strong>{k}</strong><span>{sub}</span>
            </button>
          ))}
        </div>

        <div className="lead-section">Company</div>
        <div className="lead-grid">
          <div className="field full">
            <label htmlFor="l-co">Company name <span className="req">*</span></label>
            <input id="l-co" className={errors.companyName ? "err" : ""} value={f.companyName} onChange={e => set("companyName", e.target.value)} autoComplete="organization" />
          </div>
          <div className="field full">
            <label htmlFor="l-loc">Location <span className="opt">city, state</span></label>
            <input id="l-loc" value={f.location} onChange={e => set("location", e.target.value)} placeholder="Ennis, TX" />
          </div>
        </div>

        <div className="lead-section">Contact</div>
        <div className="lead-grid">
          <div className="field full">
            <label htmlFor="l-name">Contact name</label>
            <input id="l-name" value={f.contactName} onChange={e => set("contactName", e.target.value)} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="l-phone">Phone</label>
            <input id="l-phone" type="tel" inputMode="tel" value={f.phone} onChange={e => set("phone", e.target.value)} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="l-email">Email</label>
            <input id="l-email" type="email" inputMode="email" autoCapitalize="none" className={errors.email ? "err" : ""} value={f.email} onChange={e => set("email", e.target.value)} autoComplete="off" />
          </div>
        </div>

        <div className="lead-section">Opportunity</div>
        <div className="lead-grid">
          <div className="field">
            <label htmlFor="l-owner">Solution Group lead <span className="req">*</span></label>
            {useFreeText ? (
              <input id="l-owner" className={errors.owner ? "err" : ""} value={f.ownerName} onChange={e => set("ownerName", e.target.value)} placeholder="Your name" />
            ) : (
              <select id="l-owner" className={errors.owner ? "err" : ""} value={f.ownerId} onChange={e => set("ownerId", e.target.value)} disabled={owners === null}>
                <option value="">{owners === null ? "Loading HubSpot users…" : "Choose…"}</option>
                {ownerList.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
          </div>
          <div className="field">
            <label htmlFor="l-val">Estimated value</label>
            <input id="l-val" inputMode="decimal" value={f.estimatedValue} onChange={e => set("estimatedValue", e.target.value)} placeholder="$250,000 or 250k" />
          </div>
          <div className="field full">
            <label htmlFor="l-next">Next steps</label>
            <textarea id="l-next" value={f.nextSteps} onChange={e => set("nextSteps", e.target.value)} placeholder="e.g. Site walk on the 24th; send capabilities deck" />
          </div>
        </div>
        {ownersError && <div className="lead-msg warn">{ownersError}. Type the name instead; it will be noted on the deal.</div>}

        {error && <div className="lead-msg bad" role="alert">{error}</div>}
        <button type="submit" className="lead-submit" disabled={busy}>{busy ? "Adding to HubSpot…" : "Add lead to HubSpot"}</button>
      </form>
    </div>
  );
}
