import { useState } from "react";
import { store } from "./draft.js";

// ── Feedback ──────────────────────────────────────────────────────────────────
// A header button on every page. People say what they were doing, how it went and
// what would work better; the page they were on, the document type and any error on
// screen are attached automatically so a report like "it broke" can be acted on.
// Sent to /api/feedback (kept in the site logs) and emailed to Chase via EmailJS.

const AREAS = ["Generating a proposal or assessment", "Custom file creation", "Entering a sales lead", "Reviewing my deals", "Signing in", "Something else"];
const AREA_FOR_PAGE = { intake: 0, sections: 0, form: 0, generate: 0, custom: 1, design: 1, files: 1, lead: 2, review: 3 };
const RATINGS = [["😀", "Worked well"], ["😐", "OK, but could be better"], ["😞", "Didn't work"]];

const css = `
  .fb-overlay { position: fixed; inset: 0; background: rgba(18,26,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 400; padding: 16px; }
  .fb-modal { background: white; border-radius: 14px; width: 100%; max-width: 480px; max-height: 92vh; overflow: auto; box-shadow: 0 24px 80px rgba(0,0,0,0.25); font-family: 'DM Sans', sans-serif; }
  .fb-head { background: #2B579A; color: white; padding: 18px 22px; border-radius: 14px 14px 0 0; display: flex; align-items: center; }
  .fb-head h2 { font-size: 18px; font-weight: 600; flex: 1; margin: 0; }
  .fb-head button { background: none; border: none; color: white; font-size: 22px; cursor: pointer; }
  .fb-body { padding: 18px 22px 22px; display: flex; flex-direction: column; gap: 14px; }
  .fb-body label { font-size: 13px; font-weight: 600; color: #333; display: block; margin-bottom: 6px; }
  .fb-body select, .fb-body input, .fb-body textarea { width: 100%; box-sizing: border-box; font-size: 15px; font-family: inherit; border: 1px solid #cbd5e0; border-radius: 8px; padding: 9px 11px; }
  .fb-body textarea { min-height: 110px; resize: vertical; }
  .fb-rate { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .fb-rate button { border: 1.5px solid #e2e8f0; background: white; border-radius: 8px; padding: 8px 6px; cursor: pointer; font-family: inherit; font-size: 12px; color: #4a5568; }
  .fb-rate button span { display: block; font-size: 22px; margin-bottom: 2px; }
  .fb-rate button.on { border-color: #2B579A; background: #eef3fb; color: #1a2332; font-weight: 600; }
  .fb-send { background: #2B579A; color: white; border: none; border-radius: 8px; padding: 12px; font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer; }
  .fb-send:disabled { opacity: 0.55; cursor: default; }
  .fb-note { font-size: 12px; color: #7a8a9a; line-height: 1.5; }
  .fb-err { font-size: 13px; color: #b42318; background: #fef3f2; border: 1px solid #fecdca; border-radius: 8px; padding: 8px 11px; }
`;

export default function Feedback({ page, docType, context, email }) {
  const [open, setOpen] = useState(false);
  const [area, setArea] = useState("");
  const [rating, setRating] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const show = () => {
    setArea(AREAS[AREA_FOR_PAGE[page] ?? 5]);
    setName(store.get("sg_generated_by") || "");
    setRating(""); setMessage(""); setError(""); setSent(false); setOpen(true);
  };

  const send = async () => {
    if (!message.trim()) { setError("Tell us what happened or what would work better."); return; }
    setBusy(true); setError("");
    const errorOnScreen = (document.body.innerText.match(/(⚠[^\n]{3,300}|Parse failed[^\n]{0,300}|Generation failed[^\n]{0,300})/) || [""])[0];
    const report = {
      name: name.trim() || "Not given", area, rating: rating || "Not given", message: message.trim(),
      page: page || "", docType: docType || "", context: context || "", errorOnScreen,
      browser: navigator.userAgent, screen: `${window.innerWidth}x${window.innerHeight}`,
      at: new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    };
    try {
      // 1. Always kept in the site logs, even before the email template exists
      const r = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(report) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Could not send (${r.status}).`);
      // 2. Emailed to Chase once the EmailJS template is set
      if (email?.template) {
        await email.load();
        await window.emailjs.send(email.service, email.template, {
          from_name: report.name, area: report.area, rating: report.rating, message: report.message,
          page: report.page, doc_type: report.docType || "None", context: report.context || "None",
          error_on_screen: report.errorOnScreen || "None", browser: `${report.browser} (${report.screen})`, submitted_at: report.at,
        });
      }
      if (name.trim()) store.set("sg_generated_by", name.trim());
      setSent(true);
    } catch (e) {
      setError(e?.text || e?.message || "Could not send. Please try again.");
    }
    setBusy(false);
  };

  return (<>
    <style>{css}</style>
    <button className="help-btn" onClick={show} title="Tell us what would make this work better">💬 Feedback</button>
    {open && (
      <div className="fb-overlay" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
        <div className="fb-modal" role="dialog" aria-label="Send feedback">
          <div className="fb-head"><h2>{sent ? "Thank you" : "Help us make this better"}</h2><button onClick={() => setOpen(false)} aria-label="Close">×</button></div>
          {sent ? (
            <div className="fb-body">
              <p style={{ fontSize: 15, color: "#4a5568", lineHeight: 1.6, margin: 0 }}>Your feedback went to Chase. If something is broken, it will be looked at right away.</p>
              <button className="fb-send" onClick={() => setOpen(false)}>Close</button>
            </div>
          ) : (
            <div className="fb-body">
              <div><label htmlFor="fb-area">What were you doing?</label>
                <select id="fb-area" value={area} onChange={e => setArea(e.target.value)}>{AREAS.map(a => <option key={a}>{a}</option>)}</select></div>
              <div><label>How did it go?</label>
                <div className="fb-rate">{RATINGS.map(([icon, label]) => (
                  <button key={label} type="button" className={rating === label ? "on" : ""} onClick={() => setRating(label)}><span>{icon}</span>{label}</button>
                ))}</div></div>
              <div><label htmlFor="fb-msg">What happened, or what would work better?</label>
                <textarea id="fb-msg" value={message} onChange={e => setMessage(e.target.value)} autoFocus
                  placeholder="e.g. The pricing table split the costs wrong when I uploaded the tracker. Or: I'd like to pick which sections to include." /></div>
              <div><label htmlFor="fb-name">Your name</label>
                <input id="fb-name" value={name} onChange={e => setName(e.target.value)} placeholder="So Chase can follow up" /></div>
              {error && <div className="fb-err">{error}</div>}
              <button className="fb-send" disabled={busy} onClick={send}>{busy ? "Sending…" : "Send feedback"}</button>
              <div className="fb-note">The page you're on and any error showing are included automatically, so you don't need to describe them.</div>
            </div>
          )}
        </div>
      </div>
    )}
  </>);
}
