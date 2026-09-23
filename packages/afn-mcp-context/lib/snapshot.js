import fs from 'node:fs';
import path from 'node:path';
import { afnPath, MAX_SNAPSHOT_CHARS } from './paths.js';
import { redactSecrets } from './redact.js';
import { activeProjects, activeRelationships, normalizeProjectsConfig } from './projects-policy.js';
import { loadFacts, readMemoryMarkdown } from './memory.js';
import { getMemContext } from './cerebro.js';
import { isWeakProjectsMap } from './detect-projects.js';
import { loadAgentAssets } from './agent-assets.js';
import { loadWorkspaceFlow } from './workspace-flow.js';
import { architectureReadmeBrief, workspaceFlowMarkdown } from './architecture-readme.js';
import { listTaskNotes } from './task-notes.js';
import { structuralDrift } from './architecture-llm.js';
import { isAfnEcosystemCatalog } from './resolve-root.js';
import { aggregateCatalogMemory } from './catalog-registry.js';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Lo que un LLM usa al preguntar: README de nombres, rutas, conexiones y hechos.
 * @param {string} root
 */
export function buildAskBrief(root) {
  const flow = loadWorkspaceFlow(root);
  if (flow) return architectureReadmeBrief(flow, 1600);
  const disk = readText(path.join(root, 'ARQUITECTURA.md'))
    || readText(afnPath(root, 'ARQUITECTURA.md'))
    || readText(afnPath(root, 'diagrams', 'arquitectura.md'))
    || readText(afnPath(root, 'diagrams', 'workspace-flow.md'));
  if (disk) return disk.slice(0, 1600);
  return '';
}

/**
 * Pista corta para PromptSubmit. No inyectar el snapshot completo (gasta tokens en cada mensaje).
 * @param {string} root
 */
export function buildPromptHint(root) {
  const md = [
    'AFN: mapa en ARQUITECTURA.md. Cerebro en .afn/memory/cerebro.json.',
    'SIN tokens de chat: node …/afn-mcp-context/index.js dashboard | note-save archivo.md | mem-search texto.',
    'No abras el dashboard ni guardes notes ni busques cerebro por el chat. No regeneres arquitectura.',
  ].join('\n');
  return { ok: true, markdown: `${md}\n`, root: root || '', hint: true };
}
export function buildSnapshot(root) {
  if (isAfnEcosystemCatalog(root)) {
    const pack = aggregateCatalogMemory(root);
    const lines = [
      '=== AFN CATÁLOGO (memoria global; cada producto conserva la suya) ===',
      `Catálogo: \`${root}\``,
      'Acá se lee la memoria de los proyectos registrados. Un producto no ve la de otro.',
      '',
    ];
    if (!pack.projects.length) lines.push('_Ningún producto registrado todavía. En cada uno: setup kiro._', '');
    for (const p of pack.projects) {
      lines.push(`## ${p.name}`, `\`${p.root}\``);
      if (!p.observations.length) lines.push('_Sin hechos._');
      for (const o of p.observations) lines.push(`- ${String(o.title || o.text || '').slice(0, 180)}`);
      lines.push('');
    }
    return { ok: true, markdown: lines.join('\n'), missing: false, weak: false, mode: 'catalog', activeCount: pack.projects.length, relCount: 0 };
  }
  const lines = [
    '=== AFN CONTEXT (README de arquitectura — no reexplores el repo si esto alcanza) ===',
    'Usá nombres, rutas y quién llama a quién. Completo: `ARQUITECTURA.md` en la raíz del workspace.',
    '',
  ];

  const pj = readJson(afnPath(root, 'projects.json'));
  if (!pj) {
    lines.push('_Sin `.afn/projects.json`. Corré bootstrap (SessionStart / `afn_bootstrap`)._', '');
    return { ok: false, markdown: lines.join('\n').slice(0, MAX_SNAPSHOT_CHARS), missing: true };
  }

  const cfg = normalizeProjectsConfig(pj);
  const active = activeProjects(cfg);
  const rels = activeRelationships(cfg);
  const weak = isWeakProjectsMap(cfg);
  const flow = loadWorkspaceFlow(root);
  lines.push(`Workspace: \`${root}\``);
  const drift = structuralDrift(root);
  if (!flow) {
    lines.push('Sin mapa de arquitectura. Bootstrap lo crea. No llames afn_diagram_generate en cada turno.');
  } else if (drift.drifted) {
    const bits = [...(drift.added || []).map((n) => `+${n}`), ...(drift.removed || []).map((n) => `-${n}`)].join(', ');
    lines.push(`Cambio estructural (${bits}). Regenerá la arquitectura **solo** si el usuario lo pide. No lo hagas al abrir el dashboard.`);
  } else {
    lines.push(
      flow.llmReviewed === true
        ? 'Arquitectura verificada. Documento: `ARQUITECTURA.md`. No regeneres salvo pedido explícito o cambio estructural.'
        : 'Inventario en disco (`ARQUITECTURA.md`). No llames afn_diagram_generate / afn_architecture_commit salvo «regenerá la arquitectura».',
    );
  }
  lines.push(`Proyectos activos: **${active.length}**` + (cfg.ignorePaths.length ? ` · ignorados: ${cfg.ignorePaths.join(', ')}` : '') + (cfg.architectureLocked ? ' · arquitectura cerrada' : ''));
  if (weak) {
    lines.push('_Mapa pobre (un proyecto genérico tipo mcp-context). Corré `afn_bootstrap` con force desde el workspace del producto, no desde afn-ecosystem._');
  }
  lines.push('');
  const brief = buildAskBrief(root) || (flow ? workspaceFlowMarkdown(flow).slice(0, 1600) : '');
  if (brief) lines.push(brief, '');

  const assets = loadAgentAssets(root);
  if (Array.isArray(assets.assets) && assets.assets.length) {
    const kinds = [...new Set(assets.assets.map((a) => a.kind))].slice(0, 6).join(', ');
    lines.push(`Reglas/skills (${assets.assets.length}): ${kinds}`);
    lines.push('');
  }

  const noteIndex = listTaskNotes(root);
  if (noteIndex.length) {
    lines.push(`Entregas wiki (${noteIndex.length}): ${noteIndex.slice(0, 8).map((n) => `${n.slug} [${n.status}]`).join(', ')}. Completo: dashboard → Notas.`);
    lines.push('');
  }

  try {
    if (fs.existsSync(afnPath(root, 'diagrams', 'datos.md')) || fs.existsSync(afnPath(root, 'db-connection.json')) || fs.existsSync(afnPath(root, 'db-connections.json'))) {
      lines.push('Orígenes en `.afn/db-connections.json` (los escribe el init; puede haber varios). Sesión activa: `db-connection.json`. No conectes en cada turno. Si el usuario pide el esquema: elegí el origen → MCP de BD → `afn_schema_commit`.');
      lines.push('');
    }
  } catch {
    /* */
  }

  const ctx = readJson(afnPath(root, 'context.json'));
  if (ctx && typeof ctx === 'object') {
    const safe = redactSecrets(ctx);
    lines.push('--- context.json (redactado, recorte) ---');
    lines.push(JSON.stringify(safe, null, 2).slice(0, 400));
    lines.push('');
  }

  const memCtx = getMemContext(root, { limit: 5 });
  if (memCtx.observations.length) {
    lines.push('Trabajo reciente (cerebro):');
    for (const o of memCtx.observations) {
      lines.push(`- ${String(o.title || o.text || '').slice(0, 180)}`);
    }
    lines.push('');
  } else {
    const mem = readMemoryMarkdown(root).trim();
    const facts = loadFacts(root).facts.slice(-6);
    if (facts.length) {
      lines.push('Hechos recientes:');
      for (const f of facts.reverse()) {
        lines.push(`- ${String(f.text || '').slice(0, 220)}`);
      }
      lines.push('');
    } else if (mem) {
      lines.push(mem.slice(0, 400), '');
    }
  }

  const md = lines.join('\n').slice(0, MAX_SNAPSHOT_CHARS);
  return { ok: !weak, markdown: md, missing: false, weak, activeCount: active.length, relCount: rels.length };
}

/**
 * @param {string} root
 */
export function doctorAfn(root) {
  const checks = [];
  const exists = (rel) => {
    try {
      fs.accessSync(afnPath(root, ...rel.split('/')));
      return true;
    } catch {
      return false;
    }
  };
  checks.push({ id: 'afn-dir', ok: exists(''), detail: '.afn/' });
  checks.push({ id: 'projects', ok: exists('projects.json'), detail: '.afn/projects.json' });
  checks.push({ id: 'memory-md', ok: exists('MEMORY.md'), detail: '.afn/MEMORY.md' });
  const snap = buildSnapshot(root);
  checks.push({
    id: 'diagrams',
    ok: (snap.activeCount || 0) < 1 || exists('diagrams'),
    detail: exists('diagrams') ? '.afn/diagrams' : 'sin .afn/diagrams (bootstrap genera el flujo)',
  });
  checks.push({
    id: 'mapa-rico',
    ok: !snap.weak && (snap.activeCount || 0) >= 1,
    detail: snap.weak ? 'projects.json genérico (mcp-context) — re-bootstrap desde el workspace' : 'mapa con repos reales',
  });
  return {
    ok: checks.every((c) => c.ok) && !snap.missing,
    root,
    checks,
    snapshotChars: snap.markdown.length,
    activeCount: snap.activeCount || 0,
  };
}
