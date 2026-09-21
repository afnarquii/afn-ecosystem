import fs from 'node:fs';
import path from 'node:path';
import { afnPath } from './paths.js';
import { detectProjects } from './detect-projects.js';
import { normalizeProjectsConfig, activeProjects, activeRelationships } from './projects-policy.js';
import { persistWorkspaceFlowDiagram } from './diagram-store.js';
import { withPreservedMemory } from './cerebro.js';
import { loadWorkspaceFlow } from './workspace-flow.js';

export const LLM_ARCHITECTURE_PROMPT = `Mapa AFN: leé evidencia de disco, no inventes.

1. Llamá afn_architecture_evidence.
2. Leé SOLO los archivos de filesToRead (existen en este workspace).
3. Llamá afn_architecture_commit con projects/relationships que hayas visto en esos archivos (proxy, compose, env.example, manifiestos).
Prohibido inventar: puertos, prefix /api, flechas front→back, BDs, lambdas o paquetes que no estén en el disco.
Si no hay evidencia de una conexión, omitila. No completes huecos.`;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function insideRoot(root, abs) {
  const r = path.resolve(root);
  const d = path.resolve(abs);
  const R = process.platform === 'win32' ? r.toLowerCase() : r;
  const D = process.platform === 'win32' ? d.toLowerCase() : d;
  return D === R || D.startsWith(`${R}${path.sep}`);
}

function existingFile(root, rel) {
  const abs = path.resolve(root, rel);
  if (!insideRoot(root, abs) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) return '';
  return String(rel).replace(/\\/g, '/');
}

/**
 * Inventario + conexiones con evidencia. Sin defaults inventados.
 * @param {string} root
 */
export function collectArchitectureEvidence(root) {
  const detected = detectProjects(root);
  const cfg = normalizeProjectsConfig(readJson(afnPath(root, 'projects.json')) || detected);
  const flow = loadWorkspaceFlow(root);
  const filesToRead = [];
  const addFile = (rel, why) => {
    const n = existingFile(root, rel);
    if (n && !filesToRead.some((f) => f.path === n)) filesToRead.push({ path: n, why });
  };

  addFile('docker-compose.yml', 'servicios de datos');
  addFile('docker-compose.yaml', 'servicios de datos');
  addFile('compose.yml', 'servicios de datos');

  const projects = (detected.projects.length ? detected.projects : activeProjects(cfg)).map((p) => {
    const rel = String(p.path || '.').replace(/\\/g, '/');
    const base = rel === '.' || rel === './' ? '' : rel.replace(/^\.\//, '');
    const join = (name) => (base ? `${base}/${name}` : name);
    addFile(join('package.json'), `manifiesto ${p.name}`);
    addFile(join('vite.config.js'), 'proxy');
    addFile(join('vite.config.ts'), 'proxy');
    addFile(join('vite.config.mjs'), 'proxy');
    addFile(join('next.config.js'), 'proxy');
    addFile(join('next.config.mjs'), 'proxy');
    addFile(join('.env.example'), 'puertos / URLs');
    addFile(join('prisma/schema.prisma'), 'BD');
    addFile(join('serverless.yml'), 'lambda');
    addFile(join('go.mod'), 'manifiesto');
    addFile(join('pyproject.toml'), 'manifiesto');
    const unknowns = [];
    if (!p.port) unknowns.push('puerto');
    if ((p.type === 'frontend' || p.layer === 'presentation') && !(p.proxies || []).length) {
      unknowns.push('proxy');
    }
    return {
      name: p.name,
      path: p.path,
      type: p.type,
      framework: p.framework || '',
      port: p.port || null,
      db: p.db || '',
      prefix: p.prefix || '',
      proxies: p.proxies || [],
      unknowns,
    };
  });

  const relationships = (detected.relationships.length ? detected.relationships : activeRelationships(cfg)).map((r) => ({
    from: r.from,
    to: r.to,
    type: r.type,
    endpoint: r.endpoint || '',
    via: r.via || '',
    source: r.via === 'proxy' ? 'proxy' : r.via === 'db' ? 'db' : 'disk',
  }));

  const unknowns = [];
  if (!relationships.length && projects.length > 1) {
    unknowns.push('No hay flechas evidentes (proxy/compose). El LLM debe leer filesToRead o dejar el flujo vacío.');
  }
  for (const p of projects) {
    if (p.unknowns.length) unknowns.push(`${p.name}: ${p.unknowns.join(', ')} sin evidencia en disco`);
  }

  return {
    ok: true,
    root,
    llmReviewed: flow?.llmReviewed === true,
    needsLlm: flow?.llmReviewed !== true,
    projects,
    relationships,
    filesToRead: filesToRead.slice(0, 16),
    unknowns,
    prompt: LLM_ARCHITECTURE_PROMPT,
  };
}

/**
 * El LLM entrega solo nodos/flechas verificados. Path debe existir. No se inventan nodos.
 * @param {string} root
 * @param {{ projects?: object[], relationships?: object[] }} input
 */
export function commitArchitecture(root, input = {}) {
  return withPreservedMemory(root, () => {
    const evidence = collectArchitectureEvidence(root);
    const existing = normalizeProjectsConfig(readJson(afnPath(root, 'projects.json')) || { projects: evidence.projects });
    const rejected = [];
    const byName = new Map(existing.projects.map((p) => [p.name, { ...p }]));

    for (const p of Array.isArray(input.projects) ? input.projects : []) {
      const name = String(p?.name || '').trim();
      const rel = String(p?.path || '').trim() || byName.get(name)?.path;
      if (!name) {
        rejected.push({ reason: 'sin-nombre' });
        continue;
      }
      const abs = path.resolve(root, rel || '.');
      if (!rel || !insideRoot(root, abs) || !fs.existsSync(abs)) {
        rejected.push({ name, path: rel, reason: 'path-no-existe' });
        continue;
      }
      const cur = byName.get(name) || { name, path: rel, type: p.type || 'unknown', status: 'active', enabled: true };
      if (p.type) cur.type = p.type;
      if (p.framework) cur.framework = p.framework;
      if (p.port) cur.port = p.port;
      if (p.db) cur.db = p.db;
      if (p.prefix) cur.prefix = p.prefix;
      if (p.role) cur.role = p.role;
      if (p.layer) cur.layer = p.layer;
      cur.path = rel;
      byName.set(name, cur);
    }

    const names = new Set(byName.keys());
    const rels = [];
    const seen = new Set();
    const incoming = [
      ...existing.relationships,
      ...(Array.isArray(input.relationships) ? input.relationships : []),
    ];
    for (const r of incoming) {
      const from = String(r?.from || '').trim();
      const to = String(r?.to || '').trim();
      if (!from || !to) continue;
      if (!names.has(from) || !names.has(to)) {
        rejected.push({ from, to, reason: 'nodo-inventado' });
        continue;
      }
      const key = `${from}|${to}|${r.via || r.type || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rels.push({
        from,
        to,
        type: r.type || 'api-communication',
        endpoint: r.endpoint || '',
        via: r.via || '',
      });
    }

    const cfg = normalizeProjectsConfig({
      ...existing,
      projects: [...byName.values()],
      relationships: rels,
      llmReviewed: true,
    });
    fs.mkdirSync(afnPath(root), { recursive: true });
    fs.writeFileSync(afnPath(root, 'projects.json'), `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
    const diagram = persistWorkspaceFlowDiagram(root, cfg, { recreate: true, llmReviewed: true });
    return {
      ok: true,
      committed: true,
      llmReviewed: true,
      rejected,
      projects: cfg.projects,
      relationships: cfg.relationships,
      diagram,
      hint: rejected.length
        ? `Guardé lo verificado. Rechacé ${rejected.length} ítem(s) sin disco (no se inventan).`
        : 'Arquitectura guardada solo con lo verificado. El cerebro no se tocó.',
    };
  });
}
