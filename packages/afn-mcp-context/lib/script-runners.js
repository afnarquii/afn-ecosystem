/**
 * Scripts Python/Node registrados por la persona en .afn/script-runners.json.
 * El MCP solo ejecuta un id de esa lista. No acepta una ruta inventada.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afnPath } from './paths.js';

const MAX_ROWS = 500;
const TIMEOUT_MS = 30_000;
const MAX_OUT = 1_000_000;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function catalogFile(root) {
  return afnPath(root, 'script-runners.json');
}

function slug(raw) {
  const s = String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return s || `script-${Date.now()}`;
}

export function resolveScriptFile(root, rel) {
  const clean = String(rel || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
  if (!clean || clean.includes('\0')) return { ok: false, error: 'Ruta vacía' };
  const abs = path.resolve(root, clean);
  const relTo = path.relative(path.resolve(root), abs);
  if (!relTo || relTo.startsWith('..') || path.isAbsolute(relTo)) {
    return { ok: false, error: 'La ruta tiene que estar dentro del proyecto' };
  }
  const parts = relTo.split(path.sep);
  if (parts.includes('node_modules') || parts.includes('.git')) {
    return { ok: false, error: 'Esa carpeta no se ejecuta' };
  }
  return { ok: true, abs, rel: relTo.replace(/\\/g, '/') };
}

function langOf(file, asked) {
  const ext = path.extname(file).toLowerCase();
  const fromExt = ext === '.py' ? 'python' : (ext === '.js' || ext === '.mjs' || ext === '.cjs' ? 'node' : '');
  const lang = String(asked || fromExt).toLowerCase();
  if (lang !== 'python' && lang !== 'node') return { ok: false, error: 'Lenguaje: python o node' };
  if (fromExt && fromExt !== lang) return { ok: false, error: `La extensión no coincide con ${lang}` };
  if (!fromExt) return { ok: false, error: 'El archivo tiene que ser .py, .js, .mjs o .cjs' };
  return { ok: true, lang };
}

function publicRunner(r) {
  return {
    id: String(r.id || ''),
    title: String(r.title || r.id || ''),
    lang: r.lang === 'python' ? 'python' : 'node',
    path: String(r.path || ''),
  };
}

export function listScriptRunners(root) {
  const j = readJson(catalogFile(root));
  const list = Array.isArray(j?.runners) ? j.runners : [];
  return list.map(publicRunner).filter((r) => r.id && r.path);
}

function writeCatalog(root, runners) {
  fs.mkdirSync(afnPath(root), { recursive: true });
  fs.writeFileSync(
    catalogFile(root),
    `${JSON.stringify({ version: 1, runners: runners.map(publicRunner) }, null, 2)}\n`,
    'utf8',
  );
  return listScriptRunners(root);
}

export function saveScriptRunner(root, input = {}) {
  const located = resolveScriptFile(root, input.path);
  if (!located.ok) return located;
  if (!fs.existsSync(located.abs) || !fs.statSync(located.abs).isFile()) {
    return { ok: false, error: 'El archivo no existe en el proyecto' };
  }
  const lang = langOf(located.rel, input.lang);
  if (!lang.ok) return lang;
  const id = slug(input.id || input.title || path.basename(located.rel, path.extname(located.rel)));
  const title = String(input.title || id).trim().slice(0, 80) || id;
  const next = listScriptRunners(root).filter((r) => r.id !== id);
  next.push({ id, title, lang: lang.lang, path: located.rel });
  writeCatalog(root, next);
  return { ok: true, runner: publicRunner({ id, title, lang: lang.lang, path: located.rel }) };
}

export function removeScriptRunner(root, id) {
  const key = String(id || '').trim();
  if (!key) return { ok: false, error: 'id requerido' };
  const next = listScriptRunners(root).filter((r) => r.id !== key && r.title !== key);
  writeCatalog(root, next);
  return { ok: true, runners: next };
}

const STARTER = {
  node: `const rows = [{ ok: true, fuente: "node" }];\nprocess.stdout.write(JSON.stringify(rows));\n`,
  python: `import json\nrows = [{"ok": True, "fuente": "python"}]\nprint(json.dumps(rows))\n`,
};

export function createScriptRunner(root, input = {}) {
  const lang = String(input.lang || 'node').toLowerCase() === 'python' ? 'python' : 'node';
  const title = String(input.title || '').trim().slice(0, 80);
  if (!title) return { ok: false, error: 'Poné un nombre' };
  const id = slug(title);
  const ext = lang === 'python' ? '.py' : '.js';
  const rel = `.afn/runners/${id}${ext}`;
  const located = resolveScriptFile(root, rel);
  if (!located.ok) return located;
  if (fs.existsSync(located.abs)) return { ok: false, error: 'Ese archivo ya existe' };
  fs.mkdirSync(path.dirname(located.abs), { recursive: true });
  fs.writeFileSync(located.abs, STARTER[lang], 'utf8');
  return saveScriptRunner(root, { id, title, lang, path: rel });
}

export function rowsFromScriptJson(value) {
  if (Array.isArray(value)) {
    if (!value.length) return { columns: [], rows: [] };
    const objects = value.every((x) => x && typeof x === 'object' && !Array.isArray(x));
    if (objects) {
      const columns = [...new Set(value.flatMap((r) => Object.keys(r)))].slice(0, 80);
      return { columns, rows: value.slice(0, MAX_ROWS) };
    }
    return { columns: ['value'], rows: value.slice(0, MAX_ROWS).map((v) => ({ value: v })) };
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value.rows)) return rowsFromScriptJson(value.rows);
    return { columns: Object.keys(value).slice(0, 80), rows: [value] };
  }
  return { columns: ['value'], rows: [{ value }] };
}

function spawnCapture(cmd, args, cwd) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      resolve({ missing: true, error: String(e?.message || e) });
      return;
    }
    let out = '';
    let err = '';
    let settled = false;
    const finish = (body) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(body);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, error: 'Tiempo agotado (30s)', stdout: out, stderr: err });
    }, TIMEOUT_MS);
    child.on('error', (e) => {
      finish({ missing: e?.code === 'ENOENT', error: String(e?.message || e), stdout: '', stderr: '' });
    });
    child.stdout?.on('data', (buf) => {
      if (out.length < MAX_OUT) out += buf.toString('utf8');
    });
    child.stderr?.on('data', (buf) => {
      if (err.length < 4000) err += buf.toString('utf8');
    });
    child.on('close', (code) => {
      finish({ ok: code === 0, code, stdout: out, stderr: err });
    });
  });
}

async function runFile(lang, abs, cwd) {
  const commands = lang === 'python' ? ['python', 'py', 'python3'] : ['node'];
  let last = null;
  for (const cmd of commands) {
    const r = await spawnCapture(cmd, [abs], cwd);
    if (r.missing) {
      last = r;
      continue;
    }
    return r;
  }
  return { ok: false, error: last?.error || `No está ${lang} en el PATH`, stdout: '', stderr: '' };
}

export async function runScriptRunner(root, id, { limit } = {}) {
  const key = String(id || '').trim();
  const runner = listScriptRunners(root).find((r) => r.id === key || r.title === key);
  if (!runner) {
    const known = listScriptRunners(root).map((r) => r.id).join(', ');
    return { ok: false, error: `No está en .afn/script-runners.json${known ? `: ${known}` : ''}`, rows: [], columns: [] };
  }
  const located = resolveScriptFile(root, runner.path);
  if (!located.ok) return { ...located, rows: [], columns: [] };
  if (!fs.existsSync(located.abs)) {
    return { ok: false, error: `No existe ${runner.path}`, rows: [], columns: [] };
  }
  const ran = await runFile(runner.lang, located.abs, root);
  if (!ran.ok) {
    return {
      ok: false,
      error: String(ran.error || ran.stderr || 'El script falló').slice(0, 400),
      runner,
      rows: [],
      columns: [],
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(String(ran.stdout || '').trim());
  } catch {
    return {
      ok: false,
      error: 'El script tiene que imprimir JSON por stdout',
      detail: String(ran.stdout || '').slice(0, 240),
      runner,
      rows: [],
      columns: [],
    };
  }
  const table = rowsFromScriptJson(parsed);
  const cap = Math.min(MAX_ROWS, Math.max(1, Number(limit) || 200));
  const rows = table.rows.slice(0, cap);
  return {
    ok: true,
    runner,
    columns: table.columns,
    rows,
    rowCount: rows.length,
    truncated: table.rows.length > cap,
  };
}
