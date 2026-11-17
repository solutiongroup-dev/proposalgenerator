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
  .rv-row { display: flex; align-items: center; gap: 12px; width: 100%; background: none; border: none; padding: 0; text-align: left; cursor: pointer; font-family: inherit; }
  .rv-card.closed { padding: 14px 16px; margin-bottom: 8px; }
  .rv-card.closed:hover { border-color: ${BLUE}; }
  .rv-card.open { border-color: ${BLUE}; box-shadow: 0 6px 24px rgba(43,87,154,0.12); }
  .rv-num { flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; background: #edf2f7; color: #4a5568; }
  .rv-num.done { background: #1D9E75; color: white; }
  .rv-num.now { background: ${BLUE}; color: white; }
  .rv-rowtext { flex: 1; min-width: 0; }
  .rv-rowtext .rv-title { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rv-rowtext .rv-sub { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rv-tag { flex-shrink: 0; font-size: 11px; font-weight: 600; border-radius: 12px; padding: 2px 9px; }
  .rv-tag.warn { color: #7a4b00; background: #fffaeb; border: 1px solid #fedf89; }
  .rv-tag.ok { color: #0a6554; background: #e1f5ee; border: 1px solid #b7e4d3; }
  .rv-progress { position: sticky; top: 0; z-index: 5; background: #F2F5FA; padding: 10px 0 12px; margin-bottom: 8px; }
  .rv-progress-top { display: flex; align-items: baseline; justify-content: space-between; font-size: 14px; color: #1a2332; margin-bottom: 6px; }
  .rv-progress-top strong { font-size: 16px; }
  .rv-bar { height: 10px; background: #e2e8f0; border-radius: 6px; overflow: hidden; }
  .rv-bar div { height: 100%; background: linear-gradient(90deg, #1D9E75, #4FA8A0); border-radius: 6px; transition: width 0.4s ease; }
  .rv-steps { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
  .rv-step { width: 22px; height: 22px; border-radius: 50%; border: none; font-size: 10px; font-weight: 700; cursor: pointer; background: #e2e8f0; color: #4a5568; font-family: inherit; padding: 0; }
  .rv-step.done { background: #1D9E75; color: white; }
  .rv-step.now { background: ${BLUE}; color: white; box-shadow: 0 0 0 2px #F2F5FA, 0 0 0 4px ${BLUE}; }
  @media (max-width: 640px) { .rv-grid { grid-template-columns: 1fr 1fr; } .rv-grid .wide { grid-column: 1 / -1; } .rv-card { padding: 16px; } }
  @media (max-width: 400px) { .rv-grid { grid-template-columns: 1fr; } }
`;

const FIELDS = ["customerEmail", "closeDate", "amount", "contractDays", "startupDate", "stageId", "probability"];
const valuesOf = d => ({ customerEmail: d.customer?.email || "", closeDate: d.closeDate || "", amount: d.amount ?? "",
  contractDays: d.contractDays ?? "", startupDate: d.startupDate || "", stageId: d.stageId || "", probability: d.probability ?? "" });
const fmtDate = ts => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function DealCard({ deal, index, owner, token, open, done, onOpen, onDone }) {
  const original = valuesOf(deal);
  const [v, setV] = useState(original);
  const [context, setContext] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const changed = FIELDS.filter(k => String(v[k] ?? "") !== String(original[k] ?? ""));
  const set = (k, val) => setV(prev => ({ ...prev, [k]: val }));
  const cls = k => changed.includes(k) ? "changed" : "";

  const save = async noUpdates => {
    setBusy(true); setMsg(null);
    try {
      const changes = Object.fromEntries(changed.map(k => [k, k === "amount" || k === "contractDays" || k === "probability" ? (v[k] === "" ? "" : Number(v[k])) : v[k]]));
      const r = await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, t: token, dealId: deal.id, noUpdates, context, changes, original, customerName }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Could not save (${r.status}).`);
      const label = noUpdates && !changed.length ? "No updates" : (d.changes?.length ? `${d.changes.length} update${d.changes.length === 1 ? "" : "s"}` : "Context added");
      setContext(""); setSavedNote(d.contactNote || "");
      onDone(deal.id, label, v);
    } catch (e) {
      setMsg({ bad: true, text: e.message === "Failed to fetch" ? "Could not reach the server. Check your connection and try again." : e.message });
    }
    setBusy(false);
  };

  const summary = `${deal.pipeline} · ${deal.stage}${deal.amount != null ? ` · $${Math.round(deal.amount).toLocaleString("en-US")}` : ""}${deal.closeDate ? ` · closes ${deal.closeDate}` : ""}`;
  const row = (
    <button className="rv-row" onClick={onOpen} aria-expanded={open}>
      <span className={"rv-num" + (done ? " done" : open ? " now" : "")}>{done ? "✓" : index + 1}</span>
      <span className="rv-rowtext"><div className="rv-title">{deal.name}</div><div className="rv-sub">{summary}</div></span>
      {done ? <span className="rv-tag ok">{done}</span> : (deal.reasons.length > 0 && <span className="rv-tag warn">{deal.reasons.length} to check</span>)}
    </button>
  );
  if (!open) return (
    <div className="rv-card closed" id={`deal-${deal.id}`}>
      {row}
      {savedNote && <div style={{ fontSize: 12, color: "#0a6554", margin: "6px 0 0 40px" }}>✓ {savedNote}</div>}
    </div>
  );

  return (
    <div className="rv-card open" id={`deal-${deal.id}`}>
      {row}
      {savedNote && <div className="rv-msg good">{savedNote}</div>}
      {done && <div className="rv-msg good">Already reviewed ({done}). Saving again adds another review note.</div>}
      <>
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
          {!deal.customer && changed.includes("customerEmail") && (
            <div className="rv-f"><label>Customer name (if new)</label>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="First Last" /></div>
          )}
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
      </>
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
  const [doneMap, setDoneMap] = useState({});   // deal id -> "No updates" / "2 updates"
  const [openId, setOpenId] = useState("");

  const load = id => {
    setLoading(true); setError(""); setData(null);
    fetch(`/api/review?owner=${encodeURIComponent(id)}${linkToken ? `&t=${encodeURIComponent(linkToken)}` : ""}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (!ok) throw new Error(d.error || "Could not load your deals."); setData(d); })
      .catch(e => setError(e.message === "Failed to fetch" ? "Could not reach the server." : e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (owner) load(owner); }, [owner]);

  // Once loaded: deals already reviewed this week start checked off; open the first one left
  const [loadedFor, setLoadedFor] = useState("");
  useEffect(() => {
    if (!data || loadedFor === data.owner.id) return;
    setLoadedFor(data.owner.id);
    const init = {};
    for (const d of data.deals) if (d.reviewedRecently) init[d.id] = "Reviewed this week";
    setDoneMap(init);
    setOpenId((data.deals.find(d => !init[d.id]) || {}).id || "");
  }, [data]);

  const scrollTo = id => setTimeout(() => document.getElementById(`deal-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  const openDeal = id => { setOpenId(prev => prev === id ? "" : id); scrollTo(id); };

  // After a save: check it off, keep the new values, and open the next deal still to do
  const markDone = (id, label, v) => {
    const next = { ...doneMap, [id]: label };
    setDoneMap(next);
    const list = data?.deals || [];
    setData(prev => prev && ({ ...prev, deals: prev.deals.map(d => d.id !== id ? d : {
      ...d, closeDate: v.closeDate, amount: v.amount === "" ? null : Number(v.amount), contractDays: v.contractDays === "" ? null : Number(v.contractDays),
      startupDate: v.startupDate, stageId: v.stageId, stage: d.stages.find(s => s.id === v.stageId)?.label || d.stage,
      probability: v.probability === "" ? null : Number(v.probability), customer: v.customerEmail ? { ...(d.customer || {}), email: v.customerEmail } : d.customer }) }));
    const at = list.findIndex(d => d.id === id);
    const after = [...list.slice(at + 1), ...list.slice(0, at)].find(d => !next[d.id]);
    setOpenId(after ? after.id : "");
    if (after) scrollTo(after.id);
  };

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
  const doneCount = deals.filter(d => doneMap[d.id]).length;
  const todoCount = deals.length - doneCount;
  const pct = deals.length ? Math.round(doneCount / deals.length * 100) : 0;

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
          {data ? <><strong>{data.owner.name}</strong> · {deals.length} open deal{deals.length === 1 ? "" : "s"} · {todoCount} to review</> : "Loading your deals from HubSpot…"}
          {!linkToken && data && <> · <a href="#" onClick={e => { e.preventDefault(); setOwner(""); setData(null); }}>Not you?</a></>}
        </div>
      )}

      {error && <div className="rv-msg bad">{error}</div>}
      {loading && <div className="rv-sub">Loading…</div>}

      {data && !deals.length && <div className="rv-card">No open deals in Recurring, Projects or WaterSolve are assigned to {data.owner.name} in HubSpot.</div>}
      {deals.length > 0 && (
        <div className="rv-progress">
          <div className="rv-progress-top">
            <span><strong>{doneCount} of {deals.length}</strong> reviewed</span>
            <span style={{ color: todoCount ? "#7a8a9a" : "#1D9E75", fontWeight: 600 }}>{todoCount ? `${todoCount} to go` : "All done ✓"}</span>
          </div>
          <div className="rv-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%` }} /></div>
          <div className="rv-steps">
            {deals.map((d, i) => (
              <button key={d.id} className={"rv-step" + (doneMap[d.id] ? " done" : d.id === openId ? " now" : "")} title={`${d.name}${doneMap[d.id] ? ` · ${doneMap[d.id]}` : ""}`} onClick={() => openDeal(d.id)}>
                {doneMap[d.id] ? "✓" : i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
      {deals.length > 0 && !todoCount && <div className="rv-msg good" style={{ marginBottom: 12 }}>🎉 All caught up. Every deal has been reviewed this week. Thank you!</div>}

      {deals.map((d, i) => (
        <DealCard key={d.id} deal={d} index={i} owner={owner} token={linkToken}
          open={openId === d.id} done={doneMap[d.id] || ""} onOpen={() => openDeal(d.id)} onDone={markDone} />
      ))}
    </div>
  );
}
