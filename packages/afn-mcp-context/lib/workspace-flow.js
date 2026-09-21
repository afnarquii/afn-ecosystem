import fs from 'node:fs';
import path from 'node:path';
import { afnPath, slugify } from './paths.js';
import { FLOW_GENERATOR_VERSION } from './version.js';
import { activeProjects, activeRelationships, normalizeProjectsConfig } from './projects-policy.js';
import { scanProjectSignals, scanComposeServices } from './stack-signals.js';
import { irToMermaid, mermaidId, mermaidLabel } from './diagram-ir.js';
import { workspaceFlowMarkdown } from './architecture-readme.js';

export { workspaceFlowMarkdown };

function absOf(root, rel) {
  const r = String(rel || '.').replace(/\\/g, '/');
  if (r === '.' || r === './') return path.resolve(root);
  return path.resolve(root, r);
}

function uniqPush(list, item, keyFn) {
  const k = keyFn(item);
  if (list.some((x) => keyFn(x) === k)) return;
  list.push(item);
}

/**
 * Mapa cross-project (1 repo o varios) a partir del disco + projects.json.
 * @param {string} root
 * @param {object} cfg
 * @param {{ assets?: { assets?: object[] } }} [opts]
 */
export function buildWorkspaceFlow(root, cfg, opts = {}) {
  const config = normalizeProjectsConfig(cfg || {});
  const assets = Array.isArray(opts.assets?.assets) ? opts.assets.assets : [];
  const projects = [];
  for (const p of activeProjects(config)) {
    const sig = scanProjectSignals(absOf(root, p.path), { name: p.name, type: p.type });
    const skills = assets
      .filter((a) => String(a.project || '').toLowerCase() === p.name.toLowerCase())
      .map((a) => a.title)
      .slice(0, 8);
    projects.push({
      ...p,
      role: p.role || sig.role,
      framework: p.framework || sig.framework,
      db: p.db || sig.db,
      prefix: p.prefix || sig.prefix,
      port: p.port || sig.port,
      portSource: p.portSource || sig.portSource || '',
      portFile: p.portFile || sig.portFile || '',
      technologies: Array.isArray(p.technologies) && p.technologies.length ? p.technologies : sig.technologies,
      layer: p.layer || sig.layer,
      devCommand: p.devCommand || sig.devCommand,
      testCommand: p.testCommand || sig.testCommand,
      endpoints: Array.isArray(p.endpoints) && p.endpoints.length ? p.endpoints : sig.endpoints,
      aliases: Array.isArray(p.aliases) && p.aliases.length ? p.aliases : sig.aliases,
      envLinks: Array.isArray(p.envLinks) && p.envLinks.length ? p.envLinks : sig.envLinks,
      design: p.design && p.design.entities?.length ? p.design : sig.design,
      lambdas: sig.lambdas,
      proxies: sig.proxies,
      skills,
    });
  }

  for (const extra of scanComposeServices(root)) {
    if (projects.some((p) => p.type === 'database')) continue;
    uniqPush(
      projects,
      {
        id: slugify(extra.name),
        name: extra.name,
        path: '.',
        type: 'database',
        status: 'active',
        enabled: true,
        role: extra.role,
        db: extra.db,
        port: extra.port,
        layer: 'data',
        technologies: [extra.db],
        skills: [],
        endpoints: [],
        lambdas: [],
        proxies: [],
        framework: '',
        prefix: '',
        entryPoint: '',
      },
      (x) => x.name.toLowerCase(),
    );
  }

  for (const p of [...projects]) {
    if (!p.lambdas?.length) continue;
    const cloudName = `${p.name}-lambda`;
    if (projects.some((x) => x.name === cloudName || x.type === 'cloud')) continue;
    projects.push({
      id: slugify(cloudName),
      name: cloudName,
      path: p.path,
      type: 'cloud',
      status: 'active',
      enabled: true,
      role: 'cloud / lambda',
      layer: 'cloud',
      technologies: ['serverless', ...p.lambdas.slice(0, 4)],
      skills: [],
      endpoints: p.lambdas.map((n) => ({ method: 'ANY', path: n, via: 'lambda' })),
      lambdas: p.lambdas,
      proxies: [],
      framework: '',
      prefix: '',
      db: '',
      entryPoint: '',
    });
  }

  const relationships = [];
  const seenRel = new Set();
  const pushRel = (from, to, type, endpoint, via, tech) => {
    if (!from || !to || from === to) return;
    const key = `${from}|${to}|${via || type}|${endpoint || ''}`;
    if (seenRel.has(key)) return;
    seenRel.add(key);
    relationships.push({ from, to, type, endpoint: endpoint || '', via: via || '', tech: tech || '' });
  };

  for (const rel of activeRelationships(config)) {
    pushRel(rel.from, rel.to, rel.type, rel.endpoint, rel.via || 'direct', rel.tech || '');
  }
  for (const p of projects) {
    for (const proxy of p.proxies || []) {
      const target = projects.find((o) => o.port && proxy.port && Number(o.port) === Number(proxy.port));
      if (target) {
        pushRel(p.name, target.name, 'proxy', `${proxy.path} → ${proxy.target}`, 'proxy', p.framework || 'http');
      }
    }
    if (p.db) {
      const dbNode = projects.find((o) => o.type === 'database' || o.name === p.db);
      if (dbNode) pushRel(p.name, dbNode.name, 'db', p.db, 'db', p.db);
    }
    if (p.lambdas?.length) {
      const cloud = projects.find((o) => o.type === 'cloud' && o.path === p.path);
      if (cloud) pushRel(p.name, cloud.name, 'lambda', p.lambdas.slice(0, 3).join(', '), 'lambda', 'serverless');
    }
  }

  const layers = {
    presentation: projects.filter((p) => p.layer === 'presentation').map((p) => p.name),
    api: projects.filter((p) => p.layer === 'api').map((p) => p.name),
    data: projects.filter((p) => p.layer === 'data').map((p) => p.name),
    cloud: projects.filter((p) => p.layer === 'cloud').map((p) => p.name),
    auth: projects.filter((p) => p.layer === 'auth').map((p) => p.name),
    async: projects.filter((p) => p.layer === 'async').map((p) => p.name),
  };

  const e2e = buildE2e(projects, relationships);
  const how = buildHowTo(projects, relationships);

  return {
    version: 1,
    generatorVersion: FLOW_GENERATOR_VERSION,
    mode: projects.length > 1 ? 'cross' : 'single',
    projects,
    relationships,
    layers,
    e2e,
    how,
    llmReviewed: opts.llmReviewed === true,
  };
}

function buildE2e(projects, relationships) {
  const front = projects.find((p) => p.layer === 'presentation');
  const api = projects.find((p) => p.layer === 'api');
  const data = projects.find((p) => p.layer === 'data' || p.type === 'database');
  const cloud = projects.find((p) => p.layer === 'cloud');
  const schema = projects.find((p) => p.design?.entities?.length)?.design;
  if (!front && !api && !relationships.length) return [];
  const steps = [];
  steps.push('Actor usa el sistema');
  if (front) steps.push(`${front.name} (${front.framework || 'ui'}) recibe la acción`);
  const proxy = relationships.find((r) => r.via === 'proxy');
  if (proxy) steps.push(`${proxy.from} llama ${proxy.endpoint || 'proxy'} → ${proxy.to}`);
  else if (relationships[0]) {
    steps.push(`${relationships[0].from} → ${relationships[0].to} (${relationships[0].endpoint || relationships[0].via || 'link'})`);
  }
  if (api) {
    const sample = (api.endpoints || []).find((e) => e.via !== 'proxy') || (api.endpoints || [])[0];
    steps.push(`${api.name} atiende ${sample ? `${sample.method} ${sample.path}` : (api.prefix || 'HTTP')}`);
  }
  if (cloud) steps.push(`${cloud.name} (lambda/serverless)`);
  if (data || schema) {
    const tables = (schema?.entities || []).map((e) => e.name).slice(0, 6).join(', ');
    const dbName = data ? `${data.name} (${data.db || 'db'})` : `${schema.schemaKind} ${schema.schemaFile}`;
    steps.push(`Persistencia en ${dbName}${tables ? `: ${tables}` : ''}`);
  }
  steps.push('Respuesta vuelve al actor por el mismo camino');
  return [{ name: 'request-e2e', steps }];
}

function buildHowTo(projects, relationships) {
  const front = projects.filter((p) => p.layer === 'presentation');
  const api = projects.filter((p) => p.layer === 'api');
  const data = projects.filter((p) => p.layer === 'data');
  const add = [];
  const touch = [];
  const skip = ['node_modules', 'dist', 'build', '.next', 'coverage', 'secretos en .env'];
  if (front.length) {
    add.push(`UI / pantalla nueva: ${front.map((p) => `${p.name}${p.framework ? ` (${p.framework})` : ''}`).join(', ')}.`);
    touch.push(...front.map((p) => p.name));
  }
  if (api.length) {
    add.push(`API / caso de uso: ${api.map((p) => `${p.name} prefix ${p.prefix || '/'} `).join(', ')}.`);
    touch.push(...api.map((p) => p.name));
  }
  if (data.length) {
    add.push(`Persistencia: ${data.map((p) => `${p.name} (${p.db || 'db'})`).join(', ')} — solo si cambia el contrato de datos.`);
  }
  if (relationships.some((r) => r.via === 'proxy')) {
    add.push('Si el path público cambia, actualizá el proxy del front (vite/webpack/next) además del backend.');
  }
  const local = projects
    .filter((p) => p.devCommand || p.port)
    .map((p) => `${p.name}: ${p.devCommand || '(sin script)'} ${p.port ? `→ :${p.port}` : ''}`.trim());
  const test = projects
    .filter((p) => p.testCommand)
    .map((p) => `${p.name}: ${p.testCommand}`);
  if (!test.length) test.push('No hay script de test en los manifiestos; agregá uno por paquete antes de dar un flujo por cerrado.');
  return {
    addFeature: add,
    touch: [...new Set(touch)],
    ignore: skip,
    local,
    test,
  };
}

export function flowToProjectsConfig(flow, baseCfg) {
  const cfg = normalizeProjectsConfig(baseCfg || {});
  const byPath = new Map(cfg.projects.map((p) => [String(p.path), p]));
  for (const p of flow.projects) {
    const cur = byPath.get(p.path) || cfg.projects.find((x) => x.name === p.name);
    if (!cur) {
      if (p.type === 'database' || p.type === 'cloud') {
        cfg.projects.push(normalizeProjectsConfig({ projects: [p] }).projects[0]);
      }
      continue;
    }
    cur.role = cur.role || p.role;
    cur.framework = cur.framework || p.framework;
    cur.db = cur.db || p.db;
    cur.prefix = cur.prefix || p.prefix;
    cur.port = cur.port || p.port;
    cur.portSource = cur.portSource || p.portSource;
    cur.portFile = cur.portFile || p.portFile;
    cur.layer = cur.layer || p.layer;
    cur.devCommand = cur.devCommand || p.devCommand;
    cur.testCommand = cur.testCommand || p.testCommand;
    cur.technologies = cur.technologies?.length ? cur.technologies : p.technologies;
    cur.endpoints = cur.endpoints?.length ? cur.endpoints : p.endpoints;
    cur.aliases = cur.aliases?.length ? cur.aliases : p.aliases;
    cur.envLinks = cur.envLinks?.length ? cur.envLinks : p.envLinks;
  }
  for (const rel of flow.relationships) {
    const exists = cfg.relationships.some((r) => r.from === rel.from && r.to === rel.to);
    if (!exists) cfg.relationships.push(rel);
    else {
      const r = cfg.relationships.find((x) => x.from === rel.from && x.to === rel.to);
      if (r && !r.via && rel.via) r.via = rel.via;
      if (r && !r.tech && rel.tech) r.tech = rel.tech;
      if (r && rel.endpoint && (!r.endpoint || r.endpoint.endsWith('/api'))) r.endpoint = rel.endpoint;
    }
  }
  return normalizeProjectsConfig(cfg);
}

export function buildLayersMermaid(flow) {
  const lines = ['flowchart TB'];
  const order = [
    ['presentation', 'Presentación'],
    ['api', 'API'],
    ['auth', 'Auth'],
    ['async', 'Async'],
    ['cloud', 'Cloud / lambda'],
    ['data', 'Datos'],
  ];
  for (const [key, title] of order) {
    const names = flow.layers[key] || [];
    if (!names.length) continue;
    lines.push(`  subgraph ${mermaidId(key)}["${mermaidLabel(title)}"]`);
    for (const name of names) {
      const p = flow.projects.find((x) => x.name === name);
      const label = [
        p?.port ? `${name}:${p.port}` : name,
        p?.framework,
        p?.prefix,
        p?.db,
      ].filter(Boolean).join(' · ');
      lines.push(`    ${mermaidId(name)}["${mermaidLabel(label)}"]`);
    }
    lines.push('  end');
  }
  for (const rel of flow.relationships) {
    const lab = [rel.via, rel.endpoint || rel.type].filter(Boolean).join(' ');
    lines.push(`  ${mermaidId(rel.from)} -->${lab ? `|"${mermaidLabel(lab)}"|` : ''} ${mermaidId(rel.to)}`);
  }
  return `${lines.join('\n')}\n`;
}

export function buildEndpointsMermaid(flow) {
  const lines = ['flowchart LR'];
  for (const p of flow.projects) {
    const bits = [p.role || p.type, p.framework, p.prefix, p.port ? `:${p.port}` : ''].filter(Boolean);
    lines.push(`  ${mermaidId(p.name)}["${mermaidLabel(`${p.name} · ${bits.join(' ')}`)}"]`);
  }
  for (const rel of flow.relationships) {
    const lab = [rel.via || rel.type, rel.endpoint].filter(Boolean).join(' ');
    lines.push(`  ${mermaidId(rel.from)} -->${lab ? `|"${mermaidLabel(lab)}"|` : ''} ${mermaidId(rel.to)}`);
  }
  return `${lines.join('\n')}\n`;
}

export function buildE2eMermaid(flow) {
  const e = flow.e2e[0];
  if (!e) return 'sequenceDiagram\n  Note over U: sin flujo detectado\n';
  const lines = ['sequenceDiagram', '  actor U as Usuario'];
  const parts = e.steps.filter((s) => s !== 'Usuario');
  const ids = [];
  parts.forEach((step, i) => {
    const id = `P${i}`;
    ids.push({ id, step });
    lines.push(`  participant ${id} as ${mermaidLabel(step).slice(0, 24)}`);
  });
  if (!ids.length) return `${lines.join('\n')}\n`;
  lines.push(`  U->>${ids[0].id}: usa`);
  for (let i = 0; i < ids.length - 1; i += 1) {
    lines.push(`  ${ids[i].id}->>${ids[i + 1].id}: ${i === 0 ? 'request' : 'datos'}`);
  }
  for (let i = ids.length - 1; i > 0; i -= 1) {
    lines.push(`  ${ids[i].id}-->>${ids[i - 1].id}: respuesta`);
  }
  lines.push(`  ${ids[0].id}-->>U: UI`);
  return `${lines.join('\n')}\n`;
}

export function buildWorkspaceDiagrams(flow) {
  const nodes = flow.projects.slice(0, 16).map((p) => ({
    id: slugify(p.name),
    type: p.layer === 'data' ? 'database' : p.layer === 'cloud' ? 'cloud' : p.layer === 'presentation' ? 'frontend' : 'backend',
    label: [p.name, p.port && `:${p.port}`, p.framework, p.prefix, p.db].filter(Boolean).join(' '),
    path: p.path,
  }));
  const edges = flow.relationships.map((r, i) => ({
    id: `e${i + 1}`,
    from: slugify(r.from),
    to: slugify(r.to),
    label: [r.via, r.endpoint || r.type].filter(Boolean).join(' ').slice(0, 80),
  }));
  const arch = {
    schemaVersion: 1,
    kind: 'afn-diagram-ir',
    diagramType: 'architecture',
    slug: 'workspace-flujo',
    meta: { title: 'Flujo del workspace', sourceBacked: true, qualityProfile: 'cross' },
    nodes,
    edges,
  };
  const layers = {
    schemaVersion: 1,
    kind: 'afn-diagram-ir',
    diagramType: 'architecture',
    slug: 'workspace-capas',
    meta: { title: 'Capas (presentación · api · datos · cloud)', sourceBacked: true },
    nodes,
    edges,
    mermaid: buildLayersMermaid(flow),
  };
  const endpoints = {
    schemaVersion: 1,
    kind: 'afn-diagram-ir',
    diagramType: 'architecture',
    slug: 'workspace-endpoints',
    meta: { title: 'Quién llama qué (proxy / endpoint / lambda)', sourceBacked: true },
    nodes,
    edges,
    mermaid: buildEndpointsMermaid(flow),
  };
  const e2e = {
    schemaVersion: 1,
    kind: 'afn-diagram-ir',
    diagramType: 'sequence',
    slug: 'workspace-e2e',
    meta: { title: 'Ejemplo end-to-end', sourceBacked: true },
    nodes,
    edges,
    mermaid: buildE2eMermaid(flow),
  };
  return [
    { ir: arch, mermaid: irToMermaid(arch) },
    { ir: layers, mermaid: layers.mermaid },
    { ir: endpoints, mermaid: endpoints.mermaid },
    { ir: e2e, mermaid: e2e.mermaid },
  ];
}

export function persistWorkspaceFlow(root, cfg, opts = {}) {
  const flow = buildWorkspaceFlow(root, cfg, opts);
  const dir = afnPath(root, 'diagrams');
  fs.mkdirSync(dir, { recursive: true });
  const jsonFile = path.join(dir, 'workspace-flow.json');
  const mdFile = path.join(dir, 'workspace-flow.md');
  const readmeFile = path.join(dir, 'arquitectura.md');
  const md = workspaceFlowMarkdown(flow);
  fs.writeFileSync(jsonFile, `${JSON.stringify(flow, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdFile, md, 'utf8');
  fs.writeFileSync(readmeFile, md, 'utf8');
  return { ok: true, flow, jsonFile, mdFile, readmeFile, config: flowToProjectsConfig(flow, cfg) };
}

export function loadWorkspaceFlow(root) {
  try {
    return JSON.parse(fs.readFileSync(afnPath(root, 'diagrams', 'workspace-flow.json'), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Hay mapa de arquitectura en disco (no regenerar salvo comando explícito).
 * @param {string} root
 */
export function architectureExists(root) {
  try {
    fs.accessSync(afnPath(root, 'diagrams', 'workspace-flow.json'));
    fs.accessSync(path.join(afnPath(root, 'diagrams'), 'workspace-capas.architecture.json'));
    return true;
  } catch {
    return false;
  }
}
