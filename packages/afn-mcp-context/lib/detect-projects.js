import fs from 'node:fs';
import path from 'node:path';
import { MAX_PROJECTS, pathKeyOf, slugify } from './paths.js';
import { isIgnoredPath } from './projects-policy.js';

export const DEFAULT_SKIP_DIRS = Object.freeze([
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

const MANIFEST_FILES = Object.freeze([
  'package.json',
  'go.mod',
  'pyproject.toml',
  'requirements.txt',
  'Cargo.toml',
  'pubspec.yaml',
  'pom.xml',
  'angular.json',
]);

/**
 * @param {string} dir
 */
function hasManifest(dir) {
  return MANIFEST_FILES.some((f) => fs.existsSync(path.join(dir, f)))
    || fs.readdirSync(dir).some((n) => n.endsWith('.csproj'));
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} name
 * @param {object|null} pkg
 */
export function inferProjectType(name, pkg) {
  const n = String(name || '').toLowerCase();
  if (/(^|-)(front|frontend|client|web|ui|spa)(-|$)/.test(n) || n === 'frontend' || n === 'client' || n === 'web') {
    return 'frontend';
  }
  if (/(^|-)(back|backend|server|api)(-|$)/.test(n) || n === 'backend' || n === 'server' || n === 'api') {
    return 'backend';
  }
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  const blob = Object.keys(deps).join(' ').toLowerCase();
  if (/\b(react|vue|@angular|vite|svelte|next)\b/.test(blob)) return 'frontend';
  if (/\b(express|fastify|koa|@nestjs\/core|hono)\b/.test(blob)) return 'backend';
  return 'unknown';
}

/**
 * @param {object|null} pkg
 * @param {string} type
 */
export function inferPort(pkg, type) {
  const scripts = Object.values(pkg?.scripts || {}).join(' ');
  const m = scripts.match(/--port(?:\s|=)(\d{2,5})/i) || scripts.match(/-p\s+(\d{2,5})/);
  if (m) return Number(m[1]);
  if (type === 'frontend') return 5173;
  if (type === 'backend') return 4000;
  return undefined;
}

function entryPoint(pkg) {
  return String(pkg?.main || pkg?.module || '').trim();
}

/**
 * Detecta paquetes en el cwd (sin Electron, sin LLM).
 * @param {string} root
 * @param {{ ignorePaths?: string[], skipDirs?: string[] }} [opts]
 */
export function detectProjects(root, opts = {}) {
  const base = path.resolve(root);
  const ignorePaths = opts.ignorePaths || [];
  const skip = new Set((opts.skipDirs || DEFAULT_SKIP_DIRS).map((s) => s.toLowerCase()));
  const projects = [];

  function pushDir(abs, rel, nameHint) {
    const key = pathKeyOf(rel);
    if (isIgnoredPath(rel, ignorePaths) || isIgnoredPath(key, ignorePaths)) return;
    if (!hasManifest(abs)) return;
    const pkg = readJsonSafe(path.join(abs, 'package.json'));
    const name = String(pkg?.name || nameHint || path.basename(abs)).replace(/^@[^/]+\//, '');
    const type = inferProjectType(name, pkg) || inferProjectType(path.basename(abs), pkg);
    projects.push({
      name: name || path.basename(abs),
      path: rel.replace(/\\/g, '/'),
      type,
      port: inferPort(pkg, type),
      entryPoint: entryPoint(pkg),
      status: 'active',
      enabled: true,
    });
  }

  let entries = [];
  try {
    entries = fs.readdirSync(base, { withFileTypes: true });
  } catch {
    return { isMultiProject: false, rootPath: '.', ignorePaths, projects: [], relationships: [] };
  }

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (skip.has(ent.name.toLowerCase())) continue;
    if (ent.name.startsWith('.')) continue;
    const abs = path.join(base, ent.name);
    pushDir(abs, `./${ent.name}`, ent.name);
  }

  if (!projects.length && hasManifest(base)) {
    pushDir(base, '.', path.basename(base));
  }

  const used = new Set();
  for (const p of projects) {
    let n = p.name;
    if (used.has(n)) n = `${slugify(p.path)}`;
    used.add(n);
    p.name = n;
  }

  const fronts = projects.filter((p) => p.type === 'frontend');
  const backs = projects.filter((p) => p.type === 'backend');
  const relationships = [];
  for (const f of fronts) {
    for (const b of backs) {
      const port = b.port || 4000;
      relationships.push({
        from: f.name,
        to: b.name,
        type: 'api-communication',
        endpoint: `http://localhost:${port}/api`,
      });
    }
  }

  return {
    isMultiProject: projects.length > 1,
    rootPath: '.',
    ignorePaths: [...ignorePaths],
    projects: projects.slice(0, MAX_PROJECTS),
    relationships,
  };
}
