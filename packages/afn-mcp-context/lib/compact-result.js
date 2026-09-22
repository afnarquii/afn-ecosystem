/**
 * Respuestas MCP chicas: el JSON completo del flujo vive en disco
 * (`.afn/diagrams/workspace-flow.json`, `projects.json`, `ARQUITECTURA.md`).
 */

import { FLOW_GENERATOR_VERSION } from './version.js';

export function compactProject(p) {
  if (!p || typeof p !== 'object') return p;
  return {
    name: p.name,
    path: p.path,
    type: p.type || '',
    role: p.role || '',
    framework: p.framework || '',
    port: p.port || null,
    portSource: p.portSource || '',
    prefix: p.prefix || '',
  };
}

export function compactRel(r) {
  if (!r || typeof r !== 'object') return r;
  return {
    from: r.from,
    to: r.to,
    via: r.via || r.type || '',
    endpoint: r.endpoint || '',
  };
}

export function compactDiagramResult(r = {}) {
  const flow = r.flow || {};
  const cfg = r.config || {};
  const projects = flow.projects || cfg.projects || [];
  const rels = flow.relationships || cfg.relationships || [];
  return {
    ok: r.ok !== false,
    skipped: r.skipped === true,
    wrote: r.wrote === true,
    root: r.root || '',
    readme: r.readmeFile || r.readme || '',
    llmReviewed: r.llmReviewed === true,
    needsLlm: false,
    projectNames: projects.map((p) => p.name).filter(Boolean).slice(0, 40),
    relationshipCount: Array.isArray(rels) ? rels.length : 0,
    hint: r.hint || '',
  };
}

export function compactEvidence(ev = {}) {
  return {
    ok: ev.ok !== false,
    llmReviewed: ev.llmReviewed === true,
    needsLlm: ev.needsLlm === true,
    filesToRead: ev.filesToRead || [],
    unknowns: ev.unknowns || [],
    projects: (ev.projects || []).map((p) => ({
      name: p.name,
      path: p.path,
      type: p.type,
      port: p.port || null,
      portSource: p.portSource || '',
      prefix: p.prefix || '',
      proxies: p.proxies || [],
      unknowns: p.unknowns || [],
    })),
    relationships: (ev.relationships || []).map(compactRel),
    prompt: ev.prompt,
  };
}

export function compactBootstrap(r = {}) {
  const origin = r.origin?.origin || {};
  return {
    ok: r.ok !== false,
    skipped: r.skipped === true,
    wrote: r.wrote === true,
    root: r.root || '',
    reason: r.reason || '',
    architectureLocked: r.architectureLocked === true,
    projectCount: Array.isArray(r.config?.projects) ? r.config.projects.length : undefined,
    diagramSkipped: r.diagram ? r.diagram.skipped !== false : true,
    origin: r.origin
      ? {
          skipped: r.origin.skipped === true,
          file: '.afn/db-connections.json',
          session: '.afn/db-connection.json',
          count: r.origin.count || (Array.isArray(r.origin.origins) ? r.origin.origins.length : 1),
          engine: origin.engine || '',
          name: origin.name || '',
          host: origin.host || '',
          database: origin.database || '',
          names: (r.origin.origins || []).map((o) => o.name || o.id).filter(Boolean).slice(0, 12),
        }
      : undefined,
    hint:
      r.hint
      || (r.skipped
        ? 'Arquitectura en disco. No regenerar. Abrí el dashboard o pedí regenerá la arquitectura si cambió el sistema.'
        : 'Inventario creado. ARQUITECTURA.md en la raíz. Orígenes: .afn/db-connections.json. No completes con LLM salvo pedido explícito.'),
  };
}

export function compactCommit(r = {}) {
  return {
    ok: r.ok !== false,
    committed: r.committed === true,
    llmReviewed: r.llmReviewed === true,
    rejected: r.rejected || [],
    readme: r.readme || 'ARQUITECTURA.md',
    projects: (r.projects || []).map((p) => ({
      name: p.name,
      path: p.path,
      port: p.port || null,
      portSource: p.portSource || '',
    })),
    relationships: (r.relationships || []).map(compactRel),
    hint: r.hint || '',
  };
}

/** No devolver el HTML de _tmp: Kiro lo abre como file:// y no hay SQL. */
export function compactDashboard(r = {}) {
  const http = String(r.url || '').startsWith('http') ? r.url : '';
  return {
    ok: r.ok !== false,
    version: r.version || FLOW_GENERATOR_VERSION,
    url: http,
    port: r.port || null,
    server: r.server === true,
    opened: r.opened === true,
    hint:
      r.hint
      || (http
        ? `Abrí exactamente esta URL en el navegador: ${http}`
        : 'Corré node …/index.js dashboard (sin Kiro). Tiene que ser http://127.0.0.1'),
  };
}
