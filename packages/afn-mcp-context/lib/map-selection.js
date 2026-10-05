/**
 * Lista las carpetas reconocidas y guarda cuáles entran al mapa.
 * El resto queda en ignorePaths y la arquitectura queda cerrada.
 */
import fs from 'node:fs';
import { afnPath, pathKeyOf } from './paths.js';
import { detectProjects } from './detect-projects.js';
import { activeProjects, isIgnoredPath, normalizeProjectsConfig } from './projects-policy.js';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function relPath(p) {
  const raw = String(p || '').replace(/\\/g, '/').trim();
  if (!raw || raw === '.') return '.';
  return raw.startsWith('.') ? raw : `./${raw.replace(/^\.?\//, '')}`;
}

/**
 * @param {string} root
 */
export function listMapFolders(root) {
  const existing = normalizeProjectsConfig(readJson(afnPath(root, 'projects.json')) || {});
  const detected = detectProjects(root, { ignorePaths: [] });
  const activeKeys = new Set(activeProjects(existing).map((p) => pathKeyOf(p.path)));
  const seen = new Set();
  const folders = [];

  const push = (p, extra = {}) => {
    const key = pathKeyOf(p.path);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const ignored = isIgnoredPath(p.path, existing.ignorePaths);
    let selected = false;
    if (activeKeys.has(key)) selected = true;
    else if (ignored || existing.architectureLocked) selected = false;
    else if (!activeKeys.size) selected = true;
    folders.push({
      name: String(p.name || ''),
      path: relPath(p.path),
      type: String(p.type || ''),
      framework: String(p.framework || ''),
      selected,
      ...extra,
    });
  };

  for (const p of detected.projects) push(p);
  for (const p of activeProjects(existing)) {
    if (!seen.has(pathKeyOf(p.path))) push(p, { manual: true });
  }

  return {
    ok: true,
    locked: existing.architectureLocked === true,
    folders,
  };
}

/**
 * @param {string} root
 * @param {string[]} paths
 */
export function saveMapSelection(root, paths) {
  const wanted = new Set((Array.isArray(paths) ? paths : []).map((p) => pathKeyOf(p)).filter((k) => k));
  if (!wanted.size) return { ok: false, error: 'empty' };

  const existing = normalizeProjectsConfig(readJson(afnPath(root, 'projects.json')) || {});
  const detected = detectProjects(root, { ignorePaths: [] });
  const known = new Map();
  for (const p of detected.projects) known.set(pathKeyOf(p.path), p);
  for (const p of existing.projects) {
    const key = pathKeyOf(p.path);
    if (!known.has(key)) known.set(key, p);
    else known.set(key, { ...known.get(key), ...p, name: p.name || known.get(key).name });
  }

  const projects = [];
  for (const key of wanted) {
    const p = known.get(key);
    if (!p) continue;
    projects.push({ ...p, path: relPath(p.path), status: 'active', enabled: true });
  }
  if (!projects.length) return { ok: false, error: 'unknown' };

  const selectedKeys = new Set(projects.map((p) => pathKeyOf(p.path)));
  const ignorePaths = [];
  const pushIgnore = (p) => {
    const rel = relPath(p);
    const key = pathKeyOf(rel);
    if (!key || key === '.' || selectedKeys.has(key)) return;
    if (ignorePaths.some((x) => pathKeyOf(x) === key)) return;
    ignorePaths.push(rel);
  };
  for (const p of detected.projects) {
    if (!selectedKeys.has(pathKeyOf(p.path))) pushIgnore(p.path);
  }
  for (const p of existing.ignorePaths) pushIgnore(p);

  const names = new Set(projects.map((p) => p.name));
  const relationships = [];
  const seenRel = new Set();
  for (const r of [...(existing.relationships || []), ...(detected.relationships || [])]) {
    if (!r || !names.has(r.from) || !names.has(r.to)) continue;
    const id = `${r.from}|${r.to}`;
    if (seenRel.has(id)) continue;
    seenRel.add(id);
    relationships.push(r);
  }

  const cfg = normalizeProjectsConfig({
    isMultiProject: projects.length > 1,
    rootPath: '.',
    architectureLocked: true,
    ignorePaths,
    projects,
    relationships,
  });
  fs.mkdirSync(afnPath(root), { recursive: true });
  fs.writeFileSync(afnPath(root, 'projects.json'), `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
  return {
    ok: true,
    locked: true,
    projects: activeProjects(cfg).map((p) => ({ name: p.name, path: p.path })),
    ignorePaths: cfg.ignorePaths,
  };
}
