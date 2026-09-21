import { slugify } from './paths.js';
import { activeProjects, activeRelationships } from './projects-policy.js';

const MAX_NODES = 12;

export function diagramKindFromProjectType(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'frontend' || t === 'mobile' || t === 'desktop' || t === 'web' || t === 'client') return 'frontend';
  if (t === 'database' || t === 'db') return 'database';
  if (t === 'queue' || t === 'bus' || t === 'messagebus') return 'messagebus';
  if (t === 'cloud' || t === 'infra') return 'cloud';
  if (t === 'security' || t === 'auth') return 'security';
  return 'backend';
}

function findByName(list, key) {
  const k = String(key || '').trim().toLowerCase();
  if (!k) return null;
  return list.find((p) => p.name.toLowerCase() === k || slugify(p.name) === slugify(k)) || null;
}

function mermaidId(id) {
  return String(id || 'n').replace(/[^a-zA-Z0-9_]/g, '_');
}

function mermaidLabel(s) {
  return String(s || '')
    .replace(/[[\]"#;]/g, ' ')
    .slice(0, 48);
}

/**
 * IR de flujo entre proyectos (mismo espíritu que `/diagrama` en AFN IDE).
 * @param {ReturnType<import('./projects-policy.js').normalizeProjectsConfig>} cfg
 */
export function buildFlowDiagramIr(cfg) {
  const selected = activeProjects(cfg).slice(0, MAX_NODES);
  if (!selected.length) return { ok: false, error: 'sin proyectos activos' };
  const nodes = selected.map((p) => ({
    id: slugify(p.name),
    type: diagramKindFromProjectType(p.type),
    label: p.port ? `${p.name}:${p.port}` : p.name,
    path: p.path,
  }));
  const idSet = new Set(nodes.map((n) => n.id));
  const edges = [];
  let ei = 0;
  for (const rel of activeRelationships(cfg)) {
    const from = findByName(selected, rel.from);
    const to = findByName(selected, rel.to);
    if (!from || !to || from.name === to.name) continue;
    const fid = slugify(from.name);
    const tid = slugify(to.name);
    if (!idSet.has(fid) || !idSet.has(tid)) continue;
    ei += 1;
    edges.push({
      id: `e${ei}`,
      from: fid,
      to: tid,
      label: [rel.type, rel.endpoint].filter(Boolean).join(' ').slice(0, 80),
    });
  }
  if (!edges.length && nodes.length > 1) {
    const order = ['frontend', 'security', 'backend', 'messagebus', 'database', 'cloud'];
    const by = new Map();
    for (const n of nodes) {
      if (!by.has(n.type)) by.set(n.type, []);
      by.get(n.type).push(n);
    }
    const present = order.filter((k) => (by.get(k) || []).length);
    for (let i = 0; i < present.length - 1; i += 1) {
      ei += 1;
      edges.push({
        id: `e${ei}`,
        from: by.get(present[i])[0].id,
        to: by.get(present[i + 1])[0].id,
        label: 'flujo',
      });
    }
  }
  const title = selected.length > 1 ? selected.map((p) => p.name).join(' + ') : selected[0].name;
  const slug = slugify(title) || 'flujo';
  const ir = {
    schemaVersion: 1,
    kind: 'afn-diagram-ir',
    diagramType: 'architecture',
    slug,
    meta: { title, sourceBacked: true, qualityProfile: 'lean' },
    nodes,
    edges,
  };
  return { ok: true, ir, mermaid: irToMermaid(ir) };
}

/**
 * @param {object} ir
 */
export function irToMermaid(ir) {
  const lines = ['flowchart LR'];
  for (const n of ir.nodes || []) {
    lines.push(`  ${mermaidId(n.id || n.label)}["${mermaidLabel(n.label || n.id)}"]`);
  }
  for (const e of ir.edges || []) {
    const lab = e.label ? `|"${mermaidLabel(e.label)}"|` : '';
    lines.push(`  ${mermaidId(e.from)} -->${lab} ${mermaidId(e.to)}`);
  }
  return `${lines.join('\n')}\n`;
}
