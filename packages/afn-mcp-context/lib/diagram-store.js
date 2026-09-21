import fs from 'node:fs';
import path from 'node:path';
import { afnPath } from './paths.js';
import { normalizeProjectsConfig } from './projects-policy.js';
import { buildFlowDiagramIr, irToMermaid } from './diagram-ir.js';

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
    names = fs.readdirSync(dir).filter((n) => n.endsWith('.json') && !n.includes('.delta.') && !n.includes('.deliver.'));
  } catch {
    return [];
  }
  const out = [];
  for (const name of names.slice(0, 24)) {
    const ir = readJson(path.join(dir, name));
    if (!ir || typeof ir !== 'object') continue;
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

/**
 * Persiste el flujo del workspace (como el botón mapa del `@` / `/diagrama`).
 * @param {string} root
 * @param {object} [cfg]
 * @param {{ recreate?: boolean }} [opts]
 */
export function persistWorkspaceFlowDiagram(root, cfg, opts = {}) {
  const config = cfg || normalizeProjectsConfig(readJson(afnPath(root, 'projects.json')) || {});
  const built = buildFlowDiagramIr(config);
  if (!built.ok) return built;
  const dir = afnPath(root, 'diagrams');
  fs.mkdirSync(dir, { recursive: true });
  const jsonFile = path.join(dir, `${built.ir.slug}.architecture.json`);
  const mdFile = path.join(dir, `${built.ir.slug}.architecture.md`);
  if (!opts.recreate && fs.existsSync(jsonFile)) {
    return { ok: true, skipped: true, ir: built.ir, file: jsonFile, mermaid: built.mermaid };
  }
  fs.writeFileSync(jsonFile, `${JSON.stringify(built.ir, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdFile, `# ${built.ir.meta.title}\n\n\`\`\`mermaid\n${built.mermaid}\`\`\`\n`, 'utf8');
  return { ok: true, skipped: false, wrote: true, ir: built.ir, file: jsonFile, mermaid: built.mermaid };
}
