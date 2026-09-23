/**
 * El clon afn-ecosystem es la memoria global: lee el `.afn` de cada proyecto registrado.
 * No copia esa memoria adentro del catálogo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { afnPath } from './paths.js';
import { isAfnEcosystemCatalog } from './resolve-root.js';
import { loadCerebro } from './cerebro.js';
import { listWorkspaceSkills } from './skill-library.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function catalogInstallRoot() {
  const cat = path.resolve(PACKAGE_ROOT, '..', '..');
  return isAfnEcosystemCatalog(cat) ? cat : '';
}

function registryFile(catalogRoot) {
  return afnPath(catalogRoot, 'known-projects.json');
}

function samePath(a, b) {
  const x = path.resolve(a);
  const y = path.resolve(b);
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

function readRegistry(catalogRoot) {
  try {
    const j = JSON.parse(fs.readFileSync(registryFile(catalogRoot), 'utf8'));
    return Array.isArray(j.projects) ? j.projects : [];
  } catch {
    return [];
  }
}

function writeRegistry(catalogRoot, projects) {
  const dir = afnPath(catalogRoot);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(registryFile(catalogRoot), `${JSON.stringify({ version: 1, projects }, null, 2)}\n`, 'utf8');
}

/**
 * @param {string} projectRoot
 */
export function registerKnownProject(projectRoot) {
  const cat = catalogInstallRoot();
  const root = path.resolve(String(projectRoot || ''));
  if (!cat) return { ok: false, error: 'no_catalog' };
  if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) return { ok: false, error: 'not_found' };
  const tmp = path.resolve(os.tmpdir());
  if (root.toLowerCase().startsWith(tmp.toLowerCase())) return { ok: true, skipped: true, reason: 'tmp' };
  if (samePath(root, cat) || isAfnEcosystemCatalog(root)) return { ok: true, skipped: true, reason: 'catalog' };
  const projects = readRegistry(cat).filter((p) => p && p.root && !samePath(p.root, root));
  projects.push({ root, name: path.basename(root), addedAt: new Date().toISOString() });
  writeRegistry(cat, projects);
  return { ok: true, root, catalog: cat, count: projects.length };
}

/**
 * @param {string} catalogRoot
 */
export function listKnownProjects(catalogRoot) {
  if (!isAfnEcosystemCatalog(catalogRoot)) return [];
  return readRegistry(catalogRoot)
    .filter((p) => p && p.root && fs.existsSync(p.root))
    .map((p) => ({ root: path.resolve(p.root), name: String(p.name || path.basename(p.root)), addedAt: p.addedAt || '' }));
}

function observationsOf(root) {
  return loadCerebro(root).observations.map((o) => ({
    id: o.id,
    title: o.title || '',
    type: o.type || '',
    what: o.what || '',
    text: o.text || '',
    where: o.where || '',
    createdAt: o.createdAt || '',
    project: path.basename(root),
    projectRoot: path.resolve(root),
  }));
}

/**
 * Memoria viva de cada proyecto registrado, más la del propio catálogo.
 * @param {string} catalogRoot
 */
export function aggregateCatalogMemory(catalogRoot) {
  const projects = listKnownProjects(catalogRoot).map((p) => ({
    ...p,
    observations: observationsOf(p.root),
    skills: listWorkspaceSkills(p.root).skills || [],
  }));
  return {
    ok: true,
    mode: 'catalog',
    root: path.resolve(catalogRoot),
    own: observationsOf(catalogRoot),
    projects,
  };
}

/**
 * @param {string} catalogRoot
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 */
export function searchCatalogMemory(catalogRoot, query, opts = {}) {
  const q = String(query || '').trim().toLowerCase();
  const limit = Math.min(200, Number(opts.limit) || 80);
  const all = [
    ...observationsOf(catalogRoot),
    ...listKnownProjects(catalogRoot).flatMap((p) => observationsOf(p.root)),
  ];
  const list = q
    ? all.filter((o) => [o.title, o.type, o.what, o.text, o.where, o.project].join(' ').toLowerCase().includes(q))
    : all;
  return list.slice(-limit).reverse();
}
