// ── Draft autosave ────────────────────────────────────────────────────────────
// Keeps everything a person has entered (text, form fields and the uploaded files
// themselves) in the browser's IndexedDB, so a failed parse or generation, a crash,
// a reload or a closed tab never loses their work. IndexedDB can store File objects
// directly and holds far more than localStorage. Every call fails quietly: if the
// browser blocks storage (some private modes), the app still works, just unsaved.

const DB_NAME = "sg-docs-drafts";
const STORE = "drafts";

let dbPromise = null;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") return reject(new Error("No IndexedDB"));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch(e => { dbPromise = null; throw e; });
  }
  return dbPromise;
}

function run(mode, fn) {
  return db().then(d => new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export async function loadDraft(key) {
  try { return (await run("readonly", s => s.get(key))) || null; } catch (e) { return null; }
}

export async function saveDraft(key, value) {
  try { await run("readwrite", s => s.put({ ...value, savedAt: Date.now() }, key)); return true; }
  catch (e) { console.warn("Draft not saved:", e?.message || e); return false; }
}

export async function clearDraft(key) {
  try { await run("readwrite", s => s.delete(key)); } catch (e) {}
}

// Saved-at time for the restore banner, e.g. "today at 2:14 PM"
export function savedLabel(ts) {
  if (!ts) return "earlier";
  const d = new Date(ts), now = new Date();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `today at ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${time}`;
}

// Safe localStorage access (some private modes throw)
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};
