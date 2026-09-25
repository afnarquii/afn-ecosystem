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

function blockedDir(abs) {
  const parts = abs.split(path.sep);
  return parts.includes('node_modules') || parts.includes('.git');
}

export function resolveScriptFile(root, raw) {
  const text = String(raw || '').trim();
  if (!text || text.includes('\0')) return { ok: false, error: 'Ruta vacía' };
  const absGiven = path.isAbsolute(text) || /^[a-zA-Z]:[\\/]/.test(text);
  if (absGiven) {
    const abs = path.resolve(text);
    if (blockedDir(abs)) return { ok: false, error: 'Esa carpeta no se ejecuta' };
    return { ok: true, abs, rel: abs, external: true };
  }
  const clean = text.replace(/\\/g, '/').replace(/^\.\//, '');
  const abs = path.resolve(root, clean);
  const relTo = path.relative(path.resolve(root), abs);
  if (!relTo || relTo.startsWith('..') || path.isAbsolute(relTo)) {
    return { ok: false, error: 'Una ruta relativa tiene que quedar dentro del proyecto. Para claves, usá la ruta absoluta fuera del repo.' };
  }
  if (blockedDir(abs)) return { ok: false, error: 'Esa carpeta no se ejecuta' };
  return { ok: true, abs, rel: relTo.replace(/\\/g, '/'), external: false };
}

/** Lo que puede ver el modelo: sin ruta y sin contenido del archivo. */
export function agentScriptView(runner) {
  if (!runner) return null;
  return {
    id: String(runner.id || ''),
    title: String(runner.title || runner.id || ''),
    lang: runner.lang === 'python' ? 'python' : 'node',
  };
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
    return { ok: false, error: 'El archivo no existe en esa ruta' };
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
  node: `const args = process.argv.slice(2);\nconst rows = [{ ok: true, fuente: "node", args }];\nprocess.stdout.write(JSON.stringify(rows));\n`,
  python: `import json, sys\nrows = [{"ok": True, "fuente": "python", "args": sys.argv[1:]}]\nprint(json.dumps(rows))\n`,
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

const MAX_SCRIPT_ARGS = 40;
const MAX_SCRIPT_ARG = 2000;

function scalarArg(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/** args = posicionales. params = --clave valor. Vacío = el script corre sin parámetros. */
export function buildScriptArgv(input = {}) {
  const out = [];
  const push = (text) => {
    const value = String(text);
    if (value.includes('\0')) return { ok: false, error: 'Un parámetro tiene un carácter nulo' };
    if (value.length > MAX_SCRIPT_ARG) return { ok: false, error: 'Un parámetro supera 2000 caracteres' };
    if (out.length >= MAX_SCRIPT_ARGS) return { ok: false, error: 'Demasiados parámetros (máximo 40)' };
    out.push(value);
    return null;
  };
  let params = input.params && typeof input.params === 'object' && !Array.isArray(input.params)
    ? input.params
    : null;
  if (typeof input.params === 'string' && input.params.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(input.params);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, error: 'params tiene que ser un objeto' };
      }
      params = parsed;
    } catch {
      return { ok: false, error: 'params no es JSON válido' };
    }
  }
  if (params) {
    for (const [rawKey, rawVal] of Object.entries(params)) {
      const key = String(rawKey || '').trim().replace(/^-+/, '').slice(0, 80);
      if (!key || key.includes('\0')) continue;
      if (rawVal === false || rawVal == null) continue;
      if (rawVal === true) {
        const bad = push(`--${key}`);
        if (bad) return bad;
        continue;
      }
      const list = Array.isArray(rawVal) ? rawVal : [rawVal];
      for (const item of list) {
        const text = scalarArg(item);
        if (text == null) continue;
        const flag = push(`--${key}`);
        if (flag) return flag;
        const val = push(text);
        if (val) return val;
      }
    }
  }
  let args = [];
  if (Array.isArray(input.args)) args = input.args;
  else if (typeof input.args === 'string' && input.args.trim()) {
    const text = input.args.trim();
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) return { ok: false, error: 'args tiene que ser una lista' };
        args = parsed;
      } catch {
        return { ok: false, error: 'args no es JSON válido' };
      }
    } else {
      args = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    }
  }
  for (const item of args) {
    const text = scalarArg(item);
    if (text == null || text === '') continue;
    const bad = push(text);
    if (bad) return bad;
  }
  return { ok: true, argv: out };
}

async function runFile(lang, abs, cwd, argv) {
  const commands = lang === 'python' ? ['python', 'py', 'python3'] : ['node'];
  const tail = [abs, ...(argv || [])];
  let last = null;
  for (const cmd of commands) {
    const r = await spawnCapture(cmd, tail, cwd);
    if (r.missing) {
      last = r;
      continue;
    }
    return r;
  }
  return { ok: false, error: last?.error || `No está ${lang} en el PATH`, stdout: '', stderr: '' };
}

function scriptOutputText(ran, abs) {
  const err = String(ran?.stderr || '').trim();
  const out = String(ran?.stdout || '').trim();
  let text = err || (!ran?.ok ? out : '') || String(ran?.error || '').trim();
  if (abs) {
    text = text.split(abs).join('script');
    text = text.split(String(abs).replace(/\\/g, '/')).join('script');
  }
  return text.slice(0, 4000);
}

function redactPath(text, abs) {
  let s = String(text || '');
  if (abs) {
    s = s.split(abs).join('script');
    s = s.split(String(abs).replace(/\\/g, '/')).join('script');
  }
  return s.trim().slice(0, 4000);
}

function embeddedError(parsed) {
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return '';
  if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error.trim();
  const flagged = parsed.ok === false || parsed.success === false;
  if (flagged && typeof parsed.message === 'string') return parsed.message.trim();
  return '';
}

export async function runScriptRunner(root, id, options = {}) {
  const key = String(id || '').trim();
  const runner = listScriptRunners(root).find((r) => r.id === key || r.title === key);
  if (!runner) {
    const known = listScriptRunners(root).map((r) => r.id).join(', ');
    return { ok: false, error: `No está en .afn/script-runners.json${known ? `: ${known}` : ''}`, rows: [], columns: [] };
  }
  const located = resolveScriptFile(root, runner.path);
  if (!located.ok) return { ...located, rows: [], columns: [] };
  if (!fs.existsSync(located.abs)) {
    return { ok: false, error: 'El archivo registrado ya no está en disco', rows: [], columns: [] };
  }
  const built = buildScriptArgv(options);
  if (!built.ok) return { ...built, rows: [], columns: [], ran: false };
  const cwd = located.external ? path.dirname(located.abs) : root;
  const ran = await runFile(runner.lang, located.abs, cwd, built.argv);
  const note = scriptOutputText(ran, located.abs);
  let parsed = null;
  const rawOut = String(ran.stdout || '').trim();
  if (rawOut) {
    try {
      parsed = JSON.parse(rawOut);
    } catch {
      parsed = null;
    }
  }
  const table = parsed != null ? rowsFromScriptJson(parsed) : { columns: [], rows: [] };
  const cap = Math.min(MAX_ROWS, Math.max(1, Number(options.limit) || 200));
  const rows = table.rows.slice(0, cap);
  const fromJson = embeddedError(parsed);
  const failed = !ran.ok || Boolean(fromJson) || parsed == null;
  const outRows = failed && !rows.length ? [] : rows;
  const error = !failed
    ? ''
    : redactPath(fromJson || note || rawOut || 'El script tiene que imprimir JSON por stdout', located.abs);
  return {
    ok: !failed && parsed != null,
    ran: true,
    error,
    runner: agentScriptView(runner),
    columns: outRows.length ? table.columns : [],
    rows: outRows,
    rowCount: outRows.length,
    truncated: table.rows.length > cap,
    argCount: built.argv.length,
  };
}
