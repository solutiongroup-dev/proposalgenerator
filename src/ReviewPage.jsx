import React, { useEffect, useState } from "react";
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
  .rv-f input:disabled, .rv-f select:disabled, .rv-f textarea:disabled { background: #f4f6f9; color: #4a5568; border-color: #e2e8f0; }
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
  .rv-row-wrap { display: flex; align-items: center; gap: 10px; }
  .rv-row-wrap .rv-row { flex: 1; min-width: 0; width: auto; }
  .rv-quick { flex-shrink: 0; background: white; color: ${BLUE}; border: 1.5px solid ${BLUE}; border-radius: 8px; padding: 6px 12px; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; white-space: nowrap; }
  .rv-quick:hover { background: #eef3fb; }
  .rv-quick:disabled { opacity: 0.55; cursor: default; }
  .rv-age { font-size: 11px; color: #b54708; font-weight: 600; margin-top: 2px; }
  .rv-age.fresh { color: #7a8a9a; font-weight: 500; }
  .rv-tags { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
  .rv-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin: 4px 0 14px; border-bottom: 2px solid #e2e8f0; }
  .rv-tab { background: none; border: none; border-bottom: 3px solid transparent; margin-bottom: -2px; padding: 9px 14px; font-size: 15px; font-weight: 600; color: #7a8a9a; cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 7px; }
  .rv-tab.on { color: ${BLUE}; border-bottom-color: ${BLUE}; }
  .rv-count { font-size: 12px; font-weight: 700; border-radius: 10px; padding: 1px 8px; background: #edf2f7; color: #4a5568; }
  .rv-tab.on .rv-count { background: ${BLUE}; color: white; }
  .rv-todo-dot { font-size: 11px; font-weight: 600; color: #b54708; }
  .rv-scope { display: inline-flex; background: #e2e8f0; border-radius: 10px; padding: 4px; gap: 4px; margin: 6px 0 12px; }
  .rv-scope button { border: none; background: none; border-radius: 7px; padding: 8px 18px; font-size: 15px; font-weight: 600; color: #4a5568; cursor: pointer; font-family: inherit; }
  .rv-scope button.on { background: white; color: ${BLUE}; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
  .rv-filter { display: flex; align-items: center; gap: 8px; margin: -4px 0 12px; font-size: 13px; color: #4a5568; }
  .rv-filter select { font-size: 14px; font-family: inherit; border: 1px solid #cbd5e0; border-radius: 6px; padding: 6px 8px; background: white; }
  .rv-viewonly { font-size: 12px; color: #4a5568; background: #edf2f7; border-radius: 8px; padding: 8px 12px; margin-top: 12px; }
  .rv-board { background: white; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
  .rv-board-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; font-size: 13px; color: #7a8a9a; margin-bottom: 8px; }
  .rv-board-head strong { color: #1a2332; font-size: 15px; }
  .rv-stage { display: grid; grid-template-columns: minmax(90px, 150px) 1fr 34px 96px; align-items: center; gap: 10px; width: 100%; background: none; border: none; border-radius: 6px; padding: 5px 6px; cursor: pointer; font-family: inherit; font-size: 13px; color: #1a2332; text-align: left; }
  .rv-stage:hover:not(:disabled) { background: #f4f7fb; }
  .rv-stage.on { background: #eef3fb; box-shadow: inset 3px 0 0 ${BLUE}; }
  .rv-stage:disabled { color: #a0aec0; cursor: default; }
  .rv-stage-bar { height: 14px; background: #edf2f7; border-radius: 4px; overflow: hidden; }
  .rv-stage-bar div { height: 100%; background: linear-gradient(90deg, ${BLUE}, #4FA8A0); border-radius: 4px; }
  .rv-stage.won .rv-stage-bar div { background: #1D9E75; }
  .rv-stage.lost .rv-stage-bar div { background: #a0aec0; }
  .rv-stage-n { font-weight: 700; text-align: right; }
  .rv-tag.won { color: #0a6554; background: #e1f5ee; border: 1px solid #1D9E75; }
  .rv-tag.lost { color: #4a5568; background: #edf2f7; border: 1px solid #cbd5e0; }
  .rv-stage-amt { text-align: right; color: #4a5568; font-variant-numeric: tabular-nums; }
  .rv-group { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; font-weight: 600; color: ${BLUE}; text-transform: uppercase; letter-spacing: 0.5px; margin: 18px 2px 8px; }
  .rv-group span { text-transform: none; letter-spacing: 0; font-weight: 500; color: #7a8a9a; }
  .rv-upd { font-size: 11px; color: #4a5568; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  @media (max-width: 520px) { .rv-stage { grid-template-columns: 92px 1fr 26px 62px; gap: 6px; font-size: 12px; } }
  .rv-login { display: grid; gap: 10px; max-width: 420px; }
  .rv-login input { font-size: 16px; padding: 10px 12px; border: 1px solid #cbd5e0; border-radius: 8px; font-family: inherit; width: 100%; box-sizing: border-box; }
  @media (max-width: 520px) { .rv-tags .rv-tag.warn { display: none; } .rv-quick { padding: 6px 9px; } }
  @media (max-width: 640px) { .rv-grid { grid-template-columns: 1fr 1fr; } .rv-grid .wide { grid-column: 1 / -1; } .rv-card { padding: 16px; } }
  @media (max-width: 400px) { .rv-grid { grid-template-columns: 1fr; } }
`;

const FIELDS = ["customerName", "customerEmail", "closeDate", "amount", "contractDays", "startupDate", "stageId", "probability"];
const valuesOf = d => ({ customerName: d.customer?.name || "", customerEmail: d.customer?.email || "", closeDate: d.closeDate || "", amount: d.amount ?? "",
  contractDays: d.contractDays ?? "", startupDate: d.startupDate || "", stageId: d.stageId || "", probability: d.probability ?? "" });
// How long since this deal was last reviewed, shown on every row
const ageText = d => d.weeksSinceReview == null ? "Not reviewed yet"
  : d.weeksSinceReview < 1 ? "Reviewed last week" : `${d.weeksSinceReview} week${d.weeksSinceReview === 1 ? "" : "s"} since last update`;
const TAB_ORDER = ["Projects", "Recurring", "WaterSolve", "BD"];
const usd = n => "$" + Math.round(n).toLocaleString("en-US");
const usdShort = n => n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : usd(n);
// "Last update Nov 12, 2026 · Deal review by Brian Koepsel"
const updateText = d => d.lastUpdate
  ? `Last update ${new Date(d.lastUpdate.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${d.lastUpdate.kind}${d.lastUpdate.by ? ` by ${d.lastUpdate.by}` : ""}`
  : "No updates logged yet";
// The open stages of a pipeline, in order, with the deals in each
function stageGroups(list) {
  const order = [];
  for (const d of list) for (const st of d.stages || []) if (!order.some(o => o.id === st.id)) order.push(st);
  const groups = order.map(st => ({ ...st, deals: list.filter(d => d.stageId === st.id) }));
  const other = list.filter(d => !order.some(o => o.id === d.stageId));
  if (other.length) groups.push({ id: "_other", label: "Other", deals: other });
  return groups.map(g => ({ ...g, amount: g.deals.reduce((a, d) => a + (Number(d.amount) || 0), 0),
    closed: g.deals[0]?.closed || (/closed\s*won/i.test(g.label) ? "won" : /closed\s*lost/i.test(g.label) ? "lost" : "") }));
}
const fmtDate = ts => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function DealCard({ deal, index, owner, token, open, done, onOpen, onDone, onSignedOut, showOwner }) {
  const canEdit = deal.canEdit !== false;
  const original = valuesOf(deal);
  const [v, setV] = useState(original);
  const [context, setContext] = useState("");
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
        body: JSON.stringify({ owner, t: token, dealId: deal.id, noUpdates, context, changes, original }) });
      const d = await r.json().catch(() => ({}));
      if (d.needLogin) { onSignedOut(d.error); return; }
      if (!r.ok) throw new Error(d.error || `Could not save (${r.status}).`);
      const label = noUpdates && !changed.length ? "No updates" : (d.changes?.length ? `${d.changes.length} update${d.changes.length === 1 ? "" : "s"}` : "Context added");
      setContext(""); setSavedNote(d.contactNote || "");
      onDone(deal.id, label, v);
    } catch (e) {
      setMsg({ bad: true, text: e.message === "Failed to fetch" ? "Could not reach the server. Check your connection and try again." : e.message });
    }
    setBusy(false);
  };

  const summary = `${showOwner ? `${deal.ownerName} · ` : ""}${deal.stage}${deal.amount != null ? ` · $${Math.round(deal.amount).toLocaleString("en-US")}` : ""}${deal.closeDate ? ` · closes ${deal.closeDate}` : ""}`;
  const row = (
    <div className="rv-row-wrap">
      <button className="rv-row" onClick={onOpen} aria-expanded={open}>
        <span className={"rv-num" + (done && !deal.closed ? " done" : open ? " now" : "")}>{done && !deal.closed ? "✓" : index + 1}</span>
        <span className="rv-rowtext">
          <div className="rv-title">{deal.name}</div>
          <div className="rv-sub">{summary}</div>
          {showOwner ? <div className="rv-upd">{updateText(deal)}</div>
            : !done && <div className={"rv-age" + (deal.weeksSinceReview != null && deal.weeksSinceReview < 2 ? " fresh" : "")}>{ageText(deal)}</div>}
        </span>
        <span className="rv-tags">
          {deal.closed ? <span className={"rv-tag " + deal.closed}>{deal.closed === "won" ? "Closed Won" : "Closed Lost"}</span>
            : done ? <span className="rv-tag ok">{done}</span> : (deal.reasons.length > 0 && <span className="rv-tag warn">{deal.reasons.length} to check</span>)}
        </span>
      </button>
      {/* One tap to confirm nothing changed, without opening the deal */}
      {!done && !open && canEdit && !deal.closed && <button className="rv-quick" disabled={busy} onClick={() => save(true)}>{busy ? "Saving…" : "No updates"}</button>}
    </div>
  );
  if (!open) return (
    <div className="rv-card closed" id={`deal-${deal.id}`}>
      {row}
      {msg && <div className={"rv-msg " + (msg.bad ? "bad" : "good")}>{msg.text}</div>}
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
        {!canEdit && <div className="rv-viewonly">View only. This is {deal.ownerName}'s deal, so only they (or the BD group) can update it.</div>}
        <fieldset disabled={!canEdit} style={{ border: "none", padding: 0, margin: 0, minWidth: 0 }}>
        <div className="rv-grid">
          <div className="rv-f"><label>Customer name</label>
            <input className={cls("customerName")} value={v.customerName} onChange={e => set("customerName", e.target.value)} placeholder="First Last" autoComplete="off" /></div>
          <div className="rv-f wide"><label>Customer email</label>
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
        </fieldset>
        {msg && <div className={"rv-msg " + (msg.bad ? "bad" : "good")}>{msg.text}</div>}
        {canEdit && <div className="rv-actions">
          <button className="rv-btn primary" disabled={busy || (!changed.length && !context.trim())} onClick={() => save(false)}>{busy ? "Saving…" : "Save changes"}</button>
          <button className="rv-btn ghost" disabled={busy || changed.length > 0} onClick={() => save(true)} title={changed.length ? "You've made changes. Save them instead." : ""}>No updates</button>
          {changed.length > 0 && <span style={{ fontSize: 12, color: "#7a8a9a" }}>{changed.length} field{changed.length === 1 ? "" : "s"} changed</span>}
        </div>}
      </>
    </div>
  );
}

export default function ReviewPage({ onBack, linkOwner = "", linkToken = "" }) {
  const [data, setData] = useState(null);          // "My deals"
  const [allData, setAllData] = useState(null);    // "All Deals", loaded the first time that tab is opened
  const [scope, setScope] = useState("mine");
  const [needLogin, setNeedLogin] = useState(false);
  const [email, setEmail] = useState(store.get("sg_review_email") || "");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [doneMap, setDoneMap] = useState({});   // deal id -> "No updates" / "2 updates"
  const [openId, setOpenId] = useState("");
  const [tab, setTab] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  // The personal link from the weekly email; dropped once they sign in with their password
  const [link, setLink] = useState(linkOwner && linkToken ? { owner: linkOwner, token: linkToken } : null);

  // Deals reviewed since Monday start checked off
  const checkOff = list => setDoneMap(prev => {
    const next = { ...prev };
    for (const d of list) if (d.reviewedRecently && !next[d.id]) next[d.id] = "Reviewed this week";
    return next;
  });

  const load = (which = "mine") => {
    setLoading(true); setError("");
    const params = new URLSearchParams();
    if (which === "all") params.set("scope", "all");
    if (link) { params.set("owner", link.owner); params.set("t", link.token); }
    const qs = params.toString() ? `?${params}` : "";
    fetch(`/api/review${qs}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (d.needLogin) { setNeedLogin(true); setData(null); setAllData(null); if (link) setError(d.error); return; }
        if (!ok) throw new Error(d.error || "Could not load the deals.");
        setNeedLogin(false);
        checkOff(d.deals);
        if (which === "all") setAllData(d); else setData(d);
      })
      .catch(e => setError(e.message === "Failed to fetch" ? "Could not reach the server." : e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => load("mine"), [link]);

  const signIn = async e => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSigningIn(true); setError("");
    try {
      const r = await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: { email: email.trim(), password: password.trim() } }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not sign in.");
      store.set("sg_review_email", email.trim());
      setPassword(""); setNeedLogin(false); setScope("mine"); setStarted(false);
      if (link) { window.history.replaceState(null, "", window.location.pathname + "?review"); setLink(null); }
      else load("mine");
    } catch (err) { setError(err.message === "Failed to fetch" ? "Could not reach the server." : err.message); }
    setSigningIn(false);
  };
  const signOut = async e => {
    e.preventDefault();
    try { await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logout: true }) }); } catch (err) {}
    setData(null); setAllData(null); setDoneMap({}); setTab(""); setScope("mine"); setStarted(false); setNeedLogin(true);
  };
  const signedOut = msg => { setData(null); setAllData(null); setNeedLogin(true); setError(msg || "Please sign in again."); };

  const switchScope = sc => {
    if (sc === scope) return;
    setScope(sc); setOpenId(""); setOwnerFilter(""); setStageFilter("");
    if (sc === "all" && !allData) load("all");
  };

  const view = scope === "all" ? allData : data;
  const allDeals = view?.deals || [];
  const owners = [...new Set(allDeals.map(d => d.ownerName))].sort();
  const deals = scope === "all" && ownerFilter ? allDeals.filter(d => d.ownerName === ownerFilter) : allDeals;
  // Pipeline tabs: Projects, Recurring, WaterSolve (if there are any) and BD (BD group only)
  const tabs = TAB_ORDER.filter(t => t === "Projects" || t === "Recurring" || (t === "BD" ? data?.bd : allDeals.some(d => d.tab === t)))
    .map(t => { const list = deals.filter(d => d.tab === t); return { name: t, list, todo: list.filter(d => !d.closed && !doneMap[d.id]).length }; });
  const current = tabs.find(t => t.name === tab) || tabs[0];
  // All Deals: grouped by stage, in pipeline order; clicking a stage in the overview shows just that stage
  const groups = scope === "all" ? stageGroups(current?.list || []) : [];
  const shown = scope === "all"
    ? groups.filter(g => !stageFilter || g.id === stageFilter).flatMap(g => g.deals)
    : current?.list || [];

  // First load: start on the first tab with work left
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!data || started) return;
    setStarted(true);
    const first = TAB_ORDER.find(t => data.deals.some(d => d.tab === t && !d.reviewedRecently)) || "Projects";
    setTab(first); setOpenId("");
  }, [data]);

  const scrollTo = id => setTimeout(() => document.getElementById(`deal-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  const openDeal = id => { setOpenId(prev => prev === id ? "" : id); scrollTo(id); };

  // After a save: check it off, keep the new values (in both lists), and open the next deal still to do
  const markDone = (id, label, v) => {
    const next = { ...doneMap, [id]: label };
    setDoneMap(next);
    const update = prev => prev && ({ ...prev, deals: prev.deals.map(d => d.id !== id ? d : {
      ...d, closeDate: v.closeDate, amount: v.amount === "" ? null : Number(v.amount), contractDays: v.contractDays === "" ? null : Number(v.contractDays),
      startupDate: v.startupDate, stageId: v.stageId, stage: d.stages.find(s => s.id === v.stageId)?.label || d.stage, weeksSinceReview: 0, reviewedRecently: true,
      probability: v.probability === "" ? null : Number(v.probability),
      customer: v.customerEmail || v.customerName ? { ...(d.customer || {}), email: v.customerEmail, name: v.customerName } : d.customer }) });
    setData(update); setAllData(update);
    if (openId !== id) return;   // a one-tap "No updates" on a closed row doesn't move anything
    const editable = shown.filter(d => d.canEdit !== false);
    const at = editable.findIndex(d => d.id === id);
    const after = [...editable.slice(at + 1), ...editable.slice(0, at)].find(d => !next[d.id]);
    setOpenId(after ? after.id : "");
    if (after) scrollTo(after.id);
  };

  const reviewable = shown.filter(d => !d.closed);   // closed deals don't need a weekly review
  const doneCount = reviewable.filter(d => doneMap[d.id]).length;
  const todoCount = reviewable.length - doneCount;
  const pct = reviewable.length ? Math.round(doneCount / reviewable.length * 100) : 0;
  const myDeals = data?.deals || [];

  return (
    <div className="rv-page">
      <style>{css}</style>
      {onBack && <button className="form-back" onClick={onBack}>← Back to the portal</button>}
      <div className="form-title">Weekly deal review</div>

      {needLogin ? (
        <>
          <div className="form-subtitle">Sign in with your work email and your personal password.</div>
          <form onSubmit={signIn} className="rv-card rv-login">
            <input type="email" autoComplete="username" autoCapitalize="none" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@solutionmgt.com" autoFocus={!email} />
            <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Personal password" autoFocus={!!email} />
            <button className="rv-btn primary" type="submit" disabled={signingIn}>{signingIn ? "Signing in…" : "Show my deals"}</button>
            <div className="rv-sub">Don't have your password? Ask Chase.</div>
          </form>
        </>
      ) : (
        <div className="form-subtitle">
          {data ? <><strong>{data.owner.name}</strong> · {myDeals.length} open deal{myDeals.length === 1 ? "" : "s"} of your own · {myDeals.filter(d => !doneMap[d.id]).length} to review this week</> : "Loading your deals from HubSpot…"}
          {data && !data.viaLink && <> · <a href="#" onClick={signOut}>Sign out</a></>}
        </div>
      )}

      {error && <div className="rv-msg bad">{error}</div>}

      {data && (
        <div className="rv-scope" role="tablist">
          <button role="tab" aria-selected={scope === "mine"} className={scope === "mine" ? "on" : ""} onClick={() => switchScope("mine")}>My deals</button>
          <button role="tab" aria-selected={scope === "all"} className={scope === "all" ? "on" : ""} onClick={() => switchScope("all")}>All Deals</button>
        </div>
      )}
      {loading && !view && !needLogin && <div className="rv-sub">Loading {scope === "all" ? "every open deal" : "your deals"} from HubSpot…</div>}

      {view && (
        <div className="rv-tabs" role="tablist">
          {tabs.map(t => (
            <button key={t.name} role="tab" aria-selected={current?.name === t.name} className={"rv-tab" + (current?.name === t.name ? " on" : "")}
              onClick={() => { setTab(t.name); setOpenId(""); setStageFilter(""); }}>
              {t.name === "BD" ? "BD (M&A)" : t.name} <span className="rv-count">{t.list.length}</span>
              {scope === "mine" && t.todo > 0 && <span className="rv-todo-dot">{t.todo} to do</span>}
            </button>
          ))}
        </div>
      )}
      {scope === "all" && allData && (
        <div className="rv-filter">
          <label htmlFor="rv-owner">Deal owner</label>
          <select id="rv-owner" value={ownerFilter} onChange={e => { setOwnerFilter(e.target.value); setOpenId(""); setStageFilter(""); }}>
            <option value="">Everyone</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {!data?.bd && <span style={{ color: "#7a8a9a" }}>You can update your own deals; others are view only.</span>}
        </div>
      )}

      {scope === "all" && allData && current?.list.length > 0 && (() => {
        const max = Math.max(1, ...groups.map(g => g.deals.length));
        const open = current.list.filter(d => !d.closed);
        const total = open.reduce((a, d) => a + (Number(d.amount) || 0), 0);
        const won = current.list.filter(d => d.closed === "won").length, lost = current.list.filter(d => d.closed === "lost").length;
        return (
          <div className="rv-board">
            <div className="rv-board-head">
              <span><strong>{current.name === "BD" ? "BD (M&A)" : current.name}</strong> · {open.length} open{total ? ` (${usd(total)})` : ""} · {won} won · {lost} lost</span>
              {stageFilter ? <a href="#" onClick={e => { e.preventDefault(); setStageFilter(""); }}>Show all stages</a> : <span>Click a stage to filter</span>}
            </div>
            {groups.map(g => (
              <button key={g.id} className={"rv-stage" + (stageFilter === g.id ? " on" : "") + (g.closed ? " " + g.closed : "")} disabled={!g.deals.length}
                onClick={() => { setStageFilter(stageFilter === g.id ? "" : g.id); setOpenId(""); }}>
                <span>{g.label}</span>
                <span className="rv-stage-bar"><div style={{ width: `${g.deals.length / max * 100}%` }} /></span>
                <span className="rv-stage-n">{g.deals.length}</span>
                <span className="rv-stage-amt">{g.amount ? usdShort(g.amount) : "–"}</span>
              </button>
            ))}
          </div>
        );
      })()}

      {view && !shown.length && <div className="rv-card">{scope === "all" ? `No open ${current?.name === "BD" ? "BD" : current?.name || ""} deals${ownerFilter ? ` for ${ownerFilter}` : ""}.` : current?.name === "BD" ? "You don't own any open BD deals. See All Deals for the whole pipeline." : `No open ${current?.name || ""} deals are assigned to ${data.owner.name} in HubSpot.`}</div>}
      {reviewable.length > 0 && (
        <div className="rv-progress">
          <div className="rv-progress-top">
            <span><strong>{doneCount} of {reviewable.length}</strong> {scope === "all" ? "open deals " : ""}reviewed this week</span>
            <span style={{ color: todoCount ? "#7a8a9a" : "#1D9E75", fontWeight: 600 }}>{todoCount ? `${todoCount} to go` : "All done ✓"}</span>
          </div>
          <div className="rv-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%` }} /></div>
          {reviewable.length <= 60 && <div className="rv-steps">
            {reviewable.map((d, i) => (
              <button key={d.id} className={"rv-step" + (doneMap[d.id] ? " done" : d.id === openId ? " now" : "")} title={`${d.name}${doneMap[d.id] ? ` · ${doneMap[d.id]}` : ""}`} onClick={() => openDeal(d.id)}>
                {doneMap[d.id] ? "✓" : i + 1}
              </button>
            ))}
          </div>}
        </div>
      )}
      {scope === "mine" && shown.length > 0 && !todoCount && <div className="rv-msg good" style={{ marginBottom: 12 }}>🎉 All caught up on {current.name === "BD" ? "BD" : current.name} this week. Thank you!</div>}

      {shown.map((d, i) => (<React.Fragment key={d.id}>
        {scope === "all" && (i === 0 || shown[i - 1].stageId !== d.stageId) && (() => {
          const g = groups.find(x => x.deals.includes(d));
          return g ? <div className="rv-group">{g.label} <span>{g.deals.length} deal{g.deals.length === 1 ? "" : "s"}{g.amount ? ` · ${usd(g.amount)}` : ""}</span></div> : null;
        })()}
        <DealCard key={d.id} deal={d} index={i} owner={link?.owner || ""} token={link?.token || ""} onSignedOut={signedOut} showOwner={scope === "all"}
          open={openId === d.id} done={doneMap[d.id] || ""} onOpen={() => openDeal(d.id)} onDone={markDone} />
      </React.Fragment>))}
    </div>
  );
}
