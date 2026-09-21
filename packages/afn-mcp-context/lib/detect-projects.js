import fs from 'node:fs';
import path from 'node:path';
import { MAX_PROJECTS, pathKeyOf, slugify } from './paths.js';
import { isIgnoredPath } from './projects-policy.js';
import { hasProjectSignal } from './resolve-root.js';
import { scanProjectSignals } from './stack-signals.js';

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

const NEST_WORKSPACES = new Set(['packages', 'apps', 'services']);

const MANIFEST_FILES = Object.freeze([
  'package.json',
  'go.mod',
  'pyproject.toml',
  'requirements.txt',
  'Cargo.toml',
  'pubspec.yaml',
  'pom.xml',
  'angular.json',
  'serverless.yml',
  'serverless.yaml',
]);

function hasManifest(dir) {
  try {
    return MANIFEST_FILES.some((f) => fs.existsSync(path.join(dir, f)))
      || fs.readdirSync(dir).some((n) => n.endsWith('.csproj'));
  } catch {
    return false;
  }
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
  if (/(^|-)(mobile|android|ios)(-|$)/.test(n)) return 'mobile';
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  const blob = Object.keys(deps).join(' ').toLowerCase();
  if (/\b(react|vue|@angular|vite|svelte|next)\b/.test(blob)) return 'frontend';
  if (/\b(express|fastify|koa|@nestjs\/core|hono)\b/.test(blob)) return 'backend';
  return 'unknown';
}

function refineType(abs, initial, folderName, pkg) {
  if (initial && initial !== 'unknown') return initial;
  if (fs.existsSync(path.join(abs, 'angular.json'))) return 'frontend';
  if (fs.existsSync(path.join(abs, 'go.mod'))) return 'backend';
  if (fs.existsSync(path.join(abs, 'pyproject.toml')) || fs.existsSync(path.join(abs, 'requirements.txt'))) {
    return 'backend';
  }
  return inferProjectType(folderName, pkg);
}

/**
 * @param {object|null} pkg
 * @param {string} type
 */
export function inferPort(pkg, type) {
  const scripts = Object.values(pkg?.scripts || {}).join(' ');
  const m = scripts.match(/--port(?:\s|=)(\d{2,5})/i) || scripts.match(/-p\s+(\d{2,5})/);
  if (m) return Number(m[1]);
  return undefined;
}

function entryPoint(pkg) {
  return String(pkg?.main || pkg?.module || '').trim();
}

/**
 * @param {string} name
 */
export function isWeakSoloName(name) {
  const n = String(name || '').toLowerCase();
  return n === 'mcp-context' || n === 'afn-mcp-context' || n.includes('mcp-context');
}

/**
 * Mapa pobre: un solo nodo genérico (el del MCP) — hay que re-detectar.
 * @param {{ projects?: object[] }} cfg
 */
export function isWeakProjectsMap(cfg) {
  const ps = Array.isArray(cfg?.projects) ? cfg.projects : [];
  if (ps.length === 1 && isWeakSoloName(ps[0].name)) return true;
  return false;
}

/**
 * Detecta paquetes y repos hermanos (headless, mismo espíritu que `/afn-init` + detectProjectsConfig).
 * @param {string} root
 * @param {{ ignorePaths?: string[], skipDirs?: string[] }} [opts]
 */
export function detectProjects(root, opts = {}) {
  const base = path.resolve(root);
  const ignorePaths = opts.ignorePaths || [];
  const skip = new Set((opts.skipDirs || DEFAULT_SKIP_DIRS).map((s) => s.toLowerCase()));
  const projects = [];
  const seen = new Set();

  function pushDir(abs, rel, nameHint) {
    const key = pathKeyOf(rel);
    if (seen.has(key)) return;
    if (isIgnoredPath(rel, ignorePaths) || isIgnoredPath(key, ignorePaths)) return;
    if (!hasProjectSignal(abs) && !hasManifest(abs)) return;
    const pkg = readJsonSafe(path.join(abs, 'package.json'));
    if (String(pkg?.name || '') === '@afn-ecosystem/mcp-context') return;
    seen.add(key);
    const folder = path.basename(abs);
    const name = String(nameHint || folder || pkg?.name || '')
      .replace(/^@[^/]+\//, '')
      .trim() || folder;
    const type = refineType(abs, inferProjectType(name, pkg), folder, pkg);
    const sig = scanProjectSignals(abs, { name, type, pkg });
    projects.push({
      name,
      path: rel.replace(/\\/g, '/'),
      type,
      port: sig.port || inferPort(pkg, type),
      portSource: sig.portSource || '',
      portFile: sig.portFile || '',
      entryPoint: entryPoint(pkg),
      framework: sig.framework,
      role: sig.role,
      db: sig.db,
      prefix: sig.prefix,
      layer: sig.layer,
      technologies: sig.technologies,
      endpoints: sig.endpoints,
      aliases: sig.aliases,
      envLinks: sig.envLinks,
      design: sig.design,
      proxies: sig.proxies,
      devCommand: sig.devCommand,
      testCommand: sig.testCommand,
      status: 'active',
      enabled: true,
    });
  }

  function scanLevel(dir, relPrefix) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      if (ent.name.startsWith('.')) continue;
      if (skip.has(ent.name.toLowerCase())) continue;
      const abs = path.join(dir, ent.name);
      const rel = relPrefix ? `${relPrefix}/${ent.name}` : `./${ent.name}`;
      if (NEST_WORKSPACES.has(ent.name.toLowerCase())) {
        let inner = [];
        try {
          inner = fs.readdirSync(abs, { withFileTypes: true });
        } catch {
          inner = [];
        }
        for (const child of inner) {
          if (!child.isDirectory() || child.name.startsWith('.')) continue;
          if (skip.has(child.name.toLowerCase())) continue;
          pushDir(path.join(abs, child.name), `${rel}/${child.name}`, child.name);
        }
        continue;
      }
      pushDir(abs, rel, ent.name);
    }
  }

  scanLevel(base, '');

  if (!projects.length && hasManifest(base) && !isWeakSoloName(path.basename(base))) {
    pushDir(base, '.', path.basename(base));
  }

  const used = new Set();
  for (const p of projects) {
    let n = p.name;
    if (used.has(n.toLowerCase())) n = slugify(p.path);
    used.add(n.toLowerCase());
    p.name = n;
  }

  const fronts = projects.filter((p) => p.type === 'frontend' || p.type === 'mobile');
  const backs = projects.filter((p) => p.type === 'backend');
  const relationships = [];
  const seenRel = new Set();
  const addRel = (from, to, type, endpoint, via) => {
    if (!from || !to || from === to) return;
    const key = `${from}|${to}`;
    if (seenRel.has(key)) return;
    seenRel.add(key);
    relationships.push({ from, to, type, endpoint: endpoint || '', via: via || 'direct' });
  };
  for (const f of fronts) {
    for (const proxy of f.proxies || []) {
      const byPort = backs.find((b) => b.port && proxy.port && Number(b.port) === Number(proxy.port));
      const tgt = String(proxy.target || '').toLowerCase();
      const byName = backs.find((b) => tgt && tgt.includes(String(b.name || '').toLowerCase()));
      const target = byPort || byName;
      if (target) addRel(f.name, target.name, 'proxy', `${proxy.path} → ${proxy.target}`, 'proxy');
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
