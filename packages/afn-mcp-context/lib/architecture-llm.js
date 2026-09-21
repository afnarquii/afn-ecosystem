import fs from 'node:fs';
import path from 'node:path';
import { afnPath } from './paths.js';
import { detectProjects } from './detect-projects.js';
import { normalizeProjectsConfig, activeProjects, activeRelationships } from './projects-policy.js';
import { persistWorkspaceFlowDiagram } from './diagram-store.js';
import { withPreservedMemory } from './cerebro.js';
import { loadWorkspaceFlow } from './workspace-flow.js';
import { findPortEvidence } from './port-evidence.js';

export const LLM_ARCHITECTURE_PROMPT = `Arquitectura AFN (C4 + arc42, texto): inventario de disco de punta a punta.

1. Llamá afn_architecture_evidence.
2. Leé filesToRead: proxy, compose, rutas, prisma/SQL/ORM, OpenAPI. Completá huecos SOLO si el archivo lo dice.
3. afn_architecture_commit: projects (endpoints, prefix, port con evidencia) + relationships (from, to, via, endpoint).

El artefacto es \`.afn/diagrams/arquitectura.md\`: contexto, contenedores (1 repo o varios), comunicación, flujo E2E, rutas, esquemas.
Prohibido inventar puertos, /api, flechas, tablas o mermaid. Si no hay evidencia, omití.`;

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

const EVIDENCE_FILES = [
  ['package.json', 'manifiesto'],
  ['vite.config.js', 'proxy'],
  ['vite.config.ts', 'proxy'],
  ['vite.config.mjs', 'proxy'],
  ['next.config.js', 'proxy'],
  ['next.config.mjs', 'proxy'],
  ['next.config.ts', 'proxy'],
  ['webpack.config.js', 'proxy'],
  ['.env.example', 'puertos / URLs (sin secretos)'],
  ['.env.sample', 'puertos / URLs'],
  ['.env.local.example', 'puertos / URLs'],
  ['Makefile', 'uvicorn / PORT'],
  ['makefile', 'uvicorn / PORT'],
  ['Dockerfile', 'EXPOSE / CMD'],
  ['docker-compose.yml', 'ports'],
  ['docker-compose.yaml', 'ports'],
  ['compose.yml', 'ports'],
  ['serverless.yml', 'provider.port / httpPort / lambda'],
  ['serverless.yaml', 'provider.port / httpPort / lambda'],
  ['serverless.ts', 'lambda'],
  ['pyproject.toml', 'manifiesto python'],
  ['requirements.txt', 'stack python'],
  ['main.py', 'fastapi / uvicorn'],
  ['app.py', 'fastapi / uvicorn'],
  ['src/main.py', 'fastapi / uvicorn'],
  ['app/main.py', 'fastapi / uvicorn'],
  ['server.js', 'rutas express'],
  ['src/server.js', 'rutas express'],
  ['src/app.js', 'rutas express'],
  ['openapi.yaml', 'rutas openapi'],
  ['openapi.json', 'contratos'],
  ['prisma/schema.prisma', 'esquema BD'],
  ['schema.prisma', 'esquema BD'],
  ['models.py', 'ORM'],
  ['go.mod', 'manifiesto'],
];

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

  addFile('docker-compose.yml', 'servicios y ports');
  addFile('docker-compose.yaml', 'servicios y ports');
  addFile('compose.yml', 'servicios y ports');
  addFile('Makefile', 'uvicorn / PORT del workspace');

  const projects = (detected.projects.length ? detected.projects : activeProjects(cfg)).map((p) => {
    const rel = String(p.path || '.').replace(/\\/g, '/');
    const base = rel === '.' || rel === './' ? '' : rel.replace(/^\.\//, '');
    const join = (name) => (base ? `${base}/${name}` : name);
    for (const [name, why] of EVIDENCE_FILES) {
      addFile(join(name), `${why} · ${p.name}`);
    }
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
      portSource: p.portSource || '',
      db: p.db || '',
      prefix: p.prefix || '',
      proxies: p.proxies || [],
      endpoints: p.endpoints || [],
      aliases: p.aliases || [],
      schemaFile: p.design?.schemaFile || '',
      entities: (p.design?.entities || []).map((e) => e.name).slice(0, 12),
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
    filesToRead: filesToRead.slice(0, 36),
    unknowns,
    prompt: LLM_ARCHITECTURE_PROMPT,
  };
}

function applyDiskPort(root, rel, incomingPort, rejected, name) {
  const abs = path.resolve(root, rel || '.');
  const disk = findPortEvidence(abs);
  if (incomingPort) {
    const n = Number(incomingPort);
    if (!disk.port) {
      rejected.push({ name, port: n, reason: 'puerto-sin-evidencia' });
      return { port: undefined, portSource: '', portFile: '' };
    }
    if (Number(disk.port) !== n) {
      rejected.push({ name, port: n, reason: 'puerto-no-coincide-disco', used: disk.port, source: disk.portSource });
    }
    return { port: disk.port, portSource: disk.portSource || '', portFile: disk.portFile || '' };
  }
  if (disk.port) {
    return { port: disk.port, portSource: disk.portSource || '', portFile: disk.portFile || '' };
  }
  return { port: undefined, portSource: '', portFile: '' };
}

/**
 * El LLM entrega solo nodos/flechas verificados. Path debe existir. No se inventan nodos ni puertos.
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
      const portHit = applyDiskPort(root, rel, p.port, rejected, name);
      if (portHit.port) {
        cur.port = portHit.port;
        cur.portSource = portHit.portSource;
        cur.portFile = portHit.portFile;
      } else if (!cur.port) {
        cur.port = undefined;
        cur.portSource = '';
      }
      if (p.db) cur.db = p.db;
      if (p.prefix) cur.prefix = p.prefix;
      if (p.role) cur.role = p.role;
      if (p.layer) cur.layer = p.layer;
      if (Array.isArray(p.endpoints) && p.endpoints.length) {
        const disk = cur.endpoints || [];
        const merged = [...disk];
        for (const e of p.endpoints) {
          const ep = String(e?.path || '').trim();
          if (!ep.startsWith('/')) continue;
          if ((ep === '/api' || ep === '/api/') && !disk.some((x) => String(x.path || '').startsWith('/api'))) continue;
          const method = String(e.method || 'ANY').slice(0, 8);
          if (!merged.some((x) => x.path === ep && String(x.method || 'ANY') === method)) {
            merged.push({ method, path: ep.slice(0, 80), via: String(e.via || 'code').slice(0, 16) });
          }
        }
        cur.endpoints = merged.slice(0, 24);
      }
      if (Array.isArray(p.aliases) && p.aliases.length) {
        cur.aliases = [...new Set([...(cur.aliases || []), ...p.aliases.map((x) => String(x).trim()).filter(Boolean)])].slice(0, 8);
      }
      cur.path = rel;
      byName.set(name, cur);
    }

    for (const [name, cur] of byName) {
      if (cur.port && !cur.portSource) {
        const hit = findPortEvidence(path.resolve(root, cur.path || '.'));
        if (hit.port && Number(hit.port) === Number(cur.port)) {
          cur.portSource = hit.portSource || '';
          cur.portFile = hit.portFile || '';
        } else if (!hit.port) {
          rejected.push({ name, port: cur.port, reason: 'puerto-sin-evidencia' });
          cur.port = undefined;
          cur.portSource = '';
        }
      }
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
        ? `Guardé lo verificado. Rechacé ${rejected.length} ítem(s) sin disco (no se inventan puertos ni nodos).`
        : 'Arquitectura README guardada (.afn/diagrams/arquitectura.md). El cerebro no se tocó.',
    };
  });
}
