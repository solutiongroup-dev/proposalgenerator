import { useEffect, useState } from "react";
import { store } from "./draft.js";

// ── Weekly deal review ────────────────────────────────────────────────────────
// Each deal owner confirms or updates their open deals: customer email, close date,
// amount, contract length, estimated startup date, stage and close probability, plus
// any context. Opened from the portal (enter your name or email) or from the personal
// link in the Monday email. Saves go straight to HubSpot with a review note on the deal.

const BLUE = "#2B579A";
const css = `
  .rv-page { max-width: 820px; margin: 0 auto; padding: 36px 16px 80px; font-family: 'DM Sans', sans-serif; color: #333; }
  .rv-page .form-title { font-size: 28px; font-weight: 600; color: ${BLUE}; margin-bottom: 4px; }
  .rv-page .form-subtitle { font-size: 14px; color: #7a8a9a; margin-bottom: 20px; }
  .rv-page .form-back { background: none; border: none; color: #7a8a9a; cursor: pointer; font-size: 13px; padding: 0; margin-bottom: 18px; font-family: inherit; }
  .rv-card { background: white; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  .rv-card.done { background: #f6fbf9; border-color: #b7e4d3; }
  .rv-title { font-size: 17px; font-weight: 600; color: #1a2332; }
  .rv-sub { font-size: 13px; color: #7a8a9a; margin-top: 2px; }
  .rv-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .rv-chip { font-size: 11px; font-weight: 600; color: #7a4b00; background: #fffaeb; border: 1px solid #fedf89; border-radius: 12px; padding: 2px 9px; }
  .rv-activity { background: #f8f9fc; border-left: 3px solid #4FA8A0; border-radius: 6px; padding: 10px 12px; margin-top: 12px; font-size: 13px; color: #4a5568; line-height: 1.5; white-space: pre-line; max-height: 140px; overflow: auto; overflow-wrap: anywhere; }
  .rv-activity b { color: #1a2332; }
  .rv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 14px; }
  .rv-grid .wide { grid-column: span 2; }
  .rv-f { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .rv-f label { font-size: 12px; font-weight: 500; color: #4a5568; }
  .rv-f input, .rv-f select, .rv-f textarea { font-size: 15px; font-family: inherit; border: 1px solid #cbd5e0; border-radius: 6px; padding: 8px 10px; width: 100%; box-sizing: border-box; background: white; min-width: 0; }
  .rv-f input.changed, .rv-f select.changed { border-color: ${BLUE}; background: #eef3fb; }
  .rv-f textarea { min-height: 70px; resize: vertical; }
  .rv-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; align-items: center; }
  .rv-btn { border: none; border-radius: 8px; padding: 11px 18px; font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer; }
  .rv-btn.primary { background: ${BLUE}; color: white; }
  .rv-btn.ghost { background: white; color: ${BLUE}; border: 1.5px solid ${BLUE}; }
  .rv-btn:disabled { opacity: 0.55; cursor: default; }
  .rv-msg { font-size: 13px; line-height: 1.5; border-radius: 8px; padding: 9px 12px; margin-top: 10px; overflow-wrap: anywhere; }
  .rv-msg.bad { color: #b42318; background: #fef3f2; border: 1px solid #fecdca; }
  .rv-msg.good { color: #0a6554; background: #e1f5ee; border: 1px solid #1D9E75; }
  .rv-section { font-size: 12px; font-weight: 600; color: ${BLUE}; text-transform: uppercase; letter-spacing: 0.6px; margin: 24px 0 10px; }
  @media (max-width: 640px) { .rv-grid { grid-template-columns: 1fr 1fr; } .rv-grid .wide { grid-column: 1 / -1; } .rv-card { padding: 16px; } }
  @media (max-width: 400px) { .rv-grid { grid-template-columns: 1fr; } }
`;

const FIELDS = ["customerEmail", "closeDate", "amount", "contractDays", "startupDate", "stageId", "probability"];
const valuesOf = d => ({ customerEmail: d.customer?.email || "", closeDate: d.closeDate || "", amount: d.amount ?? "",
  contractDays: d.contractDays ?? "", startupDate: d.startupDate || "", stageId: d.stageId || "", probability: d.probability ?? "" });
const fmtDate = ts => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function DealCard({ deal, owner, token, onSaved }) {
  const original = valuesOf(deal);
  const [v, setV] = useState(original);
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [done, setDone] = useState(deal.reviewedRecently ? "Reviewed this week" : "");

  const changed = FIELDS.filter(k => String(v[k] ?? "") !== String(original[k] ?? ""));
  const set = (k, val) => setV(prev => ({ ...prev, [k]: val }));
  const cls = k => changed.includes(k) ? "changed" : "";

  const save = async noUpdates => {
    setBusy(true); setMsg(null);
    try {
      const changes = Object.fromEntries(changed.map(k => [k, k === "amount" || k === "contractDays" || k === "probability" ? (v[k] === "" ? "" : Number(v[k])) : v[k]]));
      const r = await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, t: token, dealId: deal.id, noUpdates, context, changes, original }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Could not save (${r.status}).`);
      setDone(noUpdates && !changed.length ? "Confirmed: no updates" : `Saved${d.changes?.length ? `: ${d.changes.length} change${d.changes.length === 1 ? "" : "s"}` : ""}${context ? " and your context" : ""}`);
      onSaved(deal.id);
    } catch (e) {
      setMsg({ bad: true, text: e.message === "Failed to fetch" ? "Could not reach the server. Check your connection and try again." : e.message });
    }
    setBusy(false);
  };

  return (
    <div className={"rv-card" + (done ? " done" : "")}>
      <div className="rv-title">{deal.name}</div>
      <div className="rv-sub">{deal.pipeline} · {deal.stage}{deal.amount != null ? ` · $${Math.round(deal.amount).toLocaleString("en-US")}` : ""}{deal.lastReview ? ` · last reviewed ${fmtDate(deal.lastReview.at)}` : ""}</div>
      {done ? (
        <div className="rv-msg good" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span>✓ {done}</span>
          <button className="rv-btn ghost" style={{ marginLeft: "auto", padding: "5px 12px", fontSize: 13 }} onClick={() => setDone("")}>Update again</button>
        </div>
      ) : (<>
        {deal.reasons.length > 0 && <div className="rv-chips">{deal.reasons.map(r => <span key={r} className="rv-chip">{r}</span>)}</div>}
        <div className="rv-activity">
          {deal.lastActivity
            ? <><b>Last activity · {deal.lastActivity.kind} · {fmtDate(deal.lastActivity.at)}</b>{"\n"}{deal.lastActivity.text || "(no text)"}</>
            : <b>No notes, calls, meetings or emails logged on this deal yet.</b>}
          {deal.dealNotes ? <>{"\n\n"}<b>Deal notes:</b> {deal.dealNotes}</> : null}
        </div>
        <div className="rv-grid">
          <div className="rv-f wide"><label>Customer email{deal.customer?.name ? ` (${deal.customer.name})` : ""}</label>
            <input type="email" inputMode="email" autoCapitalize="none" className={cls("customerEmail")} value={v.customerEmail} onChange={e => set("customerEmail", e.target.value)} placeholder="name@customer.com" /></div>
          <div className="rv-f"><label>Close date</label>
            <input type="date" className={cls("closeDate")} value={v.closeDate} onChange={e => set("closeDate", e.target.value)} /></div>
          <div className="rv-f"><label>Deal amount ($)</label>
            <input inputMode="decimal" className={cls("amount")} value={v.amount} onChange={e => set("amount", e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" /></div>
          <div className="rv-f"><label>Contract length (days)</label>
            <input inputMode="numeric" className={cls("contractDays")} value={v.contractDays} onChange={e => set("contractDays", e.target.value.replace(/\D/g, ""))} placeholder="365" /></div>
          <div className="rv-f"><label>Estimated startup date</label>
            <input type="date" className={cls("startupDate")} value={v.startupDate} onChange={e => set("startupDate", e.target.value)} /></div>
          <div className="rv-f"><label>Deal stage</label>
            <select className={cls("stageId")} value={v.stageId} onChange={e => set("stageId", e.target.value)}>
              {deal.stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select></div>
          <div className="rv-f"><label>Close probability (%)</label>
            <input inputMode="numeric" className={cls("probability")} value={v.probability} onChange={e => set("probability", e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="40" /></div>
          <div className="rv-f" style={{ gridColumn: "1 / -1" }}><label>Additional context (saved as a note on the deal)</label>
            <textarea value={context} onChange={e => setContext(e.target.value)} placeholder="e.g. Customer delayed decision to Q1; waiting on capital approval" /></div>
        </div>
        {msg && <div className={"rv-msg " + (msg.bad ? "bad" : "good")}>{msg.text}</div>}
        <div className="rv-actions">
          <button className="rv-btn primary" disabled={busy || (!changed.length && !context.trim())} onClick={() => save(false)}>{busy ? "Saving…" : "Save changes"}</button>
          <button className="rv-btn ghost" disabled={busy || changed.length > 0} onClick={() => save(true)} title={changed.length ? "You've made changes. Save them instead." : ""}>No updates</button>
          {changed.length > 0 && <span style={{ fontSize: 12, color: "#7a8a9a" }}>{changed.length} field{changed.length === 1 ? "" : "s"} changed</span>}
        </div>
      </>)}
    </div>
  );
}

export default function ReviewPage({ onBack, linkOwner = "", linkToken = "" }) {
  const [owner, setOwner] = useState(linkOwner);
  const [who, setWho] = useState(store.get("sg_review_who") || "");
  const [matches, setMatches] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedIds, setSavedIds] = useState([]);

  const load = id => {
    setLoading(true); setError(""); setData(null);
    fetch(`/api/review?owner=${encodeURIComponent(id)}${linkToken ? `&t=${encodeURIComponent(linkToken)}` : ""}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (!ok) throw new Error(d.error || "Could not load your deals."); setData(d); })
      .catch(e => setError(e.message === "Failed to fetch" ? "Could not reach the server." : e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (owner) load(owner); }, [owner]);

  const find = async e => {
    e.preventDefault();
    if (!who.trim()) return;
    setError(""); setMatches(null);
    try {
      const r = await fetch(`/api/review?who=${encodeURIComponent(who.trim())}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not look that up.");
      store.set("sg_review_who", who.trim());
      if (d.owners.length === 1) setOwner(d.owners[0].id);
      else if (!d.owners.length) setError("No HubSpot user matches that name or email. Try your work email.");
      else setMatches(d.owners);
    } catch (err) { setError(err.message); }
  };

  const deals = data?.deals || [];
  const todo = deals.filter(d => !d.reviewedRecently && !savedIds.includes(d.id));
  const reviewed = deals.filter(d => d.reviewedRecently || savedIds.includes(d.id));

  return (
    <div className="rv-page">
      <style>{css}</style>
      {onBack && <button className="form-back" onClick={onBack}>← Back to the portal</button>}
      <div className="form-title">Weekly deal review</div>

      {!owner ? (
        <>
          <div className="form-subtitle">Enter your name or work email to see the HubSpot deals you own.</div>
          <form onSubmit={find} className="rv-card" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input value={who} onChange={e => setWho(e.target.value)} placeholder="Your name or email" autoFocus
              style={{ flex: 1, minWidth: 200, fontSize: 16, padding: "10px 12px", border: "1px solid #cbd5e0", borderRadius: 8, fontFamily: "inherit" }} />
            <button className="rv-btn primary" type="submit">Show my deals</button>
          </form>
          {matches && (
            <div className="rv-card">
              <div className="rv-sub" style={{ marginBottom: 8 }}>Which one are you?</div>
              {matches.map(m => <button key={m.id} className="rv-btn ghost" style={{ margin: "0 8px 8px 0" }} onClick={() => setOwner(m.id)}>{m.name}</button>)}
            </div>
          )}
        </>
      ) : (
        <div className="form-subtitle">
          {data ? <><strong>{data.owner.name}</strong> · {deals.length} open deal{deals.length === 1 ? "" : "s"} · {todo.length} to review</> : "Loading your deals from HubSpot…"}
          {!linkToken && data && <> · <a href="#" onClick={e => { e.preventDefault(); setOwner(""); setData(null); }}>Not you?</a></>}
        </div>
      )}

      {error && <div className="rv-msg bad">{error}</div>}
      {loading && <div className="rv-sub">Loading…</div>}

      {data && !deals.length && <div className="rv-card">No open deals in Recurring, Projects or WaterSolve are assigned to {data.owner.name} in HubSpot.</div>}
      {data && deals.length > 0 && !todo.length && <div className="rv-msg good">✓ All caught up. Every deal has been reviewed this week.</div>}

      {todo.length > 0 && <div className="rv-section">To review ({todo.length})</div>}
      {todo.map(d => <DealCard key={d.id} deal={d} owner={owner} token={linkToken} onSaved={id => setSavedIds(p => [...p, id])} />)}
      {reviewed.length > 0 && <div className="rv-section">Reviewed this week ({reviewed.length})</div>}
      {reviewed.map(d => <DealCard key={d.id} deal={{ ...d, reviewedRecently: true }} owner={owner} token={linkToken} onSaved={() => {}} />)}
    </div>
  );
}
