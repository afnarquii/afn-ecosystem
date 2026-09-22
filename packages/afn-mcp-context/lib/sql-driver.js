/**
 * Carga mssql/pg con require.resolve del pack (mssql es dependencia directa).
 * Sin npx -p en runtime: si el engine de npm no coincide, EBADENGINE tumba el SELECT.
 * Orden: pack → data-agent hermano → node_modules del workspace. Nunca npm i en el producto.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK_REQUIRE = createRequire(path.join(PACK_ROOT, 'package.json'));
const ALLOW = new Set(['mssql', 'pg']);
const loaded = new Map();

function pkgDirIfPresent(dir) {
  const pj = path.join(dir, 'package.json');
  return fs.existsSync(pj) ? dir : '';
}

function walkUp(start, pkg) {
  let dir = path.resolve(start || '');
  for (let i = 0; i < 10; i += 1) {
    const hit = pkgDirIfPresent(path.join(dir, 'node_modules', pkg));
    if (hit) return hit;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '';
}

function packageDirFromResolved(resolved, pkg) {
  let dir = path.dirname(resolved);
  for (let i = 0; i < 8; i += 1) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (j.name === pkg) return dir;
    } catch {
      /* */
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.dirname(resolved);
}

/** require.resolve desde el package.json del pack. Sin npx. */
export function resolvePackDriver(name) {
  const pkg = String(name || '');
  if (!ALLOW.has(pkg)) return '';
  try {
    return packageDirFromResolved(PACK_REQUIRE.resolve(pkg), pkg);
  } catch {
    return '';
  }
}

export function resetSqlDriverCache() {
  loaded.clear();
}

export function findInstalledDriver(name, opts = {}) {
  const pkg = String(name || '');
  if (!ALLOW.has(pkg)) return '';
  if (opts.scanPack !== false) {
    const fromPack = resolvePackDriver(pkg);
    if (fromPack) return fromPack;
    const sibling = pkgDirIfPresent(path.join(PACK_ROOT, '..', 'afn-mcp-data-agent', 'node_modules', pkg));
    if (sibling) return sibling;
  }
  const roots = Array.isArray(opts.roots) ? opts.roots.filter(Boolean) : [];
  for (const r of roots) {
    const hit = walkUp(r, pkg);
    if (hit) return hit;
  }
  return '';
}

function loadFromDir(pkgDir) {
  const req = createRequire(path.join(pkgDir, 'package.json'));
  return req(pkgDir);
}

async function importFromDir(pkgDir) {
  try {
    return loadFromDir(pkgDir);
  } catch {
    const main = path.join(pkgDir, 'index.js');
    const href = pathToFileURL(fs.existsSync(main) ? main : pkgDir).href;
    return import(href);
  }
}

function loadFromPack(pkg) {
  return PACK_REQUIRE(pkg);
}

function missingError(pkg) {
  return `No se pudo cargar ${pkg}. Es dependencia del pack AFN (require.resolve('${pkg}'), sin npx). En el clone: cd packages/afn-mcp-context && npm install. No hace falta npm i ${pkg} en el producto.`;
}

/**
 * @returns {Promise<{ ok: boolean, module?: object, dir?: string, source?: string, error?: string }>}
 */
export async function loadSqlDriver(name, opts = {}) {
  const pkg = String(name || '');
  if (!ALLOW.has(pkg)) return { ok: false, error: `driver no permitido: ${pkg}` };
  if (loaded.has(pkg) && opts.fresh !== true) return loaded.get(pkg);

  const packDir = opts.scanPack !== false ? resolvePackDriver(pkg) : '';
  if (packDir) {
    try {
      const mod = loadFromPack(pkg);
      const out = { ok: true, module: mod?.default || mod, dir: packDir, source: 'pack' };
      loaded.set(pkg, out);
      return out;
    } catch (e) {
      return { ok: false, error: String(e?.message || e).slice(0, 200), dir: packDir, source: 'pack-fail' };
    }
  }

  const dir = findInstalledDriver(pkg, { ...opts, scanPack: false });
  if (dir) {
    try {
      const mod = await importFromDir(dir);
      const out = { ok: true, module: mod?.default || mod, dir, source: 'disk' };
      loaded.set(pkg, out);
      return out;
    } catch (e) {
      return { ok: false, error: String(e?.message || e).slice(0, 200), dir };
    }
  }

  return { ok: false, error: missingError(pkg), source: 'missing' };
}

export function driverProbe(opts = {}) {
  return {
    mssql: findInstalledDriver('mssql', opts) ? 'ready' : 'missing',
    pg: findInstalledDriver('pg', opts) ? 'ready' : 'missing',
  };
}
