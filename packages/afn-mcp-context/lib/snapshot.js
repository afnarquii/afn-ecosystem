import fs from 'node:fs';
import { afnPath, MAX_SNAPSHOT_CHARS } from './paths.js';
import { redactSecrets } from './redact.js';
import { activeProjects, activeRelationships, normalizeProjectsConfig } from './projects-policy.js';
import { loadFacts, readMemoryMarkdown } from './memory.js';

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
  lines.push(`Proyectos activos: **${active.length}**` + (cfg.ignorePaths.length ? ` · ignorados: ${cfg.ignorePaths.join(', ')}` : ''));
  for (const p of active) {
    const port = p.port ? ` :${p.port}` : '';
    lines.push(`- **${p.name}** (${p.type}${port}) \`${p.path}\`${p.entryPoint ? ` · ${p.entryPoint}` : ''}`);
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

  const ctx = readJson(afnPath(root, 'context.json'));
  if (ctx && typeof ctx === 'object') {
    const safe = redactSecrets(ctx);
    lines.push('--- context.json (redactado, recorte) ---');
    lines.push(JSON.stringify(safe, null, 2).slice(0, 800));
    lines.push('');
  }

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

  const md = lines.join('\n').slice(0, MAX_SNAPSHOT_CHARS);
  return { ok: true, markdown: md, missing: false, activeCount: active.length, relCount: rels.length };
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
  return {
    ok: checks.every((c) => c.ok) && !snap.missing,
    root,
    checks,
    snapshotChars: snap.markdown.length,
    activeCount: snap.activeCount || 0,
  };
}
