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
import { loadWorkspaceFlow, buildLayersMermaid, buildEndpointsMermaid, buildE2eMermaid, workspaceFlowMarkdown } from './workspace-flow.js';

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

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function flowMermaid(projects, rels, flow) {
  if (flow) return buildEndpointsMermaid(flow);
  const ir = {
    nodes: projects.map((p) => ({
      id: p.name,
      label: [p.name, p.port && `:${p.port}`, p.framework, p.prefix].filter(Boolean).join(' '),
    })),
    edges: rels.map((r) => ({ from: r.from, to: r.to, label: r.via || r.endpoint || r.type || '' })),
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
  const flow = loadWorkspaceFlow(root);
  const flowMd = readText(afnPath(root, 'diagrams', 'workspace-flow.md')) || (flow ? workspaceFlowMarkdown(flow) : '');
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
    flow,
    flowMd,
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
  const { root, projects, rels, cerebro, memoryMd, diagrams, ignorePaths, contextSafe, assets, flow, flowMd } = data;
  const obs = [...(cerebro.observations || [])].slice(-10).reverse();
  const sess = [...(cerebro.sessions || [])].slice(-6).reverse();
  const lastSess = sess[0];
  const verified = flow?.llmReviewed === true;
  const payload = JSON.stringify(
    diagrams.map((d) => ({
      slug: d.slug,
      title: d.title,
      type: d.type,
      file: d.file,
      mermaid: d.mermaid,
      markdown: d.markdown || '',
      nodes: d.nodes,
      edges: d.edges,
    })),
  );
  const listed = flow?.projects || projects;
  const portRows = listed
    .map((p) => {
      const port = p.port ? `:${p.port}` : '—';
      const src = p.portSource || (p.port ? 'sin fuente' : 'sin evidencia');
      return `<tr data-q="${esc([p.name, p.port, p.portSource, p.framework, p.path].filter(Boolean).join(' '))}"><td><strong>${esc(p.name)}</strong></td><td>${esc(port)}</td><td class="muted">${esc(src)}</td><td class="muted">${esc(p.framework || p.role || '')}</td></tr>`;
    })
    .join('');

  const projCards = listed
    .map((p) => {
      const bits = [p.role, p.framework, p.db, p.prefix, p.port && `:${p.port}`].filter(Boolean).join(' · ');
      const skills = (p.skills || []).slice(0, 3).join(', ');
      const evid = p.portSource ? `evidencia ${p.portSource}` : p.port ? 'puerto' : 'sin puerto';
      return `<button type="button" class="tile" data-go="mapa" data-q="${esc([p.name, p.path, p.role, p.framework, p.db, p.prefix, p.layer, p.type, p.portSource, ...(p.skills || [])].filter(Boolean).join(' '))}"><span class="k">${esc(p.layer || p.type)}</span><strong>${esc(p.name)}</strong><span class="muted">${esc(bits)}</span><span class="muted">${esc(evid)}</span>${skills ? `<span class="muted">${esc(skills)}</span>` : ''}<code>${esc(p.path || '')}</code></button>`;
    })
    .join('');

  const diagramCards = diagrams.length
    ? diagrams
        .map(
          (d) =>
            `<button type="button" class="diagram-card" data-open="${esc(d.slug)}" data-q="${esc(`${d.title} ${d.type} ${d.slug}`)}" aria-label="Abrir diagrama ${esc(d.title)}">
              <span class="k">${esc(d.type)}</span>
              <strong>${esc(d.title)}</strong>
              <span class="muted">${d.nodes} componentes · ${d.edges} enlaces</span>
              <span class="cta">Abrir · ampliar · .md →</span>
            </button>`,
        )
        .join('')
    : `<div class="empty">Aún no hay diagramas. En Kiro pedí <strong>generar diagrama AFN</strong> (igual que el botón mapa del @ en AFN IDE).</div>`;

  const assetRows = assets.length
    ? assets
        .map(
          (a) =>
            `<tr data-q="${esc(`${a.kind} ${a.title} ${a.project || ''} ${a.rel || ''}`)}"><td><span class="tag">${esc(kindLabel(a.kind))}</span></td><td>${esc(a.title)}</td><td>${esc(a.project || 'workspace')}</td><td class="muted">${esc(a.rel)}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="muted">No encontré steering/skills/Copilot. El bootstrap las asocia si existen en el repo o en ~/.kiro/steering.</td></tr>';

  const sessHtml = sess.length
    ? sess
        .map(
          (s) =>
            `<li data-q="${esc(`${s.goal || ''} ${s.summary || ''} ${s.done || ''}`)}"><strong>${esc(s.goal || s.id)}</strong><p class="muted">${esc(s.summary || s.done || 'en curso')}</p><time>${esc(String(s.startedAt || '').slice(0, 16))}</time></li>`,
        )
        .join('')
    : '<li class="muted">Todavía no hay sesiones. El hook SessionStart o <code>afn_session_start</code> las crea.</li>';

  const obsHtml = obs.length
    ? obs
        .map(
          (o) =>
            `<li data-q="${esc(`${o.type} ${o.title || ''} ${o.text || ''}`)}"><span class="tag">${esc(o.type)}</span> <strong>${esc(o.title || 'hecho')}</strong><p class="muted">${esc(String(o.text || '').slice(0, 220))}</p></li>`,
        )
        .join('')
    : '<li class="muted">El cerebro está vacío. Pedile al agente que recuerde una decisión con <code>afn_mem_save</code>.</li>';

  const wsName = path.basename(root || '') || 'workspace';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>AFN · ${esc(wsName)}</title>
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
  const diagrams = JSON.parse(document.getElementById("diagrams-data").textContent);
  const bySlug = Object.fromEntries(diagrams.map((d) => [d.slug, d]));
  const flowMd = document.getElementById("flow-md")?.textContent || "";

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  async function render(el, src) {
    if (!el || !src) return;
    try {
      el.removeAttribute("data-processed");
      el.textContent = src;
      await mermaid.run({ nodes: [el] });
    } catch (_) { /* diagrama inválido: el overlay igual muestra el título */ }
  }

  function applySearch() {
    const q = (document.getElementById("q")?.value || "").trim().toLowerCase();
    let hits = 0;
    document.querySelectorAll("[data-q]").forEach((el) => {
      const hay = (el.getAttribute("data-q") || el.textContent || "").toLowerCase();
      const ok = !q || hay.includes(q);
      el.hidden = !ok;
      if (ok && q) hits += 1;
    });
    const empty = document.getElementById("q-empty");
    if (empty) empty.hidden = !q || hits > 0;
    const n = document.getElementById("q-count");
    if (n) n.textContent = q ? (hits + " coincidencias") : "";
    document.querySelectorAll("[data-view]").forEach((sec) => {
      if (!q) return;
      const any = Array.from(sec.querySelectorAll("[data-q]")).some((el) => !el.hidden);
      sec.hidden = !any;
    });
    if (!q) {
      const on = document.querySelector("nav button.on")?.dataset.go || "inicio";
      showView(on);
    }
  }

  function showView(id) {
    document.querySelectorAll("[data-view]").forEach((n) => n.hidden = n.getAttribute("data-view") !== id);
    document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.go === id));
    if (id === "mapa") render(document.getElementById("flow-mermaid"), document.getElementById("flow-src").textContent);
    if (id === "capas") render(document.getElementById("layers-mermaid"), document.getElementById("layers-src").textContent);
    if (id === "howto") render(document.getElementById("e2e-mermaid"), document.getElementById("e2e-src").textContent);
  }

  function openDiagram(slug) {
    const d = bySlug[slug];
    const ov = document.getElementById("overlay");
    if (!d || !ov) return;
    document.getElementById("ov-title").textContent = d.title;
    document.getElementById("ov-meta").textContent = d.file + " · " + d.nodes + " componentes · " + d.edges + " enlaces";
    ov.dataset.slug = slug;
    ov.hidden = false;
    showView("diagramas");
    location.hash = "d-" + slug;
    render(document.getElementById("ov-mermaid"), d.mermaid);
  }

  function closeOverlay() {
    const ov = document.getElementById("overlay");
    ov.hidden = true;
    ov.classList.remove("wide");
    if (location.hash.startsWith("#d-")) history.replaceState(null, "", "#diagramas");
  }

  function toggleExpand() {
    document.getElementById("overlay").classList.toggle("wide");
  }

  function downloadOpen() {
    const slug = document.getElementById("overlay").dataset.slug;
    const d = bySlug[slug];
    if (!d) return;
    const md = d.markdown || ("# " + d.title + "\\n\\n\`\`\`mermaid\\n" + d.mermaid + "\\n\`\`\`\\n");
    downloadText((d.slug || "diagrama") + ".architecture.md", md);
  }

  window.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) { e.preventDefault(); showView(go.dataset.go); location.hash = go.dataset.go; }
    const open = e.target.closest("[data-open]");
    if (open) { e.preventDefault(); openDiagram(open.dataset.open); }
    if (e.target.closest("[data-close]")) closeOverlay();
    if (e.target.closest("[data-expand]")) { e.preventDefault(); toggleExpand(); }
    if (e.target.closest("[data-dl]")) { e.preventDefault(); downloadOpen(); }
    if (e.target.closest("[data-dl-flow]")) {
      e.preventDefault();
      downloadText("arquitectura.md", flowMd || "# Arquitectura\\n");
    }
  });
  window.addEventListener("input", (e) => {
    if (e.target && e.target.id === "q") applySearch();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeOverlay();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      document.getElementById("q")?.focus();
    }
    if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
      e.preventDefault();
      document.getElementById("q")?.focus();
    }
  });
  window.addEventListener("hashchange", () => {
    const h = location.hash.replace("#", "");
    if (h.startsWith("d-")) openDiagram(h.slice(2));
    else if (h) showView(h);
  });
  const boot = location.hash.replace("#", "") || "inicio";
  if (boot.startsWith("d-")) openDiagram(boot.slice(2));
  else showView(["inicio","readme","mapa","diagramas","capas","howto","cerebro","reglas"].includes(boot) ? boot : "inicio");
</script>
<style>
  :root {
    --bg:#0a0e14; --panel:#121820; --ink:#f1f5f9; --muted:#8b9cb3;
    --acc:#3dd6c6; --acc2:#7aa2f7; --line:#1e2a3a; --warn:#e8b84a;
    --ok:#34d399; --danger:#f87171; --bar:#0d1219;
  }
  * { box-sizing:border-box; }
  html,body { margin:0; height:100%; background:var(--bg); color:var(--ink); font:14px/1.5 "IBM Plex Sans","Segoe UI",system-ui,sans-serif; }
  .app { display:grid; grid-template-columns:248px 1fr; min-height:100%; }
  aside { background:var(--bar); border-right:1px solid var(--line); padding:0; display:flex; flex-direction:column; }
  .brand { padding:1.1rem 1.1rem .85rem; border-bottom:1px solid var(--line); }
  .brand .mark { font-size:.68rem; letter-spacing:.18em; text-transform:uppercase; color:var(--acc); font-weight:600; }
  .brand h1 { font-size:1.05rem; margin:.2rem 0 0; font-weight:650; }
  .brand .ws { font-size:.75rem; color:var(--muted); word-break:break-all; margin:.35rem 0 0; }
  .search-box { padding:.85rem 1rem 0; }
  #q { width:100%; margin:0 0 .45rem; padding:.55rem .7rem; border-radius:8px; border:1px solid var(--line); background:#0c1118; color:var(--ink); font:inherit; }
  #q:focus { outline:1px solid var(--acc); border-color:var(--acc); }
  #q-count, #q-empty { font-size:.72rem; color:var(--muted); margin:0 0 .45rem; padding:0 1rem; }
  nav { display:flex; flex-direction:column; gap:2px; padding:.4rem .7rem 1rem; }
  nav button { text-align:left; background:transparent; border:0; color:var(--muted); padding:.5rem .7rem; border-radius:8px; cursor:pointer; font:inherit; }
  nav button.on, nav button:hover { background:#182230; color:var(--ink); }
  .stat { font-size:.72rem; color:var(--muted); padding:0 1.1rem 1.2rem; margin-top:auto; word-break:break-all; }
  .top { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem 1.6rem .4rem; border-bottom:1px solid var(--line); background:linear-gradient(180deg,#10161f,transparent); }
  .badge { display:inline-flex; align-items:center; gap:.35rem; font-size:.72rem; letter-spacing:.04em; text-transform:uppercase; padding:.28rem .55rem; border-radius:999px; border:1px solid var(--line); color:var(--muted); }
  .badge.ok { color:var(--ok); border-color:#14532d; background:#052e16; }
  .badge.warn { color:var(--warn); border-color:#713f12; background:#1c1406; }
  main { padding:1.35rem 1.7rem 3.2rem; overflow:auto; }
  h2 { margin:0 0 .3rem; font-size:1.28rem; font-weight:650; letter-spacing:-.02em; }
  h3 { margin:1.2rem 0 .4rem; font-size:.92rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); font-weight:600; }
  .lead { color:var(--muted); margin:0 0 1.15rem; max-width:62ch; }
  .hero { display:grid; grid-template-columns:repeat(auto-fit,minmax(176px,1fr)); gap:.7rem; margin-bottom:1.4rem; }
  .hero button, .tile, .diagram-card { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:1rem 1.05rem; text-align:left; color:inherit; cursor:pointer; font:inherit; display:flex; flex-direction:column; gap:.32rem; box-shadow:0 8px 24px rgba(0,0,0,.18); }
  .hero button:hover, .diagram-card:hover, .tile:hover { border-color:var(--acc); }
  .k { font-size:.68rem; text-transform:uppercase; letter-spacing:.1em; color:var(--acc); }
  .cta { color:var(--acc2); font-size:.78rem; margin-top:.35rem; }
  .muted { color:var(--muted); font-size:.82rem; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:.7rem; }
  .toolbar { display:flex; gap:.5rem; flex-wrap:wrap; margin:0 0 .9rem; }
  .btn { background:#182230; border:1px solid var(--line); color:var(--ink); border-radius:8px; padding:.42rem .75rem; font:inherit; cursor:pointer; }
  .btn:hover { border-color:var(--acc); color:var(--acc); }
  #flow-src, #layers-src, #e2e-src, #flow-md { display:none; }
  .empty { background:var(--panel); border:1px dashed var(--line); border-radius:12px; padding:1rem 1.1rem; color:var(--muted); }
  table { width:100%; border-collapse:collapse; font-size:.84rem; }
  th,td { padding:.55rem .45rem; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
  th { color:var(--muted); font-weight:600; font-size:.72rem; text-transform:uppercase; letter-spacing:.06em; }
  .tag { display:inline-block; font-size:.68rem; padding:.12rem .4rem; border-radius:999px; background:#12352f; color:var(--acc); }
  ul { margin:0; padding-left:1.1rem; }
  li { margin:.5rem 0; }
  code { color:#f5d58a; font-size:.8rem; }
  .overlay { position:fixed; inset:0; background:rgba(4,8,14,.78); display:flex; align-items:center; justify-content:center; padding:1.4rem; z-index:20; backdrop-filter:blur(6px); }
  .overlay[hidden] { display:none; }
  .sheet { width:min(1080px,100%); max-height:90vh; overflow:auto; background:#10161e; border:1px solid var(--line); border-radius:14px; padding:1rem 1.2rem 1.4rem; box-shadow:0 24px 80px rgba(0,0,0,.45); }
  .overlay.wide { padding:0; }
  .overlay.wide .sheet { width:100%; height:100%; max-height:none; border-radius:0; }
  .sheet-bar { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; margin-bottom:.8rem; }
  .sheet-actions { display:flex; gap:.4rem; align-items:center; }
  .x { background:transparent; border:0; color:var(--muted); font-size:1.4rem; cursor:pointer; }
  .mermaid { background:#0b1016; border-radius:10px; padding:.75rem; overflow:auto; min-height:180px; }
  .doc { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:1.1rem 1.25rem; white-space:pre-wrap; font:13px/1.55 ui-monospace,Consolas,monospace; color:#dbe4ee; max-width:92ch; }
</style>
</head>
<body>
<div class="app">
  <aside>
    <div class="brand">
      <div class="mark">AFN context</div>
      <h1>Arquitectura y cerebro</h1>
      <p class="ws">${esc(wsName)}</p>
    </div>
    <div class="search-box">
      <label for="q" class="muted" style="display:block;font-size:.68rem;margin:0 0 .3rem;letter-spacing:.08em;text-transform:uppercase">Buscar</label>
      <input id="q" type="search" placeholder="Proyecto, puerto, diagrama…" autocomplete="off"/>
    </div>
    <p id="q-count" class="muted"></p>
    <p id="q-empty" hidden>Sin coincidencias. Probá otro término.</p>
    <nav>
      <button type="button" data-go="inicio">Inicio</button>
      <button type="button" data-go="readme">Arquitectura</button>
      <button type="button" data-go="mapa">Mapa (${projects.length})</button>
      <button type="button" data-go="diagramas">Diagramas (${diagrams.length})</button>
      <button type="button" data-go="capas">Capas y E2E</button>
      <button type="button" data-go="howto">Cómo se trabaja</button>
      <button type="button" data-go="cerebro">Memoria</button>
      <button type="button" data-go="reglas">Reglas (${assets.length})</button>
    </nav>
    <p class="stat">${esc(root)}${ignorePaths.length ? `<br>ignorados: ${esc(ignorePaths.join(', '))}` : ''}</p>
  </aside>
  <div>
    <div class="top">
      <span class="badge ${verified ? 'ok' : 'warn'}">${verified ? 'Arquitectura verificada' : 'Pendiente de evidencia LLM'}</span>
      <span class="muted">${projects.length} proyectos · ${rels.length} conexiones · ${obs.length} hechos</span>
    </div>
    <main>
    <section data-view="inicio">
      <h2>Qué hay en este workspace</h2>
      <p class="lead">El agente usa el README (nombres, rutas, quién llama a quién). Los diagramas son opcionales para vos.</p>
      <div class="hero">
        <button type="button" data-go="readme" data-q="arquitectura readme rutas endpoints flujo nombres"><span class="k">README</span><strong>Arquitectura</strong><span class="muted">Nombres · rutas · conexiones</span></button>
        <button type="button" data-go="mapa" data-q="mapa proyectos conexiones flujo"><span class="k">Mapa</span><strong>${projects.length} proyectos</strong><span class="muted">${rels.length} conexiones</span></button>
        <button type="button" data-go="diagramas" data-q="diagramas mapas flujo componentes"><span class="k">Diagramas</span><strong>${diagrams.length} mapas</strong><span class="muted">Ampliar y descargar .md</span></button>
        <button type="button" data-go="capas" data-q="capas presentación api datos e2e trazabilidad"><span class="k">Capas</span><strong>Presentación · API · datos</strong><span class="muted">Quién llama qué</span></button>
        <button type="button" data-go="howto" data-q="local test desarrollar probar feature"><span class="k">Local / test</span><strong>Cómo agregar y probar</strong><span class="muted">Qué se toca y qué no</span></button>
        <button type="button" data-go="cerebro" data-q="memoria cerebro sesiones hechos"><span class="k">Memoria</span><strong>${lastSess ? esc(lastSess.goal || 'Sesión') : 'Sin sesiones'}</strong><span class="muted">${obs.length} hechos recientes</span></button>
        <button type="button" data-go="reglas" data-q="kiro copilot steering skills reglas"><span class="k">Kiro · Copilot</span><strong>${assets.length} reglas / skills</strong><span class="muted">Asociadas al workspace</span></button>
      </div>
      <h3>Puertos con evidencia</h3>
      <table>
        <thead><tr><th>Proyecto</th><th>Puerto</th><th>Fuente</th><th>Stack</th></tr></thead>
        <tbody>${portRows || '<tr><td colspan="4" class="muted">Sin componentes.</td></tr>'}</tbody>
      </table>
    </section>
    <section data-view="readme" hidden>
      <h2>Arquitectura (README)</h2>
      <p class="lead">Esto es lo que el LLM debe leer: nombres de todas partes, rutas, endpoints y el flujo. Descargable en <code>arquitectura.md</code>.</p>
      <div class="toolbar">
        <button type="button" class="btn" data-dl-flow>Descargar arquitectura.md</button>
      </div>
      <pre class="doc" data-q="arquitectura nombres rutas endpoints flujo">${esc(flowMd || 'Todavía no hay README. Pedí regenerar la arquitectura.')}</pre>
    </section>
    <section data-view="mapa" hidden>
      <h2>Cómo se conectan</h2>
      <p class="lead">Rol, framework, BD, puerto (solo si hay evidencia), prefix y skills. Las flechas son proxy, API, lambda o datos.</p>
      <div class="toolbar">
        <button type="button" class="btn" data-dl-flow>Descargar arquitectura.md</button>
      </div>
      <div class="grid">${projCards || '<div class="empty">Corrê bootstrap desde el workspace del producto.</div>'}</div>
      <div id="flow-mermaid" class="mermaid" style="margin-top:1rem"></div>
      <pre id="flow-src">${esc(flowMermaid(projects, rels, flow))}</pre>
    </section>
    <section data-view="capas" hidden>
      <h2>Capas y trazabilidad</h2>
      <p class="lead">Presentación, API, datos, cloud. El E2E es el camino usuario → UI → proxy → API → persistencia.</p>
      <div class="toolbar">
        <button type="button" class="btn" data-dl-flow>Descargar arquitectura.md</button>
      </div>
      <div id="layers-mermaid" class="mermaid"></div>
      <pre id="layers-src">${esc(flow ? buildLayersMermaid(flow) : flowMermaid(projects, rels))}</pre>
    </section>
    <section data-view="howto" hidden>
      <h2>Cómo se desarrolla y se prueba</h2>
      <p class="lead">Inferido de manifiestos y scripts. No es un producto concreto: aplica a un repo o a varios conectados.</p>
      ${(flow?.how?.addFeature || []).map((x) => `<p>${esc(x)}</p>`).join('') || '<p class="muted">Generá el mapa (bootstrap) para ver esta guía.</p>'}
      <h3>Se toca</h3>
      <ul>${(flow?.how?.touch || []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">—</li>'}</ul>
      <h3>Qué no</h3>
      <ul>${(flow?.how?.ignore || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h3>Local</h3>
      <ul>${(flow?.how?.local || []).map((x) => `<li><code>${esc(x)}</code></li>`).join('') || '<li class="muted">Sin scripts dev en los manifiestos.</li>'}</ul>
      <h3>Probar un flujo</h3>
      <ul>${(flow?.how?.test || []).map((x) => `<li><code>${esc(x)}</code></li>`).join('')}</ul>
      <div id="e2e-mermaid" class="mermaid" style="margin-top:1rem"></div>
      <pre id="e2e-src">${esc(flow ? buildE2eMermaid(flow) : '')}</pre>
    </section>
    <section data-view="diagramas" hidden>
      <h2>Diagramas</h2>
      <p class="lead">Abrí uno para ampliarlo a pantalla completa o descargarlo en Markdown (mermaid incluido).</p>
      <div class="hero">${diagramCards}</div>
    </section>
    <section data-view="cerebro" hidden>
      <h2>Qué se ha trabajado</h2>
      <p class="lead">Diario del cerebro (<code>.afn/memory/cerebro.json</code>). Decisiones, no el chat entero. Es lo que da valor al preguntar.</p>
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
</div>
<div id="overlay" class="overlay" hidden>
  <div class="sheet">
    <div class="sheet-bar">
      <div>
        <h2 id="ov-title">Diagrama</h2>
        <p id="ov-meta" class="muted"></p>
      </div>
      <div class="sheet-actions">
        <button type="button" class="btn" data-expand>Ampliar</button>
        <button type="button" class="btn" data-dl>Descargar .md</button>
        <button type="button" class="x" data-close aria-label="Cerrar">×</button>
      </div>
    </div>
    <div id="ov-mermaid" class="mermaid"></div>
  </div>
</div>
<script type="application/json" id="diagrams-data">${payload.replace(/</g, '\\u003c')}</script>
<script type="text/plain" id="flow-md">${esc(flowMd || '')}</script>
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
    root: data.root,
    projects: data.projects.length,
    observations: data.cerebro.observations.length,
    diagrams: data.diagrams.length,
    assets: data.assets.length,
    hint: opened ? 'Dashboard abierto. Ampliar / descargar .md en cada diagrama.' : `Abrí: ${file}`,
  };
}

export { collectDashboard, buildHtml, flowMermaid };
