import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { afnPath } from './paths.js';
import { activeProjects, activeRelationships, normalizeProjectsConfig } from './projects-policy.js';
import { loadCerebro } from './cerebro.js';
import { readMemoryMarkdown } from './memory.js';
import { redactSecrets } from './redact.js';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mermaidId(raw) {
  const s = String(raw || 'n').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);
  return s || 'n';
}

function mermaidLabel(s) {
  return String(s || '')
    .replace(/"/g, '')
    .replace(/[\[\]]/g, ' ')
    .slice(0, 40);
}

function flowMermaid(projects, rels) {
  const lines = ['flowchart LR'];
  for (const p of projects) {
    lines.push(`  ${mermaidId(p.name)}["${mermaidLabel(`${p.name} (${p.type})`)}"]`);
  }
  for (const r of rels) {
    const lab = mermaidLabel(r.endpoint || r.type || '');
    lines.push(`  ${mermaidId(r.from)} -->|"${lab}"| ${mermaidId(r.to)}`);
  }
  if (projects.length && !rels.length) {
    for (let i = 0; i < projects.length - 1; i += 1) {
      lines.push(`  ${mermaidId(projects[i].name)} --- ${mermaidId(projects[i + 1].name)}`);
    }
  }
  return lines.join('\n');
}

function irToMermaid(ir) {
  const nodes = Array.isArray(ir?.nodes) ? ir.nodes : [];
  const edges = Array.isArray(ir?.edges) ? ir.edges : [];
  const lines = ['flowchart LR'];
  for (const n of nodes) {
    const id = mermaidId(n.id || n.label);
    const label = String(n.label || n.id || '').slice(0, 40);
    lines.push(`  ${id}["${label.replace(/"/g, '')}"]`);
  }
  for (const e of edges) {
    const lab = String(e.label || e.endpoint || '').slice(0, 32);
    const arrow = lab ? ` -->|"${lab.replace(/"/g, '')}"| ` : ' --> ';
    lines.push(`  ${mermaidId(e.from)} ${arrow}${mermaidId(e.to)}`);
  }
  return lines.join('\n');
}

function listDiagrams(root) {
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
      title: ir.meta?.title || ir.slug || name,
      type: ir.diagramType || 'architecture',
      mermaid: irToMermaid(ir),
      nodes: Array.isArray(ir.nodes) ? ir.nodes.length : 0,
    });
  }
  return out;
}

function collectDashboard(root) {
  const pj = readJson(afnPath(root, 'projects.json'));
  const cfg = normalizeProjectsConfig(pj || {});
  const projects = activeProjects(cfg);
  const rels = activeRelationships(cfg);
  const cerebro = loadCerebro(root);
  const ctx = readJson(afnPath(root, 'context.json'));
  return {
    root,
    projects,
    rels,
    ignorePaths: cfg.ignorePaths || [],
    cerebro,
    memoryMd: readMemoryMarkdown(root),
    diagrams: listDiagrams(root),
    contextSafe: ctx && typeof ctx === 'object' ? redactSecrets(ctx) : null,
  };
}

function buildHtml(data) {
  const { root, projects, rels, cerebro, memoryMd, diagrams, ignorePaths, contextSafe } = data;
  const obs = [...(cerebro.observations || [])].slice(-12).reverse();
  const sess = [...(cerebro.sessions || [])].slice(-8).reverse();
  const projCards = projects
    .map(
      (p) =>
        `<article class="card"><h3>${esc(p.name)}</h3><p class="muted">${esc(p.type)}${p.port ? ` · :${esc(p.port)}` : ''}</p><code>${esc(p.path)}</code></article>`,
    )
    .join('');
  const obsHtml = obs.length
    ? obs
        .map(
          (o) =>
            `<li><strong>${esc(o.title || o.type)}</strong> <span class="tag">${esc(o.type)}</span><div class="muted">${esc(String(o.text || '').slice(0, 280))}</div><time>${esc(String(o.createdAt || '').slice(0, 19))}</time></li>`,
        )
        .join('')
    : '<li class="muted">Sin observaciones todavía. El agente debe llamar afn_mem_save.</li>';
  const sessHtml = sess.length
    ? sess
        .map(
          (s) =>
            `<li><strong>${esc(s.goal || s.id)}</strong><div class="muted">${esc(s.summary || s.done || 'en curso')}</div><time>${esc(String(s.startedAt || '').slice(0, 19))}</time></li>`,
        )
        .join('')
    : '<li class="muted">Sin sesiones. afn_session_start al abrir trabajo.</li>';
  const diagramsHtml = diagrams.length
    ? diagrams
        .map(
          (d) =>
            `<section class="panel"><h3>${esc(d.title)} <span class="tag">${esc(d.type)}</span></h3><p class="muted">${esc(d.file)} · ${d.nodes} nodos</p><pre class="mermaid">${esc(d.mermaid)}</pre></section>`,
        )
        .join('')
    : '<p class="muted">No hay mapas en <code>.afn/diagrams/</code>. En AFN IDE usá <code>/diagrama</code>; acá se listan solos.</p>';
  const ctxHtml = contextSafe
    ? `<pre class="json">${esc(JSON.stringify(contextSafe, null, 2).slice(0, 2500))}</pre>`
    : '<p class="muted">Sin context.json (o vacío).</p>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>AFN · cerebro y mapa</title>
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, theme: "dark" });
</script>
<style>
  :root { --bg:#0f1419; --panel:#1a2332; --ink:#e8eef7; --muted:#8aa0b8; --acc:#3dd6c6; --line:#2a3a4d; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: "Segoe UI", system-ui, sans-serif; background:var(--bg); color:var(--ink); }
  header { padding:1.25rem 1.5rem; border-bottom:1px solid var(--line); background:linear-gradient(90deg,#12202b,#0f1419); }
  header h1 { margin:0; font-size:1.25rem; letter-spacing:.04em; }
  header p { margin:.35rem 0 0; color:var(--muted); font-size:.9rem; }
  nav { display:flex; gap:.6rem; flex-wrap:wrap; padding:.75rem 1.5rem; border-bottom:1px solid var(--line); }
  nav a { color:var(--acc); text-decoration:none; font-size:.85rem; }
  main { padding:1.25rem 1.5rem 3rem; display:grid; gap:1.25rem; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:.75rem; }
  .card, .panel { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:1rem; }
  h2 { font-size:1rem; margin:0 0 .75rem; color:var(--acc); }
  h3 { margin:.1rem 0 .35rem; font-size:.95rem; }
  .muted { color:var(--muted); font-size:.8rem; }
  .tag { display:inline-block; font-size:.7rem; padding:.1rem .4rem; border-radius:999px; background:#123; color:var(--acc); margin-left:.35rem; }
  ul { margin:0; padding-left:1.1rem; }
  li { margin:.45rem 0; }
  time { display:block; color:var(--muted); font-size:.7rem; }
  .mermaid { background:#0b1016; border-radius:8px; padding:.5rem; overflow:auto; }
  .json { font-size:.75rem; overflow:auto; max-height:280px; }
  code { color:#f6d58a; }
</style>
</head>
<body>
<header>
  <h1>AFN cerebro</h1>
  <p>${esc(root)}${ignorePaths.length ? ` · ignorados: ${esc(ignorePaths.join(', '))}` : ''}</p>
</header>
<nav>
  <a href="#mapa">Mapa</a>
  <a href="#flujo">Flujo</a>
  <a href="#diagramas">Diagramas</a>
  <a href="#sesiones">Sesiones</a>
  <a href="#hechos">Hechos</a>
  <a href="#context">context.json</a>
</nav>
<main>
  <section id="mapa">
    <h2>Proyectos activos (${projects.length})</h2>
    <div class="grid">${projCards || '<p class="muted">Corrê afn_bootstrap desde el workspace del producto.</p>'}</div>
  </section>
  <section id="flujo" class="panel">
    <h2>Cómo se conectan</h2>
    <pre class="mermaid">${esc(flowMermaid(projects, rels))}</pre>
  </section>
  <section id="diagramas">
    <h2>Diagramas en .afn/diagrams</h2>
    ${diagramsHtml}
  </section>
  <section id="sesiones" class="panel">
    <h2>Qué se ha trabajado (sesiones)</h2>
    <ul>${sessHtml}</ul>
  </section>
  <section id="hechos" class="panel">
    <h2>Cerebro (observaciones)</h2>
    <ul>${obsHtml}</ul>
    ${memoryMd ? `<h2>MEMORY.md</h2><pre class="json">${esc(memoryMd.slice(0, 2000))}</pre>` : ''}
  </section>
  <section id="context" class="panel">
    <h2>Contexto (redactado)</h2>
    ${ctxHtml}
  </section>
</main>
</body>
</html>
`;
}

function openInBrowser(fileAbs) {
  const url = pathToFileURL(fileAbs).href;
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [fileAbs], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [fileAbs], { detached: true, stdio: 'ignore' }).unref();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Escribe HTML local y opcionalmente abre el navegador (desde Kiro: tool afn_dashboard).
 * @param {string} root
 * @param {{ open?: boolean }} [opts]
 */
export function writeDashboard(root, opts = {}) {
  const data = collectDashboard(root);
  const html = buildHtml(data);
  const outDir = afnPath(root, '_tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'dashboard.html');
  fs.writeFileSync(file, html, 'utf8');
  const shouldOpen = opts.open !== false;
  const opened = shouldOpen ? openInBrowser(file) : false;
  return {
    ok: true,
    file,
    url: pathToFileURL(file).href,
    opened,
    projects: data.projects.length,
    observations: data.cerebro.observations.length,
    diagrams: data.diagrams.length,
    hint: opened
      ? 'Dashboard abierto en el navegador.'
      : `Abrí este archivo: ${file}`,
  };
}

export { collectDashboard, buildHtml, flowMermaid };
