/**
 * Respuestas MCP chicas: el JSON completo del flujo vive en disco
 * (`.afn/diagrams/workspace-flow.json`, `projects.json`, `ARQUITECTURA.md`).
 */

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
  return {
    ok: r.ok !== false,
    skipped: r.skipped === true,
    wrote: r.wrote === true,
    root: r.root || '',
    reason: r.reason || '',
    architectureLocked: r.architectureLocked === true,
    projectCount: Array.isArray(r.config?.projects) ? r.config.projects.length : undefined,
    diagramSkipped: r.diagram ? r.diagram.skipped !== false : true,
    hint:
      r.hint
      || (r.skipped
        ? 'Arquitectura en disco. No regenerar. Abrí el dashboard o pedí regenerá la arquitectura si cambió el sistema.'
        : 'Inventario creado. ARQUITECTURA.md en la raíz. No completes con LLM salvo pedido explícito.'),
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
