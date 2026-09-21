import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SELF_PKG = '@afn-ecosystem/mcp-context';

function readPkgName(dir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return String(j?.name || '');
  } catch {
    return '';
  }
}

/**
 * True si `dir` es el paquete del MCP (no el producto).
 * @param {string} dir
 */
export function isMcpContextPackageDir(dir) {
  if (!dir) return false;
  const name = readPkgName(dir);
  if (name === SELF_PKG) return true;
  const n = String(name || path.basename(dir) || '').toLowerCase();
  return n === 'afn-mcp-context' || n === 'mcp-context';
}

/**
 * Catálogo público afn-ecosystem (skills/packs/mcps), no un workspace de producto.
 * @param {string} dir
 */
export function isAfnEcosystemCatalog(dir) {
  try {
    return (
      fs.existsSync(path.join(dir, 'packs')) &&
      fs.existsSync(path.join(dir, 'skills')) &&
      fs.existsSync(path.join(dir, 'mcps')) &&
      fs.existsSync(path.join(dir, 'packages', 'afn-mcp-context'))
    );
  } catch {
    return false;
  }
}

/**
 * @param {string} dir
 */
export function isCatalogish(dir) {
  return isMcpContextPackageDir(dir) || isAfnEcosystemCatalog(dir);
}

function isFsRoot(dir) {
  const n = path.resolve(dir);
  const root = path.parse(n).root;
  return n === root || n === path.resolve(root);
}

function isHomeOrUsers(dir) {
  const n = path.resolve(dir);
  const home = path.resolve(os.homedir() || '');
  if (home && (n === home || path.dirname(n) === home)) return true;
  const base = path.basename(n).toLowerCase();
  return base === 'users' || base === 'home' || base === 'documents' || base === 'desktop';
}

function isTempDir(dir) {
  const n = path.resolve(dir);
  const tmp = path.resolve(os.tmpdir() || '');
  if (!tmp) return false;
  return n === tmp;
}

function isUsableRoot(raw) {
  const s = String(raw || '').trim();
  if (!s || /\$\{/.test(s)) return false;
  try {
    const abs = path.resolve(s);
    return fs.existsSync(abs) && fs.statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Si estamos dentro del catálogo/MCP, saltar a un padre usable.
 * @param {string} start
 */
export function escapeCatalog(start) {
  let cur = path.resolve(start);
  if (isMcpContextPackageDir(cur)) cur = path.dirname(cur);
  if (path.basename(cur).toLowerCase() === 'packages' && isAfnEcosystemCatalog(path.dirname(cur))) {
    cur = path.dirname(cur);
  }
  return cur;
}

/**
 * @param {string} [override]
 * @param {{ cwd?: string, envRoot?: string }} [opts]
 */
export function resolveProjectRoot(override, opts = {}) {
  const cwd = path.resolve(opts.cwd || process.cwd() || '.');
  const rawEnv = String(opts.envRoot ?? process.env.AFN_PROJECT_ROOT ?? override ?? '').trim();
  const envAbs = isUsableRoot(rawEnv) ? path.resolve(rawEnv) : '';

  const picks = [];
  if (envAbs && !isCatalogish(envAbs)) picks.push(envAbs);
  if (cwd && !isCatalogish(cwd)) picks.push(cwd);
  if (envAbs) picks.push(envAbs);
  if (cwd) picks.push(cwd);

  const start = picks[0] || cwd;
  const resolved = resolveWorkspaceRoot(start);
  if (isCatalogish(resolved) && cwd && !isCatalogish(cwd)) {
    return resolveWorkspaceRoot(cwd);
  }
  return resolved;
}

/**
 * Si el padre tiene varios repos/paquetes, ese es el workspace (como /afn-init).
 * No sube a /tmp ni al home. No elige el ancestro con más hijos si el actual ya es workspace.
 * @param {string} start
 * @param {{ countFn?: (dir: string) => number }} [opts]
 */
export function resolveWorkspaceRoot(start, opts = {}) {
  const count = opts.countFn || countChildProjectSignals;
  let cur = escapeCatalog(path.resolve(start));

  if (isAfnEcosystemCatalog(cur)) {
    const parent = path.dirname(cur);
    if (parent && parent !== cur && !isFsRoot(parent) && !isHomeOrUsers(parent) && !isTempDir(parent)) {
      if (count(parent) >= 2) cur = parent;
    }
  }

  const escaped = cur;
  const selfCount = count(cur);
  if (selfCount >= 2 && !isCatalogish(cur)) return cur;

  for (let i = 0; i < 5; i += 1) {
    const parent = path.dirname(cur);
    if (!parent || parent === cur || isFsRoot(parent) || isHomeOrUsers(parent) || isTempDir(parent)) break;
    const n = count(parent);
    if (n >= 2) return parent;
    cur = parent;
  }
  return escaped;
}

const SKIP = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'vendor',
  '.next',
  'venv',
  '.venv',
  '__pycache__',
  '.afn',
  '.kiro',
  '.cursor',
  'tools',
  'miniverse',
  'afnbd',
]);

/**
 * Señal de “acá hay un repo o paquete” (mismo espíritu que detectProjectsConfig).
 * @param {string} dir
 */
export function hasProjectSignal(dir) {
  try {
    if (fs.existsSync(path.join(dir, '.git'))) return true;
    const names = [
      'package.json',
      'go.mod',
      'pyproject.toml',
      'requirements.txt',
      'Cargo.toml',
      'angular.json',
      'pom.xml',
      'pubspec.yaml',
      'docker-compose.yml',
      'docker-compose.yaml',
    ];
    if (names.some((f) => fs.existsSync(path.join(dir, f)))) return true;
    return fs.readdirSync(dir).some((n) => n.endsWith('.csproj') || n.endsWith('.sln'));
  } catch {
    return false;
  }
}

/**
 * @param {string} dir
 */
export function countChildProjectSignals(dir) {
  let n = 0;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name.startsWith('.')) continue;
    if (SKIP.has(ent.name.toLowerCase())) continue;
    const abs = path.join(dir, ent.name);
    if (hasProjectSignal(abs)) n += 1;
    if (['packages', 'apps', 'services'].includes(ent.name.toLowerCase())) {
      try {
        for (const inner of fs.readdirSync(abs, { withFileTypes: true })) {
          if (!inner.isDirectory() || inner.name.startsWith('.')) continue;
          if (hasProjectSignal(path.join(abs, inner.name))) n += 1;
        }
      } catch {
        /* */
      }
    }
  }
  return n;
}
