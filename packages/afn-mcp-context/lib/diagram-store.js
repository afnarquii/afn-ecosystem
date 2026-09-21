import fs from 'node:fs';
import path from 'node:path';
import { afnPath } from './paths.js';
import { normalizeProjectsConfig } from './projects-policy.js';
import { irToMermaid } from './diagram-ir.js';
import { persistWorkspaceFlow, buildWorkspaceDiagrams, architectureExists, loadWorkspaceFlow } from './workspace-flow.js';
import { withPreservedMemory } from './cerebro.js';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} root
 */
export function listDiagramIrs(root) {
  const dir = afnPath(root, 'diagrams');
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith('.json') && !n.includes('.delta.') && !n.includes('.deliver.') && n !== 'workspace-flow.json');
  } catch {
    return [];
  }
  const out = [];
  for (const name of names.slice(0, 24)) {
    const ir = readJson(path.join(dir, name));
    if (!ir || typeof ir !== 'object' || ir.kind === 'workspace-flow') continue;
    out.push({
      file: name,
      slug: ir.slug || name.replace(/\.architecture\.json$/i, '').replace(/\.json$/i, ''),
      title: ir.meta?.title || ir.slug || name,
      type: ir.diagramType || 'architecture',
      mermaid: irToMermaid(ir),
      nodes: Array.isArray(ir.nodes) ? ir.nodes.length : 0,
      edges: Array.isArray(ir.edges) ? ir.edges.length : 0,
    });
  }
  return out;
}

function writeIr(dir, built, recreate) {
  const jsonFile = path.join(dir, `${built.ir.slug}.architecture.json`);
  const mdFile = path.join(dir, `${built.ir.slug}.architecture.md`);
  if (!recreate && fs.existsSync(jsonFile)) {
    return { ok: true, skipped: true, slug: built.ir.slug, file: jsonFile };
  }
  const ir = { ...built.ir, mermaid: built.mermaid };
  fs.writeFileSync(jsonFile, `${JSON.stringify(ir, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdFile, `# ${ir.meta?.title || ir.slug}\n\n\`\`\`mermaid\n${built.mermaid}\`\`\`\n`, 'utf8');
  return { ok: true, skipped: false, wrote: true, slug: ir.slug, file: jsonFile };
}

/**
 * Persiste flujo + capas + endpoints + e2e (gráficas que reflejan el mapa cross-project).
 * No pisa un IR existente salvo recreate.
 * No toca el cerebro (`.afn/memory/cerebro.json`, facts, MEMORY.md).
 * @param {string} root
 * @param {object} [cfg]
 * @param {{ recreate?: boolean, assets?: object }} [opts]
 */
export function persistWorkspaceFlowDiagram(root, cfg, opts = {}) {
  return withPreservedMemory(root, () => persistWorkspaceFlowDiagramUnprotected(root, cfg, opts));
}

function persistWorkspaceFlowDiagramUnprotected(root, cfg, opts = {}) {
  const config = cfg || normalizeProjectsConfig(readJson(afnPath(root, 'projects.json')) || {});
  if (!opts.recreate && architectureExists(root)) {
    return {
      ok: true,
      skipped: true,
      wrote: false,
      flow: loadWorkspaceFlow(root),
      config,
      hint: 'La arquitectura ya existe. Para regenerarla usá el comando (recreate=true). No gasta el LLM.',
    };
  }
  const persisted = persistWorkspaceFlow(root, config, opts);
  if (!persisted.ok) return persisted;
  const dir = afnPath(root, 'diagrams');
  fs.mkdirSync(dir, { recursive: true });
  const maps = buildWorkspaceDiagrams(persisted.flow);
  const files = maps.map((built) => writeIr(dir, built, opts.recreate === true));
  const wrote = files.some((f) => f.wrote);
  const llmReviewed = persisted.flow?.llmReviewed === true;
  return {
    ok: true,
    skipped: !wrote,
    wrote,
    files,
    flow: persisted.flow,
    config: persisted.config,
    mermaid: maps[0]?.mermaid || '',
    ir: maps[0]?.ir || null,
    llmReviewed,
    needsLlm: !llmReviewed,
    hint: llmReviewed
      ? 'Arquitectura verificada (LLM + disco).'
      : 'Inventario de disco (sin inventar flechas). El LLM debe leer filesToRead y afn_architecture_commit.',
  };
}
