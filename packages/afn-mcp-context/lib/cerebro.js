import fs from 'node:fs';
import { afnPath, MAX_FACT_CHARS } from './paths.js';
import { loadFacts, writeFacts } from './memory.js';

const MAX_OBS = 300;
const MAX_SESSIONS = 80;
const DURABLE_TYPES = new Set(['decision', 'architecture', 'pattern', 'config']);

function cerebroFile(root) {
  return afnPath(root, 'memory', 'cerebro.json');
}

function emptyStore() {
  return { version: 1, activeSessionId: '', sessions: [], observations: [] };
}

/**
 * @param {string} root
 */
export function loadCerebro(root) {
  try {
    const j = JSON.parse(fs.readFileSync(cerebroFile(root), 'utf8'));
    return {
      version: 1,
      activeSessionId: String(j?.activeSessionId || ''),
      sessions: Array.isArray(j?.sessions) ? j.sessions.filter((s) => s && s.id) : [],
      observations: Array.isArray(j?.observations) ? j.observations.filter((o) => o && o.id) : [],
    };
  } catch {
    return emptyStore();
  }
}

/**
 * @param {string} root
 * @param {ReturnType<typeof loadCerebro>} store
 */
export function writeCerebro(root, store) {
  fs.mkdirSync(afnPath(root, 'memory'), { recursive: true });
  const next = {
    version: 1,
    activeSessionId: String(store.activeSessionId || ''),
    sessions: (store.sessions || []).slice(-MAX_SESSIONS),
    observations: (store.observations || []).slice(-MAX_OBS),
  };
  fs.writeFileSync(cerebroFile(root), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

function blobOf(o) {
  return [o.title, o.type, o.what, o.why, o.where, o.learned, o.text].filter(Boolean).join(' ');
}

/**
 * @param {string} root
 * @param {object} input
 */
export function saveObservation(root, input = {}) {
  const what = String(input.what || '').trim();
  const why = String(input.why || '').trim();
  const where = String(input.where || '').trim();
  const learned = String(input.learned || '').trim();
  const parts = [
    what && `**What**: ${what}`,
    why && `**Why**: ${why}`,
    where && `**Where**: ${where}`,
    learned && `**Learned**: ${learned}`,
  ].filter(Boolean);
  let text = String(input.text || parts.join(' ') || '').trim();
  if (!text) return { ok: false, error: 'texto vacío' };
  text = text.slice(0, MAX_FACT_CHARS);
  const type = String(input.type || 'observation').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'observation';
  const title = String(input.title || what || text)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  const store = loadCerebro(root);
  const obs = {
    id: `o-${Date.now()}`,
    title,
    type,
    what,
    why,
    where,
    learned,
    text,
    sessionId: String(input.sessionId || store.activeSessionId || ''),
    createdAt: new Date().toISOString(),
  };
  store.observations.push(obs);
  writeCerebro(root, store);
  if (DURABLE_TYPES.has(type) || type === 'observation' || type === 'session-summary') {
    const pack = loadFacts(root);
    pack.facts.push({ id: obs.id, text, createdAt: obs.createdAt, type, title });
    writeFacts(root, pack.facts);
  }
  return { ok: true, observation: obs, count: store.observations.length };
}

/**
 * @param {string} root
 * @param {string} query
 * @param {{ limit?: number, type?: string }} [opts]
 */
export function searchCerebro(root, query, opts = {}) {
  const q = String(query || '').trim().toLowerCase();
  const type = String(opts.type || '').toLowerCase();
  const limit = Math.min(20, Number(opts.limit) || 8);
  let list = loadCerebro(root).observations;
  if (type) list = list.filter((o) => String(o.type || '') === type);
  if (q) list = list.filter((o) => blobOf(o).toLowerCase().includes(q));
  return list.slice(-limit).reverse();
}

/**
 * @param {string} root
 * @param {{ goal?: string, id?: string }} [input]
 */
export function startSession(root, input = {}) {
  const store = loadCerebro(root);
  const id = String(input.id || `s-${Date.now()}`);
  const sess = {
    id,
    startedAt: new Date().toISOString(),
    endedAt: '',
    goal: String(input.goal || '').trim().slice(0, 240),
    done: '',
    next: '',
    files: '',
    summary: '',
  };
  store.sessions.push(sess);
  store.activeSessionId = id;
  writeCerebro(root, store);
  return { ok: true, session: sess };
}

/**
 * @param {string} root
 * @param {object} input
 */
export function endSession(root, input = {}) {
  const store = loadCerebro(root);
  const id = String(input.sessionId || store.activeSessionId || '');
  let sess = store.sessions.find((s) => s.id === id);
  if (!sess) {
    const started = startSession(root, { goal: input.goal });
    sess = started.session;
  }
  const live = loadCerebro(root);
  const cur = live.sessions.find((s) => s.id === sess.id) || sess;
  cur.endedAt = new Date().toISOString();
  cur.goal = String(input.goal || cur.goal || '').trim().slice(0, 240);
  cur.done = String(input.done || '').trim().slice(0, 800);
  cur.next = String(input.next || '').trim().slice(0, 400);
  cur.files = String(input.files || '').trim().slice(0, 400);
  cur.summary = [cur.goal && `Goal: ${cur.goal}`, cur.done && `Done: ${cur.done}`, cur.next && `Next: ${cur.next}`, cur.files && `Files: ${cur.files}`]
    .filter(Boolean)
    .join(' · ');
  live.activeSessionId = '';
  writeCerebro(root, live);
  const saved = saveObservation(root, {
    type: 'session-summary',
    title: cur.goal || 'sesión',
    what: cur.done || cur.summary,
    why: cur.goal,
    where: cur.files,
    learned: cur.next,
    sessionId: cur.id,
  });
  return { ok: true, session: cur, observation: saved.observation };
}

/**
 * Contexto reciente (equivalente lean a mem_context de Engram).
 * @param {string} root
 * @param {{ limit?: number }} [opts]
 */
export function getMemContext(root, opts = {}) {
  const store = loadCerebro(root);
  const limit = Math.min(12, Number(opts.limit) || 8);
  const observations = [...store.observations].slice(-limit).reverse();
  const sessions = [...store.sessions].slice(-5).reverse();
  const active = store.sessions.find((s) => s.id === store.activeSessionId) || null;
  return {
    ok: true,
    activeSessionId: store.activeSessionId,
    active,
    sessions,
    observations,
    counts: { observations: store.observations.length, sessions: store.sessions.length },
  };
}
