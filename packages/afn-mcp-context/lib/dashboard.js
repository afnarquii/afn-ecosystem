import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { afnPath } from './paths.js';
import { activeProjects, activeRelationships, normalizeProjectsConfig } from './projects-policy.js';
import { loadCerebro } from './cerebro.js';
import { readMemoryMarkdown } from './memory.js';
import { redactSecrets } from './redact.js';
import { listDiagramIrs } from './diagram-store.js';
import { loadAgentAssets } from './agent-assets.js';
import { irToMermaid } from './diagram-ir.js';

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

function flowMermaid(projects, rels) {
  const ir = {
    nodes: projects.map((p) => ({ id: p.name, label: p.port ? `${p.name}:${p.port}` : p.name })),
    edges: rels.map((r) => ({ from: r.from, to: r.to, label: r.endpoint || r.type || '' })),
  };
  return irToMermaid(ir);
}

function collectDashboard(root) {
  const pj = readJson(afnPath(root, 'projects.json'));
  const cfg = normalizeProjectsConfig(pj || {});
  const projects = activeProjects(cfg);
  const rels = activeRelationships(cfg);
  const cerebro = loadCerebro(root);
  const ctx = readJson(afnPath(root, 'context.json'));
  const assetsPack = loadAgentAssets(root);
  return {
    root,
    projects,
    rels,
    ignorePaths: cfg.ignorePaths || [],
    cerebro,
    memoryMd: readMemoryMarkdown(root),
    diagrams: listDiagramIrs(root),
    assets: Array.isArray(assetsPack.assets) ? assetsPack.assets : [],
    contextSafe: ctx && typeof ctx === 'object' ? redactSecrets(ctx) : null,
  };
}

function kindLabel(kind) {
  const map = {
    'kiro-steering': 'Kiro steering',
    'kiro-skill': 'Kiro skill',
    'afn-skill': 'Skill AFN',
    'afn-prompt': 'Prompt AFN',
    'copilot-instructions': 'Copilot',
    'copilot-prompt': 'Copilot prompt',
    'copilot-skill': 'Copilot skill',
    'cursor-rule': 'Cursor',
    agents: 'AGENTS.md',
    claude: 'CLAUDE.md',
  };
  return map[kind] || kind;
}

function buildHtml(data) {
  const { root, projects, rels, cerebro, memoryMd, diagrams, ignorePaths, contextSafe, assets } = data;
  const obs = [...(cerebro.observations || [])].slice(-10).reverse();
  const sess = [...(cerebro.sessions || [])].slice(-6).reverse();
  const lastSess = sess[0];
  const payload = JSON.stringify(
    diagrams.map((d) => ({
      slug: d.slug,
      title: d.title,
      type: d.type,
      file: d.file,
      mermaid: d.mermaid,
      nodes: d.nodes,
      edges: d.edges,
    })),
  );

  const projCards = projects
    .map(
      (p) =>
        `<button type="button" class="tile" data-go="mapa"><span class="k">${esc(p.type)}</span><strong>${esc(p.name)}</strong><code>${esc(p.path)}</code>${p.port ? `<span class="muted">:${esc(p.port)}</span>` : ''}</button>`,
    )
    .join('');

  const diagramCards = diagrams.length
    ? diagrams
        .map(
          (d) =>
            `<button type="button" class="diagram-card" data-open="${esc(d.slug)}" aria-label="Abrir diagrama ${esc(d.title)}">
              <span class="k">${esc(d.type)}</span>
              <strong>${esc(d.title)}</strong>
              <span class="muted">${d.nodes} componentes · ${d.edges} enlaces</span>
              <span class="cta">Abrir →</span>
            </button>`,
        )
        .join('')
    : `<div class="empty">Aún no hay diagramas. En Kiro pedí <strong>generar diagrama AFN</strong> (igual que el botón mapa del @ en AFN IDE).</div>`;

  const assetRows = assets.length
    ? assets
        .map(
          (a) =>
            `<tr><td><span class="tag">${esc(kindLabel(a.kind))}</span></td><td>${esc(a.title)}</td><td>${esc(a.project || 'workspace')}</td><td class="muted">${esc(a.rel)}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="muted">No encontré steering/skills/Copilot. El bootstrap las asocia si existen en el repo o en ~/.kiro/steering.</td></tr>';

  const sessHtml = sess.length
    ? sess
        .map(
          (s) =>
            `<li><strong>${esc(s.goal || s.id)}</strong><p class="muted">${esc(s.summary || s.done || 'en curso')}</p><time>${esc(String(s.startedAt || '').slice(0, 16))}</time></li>`,
        )
        .join('')
    : '<li class="muted">Todavía no hay sesiones. El hook SessionStart o <code>afn_session_start</code> las crea.</li>';

  const obsHtml = obs.length
    ? obs
        .map(
          (o) =>
            `<li><span class="tag">${esc(o.type)}</span> <strong>${esc(o.title || 'hecho')}</strong><p class="muted">${esc(String(o.text || '').slice(0, 220))}</p></li>`,
        )
        .join('')
    : '<li class="muted">El cerebro está vacío. Pedile al agente que recuerde una decisión con <code>afn_mem_save</code>.</li>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>AFN · mapa y cerebro</title>
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
  const diagrams = JSON.parse(document.getElementById("diagrams-data").textContent);
  const bySlug = Object.fromEntries(diagrams.map((d) => [d.slug, d]));

  async function render(el, src) {
    if (!el || !src) return;
    try {
      el.removeAttribute("data-processed");
      el.textContent = src;
      await mermaid.run({ nodes: [el] });
    } catch (_) { /* diagrama inválido: el overlay igual muestra el título */ }
  }

  function showView(id) {
    document.querySelectorAll("[data-view]").forEach((n) => n.hidden = n.getAttribute("data-view") !== id);
    document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.go === id));
    if (id === "mapa") render(document.getElementById("flow-mermaid"), document.getElementById("flow-src").textContent);
  }

  function openDiagram(slug) {
    const d = bySlug[slug];
    const ov = document.getElementById("overlay");
    if (!d || !ov) return;
    document.getElementById("ov-title").textContent = d.title;
    document.getElementById("ov-meta").textContent = d.file + " · " + d.nodes + " componentes · " + d.edges + " enlaces";
    ov.hidden = false;
    showView("diagramas");
    location.hash = "d-" + slug;
    render(document.getElementById("ov-mermaid"), d.mermaid);
  }

  function closeOverlay() {
    document.getElementById("overlay").hidden = true;
    if (location.hash.startsWith("#d-")) history.replaceState(null, "", "#diagramas");
  }

  window.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) { e.preventDefault(); showView(go.dataset.go); location.hash = go.dataset.go; }
    const open = e.target.closest("[data-open]");
    if (open) { e.preventDefault(); openDiagram(open.dataset.open); }
    if (e.target.closest("[data-close]")) closeOverlay();
  });
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeOverlay(); });
  window.addEventListener("hashchange", () => {
    const h = location.hash.replace("#", "");
    if (h.startsWith("d-")) openDiagram(h.slice(2));
    else if (h) showView(h);
  });
  const boot = location.hash.replace("#", "") || "inicio";
  if (boot.startsWith("d-")) openDiagram(boot.slice(2));
  else showView(["inicio","mapa","diagramas","cerebro","reglas"].includes(boot) ? boot : "inicio");
</script>
<style>
  :root { --bg:#0c0f14; --panel:#151b24; --ink:#eef3f8; --muted:#8b9cb0; --acc:#4adeb8; --line:#243044; --warn:#fbbf24; }
  * { box-sizing:border-box; }
  html,body { margin:0; height:100%; background:var(--bg); color:var(--ink); font:15px/1.45 "Segoe UI",system-ui,sans-serif; }
  .app { display:grid; grid-template-columns:220px 1fr; min-height:100%; }
  aside { background:#10151d; border-right:1px solid var(--line); padding:1.25rem 0.9rem; }
  aside h1 { font-size:0.95rem; margin:0 0 1rem; letter-spacing:.06em; text-transform:uppercase; color:var(--acc); }
  nav { display:flex; flex-direction:column; gap:.25rem; }
  nav button { text-align:left; background:transparent; border:0; color:var(--muted); padding:.55rem .7rem; border-radius:8px; cursor:pointer; font:inherit; }
  nav button.on, nav button:hover { background:#1c2736; color:var(--ink); }
  .stat { font-size:.75rem; color:var(--muted); margin-top:1.5rem; word-break:break-all; }
  main { padding:1.5rem 1.75rem 3rem; overflow:auto; }
  h2 { margin:0 0 .35rem; font-size:1.35rem; }
  .lead { color:var(--muted); margin:0 0 1.25rem; }
  .hero { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:.75rem; margin-bottom:1.5rem; }
  .hero button, .tile, .diagram-card { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:1rem; text-align:left; color:inherit; cursor:pointer; font:inherit; display:flex; flex-direction:column; gap:.35rem; }
  .hero button:hover, .diagram-card:hover, .tile:hover { border-color:var(--acc); }
  .k { font-size:.7rem; text-transform:uppercase; letter-spacing:.08em; color:var(--acc); }
  .cta { color:var(--acc); font-size:.8rem; margin-top:.4rem; }
  .muted { color:var(--muted); font-size:.82rem; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:.7rem; }
  .empty { background:var(--panel); border:1px dashed var(--line); border-radius:12px; padding:1rem 1.1rem; color:var(--muted); }
  table { width:100%; border-collapse:collapse; font-size:.85rem; }
  th,td { padding:.55rem .4rem; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
  .tag { display:inline-block; font-size:.68rem; padding:.12rem .4rem; border-radius:999px; background:#12352f; color:var(--acc); }
  ul { margin:0; padding-left:1.1rem; }
  li { margin:.5rem 0; }
  code { color:#f5d58a; font-size:.8rem; }
  .overlay { position:fixed; inset:0; background:rgba(6,8,12,.72); display:flex; align-items:center; justify-content:center; padding:1.5rem; z-index:20; }
  .overlay[hidden] { display:none; }
  .sheet { width:min(960px,100%); max-height:90vh; overflow:auto; background:#121820; border:1px solid var(--line); border-radius:16px; padding:1rem 1.2rem 1.4rem; }
  .sheet head-row, .sheet-bar { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; margin-bottom:.8rem; }
  .x { background:transparent; border:0; color:var(--muted); font-size:1.4rem; cursor:pointer; }
  .mermaid { background:#0b1016; border-radius:10px; padding:.75rem; overflow:auto; min-height:180px; }
  #flow-src { display:none; }
</style>
</head>
<body>
<div class="app">
  <aside>
    <h1>AFN</h1>
    <nav>
      <button type="button" data-go="inicio">Inicio</button>
      <button type="button" data-go="mapa">Mapa (${projects.length})</button>
      <button type="button" data-go="diagramas">Diagramas (${diagrams.length})</button>
      <button type="button" data-go="cerebro">Memoria</button>
      <button type="button" data-go="reglas">Reglas (${assets.length})</button>
    </nav>
    <p class="stat">${esc(root)}${ignorePaths.length ? `<br>ignorados: ${esc(ignorePaths.join(', '))}` : ''}</p>
  </aside>
  <main>
    <section data-view="inicio">
      <h2>Qué hay en este workspace</h2>
      <p class="lead">Elegí una tarjeta. Los diagramas se abren aquí mismo (no hace falta otro programa).</p>
      <div class="hero">
        <button type="button" data-go="mapa"><span class="k">Mapa</span><strong>${projects.length} proyectos</strong><span class="muted">${rels.length} conexiones</span></button>
        <button type="button" data-go="diagramas"><span class="k">Diagramas</span><strong>${diagrams.length} mapas</strong><span class="muted">Clic para abrir el flujo</span></button>
        <button type="button" data-go="cerebro"><span class="k">Memoria</span><strong>${lastSess ? esc(lastSess.goal || 'Sesión') : 'Sin sesiones'}</strong><span class="muted">${obs.length} hechos recientes</span></button>
        <button type="button" data-go="reglas"><span class="k">Kiro · Copilot</span><strong>${assets.length} reglas / skills</strong><span class="muted">Asociadas al workspace</span></button>
      </div>
    </section>
    <section data-view="mapa" hidden>
      <h2>Cómo se conectan</h2>
      <p class="lead">Mismo contrato que <code>/diagrama</code> y el botón mapa del @ en AFN IDE.</p>
      <div class="grid">${projCards || '<div class="empty">Corrê bootstrap desde el workspace del producto.</div>'}</div>
      <div id="flow-mermaid" class="mermaid" style="margin-top:1rem"></div>
      <pre id="flow-src">${esc(flowMermaid(projects, rels))}</pre>
    </section>
    <section data-view="diagramas" hidden>
      <h2>Diagramas</h2>
      <p class="lead">Tocá uno para ver componentes, nombres y enlaces. Si falta, en Kiro: <strong>generar diagrama AFN</strong>.</p>
      <div class="hero">${diagramCards}</div>
    </section>
    <section data-view="cerebro" hidden>
      <h2>Qué se ha trabajado</h2>
      <p class="lead">Diario del cerebro (<code>.afn/memory/cerebro.json</code>). No es el chat entero.</p>
      <h3>Sesiones</h3>
      <ul>${sessHtml}</ul>
      <h3>Hechos</h3>
      <ul>${obsHtml}</ul>
      ${memoryMd ? `<h3>MEMORY.md</h3><pre class="muted" style="white-space:pre-wrap">${esc(memoryMd.slice(0, 1800))}</pre>` : ''}
      ${contextSafe ? `<h3>context.json (redactado)</h3><pre class="muted" style="white-space:pre-wrap">${esc(JSON.stringify(contextSafe, null, 2).slice(0, 1800))}</pre>` : ''}
    </section>
    <section data-view="reglas" hidden>
      <h2>Steering, skills e instrucciones</h2>
      <p class="lead">Kiro, Copilot (.github), Cursor y AFN. Se asocian a un proyecto si el nombre coincide; si no, al workspace. Un diagrama existente no se pisa.</p>
      <table>
        <thead><tr><th>Origen</th><th>Nombre</th><th>Asociado a</th><th>Ruta</th></tr></thead>
        <tbody>${assetRows}</tbody>
      </table>
    </section>
  </main>
</div>
<div id="overlay" class="overlay" hidden>
  <div class="sheet">
    <div class="sheet-bar">
      <div>
        <h2 id="ov-title">Diagrama</h2>
        <p id="ov-meta" class="muted"></p>
      </div>
      <button type="button" class="x" data-close aria-label="Cerrar">×</button>
    </div>
    <div id="ov-mermaid" class="mermaid"></div>
  </div>
</div>
<script type="application/json" id="diagrams-data">${payload.replace(/</g, '\\u003c')}</script>
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

export function writeDashboard(root, opts = {}) {
  const data = collectDashboard(root);
  const html = buildHtml(data);
  const outDir = afnPath(root, '_tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'dashboard.html');
  fs.writeFileSync(file, html, 'utf8');
  const shouldOpen = opts.open !== false;
  const opened = shouldOpen ? openInBrowser(file) : false;
  const hash = opts.slug ? `#d-${opts.slug}` : '';
  return {
    ok: true,
    file,
    url: `${pathToFileURL(file).href}${hash}`,
    opened,
    projects: data.projects.length,
    observations: data.cerebro.observations.length,
    diagrams: data.diagrams.length,
    assets: data.assets.length,
    hint: opened ? 'Dashboard abierto. Los diagramas se abren con un clic en esa página.' : `Abrí: ${file}`,
  };
}

export { collectDashboard, buildHtml, flowMermaid };
