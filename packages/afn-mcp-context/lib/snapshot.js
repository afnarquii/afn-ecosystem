import fs from 'node:fs';
import { afnPath, MAX_SNAPSHOT_CHARS } from './paths.js';
import { redactSecrets } from './redact.js';
import { activeProjects, activeRelationships, normalizeProjectsConfig } from './projects-policy.js';
import { loadFacts, readMemoryMarkdown } from './memory.js';
import { getMemContext } from './cerebro.js';
import { isWeakProjectsMap } from './detect-projects.js';
import { listDiagramIrs } from './diagram-store.js';
import { loadAgentAssets } from './agent-assets.js';
import { loadWorkspaceFlow } from './workspace-flow.js';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Bloque compacto para inyectar al prompt (ahorro de tokens).
 * @param {string} root
 */
export function buildSnapshot(root) {
  const lines = [
    '=== AFN CONTEXT (mapa del producto — no reexplores el repo si esto alcanza) ===',
    'Usá este bloque. No listés el árbol salvo que falte un path concreto.',
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
  lines.push(`Workspace: \`${root}\``);
  const flow = loadWorkspaceFlow(root);
  if (flow?.llmReviewed !== true) {
    lines.push('ARQUITECTURA PENDIENTE: `afn_architecture_evidence` → leer filesToRead → `afn_architecture_commit`. No inventes puertos, prefix, flechas ni BDs.');
  }
  lines.push(`Proyectos activos: **${active.length}**` + (cfg.ignorePaths.length ? ` · ignorados: ${cfg.ignorePaths.join(', ')}` : '') + (cfg.architectureLocked ? ' · arquitectura cerrada' : ''));
  if (weak) {
    lines.push('_Mapa pobre (un proyecto genérico tipo mcp-context). Corré `afn_bootstrap` con force desde el workspace del producto, no desde afn-ecosystem._');
  }
  for (const p of active) {
    const port = p.port ? `:${p.port}` : '';
    const extra = [p.role || p.type, p.framework, p.db, p.prefix, port].filter(Boolean).join(' · ');
    lines.push(`- **${p.name}** (${extra}) \`${p.path}\`${p.entryPoint ? ` · ${p.entryPoint}` : ''}`);
  }
  if (!active.length) lines.push('- _(ninguno activo)_');
  lines.push('');
  if (rels.length) {
    lines.push('Flujo:');
    for (const r of rels) {
      lines.push(`- ${r.from} → ${r.to}` + (r.type ? ` · ${r.type}` : '') + (r.endpoint ? ` \`${r.endpoint}\`` : ''));
    }
    lines.push('');
  }

  const diagrams = listDiagramIrs(root);
  if (diagrams.length) {
    lines.push(`Diagramas (.afn/diagrams): ${diagrams.map((d) => d.slug).join(', ')}`);
    lines.push('Para verlos: `afn_dashboard` (se abren en esa página). Recrear flujo: `afn_diagram_generate` recreate.');
    lines.push('');
  }

  const assets = loadAgentAssets(root);
  if (Array.isArray(assets.assets) && assets.assets.length) {
    const kinds = [...new Set(assets.assets.map((a) => a.kind))].slice(0, 6).join(', ');
    lines.push(`Reglas/skills (${assets.assets.length}): ${kinds}`);
    lines.push('');
  }

  const ctx = readJson(afnPath(root, 'context.json'));
  if (ctx && typeof ctx === 'object') {
    const safe = redactSecrets(ctx);
    lines.push('--- context.json (redactado, recorte) ---');
    lines.push(JSON.stringify(safe, null, 2).slice(0, 800));
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
      lines.push(mem.slice(0, 600), '');
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
