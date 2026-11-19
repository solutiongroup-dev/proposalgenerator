import React, { useState, useRef, useEffect } from "react";
import { loadDraft, saveDraft, clearDraft, savedLabel, store } from "./draft.js";

// ── Design Request ───────────────────────────────────────────────────────────
// For documents that need photos, custom layout or design work and don't fit the
// proposal templates. Files go to Vercel Blob (any size, straight from the
// browser), and Chase gets an email with a complete brief that can be pasted into
// Claude / Claude Design to produce the finished document without follow-up.

const BLUE = "#2B579A";

const DOC_KINDS = ["Slide deck", "One-pager / flyer", "Brochure", "Proposal or report (designed)", "Case study", "Other"];
const FORMAT_FOR = { "Slide deck": "PowerPoint", "One-pager / flyer": "PDF", "Brochure": "PDF", "Proposal or report (designed)": "Word", "Case study": "PDF", "Other": "Not sure" };
const FORMATS = ["PowerPoint", "PDF", "Word", "Not sure"];
const BRANDS = ["Solution Group", "WaterSolve", "Solution Group + WaterSolve", "Client's brand"];
const FILE_ROLES = ["Source content (pull text/data from it)", "Photo to use", "Logo", "Example of the look we want", "Other"];
const DEFAULTS = { brand: "Solution Group", format: "", kind: "" };

const MAX_FILE_MB = 500;

const sanitize = name => name.replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "_").slice(-120) || "file";
// The store is private: links go through /api/design-file, which signs a fresh URL per click
const fileLink = pathname => `${window.location.origin}/api/design-file?p=${encodeURIComponent(pathname)}`;
const mb = bytes => bytes < 1048576 ? Math.max(1, Math.round(bytes / 1024)) + " KB" : (bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0) + " MB";

function newRequestId() {
  const d = new Date();
  const ymd = d.getFullYear().toString().slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  return `DR-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// The brief Chase pastes into Claude / Claude Design. Written so Claude can
// produce the finished document with no follow-up questions.
export function buildBrief(id, f, files) {
  const t = v => String(v || "").trim();
  const deck = /deck|slide/i.test(f.kind) || f.format === "PowerPoint";
  const fileList = files.length
    ? files.map((x, i) => `${i + 1}. ${x.name} (${mb(x.size)}): ${x.role}${x.note ? `. ${x.note}` : ""}\n   ${x.url || "(not uploaded)"}`).join("\n")
    : "No files attached.";
  return `# Custom Request ${id}: ${t(f.title)}

## Build this
Make a finished ${t(f.kind).toLowerCase() || "document"}${f.length ? ` (${t(f.length)})` : ""}, delivered as ${f.format && f.format !== "Not sure" ? f.format : "the best format for the purpose"}.
- Audience: ${t(f.audience)}
- Goal (what they should think or do after): ${t(f.purpose)}
- Brand: ${f.brand || "Solution Group"}. Use the brand's logos and colors.${t(f.style) ? `\n- Look and feel: ${t(f.style)}` : ""}
${deck ? "- Build it as a Slides deck in Claude: one idea per slide, short headlines, photos and visuals over paragraphs. Export as PowerPoint.\n" : "- Build it in Claude's Design tool as a designed, print-ready layout.\n"}- Use only the facts in this brief and the attached files. Never invent prices, names, dates, results or certifications; where something is missing, put [PLACEHOLDER: what is needed].
- Use the attached photos and logos where the file notes say.

## Outline (in order)
${t(f.outline)}
${t(f.mustInclude) ? `\n## Must include, word for word, or avoid\n${t(f.mustInclude)}\n` : ""}
## Files
${fileList}

## Request
- From: ${t(f.requesterName)} <${t(f.requesterEmail)}>
- Needed by: ${t(f.dueDate)}
- Send the finished file to: ${t(f.requesterEmail)}
`;
}

function Field({ label, required, hint, children, full }) {
  return (
    <div className="field" style={full ? { gridColumn: "1 / -1" } : {}}>
      <label>{label}{required ? <span className="req"> *</span> : <span className="opt"> optional</span>}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "#9aa5b4", marginTop: 3, fontStyle: "italic" }}>{hint}</div>}
    </div>
  );
}

export default function DesignRequest({ onBack, defaultName, email, seed, onSeedUsed }) {
  const [f, setF] = useState(() => ({ requesterName: defaultName || "", ...DEFAULTS }));
  const [files, setFiles] = useState([]);          // { file, role, note, progress, url }
  const [errors, setErrors] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(null);           // { id, brief, briefUrl }
  const inputRef = useRef();

  // Autosave the request (fields and files) so a failed send or a reload loses nothing
  const [draftReady, setDraftReady] = useState(false);
  const [restoredAt, setRestoredAt] = useState(null);
  useEffect(() => {
    let cancelled = false;
    loadDraft("customRequest").then(d => {
      if (cancelled) return;
      if (d && (Object.values(d.f || {}).some(v => String(v || "").trim() && !["Solution Group", defaultName].includes(v)) || d.files?.length)) {
        // Older drafts kept the content in other fields: fold them into the outline
        const old = d.f || {};
        const outline = old.outline || [old.content, old.messages].filter(Boolean).join("\n\n");
        setF(p => ({ ...p, ...old, outline }));
        setFiles((d.files || []).map(x => ({ ...x, progress: 0, url: "" })));
        setRestoredAt(d.savedAt);
      } else if (seed && (seed.text || seed.files?.length)) {
        // Handed over from Custom Document: start the brief from what they already wrote
        const deck = /\b(deck|slides?|presentation|powerpoint|pitch)\b/i.test(seed.text || "");
        setF(p => ({ ...p, outline: seed.text || "", ...(deck ? { kind: "Slide deck", format: "PowerPoint" } : {}) }));
        if (seed.files?.length) addFiles(seed.files);
      }
      if (seed && onSeedUsed) onSeedUsed();
      setDraftReady(true);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!draftReady || done) return;
    const t = setTimeout(() => saveDraft("customRequest", { f, files: files.map(({ file, role, note, tooBig }) => ({ file, role, note, tooBig })) }), 400);
    return () => clearTimeout(t);
  }, [draftReady, done, f, files]);
  const clearForm = () => {
    if (!window.confirm("Clear this request and start over?")) return;
    clearDraft("customRequest");
    setF({ requesterName: defaultName || "", ...DEFAULTS });
    setFiles([]); setErrors({}); setErr(""); setRestoredAt(null);
  };

  const set = (k, v) => {
    // Picking a type suggests its usual format, unless a format was already chosen
    setF(p => ({ ...p, [k]: v, ...(k === "kind" && !p.formatTouched ? { format: FORMAT_FOR[v] || "" } : {}), ...(k === "format" ? { formatTouched: true } : {}) }));
    setErrors(e => ({ ...e, [k]: false })); setErr("");
  };
  const inp = (k, props = {}) => <input className={errors[k] ? "err" : ""} value={f[k] || ""} onChange={e => set(k, e.target.value)} {...props} />;
  const area = (k, placeholder, rows = 4) => <textarea className={errors[k] ? "err" : ""} rows={rows} placeholder={placeholder} value={f[k] || ""} onChange={e => set(k, e.target.value)} />;
  const sel = (k, opts, blank) => (
    <select className={errors[k] ? "err" : ""} value={f[k] || ""} onChange={e => set(k, e.target.value)}>
      {blank && <option value="">{blank}</option>}
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  const addFiles = list => {
    const added = Array.from(list).map(file => ({
      file, note: "", progress: 0, url: "",
      role: file.type.startsWith("image/") ? FILE_ROLES[0] : FILE_ROLES[1],
      tooBig: file.size > MAX_FILE_MB * 1048576,
    }));
    setFiles(p => [...p, ...added]);
    setErr("");
  };
  const setFile = (i, patch) => setFiles(p => p.map((x, j) => j === i ? { ...x, ...patch } : x));

  const REQUIRED = ["requesterName", "requesterEmail", "dueDate", "kind", "title", "audience", "purpose", "outline"];

  const submit = async () => {
    const errs = {};
    REQUIRED.forEach(k => { if (!String(f[k] || "").trim()) errs[k] = true; });
    if (f.requesterEmail && !/^\S+@\S+\.\S+$/.test(f.requesterEmail)) errs.requesterEmail = true;
    setErrors(errs);
    if (Object.keys(errs).length) { setErr("Fill in the highlighted fields."); return; }
    if (files.some(x => x.tooBig)) { setErr(`Remove files over ${MAX_FILE_MB} MB.`); return; }
    if (!email.template) { setErr("Custom requests aren't switched on yet: the email template ID is missing. Let the portal admin know."); return; }

    setBusy(true); setErr("");
    const id = newRequestId();
    try {
      const { uploadPresigned: upload } = await import("@vercel/blob/client");  // loaded only when a request is sent
      // 1. Files, straight from the browser to Vercel Blob
      const uploaded = [];
      for (let i = 0; i < files.length; i++) {
        const x = files[i];
        setStatus(`Uploading ${i + 1} of ${files.length}: ${x.file.name}`);
        const blob = await upload(`design-requests/${id}/${sanitize(x.file.name)}`, x.file, {
          access: "private",
          handleUploadUrl: "/api/design-upload",
          multipart: x.file.size > 20 * 1048576,
          contentType: x.file.type || "application/octet-stream",
          onUploadProgress: ({ percentage }) => setFile(i, { progress: Math.round(percentage) }),
        });
        const url = fileLink(blob.pathname);
        setFile(i, { progress: 100, url });
        uploaded.push({ name: x.file.name, size: x.file.size, role: x.role, note: x.note, url });
      }

      // 2. The brief itself, saved next to the files
      setStatus("Saving the brief");
      let brief = buildBrief(id, f, uploaded);
      const briefFile = new File([brief], `${id}-brief.md`, { type: "text/markdown" });
      const briefBlob = await upload(`design-requests/${id}/${id}-brief.md`, briefFile, {
        access: "private", handleUploadUrl: "/api/design-upload", contentType: "text/markdown",
      });
      const briefUrl = fileLink(briefBlob.pathname);

      // 3. Email Chase
      setStatus("Sending your request");
      await email.load();
      const MAX = 30000; // EmailJS caps the whole message at 50 KB
      await window.emailjs.send(email.service, email.template, {
        request_id: id,
        doc_title: f.title,
        doc_kind: f.kind,
        client_name: f.audience || "Not specified",
        requester_name: f.requesterName,
        requester_email: f.requesterEmail,
        due_date: f.dueDate,
        priority: "Normal",
        file_count: String(uploaded.length),
        file_list: uploaded.length ? uploaded.map(u => `${u.name} (${mb(u.size)}): ${u.url}`).join("\n") : "None",
        brief_url: briefUrl,
        brief: brief.length > MAX ? brief.slice(0, MAX) + `\n\n[Brief continues: open the full brief at ${briefUrl}]` : brief,
      });

      store.set("sg_generated_by", f.requesterName);
      clearDraft("customRequest");   // sent: nothing left to recover
      setDone({ id, brief, briefUrl });
    } catch (e) {
      const msg = e?.text || e?.message || String(e);
      setErr(/BLOB_READ_WRITE_TOKEN|storage not set up/i.test(msg)
        ? "File storage isn't set up yet. Let the portal admin know."
        : `Request not sent: ${msg}`);
    } finally {
      setBusy(false); setStatus("");
    }
  };

  if (done) {
    return (
      <div className="custom-page">
        <div className="custom-title">Request sent</div>
        <div className="custom-sub">
          Custom request <strong>{done.id}</strong> was sent with your files. The finished document will be
          emailed to {f.requesterEmail}.
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <button className="btn-revise" onClick={() => navigator.clipboard?.writeText(done.brief)}>Copy brief</button>
          <a className="btn-revise" style={{ textDecoration: "none" }} href={done.briefUrl} target="_blank" rel="noreferrer">Open brief</a>
          <button className="btn-revise" style={{ background: BLUE }} onClick={onBack}>Back to start</button>
        </div>
        <pre style={{ whiteSpace: "pre-wrap", background: "#f8f9fc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, fontSize: 12, lineHeight: 1.6, maxHeight: 420, overflow: "auto" }}>{done.brief}</pre>
      </div>
    );
  }

  return (
    <div className="custom-page">
      <button className="form-back" onClick={onBack}>← Back</button>
      <div className="custom-title">Custom Request</div>
      {restoredAt && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", background: "#e1f5ee", color: "#0a6554", fontSize: 13, padding: "8px 12px", borderRadius: 6, margin: "6px 0 14px" }}>
          <span style={{ flex: 1 }}>Restored your request from {savedLabel(restoredAt)}, including attached files.</span>
          <button onClick={clearForm} style={{ background: "none", border: "none", color: "#7a8a9a", cursor: "pointer", fontSize: 13, textDecoration: "underline", fontFamily: "inherit" }}>Start over</button>
        </div>
      )}
      <div className="custom-sub">
        For decks, brochures and other designed pieces with photos or custom layout. It is built with Claude
        from this brief, so give the outline and the files it should use.
      </div>

      <div className="section">
        <div className="section-title">You</div>
        <div className="field-grid">
          <Field label="Your name" required>{inp("requesterName", { placeholder: "Daniel Wilcox" })}</Field>
          <Field label="Your email" required>{inp("requesterEmail", { type: "email", placeholder: "name@solutionmgt.com" })}</Field>
          <Field label="Needed by" required>{inp("dueDate", { type: "date" })}</Field>
        </div>
      </div>

      <div className="section">
        <div className="section-title">What to make</div>
        <div className="field-grid">
          <Field label="Type" required>{sel("kind", DOC_KINDS, "Choose one")}</Field>
          <Field label="Format">{sel("format", FORMATS, "Choose one")}</Field>
          <Field label="Length">{inp("length", { placeholder: f.kind === "Slide deck" ? "4 slides" : "2 pages" })}</Field>
          <Field label="Brand">{sel("brand", BRANDS)}</Field>
          <Field label="Working title" required full>{inp("title", { placeholder: "WaterSolve + Solution Group: rep partnership overview" })}</Field>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Who it's for</div>
        <div className="field-grid">
          <Field label="Audience" required full>{inp("audience", { placeholder: "Manufacturer rep firms that sell equipment to water and wastewater plants" })}</Field>
          <Field label="Goal: what should they think or do after seeing it?" required full>
            {area("purpose", "Want to talk with us about adding WaterSolve and Solution Group to their line card", 2)}
          </Field>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Content</div>
        <div className="field-grid">
          <Field label="Outline: each slide or section in order, and what goes in it" required full
            hint="Point to the files for details, e.g. “projects from the attached Word doc”.">
            {area("outline", "1. Who we are: WaterSolve + Solution Group overview, products and services (from the SOQ)\n2. Example projects and services, including sonar surveying\n3. Example product sales, including the treatability lab\n4. Why partner with us + contact", 6)}
          </Field>
          <Field label="Must include word for word, or must avoid" full>
            {area("mustInclude", "Taglines, numbers, legal text, names to leave out", 2)}
          </Field>
          <Field label="Look and feel" full hint="Style, colors, or an example to match (attach it below).">
            {inp("style", { placeholder: "Clean and photo-led, like our SOQ" })}
          </Field>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Photos and files</div>
        <div
          style={{ border: "2px dashed #c8d4e8", borderRadius: 8, padding: "18px 24px", textAlign: "center", cursor: "pointer", background: "#fafbfc" }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current.click()}
        >
          <input ref={inputRef} type="file" multiple style={{ display: "none" }} onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
          <div style={{ fontSize: 24, marginBottom: 6 }}>📷</div>
          <div style={{ fontSize: 13, color: "#7a8a9a" }}>Drop the source documents, photos, logos and any example to match. Full resolution, up to {MAX_FILE_MB} MB each.</div>
        </div>
        {files.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {files.map((x, i) => (
              <div key={i} style={{ border: `1px solid ${x.tooBig ? "#e24b4a" : "#e2e8f0"}`, borderRadius: 6, padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: BLUE }}>
                  {x.file.type.startsWith("image/") ? "🖼" : "📄"}
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.file.name}</span>
                  <span style={{ color: x.tooBig ? "#e24b4a" : "#9aa5b4", fontSize: 12 }}>{mb(x.file.size)}{x.tooBig ? " (too large)" : ""}</span>
                  {busy ? <span style={{ fontSize: 12, color: "#7a8a9a", minWidth: 36, textAlign: "right" }}>{x.progress}%</span>
                    : <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#9aa5b4", cursor: "pointer", fontSize: 16 }}>×</button>}
                </div>
                <div className="field-grid" style={{ marginTop: 8 }}>
                  <div className="field">
                    <select value={x.role} onChange={e => setFile(i, { role: e.target.value })} disabled={busy}>
                      {FILE_ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <input placeholder="What it is / where it goes (e.g. cover photo, slide 2)" value={x.note} onChange={e => setFile(i, { note: e.target.value })} disabled={busy} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {err && <div className="err-banner"><span>⚠</span><span>{err}</span></div>}
      <button className="btn-parse-big" onClick={submit} disabled={busy}>
        {busy ? `⏳ ${status || "Sending…"}` : "Send request"}
      </button>
      <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "#b0bbc8" }}>
        The design team gets an email with this brief and links to your files. No HubSpot deal is created.
      </div>
    </div>
  );
}
