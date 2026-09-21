import { MAX_PROJECTS, pathKeyOf, slugify } from './paths.js';

const SKIP_STATUS = new Set(['deprecated', 'ignored', 'disabled', 'archived']);

/**
 * @param {unknown} rel
 * @param {string[]} ignorePaths
 */
export function isIgnoredPath(rel, ignorePaths) {
  const k = pathKeyOf(rel);
  const list = Array.isArray(ignorePaths) ? ignorePaths : [];
  for (const ign of list) {
    const i = pathKeyOf(ign);
    if (!i || i === '.') continue;
    if (k === i || k.startsWith(`${i}/`)) return true;
  }
  return false;
}

/**
 * @param {object} p
 */
export function isProjectActive(p) {
  if (!p || typeof p !== 'object') return false;
  if (p.enabled === false) return false;
  const s = String(p.status || 'active').toLowerCase();
  if (SKIP_STATUS.has(s)) return false;
  return true;
}

/**
 * @param {object} [raw]
 */
export function normalizeProjectsConfig(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const ignorePaths = (Array.isArray(src.ignorePaths) ? src.ignorePaths : [])
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  const seen = new Set();
  const projects = [];
  for (const p of Array.isArray(src.projects) ? src.projects : []) {
    if (!p || typeof p !== 'object') continue;
    const name = String(p.name || p.label || p.path || '').trim();
    if (!name) continue;
    const projectPath = String(p.path || `./${name}`).replace(/\\/g, '/').trim() || '.';
    const key = pathKeyOf(projectPath);
    if (seen.has(key)) continue;
    seen.add(key);
    projects.push({
      id: slugify(name),
      name,
      path: projectPath.startsWith('.') || projectPath.startsWith('/') ? projectPath : `./${projectPath}`,
      type: String(p.type || 'unknown').toLowerCase() || 'unknown',
      port: p.port,
      entryPoint: String(p.entryPoint || '').trim(),
      framework: String(p.framework || '').trim(),
      role: String(p.role || '').trim(),
      db: String(p.db || '').trim(),
      prefix: String(p.prefix || '').trim(),
      layer: String(p.layer || '').trim(),
      devCommand: String(p.devCommand || '').trim(),
      testCommand: String(p.testCommand || '').trim(),
      technologies: Array.isArray(p.technologies) ? p.technologies.map((x) => String(x)).filter(Boolean).slice(0, 12) : [],
      endpoints: Array.isArray(p.endpoints)
        ? p.endpoints
            .filter((e) => e && (e.path || e.method))
            .map((e) => ({
              method: String(e.method || 'ANY').slice(0, 8),
              path: String(e.path || '').slice(0, 80),
              via: String(e.via || '').slice(0, 16),
            }))
            .slice(0, 12)
        : [],
      status: String(p.status || (p.enabled === false ? 'ignored' : 'active')).toLowerCase() || 'active',
      enabled: p.enabled !== false,
    });
  }
  const relationships = (Array.isArray(src.relationships) ? src.relationships : [])
    .filter((r) => r && r.from && r.to)
    .map((r) => ({
      from: String(r.from),
      to: String(r.to),
      type: String(r.type || 'api').trim() || 'api',
      endpoint: String(r.endpoint || '').trim(),
      via: String(r.via || '').trim(),
      tech: String(r.tech || '').trim(),
    }));
  return {
    isMultiProject: projects.length > 1 || src.isMultiProject === true,
    rootPath: String(src.rootPath || '.'),
    ignorePaths,
    projects: projects.slice(0, MAX_PROJECTS),
    relationships,
  };
}

/**
 * @param {ReturnType<typeof normalizeProjectsConfig>} config
 */
export function activeProjects(config) {
  const cfg = config && typeof config === 'object' ? config : normalizeProjectsConfig();
  return (cfg.projects || []).filter(
    (p) => isProjectActive(p) && !isIgnoredPath(p.path, cfg.ignorePaths),
  );
}

function matchProject(list, key) {
  const k = String(key || '').trim().toLowerCase();
  if (!k) return null;
  return (
    list.find((p) => p.id === k || p.name.toLowerCase() === k) ||
    list.find((p) => slugify(p.name) === slugify(k)) ||
    null
  );
}

/**
 * @param {ReturnType<typeof normalizeProjectsConfig>} config
 */
export function activeRelationships(config) {
  const selected = activeProjects(config);
  const out = [];
  for (const rel of config.relationships || []) {
    const from = matchProject(selected, rel.from);
    const to = matchProject(selected, rel.to);
    if (!from || !to || from.id === to.id) continue;
    out.push({ ...rel, from: from.name, to: to.name });
  }
  return out;
}

/**
 * @param {ReturnType<typeof normalizeProjectsConfig>} config
 * @param {string} relPath
 * @param {string} [reason]
 */
export function applyIgnorePath(config, relPath, reason = 'deprecated') {
  const cfg = normalizeProjectsConfig(config);
  const key = pathKeyOf(relPath);
  if (!key || key === '.') return cfg;
  if (!cfg.ignorePaths.some((p) => pathKeyOf(p) === key)) {
    cfg.ignorePaths.push(relPath.startsWith('.') ? relPath : `./${relPath}`);
  }
  for (const p of cfg.projects) {
    if (pathKeyOf(p.path) === key) {
      p.status = reason === 'ignored' ? 'ignored' : 'deprecated';
      p.enabled = false;
    }
  }
  cfg.relationships = cfg.relationships.filter((r) => {
    const from = matchProject(cfg.projects, r.from);
    const to = matchProject(cfg.projects, r.to);
    if (!from || !to) return false;
    return isProjectActive(from) && isProjectActive(to) && !isIgnoredPath(from.path, cfg.ignorePaths) && !isIgnoredPath(to.path, cfg.ignorePaths);
  });
  return cfg;
}
