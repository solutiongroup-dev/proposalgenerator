// ── Team sign-in ──────────────────────────────────────────────────────────────
// Wraps the app: shows a sign-in screen until the person enters the team password.
// The server (api/_auth.js) enforces it on every API route; this screen is the
// friendly front door. If a session ever expires mid-task, any API call answers 401,
// the sign-in screen comes back, and the autosaved draft restores after sign-in.

import { useEffect, useState } from "react";
import SG_LOGO from "./sg_logo.png";

const BLUE = "#1a3a6b";

// Watch every API response for "signed out"
let onSignedOut = () => {};
if (typeof window !== "undefined" && !window.__sgFetchWrapped) {
  window.__sgFetchWrapped = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const resp = await realFetch(input, init);
    const url = typeof input === "string" ? input : input?.url || "";
    const path = url.startsWith("/") ? url : (url.startsWith(window.location.origin) ? url.slice(window.location.origin.length) : "");
    if (resp.status === 401 && path.startsWith("/api/") && !path.startsWith("/api/login")) onSignedOut();
    return resp;
  };
}

export async function signOut() {
  try { await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logout: true }) }); } catch (e) {}
  window.location.reload();
}

// After sign-in, return to a Custom Request file link if that's what brought them here
function goNext() {
  const next = new URLSearchParams(window.location.search).get("next") || "";
  if (next.startsWith("/api/design-file?")) { window.location.replace(next); return true; }
  return false;
}

export default function LoginGate({ children }) {
  const [state, setState] = useState("checking"); // checking | in | out
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onSignedOut = () => { setExpired(true); setState("out"); };
    fetch("/api/login", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (d.signedIn) { if (!goNext()) setState("in"); }
        else { setState("out"); if (!d.configured) setError("Login is not set up yet. Ask Chase to add APP_PASSWORD in Vercel."); }
      })
      .catch(() => {
        // Local Vite dev has no API routes; the server still enforces sign-in in production
        if (import.meta.env.DEV) setState("in"); else setState("out");
      });
    return () => { onSignedOut = () => {}; };
  }, []);

  const submit = async e => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.signedIn) { setPassword(""); setExpired(false); if (!goNext()) setState("in"); }
      else setError(d.error || `Sign-in failed (${r.status}).`);
    } catch (err) {
      setError("Could not reach the server. Check your connection and try again.");
    }
    setBusy(false);
  };

  if (state === "in") return children;
  if (state === "checking") return <div style={{ minHeight: "100vh", background: "#F2F5FA" }} />;

  return (
    <div style={{ minHeight: "100vh", background: "#F2F5FA", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form onSubmit={submit} style={{ background: "white", borderRadius: 14, boxShadow: "0 12px 40px rgba(26,58,107,0.12)", width: "100%", maxWidth: 400, overflow: "hidden" }}>
        <div style={{ background: BLUE, padding: "22px 28px", display: "flex", alignItems: "center", gap: 16, borderBottom: "4px solid #4FA8A0" }}>
          <div style={{ background: "white", borderRadius: 6, padding: "5px 10px" }}>
            <img src={SG_LOGO} alt="Solution Group" style={{ height: 32, display: "block" }} />
          </div>
          <div style={{ color: "white", fontWeight: 600, fontSize: 15 }}>Document Generator</div>
        </div>
        <div style={{ padding: "26px 28px 28px" }}>
          <h1 style={{ fontSize: 20, color: BLUE, marginBottom: 6 }}>{expired ? "Please sign in again" : "Sign in"}</h1>
          <p style={{ fontSize: 14, color: "#4a5568", lineHeight: 1.5, marginBottom: 18 }}>
            {expired ? "Your sign-in ran out. Your work is saved and will come back after you sign in." : "Enter the team password. You'll stay signed in on this browser for 30 days."}
          </p>
          <label htmlFor="sg-pw" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 6 }}>Team password</label>
          <input id="sg-pw" type="password" autoComplete="current-password" autoFocus value={password} onChange={e => setPassword(e.target.value)}
            style={{ width: "100%", padding: "11px 12px", fontSize: 15, border: "1px solid #cbd5e0", borderRadius: 8, fontFamily: "inherit", marginBottom: 14, boxSizing: "border-box" }} />
          {error && <div role="alert" style={{ color: "#b42318", background: "#fef3f2", border: "1px solid #fecdca", borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <button type="submit" disabled={busy || !password}
            style={{ width: "100%", background: "#2B579A", color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: busy || !password ? "default" : "pointer", opacity: busy || !password ? 0.6 : 1 }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p style={{ fontSize: 12, color: "#9aa5b4", marginTop: 16, textAlign: "center" }}>Don't have the password? Ask Chase.</p>
        </div>
      </form>
    </div>
  );
}
