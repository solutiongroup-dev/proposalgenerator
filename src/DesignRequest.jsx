import React, { useState, useRef } from "react";

// ── Design Request ───────────────────────────────────────────────────────────
// For documents that need photos, custom layout or design work and don't fit the
// proposal templates. Files go to Vercel Blob (any size, straight from the
// browser), and Chase gets an email with a complete brief that can be pasted into
// Claude / Claude Design to produce the finished document without follow-up.

const BLUE = "#2B579A";

const DOC_KINDS = ["Proposal (custom layout)", "Capabilities brochure", "Case study", "Report", "Presentation / slide deck",
  "Flyer / one-pager", "Letter or memo", "Signage or poster", "Other"];
const BRANDS = ["Solution Group", "WaterSolve", "Co-branded (SG + client)", "Client's brand", "Unbranded"];
const FORMATS = ["Word (.docx)", "PDF", "PowerPoint (.pptx)", "Web page", "Not sure. Recommend one"];
const STYLES = ["Clean corporate", "Bold marketing", "Technical / engineering", "Photo-led", "Match the reference files"];
const PRIORITIES = ["Normal", "High", "Urgent"];
const FILE_ROLES = ["Photo to use in the document", "Source content (pull text/data from it)", "Style reference (look and feel)", "Logo or brand asset", "Other"];

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
  const line = (label, v) => v && String(v).trim() ? `- **${label}:** ${String(v).trim()}\n` : "";
  const block = (title, v) => v && String(v).trim() ? `\n## ${title}\n${String(v).trim()}\n` : "";
  const fileList = files.length
    ? files.map((x, i) => `${i + 1}. **${x.name}** (${mb(x.size)}): ${x.role}${x.note ? `. ${x.note}` : ""}\n   ${x.url || "(not uploaded)"}`).join("\n")
    : "No files attached.";
  return `# Custom Request ${id}: ${f.title}

## Instructions for Claude
Produce a finished, ready-to-send ${f.format && !/not sure/i.test(f.format) ? f.format : "document (choose the best format for the purpose and say why)"} from this brief.
- Follow the outline and include every fact, number and exact-text item given. Do not invent prices, names, dates, certifications or results; where something needed is missing, insert a clearly marked [PLACEHOLDER: what is needed].
- Use the attached photos where the notes say. Download them from the links below. Give each photo a short caption unless told otherwise.
- Brand: ${f.brand || "Solution Group"}. Design style: ${f.style || "Clean corporate"}.${f.colors ? ` Colors / brand notes: ${f.colors}.` : ""}
- Audience: ${f.audience || "client decision makers"}. Write for them: plain, confident and specific.
- Length target: ${f.length || "as long as the content needs, no padding"}.

## Document
${line("Title", f.title)}${line("Type", f.kind)}${line("Prepared for (client / recipient)", f.client)}${line("Brand", f.brand)}${line("Output format", f.format)}${line("Length", f.length)}${line("Audience", f.audience)}${line("Purpose / what the reader should do", f.purpose)}${block("Outline (sections in order, and what goes in each)", f.outline)}${block("Key messages", f.messages)}${block("Content, facts and numbers", f.content)}${block("Exact text to include word for word", f.exactText)}
## Visual design
${line("Style", f.style)}${line("Colors / brand notes", f.colors)}${line("Charts, tables or diagrams needed", f.charts)}${line("Design references (links)", f.referenceLinks)}
## Photos and files
${fileList}
${block("Avoid", f.avoid)}
## Request details
${line("Request ID", id)}${line("Requested by", `${f.requesterName} <${f.requesterEmail}>`)}${line("Due", f.dueDate)}${line("Priority", f.priority)}${line("Send the finished document to", f.deliverTo || f.requesterEmail)}${line("Other notes", f.notes)}`;
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

export default function DesignRequest({ onBack, defaultName, email }) {
  const [f, setF] = useState(() => ({ requesterName: defaultName || "", priority: "Normal", brand: "Solution Group", style: "Clean corporate", format: "Word (.docx)", kind: "" }));
  const [files, setFiles] = useState([]);          // { file, role, note, progress, url }
  const [errors, setErrors] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(null);           // { id, brief, briefUrl }
  const inputRef = useRef();

  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: false })); setErr(""); };
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

  const REQUIRED = ["requesterName", "requesterEmail", "title", "kind", "purpose", "dueDate"];

  const submit = async () => {
    const errs = {};
    REQUIRED.forEach(k => { if (!String(f[k] || "").trim()) errs[k] = true; });
    if (f.requesterEmail && !/^\S+@\S+\.\S+$/.test(f.requesterEmail)) errs.requesterEmail = true;
    if (!String(f.outline || "").trim() && !String(f.content || "").trim()) { errs.outline = true; errs.content = true; }
    setErrors(errs);
    if (Object.keys(errs).length) { setErr("Fill in the highlighted fields. Give at least an outline or the content to include."); return; }
    if (files.some(x => x.tooBig)) { setErr(`Remove files over ${MAX_FILE_MB} MB.`); return; }
    if (!email.template) { setErr("Custom requests aren't switched on yet: the email template ID is missing. Tell Chase."); return; }

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
      setStatus("Sending to Chase");
      await email.load();
      const MAX = 30000; // EmailJS caps the whole message at 50 KB
      await window.emailjs.send(email.service, email.template, {
        request_id: id,
        doc_title: f.title,
        doc_kind: f.kind,
        client_name: f.client || "Not specified",
        requester_name: f.requesterName,
        requester_email: f.requesterEmail,
        due_date: f.dueDate,
        priority: f.priority,
        file_count: String(uploaded.length),
        file_list: uploaded.length ? uploaded.map(u => `${u.name} (${mb(u.size)}): ${u.url}`).join("\n") : "None",
        brief_url: briefUrl,
        brief: brief.length > MAX ? brief.slice(0, MAX) + `\n\n[Brief continues: open the full brief at ${briefUrl}]` : brief,
      });

      try { localStorage.setItem("sg_generated_by", f.requesterName); } catch (e) {}
      setDone({ id, brief, briefUrl });
    } catch (e) {
      const msg = e?.text || e?.message || String(e);
      setErr(/BLOB_READ_WRITE_TOKEN|storage not set up/i.test(msg)
        ? "File storage isn't set up yet. Tell Chase."
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
          Custom request <strong>{done.id}</strong> went to Chase with your files. The finished document will be
          emailed to {f.deliverTo || f.requesterEmail}.
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
      <div className="custom-sub">
        For documents that need photos, custom layout or design work and don't fit the proposal templates.
        This goes straight to Chase. Be specific: the more complete this is, the sooner the finished document comes back,
        with no follow-up questions.
      </div>

      <div className="section">
        <div className="section-title">You</div>
        <div className="field-grid">
          <Field label="Your name" required>{inp("requesterName", { placeholder: "Ted Winkelman" })}</Field>
          <Field label="Your email" required>{inp("requesterEmail", { type: "email", placeholder: "name@solutionmgt.com" })}</Field>
          <Field label="Due date" required>{inp("dueDate", { type: "date" })}</Field>
          <Field label="Priority">{sel("priority", PRIORITIES)}</Field>
          <Field label="Send the finished document to" hint="Leave blank to send it to you. Separate several emails with commas." full>
            {inp("deliverTo", { placeholder: "you, or the people who should receive it" })}
          </Field>
        </div>
      </div>

      <div className="section">
        <div className="section-title">The document</div>
        <div className="field-grid">
          <Field label="Document title" required full>{inp("title", { placeholder: "International Paper Cambridge: Water Program Capabilities" })}</Field>
          <Field label="Type of document" required>{sel("kind", DOC_KINDS, "Choose one")}</Field>
          <Field label="Prepared for (client / recipient)">{inp("client", { placeholder: "International Paper, Cambridge MD" })}</Field>
          <Field label="Output format">{sel("format", FORMATS)}</Field>
          <Field label="Length" hint="Pages, slides or a size, e.g. 11x17 poster">{inp("length", { placeholder: "6-8 pages" })}</Field>
          <Field label="Audience" full>{inp("audience", { placeholder: "Plant manager and HSE manager; not water specialists" })}</Field>
          <Field label="Purpose: what should the reader do or decide after reading it?" required full>
            {area("purpose", "Approve SG to take over wastewater operations on Jan 1", 2)}
          </Field>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Content</div>
        <div className="field-grid">
          <Field label="Outline: sections in order, and what goes in each" required={!f.content} full
            hint="An outline or the content below is required. Both is best.">
            {area("outline", "1. Cover: site photo, title, date\n2. Who we are: 1 paragraph + 3 stats\n3. Current situation: problems we found, with photos 2-4\n4. Our approach...\n5. Pricing table\n6. Next steps", 7)}
          </Field>
          <Field label="Key messages: the 2-4 things the reader must take away" full>
            {area("messages", "We take over with no gap in coverage\nCompliance with permit No. 16 from day one", 3)}
          </Field>
          <Field label="Content, facts and numbers" required={!f.outline} full
            hint="Paste everything the document should say: specs, prices, dates, names, results. Claude won't invent facts.">
            {area("content", "Flows, permit limits, staffing, pricing, timelines, results, quotes...", 8)}
          </Field>
          <Field label="Exact text to include word for word" full>
            {area("exactText", "Legal language, approved taglines, terms that must appear exactly", 3)}
          </Field>
          <Field label="Avoid" full>{area("avoid", "Competitor names, internal costs, anything that must not appear", 2)}</Field>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Design</div>
        <div className="field-grid">
          <Field label="Design style">{sel("style", STYLES)}</Field>
          <Field label="Brand">{sel("brand", BRANDS)}</Field>
          <Field label="Colors / brand notes" full>{inp("colors", { placeholder: "Use the client's navy alongside SG blue; no stock photos" })}</Field>
          <Field label="Charts, tables or diagrams needed" full>
            {area("charts", "Before/after TSS chart from the data sheet; process flow diagram of the treatment train", 2)}
          </Field>
          <Field label="Design reference links" full>{area("referenceLinks", "Links to documents or sites with the look you want", 2)}</Field>
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
          <div style={{ fontSize: 13, color: "#7a8a9a" }}>Drop photos and files or click to upload. Full resolution, up to {MAX_FILE_MB} MB each.</div>
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
                    <input placeholder="What it shows / where it goes (e.g. cover photo)" value={x.note} onChange={e => setFile(i, { note: e.target.value })} disabled={busy} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-title">Anything else</div>
        <div className="field">{area("notes", "Context Chase should know: deal status, who asked for it, how it will be used", 3)}</div>
      </div>

      {err && <div className="err-banner"><span>⚠</span><span>{err}</span></div>}
      <button className="btn-parse-big" onClick={submit} disabled={busy}>
        {busy ? `⏳ ${status || "Sending…"}` : "Send to Chase"}
      </button>
      <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "#b0bbc8" }}>
        Chase gets an email with this brief and links to your files. No HubSpot deal is created.
      </div>
    </div>
  );
}
