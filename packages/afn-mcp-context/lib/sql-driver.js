/**
 * Carga mssql/pg sin agregarlos al pack (cero deps).
 * Orden: workspace → data-agent hermano → caché npx del data-agent → npx -y -p <pkg>.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';

const PACK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOW = new Set(['mssql', 'pg']);
const loaded = new Map();

function npmCacheDir(override) {
  if (override) return override;
  return (
    process.env.npm_config_cache ||
    (process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Local', 'npm-cache')
      : path.join(os.homedir(), '.npm'))
  );
}

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

function findInNpxCache(pkg, npmCache) {
  const npxRoot = path.join(npmCacheDir(npmCache), '_npx');
  let hashes = [];
  try {
    hashes = fs.readdirSync(npxRoot, { withFileTypes: true });
  } catch {
    return '';
  }
  for (const d of hashes) {
    if (!d.isDirectory()) continue;
    const base = path.join(npxRoot, d.name);
    const hits = [
      path.join(base, 'node_modules', pkg),
      path.join(base, 'node_modules', '@afn-ecosystem', 'mcp-data-agent', 'node_modules', pkg),
    ];
    for (const h of hits) {
      const dir = pkgDirIfPresent(h);
      if (dir) return dir;
    }
  }
  return '';
}

export function resetSqlDriverCache() {
  loaded.clear();
}

export function findInstalledDriver(name, opts = {}) {
  const pkg = String(name || '');
  if (!ALLOW.has(pkg)) return '';
  const roots = Array.isArray(opts.roots) ? opts.roots.filter(Boolean) : [];
  for (const r of roots) {
    const hit = walkUp(r, pkg);
    if (hit) return hit;
  }
  if (opts.scanPack !== false) {
    const sibling = pkgDirIfPresent(path.join(PACK_ROOT, '..', 'afn-mcp-data-agent', 'node_modules', pkg));
    if (sibling) return sibling;
    const fromPack = walkUp(PACK_ROOT, pkg);
    if (fromPack) return fromPack;
  }
  if (opts.scanNpx !== false) {
    const npx = findInNpxCache(pkg, opts.npmCache);
    if (npx) return npx;
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

function npxResolve(pkg) {
  return new Promise((resolve, reject) => {
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    execFile(
      cmd,
      ['-y', '-p', pkg, 'node', '-e', `process.stdout.write(require.resolve(${JSON.stringify(pkg)}))`],
      { timeout: 120000, windowsHide: true, env: process.env, shell: process.platform === 'win32' },
      (err, stdout) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(String(stdout || '').trim());
      },
    );
  });
}

/**
 * @returns {Promise<{ ok: boolean, module?: object, dir?: string, source?: string, error?: string }>}
 */
export async function loadSqlDriver(name, opts = {}) {
  const pkg = String(name || '');
  if (!ALLOW.has(pkg)) return { ok: false, error: `driver no permitido: ${pkg}` };
  if (loaded.has(pkg) && opts.fresh !== true) return loaded.get(pkg);
  const dir = findInstalledDriver(pkg, opts);
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
  if (opts.allowNpx === false) {
    return { ok: false, error: `no_driver:${pkg}`, source: 'missing' };
  }
  try {
    const resolved = await npxResolve(pkg);
    if (!resolved) return { ok: false, error: `npx no resolvió ${pkg}` };
    const pkgDir = packageDirFromResolved(resolved, pkg);
    const mod = await importFromDir(pkgDir);
    const out = { ok: true, module: mod?.default || mod, dir: pkgDir, source: 'npx' };
    loaded.set(pkg, out);
    return out;
  } catch (e) {
    return {
      ok: false,
      error: `No se pudo cargar ${pkg} (el dashboard lo busca en data-agent / npx; no hace falta npm i en el producto). ${String(e?.message || e).slice(0, 160)}`,
      source: 'npx-fail',
    };
  }
}

export function driverProbe(opts = {}) {
  return {
    mssql: findInstalledDriver('mssql', opts) ? 'ready' : 'pending',
    pg: findInstalledDriver('pg', opts) ? 'ready' : 'pending',
  };
}
