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
import { listTaskNotes } from './task-notes.js';
import { workbenchNavButtons, workbenchSections, workbenchScript } from './dashboard-workbench.js';
import { skillsCss, skillsNavButton, skillsScript, skillsSection } from './dashboard-skills-ui.js';
import { extractCss, extractNavButton, extractScript, extractSection } from './dashboard-extract-ui.js';
import { projectBarHtml, projectBarScript, projectBarCss } from './dashboard-project-ui.js';
import { FLOW_GENERATOR_VERSION } from './version.js';

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

function inlineMd(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function tableHtml(rows) {
  const parsed = rows
    .filter((r) => !/^\s*\|[\s:|-]+\|/.test(r))
    .map((r) => r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim()));
  if (!parsed.length) return '';
  const head = parsed[0];
  const body = parsed.slice(1);
  return `<div class="table-wrap"><table class="doc-table"><thead><tr>${head.map((c) => `<th>${inlineMd(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inlineMd(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/** Markdown del README AFN → HTML (sin dependencias). */
export function mdToHtml(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*<!--/.test(line)) {
      i += 1;
      continue;
    }
    if (/^\s*\|/.test(line) && lines[i + 1] && /[-|]{3,}/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(lines[i]);
        i += 1;
      }
      out.push(tableHtml(rows));
      continue;
    }
    if (/^### /.test(line)) {
      out.push(`<h3>${inlineMd(line.slice(4))}</h3>`);
      i += 1;
      continue;
    }
    if (/^## /.test(line)) {
      out.push(`<h2>${inlineMd(line.slice(3))}</h2>`);
      i += 1;
      continue;
    }
    if (/^# /.test(line)) {
      out.push(`<h1>${inlineMd(line.slice(2))}</h1>`);
      i += 1;
      continue;
    }
    if (/^[-*] /.test(line)) {
      out.push('<ul>');
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        out.push(`<li>${inlineMd(lines[i].replace(/^[-*] /, ''))}</li>`);
        i += 1;
      }
      out.push('</ul>');
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      out.push('<ol>');
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        out.push(`<li>${inlineMd(lines[i].replace(/^\d+\.\s/, ''))}</li>`);
        i += 1;
      }
      out.push('</ol>');
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    out.push(`<p>${inlineMd(line)}</p>`);
    i += 1;
  }
  return out.join('\n') || '<p class="muted">Todavía no hay README. Pedí regenerar la arquitectura.</p>';
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
  const flowMd = readText(path.join(root, 'ARQUITECTURA.md'))
    || readText(afnPath(root, 'ARQUITECTURA.md'))
    || readText(afnPath(root, 'diagrams', 'arquitectura.md'))
    || readText(afnPath(root, 'diagrams', 'workspace-flow.md'))
    || (flow ? workspaceFlowMarkdown(flow) : '');
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
    datosMd: readText(afnPath(root, 'diagrams', 'datos.md')),
    dbOrigins: (() => {
      const pack = readJson(afnPath(root, 'db-connections.json'));
      const list = Array.isArray(pack?.connections) ? pack.connections : Array.isArray(pack) ? pack : [];
      return list
        .filter((c) => c && (c.id || c.name || c.connectionName))
        .map((c) => ({
          id: String(c.id || '').slice(0, 80),
          name: String(c.name || c.connectionName || '').slice(0, 80),
          engine: String(c.engine || c.dbEngine || '').slice(0, 40),
          host: String(c.host || c.server || '').slice(0, 80),
          database: String(c.database || '').slice(0, 80),
          project: String(c.project || '').slice(0, 80),
        }));
    })(),
    notes: listTaskNotes(root, { includeBody: true }),
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

function buildHtml(data, opts = {}) {
  const { root, projects, rels, cerebro, memoryMd, diagrams, ignorePaths, contextSafe, assets, flow, flowMd, datosMd = '', notes = [], dbOrigins = [] } = data;
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
  const notesPayload = JSON.stringify(
    notes.map((n) => ({
      slug: n.slug,
      title: n.title,
      status: n.status,
      updatedAt: n.updatedAt,
      docs: (n.docs || []).map((d) => ({
        name: d.name,
        title: d.title,
        markdown: d.markdown || '',
        html: mdToHtml(d.markdown || ''),
      })),
    })),
  );
  const statusLabel = (s) => ({ draft: 'Borrador', listo: 'Listo', aprobado: 'Aprobado' }[s] || s);
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
            `<button type="button" class="diagram-card" data-open="${esc(d.slug)}" data-q="${esc(`${d.title} ${d.type} ${d.slug}`)}" aria-label="Ampliar diagrama ${esc(d.title)}">
              <span class="k">${esc(d.type)}</span>
              <strong>${esc(d.title)}</strong>
              <span class="muted">${d.nodes} componentes · ${d.edges} enlaces</span>
              <span class="cta">Ampliar a pantalla completa →</span>
            </button>`,
        )
        .join('')
    : `<div class="empty">Aún no hay diagramas. El README de arquitectura está en la pestaña Arquitectura.</div>`;

  const noteCards = notes.length
    ? notes
        .map(
          (n) =>
            `<button type="button" class="tile" data-note-task="${esc(n.slug)}" data-q="${esc([n.title, n.slug, n.status, ...(n.docs || []).map((d) => d.title)].join(' '))}">
              <span class="k">${esc(statusLabel(n.status))}</span>
              <strong>${esc(n.title)}</strong>
              <span class="muted">${(n.docs || []).length} documentos · ${esc(n.slug)}</span>
              <span class="cta">Abrir tarea →</span>
            </button>`,
        )
        .join('')
    : `<div class="empty">Todavía no hay entregas. En Kiro pedí <strong>guardá el README de esta tarea</strong>. Quedan en <code>.afn/notes/tareas/</code>, no en ARQUITECTURA.md.</div>`;

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
  const readmeHtml = mdToHtml(flowMd);
  const hasReadme = Boolean(String(flowMd || '').trim());
  const hasDatos = Boolean(String(datosMd || '').trim());
  const originsHtml = dbOrigins.length
    ? `<div class="table-wrap"><table class="doc-table"><thead><tr><th>Id</th><th>Nombre</th><th>Motor</th><th>Host</th><th>Base</th><th>Repo</th></tr></thead><tbody>${dbOrigins
        .map(
          (o) =>
            `<tr><td><code>${esc(o.id)}</code></td><td>${esc(o.name)}</td><td>${esc(o.engine)}</td><td>${esc(o.host)}</td><td>${esc(o.database)}</td><td>${esc(o.project)}</td></tr>`,
        )
        .join('')}</tbody></table></div>`
    : '';
  const datosHtml = hasDatos
    ? mdToHtml(datosMd)
    : '<p class="muted">El init arma el catálogo en <code>.afn/db-connections.json</code> (puede haber varios orígenes: un repo, un compose, un env). <code>db-connection.json</code> es solo la sesión activa. Kiro consulta con la tool <code>afn_sql</code> del MCP afn-context. Esta pestaña SQL es para la persona (no hace falta npx data-agent).</p>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>AFN · ${esc(wsName)}</title>
${opts.api?.token ? `<script>window.AFN_API={token:${JSON.stringify(opts.api.token)},base:location.origin};</script>` : '<script>window.AFN_API=null;</script>'}
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "strict",
    flowchart: { useMaxWidth: false, htmlLabels: true, curve: "basis", padding: 18, nodeSpacing: 56, rankSpacing: 72 },
    sequence: { useMaxWidth: false, mirrorActors: false },
  });
  const diagrams = JSON.parse(document.getElementById("diagrams-data").textContent);
  const bySlug = Object.fromEntries(diagrams.map((d) => [d.slug, d]));
  const notes = JSON.parse(document.getElementById("notes-data")?.textContent || "[]");
  const notesBy = Object.fromEntries(notes.map((n) => [n.slug, n]));
  const flowMd = document.getElementById("flow-md")?.textContent || "";
  const stage = { s: 1, x: 0, y: 0, drag: false, px: 0, py: 0 };

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  function prepSvg(el) {
    const svg = el?.querySelector("svg");
    if (!svg) return;
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.maxWidth = "none";
    svg.style.width = "auto";
    svg.style.height = "auto";
    svg.style.minWidth = "720px";
  }

  function applyZoom() {
    const svg = document.querySelector("#ov-stage svg");
    if (!svg) return;
    svg.style.transformOrigin = "0 0";
    svg.style.transform = "translate(" + stage.x + "px," + stage.y + "px) scale(" + stage.s + ")";
  }

  function resetZoom() {
    stage.s = 1;
    stage.x = 24;
    stage.y = 24;
    applyZoom();
  }

  async function render(el, src) {
    if (!el || !src) return;
    try {
      el.removeAttribute("data-processed");
      el.innerHTML = "";
      el.textContent = src;
      await mermaid.run({ nodes: [el] });
      prepSvg(el);
    } catch (_) { /* overlay igual muestra el título */ }
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
      if (sec.getAttribute("data-view") === "sql" && document.querySelector("nav button.on")?.dataset.go === "sql") {
        sec.hidden = false;
        return;
      }
      const any = Array.from(sec.querySelectorAll("[data-q]")).some((el) => !el.hidden);
      sec.hidden = !any;
    });
    if (typeof window.afnSqlFind === "function") window.afnSqlFind(document.getElementById("q")?.value || "");
    if (!q) {
      const on = document.querySelector("nav button.on")?.dataset.go || "readme";
      showView(on);
    }
  }

  function showView(id) {
    document.querySelectorAll("[data-view]").forEach((n) => n.hidden = n.getAttribute("data-view") !== id);
    document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.go === id));
    const sqlPreview = document.getElementById("wb-sql-inspect");
    if (id !== "sql" && sqlPreview) sqlPreview.classList.remove("fs");
    const project = document.getElementById("afn-project");
    if (project) project.hidden = id === "sql";
    document.querySelector("main")?.classList.toggle("sql-focus", id === "sql");
    if (id === "mapa") render(document.getElementById("flow-mermaid"), document.getElementById("flow-src").textContent);
    if (id === "capas") render(document.getElementById("layers-mermaid"), document.getElementById("layers-src").textContent);
    if (id === "howto") render(document.getElementById("e2e-mermaid"), document.getElementById("e2e-src").textContent);
    if (id === "skills" && window.afnSkillsOnShow) window.afnSkillsOnShow();
    if (id === "extract" && window.afnExtractOnShow) window.afnExtractOnShow();
    if (id === "notas" && !location.hash.startsWith("#n-")) {
      const list = document.getElementById("notes-list");
      const reader = document.getElementById("notes-reader");
      if (list) list.hidden = false;
      if (reader) reader.hidden = true;
    }
  }

  function showNote(slug, file) {
    showView("notas");
    const list = document.getElementById("notes-list");
    const reader = document.getElementById("notes-reader");
    const t = notesBy[slug];
    if (!t) {
      if (list) list.hidden = false;
      if (reader) reader.hidden = true;
      if (location.hash !== "#notas") location.hash = "notas";
      return;
    }
    if (list) list.hidden = true;
    if (reader) reader.hidden = false;
    const doc = (t.docs || []).find((d) => d.name === file) || t.docs[0];
    const crumb = document.getElementById("note-crumb");
    const st = document.getElementById("note-status");
    if (crumb) crumb.textContent = t.title;
    if (st) st.textContent = t.status === "aprobado" ? "Aprobado" : t.status === "listo" ? "Listo" : "Borrador";
    const toc = document.getElementById("note-toc");
    if (toc) {
      toc.innerHTML = (t.docs || []).map((d) => {
        const on = doc && d.name === doc.name ? " on" : "";
        return '<button type="button" class="btn' + on + '" data-note-task="' + t.slug + '" data-note-file="' + d.name.replace(/"/g, "") + '">' + (d.title || d.name) + "</button>";
      }).join("");
    }
    const art = document.getElementById("note-article");
    if (art) art.innerHTML = (doc && doc.html) || "<p class='muted'>Vacío.</p>";
    const dl = document.getElementById("note-dl");
    if (dl) {
      dl.dataset.slug = t.slug;
      dl.dataset.file = doc ? doc.name : "nota.md";
    }
    const hash = "n-" + t.slug + (doc ? "/" + doc.name : "");
    if (location.hash.replace("#", "") !== hash) location.hash = hash;
  }

  async function openCanvas(title, src, file) {
    const ov = document.getElementById("overlay");
    if (!ov || !src) return;
    document.getElementById("ov-title").textContent = title || "Diagrama";
    document.getElementById("ov-meta").textContent = (file || "") + " · rueda = zoom · arrastrar = mover · + / −";
    ov.dataset.src = src;
    ov.hidden = false;
    ov.classList.add("wide");
    const host = document.getElementById("ov-mermaid");
    await render(host, src);
    resetZoom();
  }

  function openDiagram(slug) {
    const d = bySlug[slug];
    if (!d) return;
    location.hash = "d-" + slug;
    showView("diagramas");
    openCanvas(d.title, d.mermaid, d.file);
    document.getElementById("overlay").dataset.slug = slug;
  }

  function closeOverlay() {
    const ov = document.getElementById("overlay");
    ov.hidden = true;
    ov.classList.remove("wide");
    if (location.hash.startsWith("#d-")) history.replaceState(null, "", "#readme");
  }

  function toggleExpand() {
    const ov = document.getElementById("overlay");
    ov.classList.add("wide");
    resetZoom();
  }

  function downloadOpen() {
    const slug = document.getElementById("overlay").dataset.slug;
    const d = bySlug[slug];
    const src = document.getElementById("overlay").dataset.src || (d && d.mermaid) || "";
    const md = (d && d.markdown) || ("# " + (d?.title || "diagrama") + "\\n\\n\`\`\`mermaid\\n" + src + "\\n\`\`\`\\n");
    downloadText((d?.slug || "diagrama") + ".architecture.md", md);
  }

  window.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) { e.preventDefault(); showView(go.dataset.go); location.hash = go.dataset.go; }
    const noteBtn = e.target.closest("[data-note-task]");
    if (noteBtn) { e.preventDefault(); showNote(noteBtn.dataset.noteTask, noteBtn.dataset.noteFile || ""); }
    if (e.target.closest("[data-note-back]")) { e.preventDefault(); showNote("", ""); }
    if (e.target.closest("[data-dl-note]")) {
      e.preventDefault();
      const b = document.getElementById("note-dl");
      const t = notesBy[b?.dataset.slug];
      const doc = (t?.docs || []).find((d) => d.name === b?.dataset.file);
      downloadText(b?.dataset.file || "nota.md", doc?.markdown || "");
    }
    const open = e.target.closest("[data-open]");
    if (open) { e.preventDefault(); openDiagram(open.dataset.open); }
    const canvas = e.target.closest("[data-canvas]");
    if (canvas) {
      e.preventDefault();
      const srcEl = document.getElementById(canvas.dataset.canvas);
      openCanvas(canvas.dataset.title || "Diagrama", srcEl?.textContent || "", canvas.dataset.title);
    }
    if (e.target.closest("[data-close]")) closeOverlay();
    if (e.target.closest("[data-expand]")) { e.preventDefault(); toggleExpand(); }
    if (e.target.closest("[data-dl]")) { e.preventDefault(); downloadOpen(); }
    if (e.target.closest("[data-dl-flow]")) {
      e.preventDefault();
      downloadText("ARQUITECTURA.md", flowMd || "# Arquitectura\\n");
    }
    const z = e.target.closest("[data-zoom]");
    if (z) {
      e.preventDefault();
      const k = z.dataset.zoom;
      if (k === "in") stage.s = Math.min(4, stage.s * 1.2);
      if (k === "out") stage.s = Math.max(0.25, stage.s / 1.2);
      if (k === "fit") { stage.s = 1; stage.x = 24; stage.y = 24; }
      applyZoom();
    }
  });
  window.addEventListener("input", (e) => {
    if (e.target && e.target.id === "q") applySearch();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target && e.target.id === "q" && typeof window.afnSqlFindNext === "function") {
      e.preventDefault();
      window.afnSqlFindNext(e.shiftKey ? "prev" : "next");
    }
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
  const stageEl = () => document.getElementById("ov-stage");
  window.addEventListener("wheel", (e) => {
    const box = stageEl();
    if (!box || document.getElementById("overlay").hidden) return;
    if (!box.contains(e.target)) return;
    e.preventDefault();
    const next = e.deltaY < 0 ? stage.s * 1.08 : stage.s / 1.08;
    stage.s = Math.min(4, Math.max(0.2, next));
    applyZoom();
  }, { passive: false });
  window.addEventListener("pointerdown", (e) => {
    const box = stageEl();
    if (!box || document.getElementById("overlay").hidden || !box.contains(e.target)) return;
    if (e.target.closest("button")) return;
    stage.drag = true;
    stage.px = e.clientX - stage.x;
    stage.py = e.clientY - stage.y;
    box.setPointerCapture?.(e.pointerId);
  });
  window.addEventListener("pointermove", (e) => {
    if (!stage.drag) return;
    stage.x = e.clientX - stage.px;
    stage.y = e.clientY - stage.py;
    applyZoom();
  });
  window.addEventListener("pointerup", () => { stage.drag = false; });
  window.addEventListener("hashchange", () => {
    const h = location.hash.replace("#", "");
    if (h.startsWith("d-")) openDiagram(h.slice(2));
    else if (h.startsWith("n-")) {
      const rest = h.slice(2);
      const i = rest.indexOf("/");
      showNote(i < 0 ? rest : rest.slice(0, i), i < 0 ? "" : rest.slice(i + 1));
    }
    else if (h) showView(h);
  });
  const boot = location.hash.replace("#", "") || "readme";
  if (boot.startsWith("d-")) openDiagram(boot.slice(2));
  else if (boot.startsWith("n-")) {
    const rest = boot.slice(2);
    const i = rest.indexOf("/");
    showNote(i < 0 ? rest : rest.slice(0, i), i < 0 ? "" : rest.slice(i + 1));
  }
  else showView(["inicio","readme","datos","origenes","esquema","sql","mapa","diagramas","capas","howto","cerebro","reglas","notas","skills","extract"].includes(boot) ? boot : "readme");
${workbenchScript()}
${skillsScript()}
${extractScript()}
${projectBarScript()}
</script>
<style>
  :root {
    --bg:#0b0f16; --panel:#141c27; --ink:#f4f7fb; --muted:#93a4b8;
    --acc:#5eead4; --acc2:#93c5fd; --line:#243044; --warn:#fbbf24;
    --ok:#34d399; --bar:#0e141c;
  }
  * { box-sizing:border-box; }
  [hidden] { display:none !important; }
  html,body { margin:0; height:100%; background:var(--bg); color:var(--ink); font:15px/1.5 "Segoe UI",system-ui,sans-serif; }
  .app { display:grid; grid-template-columns:240px minmax(0,1fr); min-height:100%; height:100%; }
  .app > div { min-width:0; height:100%; display:flex; flex-direction:column; overflow:hidden; }
  aside { background:var(--bar); border-right:1px solid var(--line); padding:0; display:flex; flex-direction:column; }
  .brand { padding:1.15rem 1.1rem .9rem; border-bottom:1px solid var(--line); }
  .brand .mark { font-size:.68rem; letter-spacing:.16em; text-transform:uppercase; color:var(--acc); font-weight:700; }
  .brand h1 { font-size:1.08rem; margin:.25rem 0 0; font-weight:650; }
  .brand .ws { font-size:.75rem; color:var(--muted); word-break:break-all; margin:.35rem 0 0; }
  .search-box { padding:.85rem 1rem 0; }
  #q { width:100%; margin:0 0 .45rem; padding:.55rem .7rem; border-radius:8px; border:1px solid var(--line); background:#0c1118; color:var(--ink); font:inherit; }
  #q:focus { outline:1px solid var(--acc); border-color:var(--acc); }
  #q-count, #q-empty { font-size:.72rem; color:var(--muted); margin:0 0 .45rem; padding:0 1rem; }
  nav { display:flex; flex-direction:column; gap:2px; padding:.4rem .7rem 1rem; }
  nav button { text-align:left; background:transparent; border:0; color:var(--muted); padding:.55rem .7rem; border-radius:8px; cursor:pointer; font:inherit; }
  nav button.on, nav button:hover { background:#1a2533; color:var(--ink); }
  .stat { font-size:.72rem; color:var(--muted); padding:0 1.1rem 1.2rem; margin-top:auto; word-break:break-all; }
  .top { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem 1.6rem .5rem; border-bottom:1px solid var(--line); }
  .badge { font-size:.72rem; letter-spacing:.04em; text-transform:uppercase; padding:.28rem .55rem; border-radius:999px; border:1px solid var(--line); color:var(--muted); }
  .badge.ok { color:var(--ok); border-color:#14532d; background:#052e16; }
  .badge.warn { color:var(--warn); border-color:#713f12; background:#1c1406; }
  main { padding:1.2rem 1.7rem 3.2rem; overflow:auto; min-width:0; min-height:0; flex:1; display:flex; flex-direction:column; }
  main.sql-focus { padding:.4rem .65rem .45rem; }
  h1,h2 { margin:0 0 .4rem; letter-spacing:-.02em; }
  h2 { font-size:1.32rem; }
  .lead { color:var(--muted); margin:0 0 1rem; max-width:70ch; }
  .hero { display:grid; grid-template-columns:repeat(auto-fit,minmax(168px,1fr)); gap:.7rem; margin-bottom:1.3rem; }
  .hero button, .tile, .diagram-card { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:1rem; text-align:left; color:inherit; cursor:pointer; font:inherit; display:flex; flex-direction:column; gap:.32rem; }
  .hero button:hover, .diagram-card:hover, .tile:hover { border-color:var(--acc); }
  .k { font-size:.68rem; text-transform:uppercase; letter-spacing:.1em; color:var(--acc); }
  .cta { color:var(--acc2); font-size:.8rem; margin-top:.35rem; }
  .muted { color:var(--muted); font-size:.82rem; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:.7rem; }
  .toolbar { display:flex; gap:.45rem; flex-wrap:wrap; margin:0 0 .9rem; }
  .btn { background:#1a2533; border:1px solid var(--line); color:var(--ink); border-radius:8px; padding:.45rem .8rem; font:inherit; cursor:pointer; }
  .btn.on { border-color:var(--acc); color:var(--acc); }
  #flow-src, #layers-src, #e2e-src, #flow-md { display:none; }
  .empty { background:var(--panel); border:1px dashed var(--line); border-radius:12px; padding:1rem 1.1rem; color:var(--muted); }
  table { width:100%; border-collapse:collapse; font-size:.86rem; }
  th,td { padding:.55rem .45rem; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
  th { color:var(--muted); font-weight:600; font-size:.72rem; text-transform:uppercase; letter-spacing:.06em; }
  .tag { display:inline-block; font-size:.68rem; padding:.12rem .4rem; border-radius:999px; background:#12352f; color:var(--acc); }
  ul,ol { margin:.2rem 0 1rem; padding-left:1.2rem; }
  li { margin:.35rem 0; }
  code { color:#f5d58a; font-size:.85rem; }
  .article { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:1.35rem 1.5rem 1.8rem; max-width:980px; }
  .article h1 { font-size:1.45rem; margin:0 0 .75rem; }
  .article h2 { font-size:1.08rem; margin:1.4rem 0 .5rem; color:var(--acc); text-transform:none; letter-spacing:0; }
  .article h3 { font-size:.95rem; margin:1rem 0 .4rem; color:var(--acc2); text-transform:none; letter-spacing:0; }
  .article p { margin:0 0 .7rem; color:#d7e0ea; }
  .table-wrap { overflow:auto; margin:0 0 1rem; }
  .doc-table { min-width:640px; }
  .canvas-wrap { background:#0b1016; border:1px solid var(--line); border-radius:12px; overflow:auto; min-height:420px; padding:1rem; }
  .canvas-wrap .mermaid { min-height:380px; overflow:visible; }
  .overlay { position:fixed; inset:0; background:#070b10; display:flex; flex-direction:column; z-index:30; }
  .overlay[hidden] { display:none; }
  .sheet { flex:1; display:flex; flex-direction:column; min-height:0; }
  .overlay.wide .sheet { width:100%; height:100%; max-height:none; border-radius:0; }
  .sheet-bar { display:flex; justify-content:space-between; gap:1rem; align-items:center; padding:.85rem 1.1rem; border-bottom:1px solid var(--line); background:#10161e; }
  .sheet-actions { display:flex; gap:.4rem; align-items:center; }
  .x { background:transparent; border:0; color:var(--muted); font-size:1.5rem; cursor:pointer; }
  #ov-stage { flex:1; overflow:hidden; cursor:grab; background:#0b1016; }
  #ov-stage:active { cursor:grabbing; }
  #ov-mermaid { min-height:100%; padding:1rem; }
  .sql-ed { width:100%; min-height:12rem; background:#0b1016; color:#e8eef5; border:1px solid var(--line); border-radius:10px; padding:.75rem .85rem; font:13px/1.45 Consolas,ui-monospace,monospace; tab-size:2; }
  .chk { display:block; padding:.28rem 0; }
  .chk input { margin-right:.4rem; }
  section[data-view="sql"].sql-ide:not([hidden]) { max-width:none; min-width:0; flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden; }
  .sql-head { display:flex; flex-wrap:wrap; gap:.4rem; align-items:center; margin:0 0 .4rem; flex-shrink:0; min-width:0; }
  .sql-head-title { font-size:.95rem; letter-spacing:-.02em; margin-right:.15rem; }
  .sql-head label { display:flex; align-items:center; gap:.35rem; font-size:.78rem; color:var(--muted); }
  .sql-head select, .sql-head input[type=number] { background:#0c1118; color:var(--ink); border:1px solid var(--line); border-radius:8px; padding:.32rem .45rem; font:inherit; }
  .sql-head input[type=number] { width:4.4rem; }
  .sql-head .btn { padding:.32rem .6rem; }
  .sql-head .btn-run { background:#14532d; border-color:#166534; color:#bbf7d0; font-weight:650; }
  .sql-head .btn-run:hover { border-color:var(--acc); }
  .sql-head #wb-sql-driver { font-size:.72rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:16rem; }
  .sql-export { display:flex; gap:.3rem; margin-left:.15rem; }
  .sql-ide-split { display:grid; grid-template-rows:auto minmax(0,1fr); flex:1; min-height:0; min-width:0; border:1px solid var(--line); border-radius:12px; overflow:hidden; background:#0b1016; }
  .sql-editor-wrap { display:grid; grid-template-columns:48px minmax(0,1fr); grid-template-rows:auto minmax(0,1fr); height:28vh; min-height:150px; max-width:100%; min-width:0; resize:vertical; overflow:hidden; border-bottom:1px solid var(--line); }
  .sql-pane-bar { grid-column:1 / -1; display:flex; align-items:center; gap:.35rem; padding:.28rem .55rem; background:#121a24; border-bottom:1px solid var(--line); font-size:.75rem; color:var(--muted); }
  .sql-editor-wrap.fs, .sql-results.fs { position:fixed; inset:0; z-index:42; width:100vw; height:100vh; max-height:none; max-width:100vw; min-height:0; min-width:0; resize:none; border:0; border-radius:0; background:#0b1016; overflow:hidden; }
  .sql-gutter { background:#0e1620; color:#5b6b7e; font:12px/1.55 Consolas,"Cascadia Mono",ui-monospace,monospace; text-align:right; padding:.75rem .45rem; user-select:none; overflow:hidden; white-space:pre; }
  #wb-sql-ed.sql-ed { min-height:0; min-width:0; max-width:100%; height:100%; border:0; border-radius:0; resize:none; overflow:auto; padding:.75rem .9rem; font:13.5px/1.55 Consolas,"Cascadia Mono",ui-monospace,monospace; color:#d6e4f0; background:#0b1016; outline:none; }
  .sql-results { display:flex; flex-direction:column; min-height:0; min-width:0; max-width:100%; overflow:hidden; background:#101820; }
  .sql-statusbar { display:flex; justify-content:space-between; gap:1rem; align-items:center; padding:.4rem .75rem; background:#0e141c; border-bottom:1px solid var(--line); font:12px/1.4 Consolas,ui-monospace,monospace; color:var(--muted); }
  .sql-rowbar { display:flex; flex-wrap:wrap; gap:.35rem; align-items:center; padding:.35rem .65rem; background:#121a24; border-bottom:1px solid var(--line); }
  .sql-rowbar .btn { padding:.28rem .55rem; font-size:.78rem; }
  .sql-ico { min-width:2rem; }
  .sql-grid-wrap { overflow-x:auto; overflow-y:auto; flex:1; min-height:0; min-width:0; max-width:100%; margin:0; scrollbar-width:thin; scrollbar-color:#5b6b7e #0e141c; }
  .sql-grid-wrap::-webkit-scrollbar { width:12px; height:12px; }
  .sql-grid-wrap::-webkit-scrollbar-thumb { background:#3d5166; border-radius:8px; }
  .sql-grid-wrap::-webkit-scrollbar-track, .sql-grid-wrap::-webkit-scrollbar-corner { background:#0e141c; }
  #wb-sql-grid { width:max-content; min-width:100%; max-width:none; font:12.5px/1.4 Consolas,"Cascadia Mono",ui-monospace,monospace; }
  #wb-sql-grid th { position:sticky; top:0; background:#15202c; z-index:1; white-space:nowrap; text-transform:none; letter-spacing:0; font-size:.78rem; }
  .sql-json-pane { display:flex; flex-direction:column; flex:1; min-height:0; min-width:0; }
  .sql-json-pane[hidden] { display:none !important; }
  .sql-json-find { display:flex; gap:.35rem; align-items:center; padding:.35rem .65rem; border-bottom:1px solid var(--line); background:#121a24; }
  .sql-json-find input { flex:1; min-width:8rem; background:#0c1118; color:var(--ink); border:1px solid var(--line); border-radius:8px; padding:.35rem .55rem; font:13px Consolas,ui-monospace,monospace; }
  .sql-json-body { margin:0; flex:1; min-height:0; overflow:auto; padding:.85rem 1rem; white-space:pre; word-break:break-word; font:12.5px/1.45 Consolas,ui-monospace,monospace; color:#e5e7eb; scrollbar-width:thin; scrollbar-color:#5b6b7e #0e141c; }
  .sql-json-body mark.sql-hit { background:#854d0e; color:#fef9c3; border-radius:2px; }
  .sql-json-body mark.sql-hit.on { background:#f59e0b; color:#111827; }
  #wb-sql-grid td { white-space:nowrap; max-width:28rem; overflow:hidden; text-overflow:ellipsis; }
  #wb-sql-grid td.sql-ck, #wb-sql-grid th.sql-ck, #wb-sql-grid td.sql-lupa, #wb-sql-grid th.sql-lupa { width:2.1rem; text-align:center; padding:.25rem .35rem; }
  #wb-sql-grid td.sql-val { cursor:copy; }
  #wb-sql-grid tbody tr { cursor:pointer; }
  #wb-sql-grid tbody tr:hover td { background:#1a2533; }
  #wb-sql-grid tbody tr.on td { background:#1e3a5f; }
${skillsCss()}
${extractCss()}
${projectBarCss()}
  .sql-lupa-btn { display:inline-flex; align-items:center; justify-content:center; width:1.7rem; height:1.7rem; border:1px solid #2a4a6a; background:#16324a; color:#7dd3fc; border-radius:6px; cursor:pointer; }
  .sql-lupa-btn:hover, .sql-lupa-btn.on { background:#2563eb; border-color:#3b82f6; color:#fff; }
  .sql-inspect { border-top:1px solid var(--line); background:#0b1016; height:250px; min-height:200px; max-height:40vh; display:flex; flex-direction:column; flex-shrink:0; }
  .sql-inspect[hidden] { display:none; }
  .sql-inspect.fs { position:fixed; inset:0; z-index:50; height:100%; max-height:none; min-height:0; border:0; background:#0b1016; }
  .sql-inspect-bar { display:flex; flex-wrap:wrap; gap:.35rem; align-items:center; padding:.4rem .65rem; background:#111827; border-bottom:1px solid var(--line); font-size:.78rem; }
  .sql-inspect-spacer { flex:1; }
  .sql-inspect-body { margin:0; padding:.85rem 1rem; overflow:auto; flex:1; font:13px/1.55 Consolas,"Cascadia Mono",ui-monospace,monospace; color:#e5e7eb; white-space:pre-wrap; word-break:break-word; background:#0b1016; }
  .sql-inspect .btn.on { background:#2563eb; border-color:#2563eb; color:#fff; }
  .script-panel { background:var(--panel); border:1px solid var(--line); border-radius:16px; padding:1rem 1.05rem 1.1rem; margin:0 0 1.2rem; }
  .script-form { display:flex; flex-wrap:wrap; gap:.7rem; align-items:flex-end; margin-top:.85rem; }
  .script-form label { display:flex; flex-direction:column; gap:.28rem; font-size:.72rem; letter-spacing:.04em; text-transform:uppercase; color:var(--muted); min-width:12rem; }
  .script-form input, .script-form select { text-transform:none; letter-spacing:0; font:inherit; color:var(--ink); background:#0c1118; border:1px solid var(--line); border-radius:8px; padding:.5rem .65rem; }
  .script-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:.7rem; }
  .script-item { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:.9rem 1rem; display:flex; flex-direction:column; gap:.35rem; }
  .script-item:hover { border-color:var(--acc); }
  .script-item strong { font-size:1rem; }
  .script-item .script-actions { display:flex; gap:.4rem; margin-top:.45rem; }
  .script-args-sheet { width:min(560px,100%); height:auto; }
  .script-args-body { padding:0 1.15rem 1.15rem; display:flex; flex-direction:column; gap:.75rem; }
  .script-param-list { display:flex; flex-direction:column; gap:.45rem; max-height:280px; overflow:auto; }
  .script-param-row { display:grid; grid-template-columns:minmax(7rem,1fr) minmax(9rem,1.4fr) auto; gap:.45rem; align-items:center; }
  .script-param-row input { font:13px/1.4 Consolas,ui-monospace,monospace; color:var(--ink); background:#0c1118; border:1px solid var(--line); border-radius:8px; padding:.5rem .65rem; width:100%; box-sizing:border-box; }
  .script-error { margin:.55rem .7rem 0; padding:.75rem .9rem; border-radius:10px; background:#3f1d1d; border:1px solid #7f1d1d; color:#fecaca; white-space:pre-wrap; word-break:break-word; font:12.5px/1.45 Consolas,ui-monospace,monospace; max-height:240px; overflow:auto; }
  .script-error[hidden] { display:none; }
  .fav-modal { position:fixed; inset:0; z-index:55; background:rgba(7,11,16,.72); display:flex; align-items:center; justify-content:center; padding:1.2rem; }
  .fav-modal[hidden] { display:none; }
  .fav-sheet { width:min(980px,100%); height:min(680px,90vh); background:#111827; border:1px solid var(--line); border-radius:16px; display:flex; flex-direction:column; box-shadow:0 24px 80px rgba(0,0,0,.5); overflow:hidden; }
  .fav-head { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; padding:1rem 1.15rem; border-bottom:1px solid var(--line); }
  .fav-head h3 { margin:.15rem 0 .25rem; font-size:1.15rem; }
  .fav-head .k { margin:0; }
  .fav-body { display:grid; grid-template-columns:minmax(220px,300px) 1fr; min-height:0; flex:1; }
  .fav-list { overflow:auto; border-right:1px solid var(--line); padding:.45rem; display:flex; flex-direction:column; gap:.35rem; }
  .fav-item { text-align:left; background:#0c1118; border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:.55rem .7rem; cursor:pointer; font:inherit; }
  .fav-item.on, .fav-item:hover { border-color:var(--acc); background:#1e3a5f; }
  .fav-item small { display:block; color:var(--muted); margin-top:.2rem; font-size:.72rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .fav-preview { display:flex; flex-direction:column; min-width:0; min-height:0; }
  .fav-preview-bar { display:flex; flex-wrap:wrap; gap:.35rem; align-items:center; padding:.55rem .75rem; border-bottom:1px solid var(--line); font-size:.82rem; }
  .fav-preview-sql { margin:0; padding:1rem 1.1rem; overflow:auto; flex:1; font:13px/1.55 Consolas,"Cascadia Mono",ui-monospace,monospace; color:#e5e7eb; white-space:pre; background:#0b1016; }
  @media (max-width:760px) { .fav-body { grid-template-columns:1fr; } .fav-list { max-height:34vh; border-right:0; border-bottom:1px solid var(--line); } }
</style>
</head>
<body data-afn-version="${esc(FLOW_GENERATOR_VERSION)}">
<div class="app">
  <aside>
    <div class="brand">
      <div class="mark">AFN context · v${esc(FLOW_GENERATOR_VERSION)}</div>
      <h1>Arquitectura y cerebro</h1>
      <p class="ws">${esc(wsName)}</p>
      <p id="wb-ver" class="muted" style="margin:.35rem 0 0;font-size:.72rem">Cargando…</p>
    </div>
    <div class="search-box">
      <label for="q" class="muted" style="display:block;font-size:.68rem;margin:0 0 .3rem;letter-spacing:.08em;text-transform:uppercase">Buscar</label>
      <input id="q" type="search" placeholder="Proyecto, ruta, diagrama…" autocomplete="off"/>
    </div>
    <p id="q-count" class="muted"></p>
    <p id="q-empty" hidden>Sin coincidencias. Probá otro término.</p>
    <nav>
      <button type="button" data-go="readme">README</button>
      <button type="button" data-go="datos">Datos${hasDatos ? ' (listo)' : ''}</button>
${workbenchNavButtons()}
      <button type="button" data-go="notas">Notas (${notes.length})</button>
      <button type="button" data-go="inicio">Inicio</button>
      <button type="button" data-go="mapa">Mapa (${projects.length})</button>
      <button type="button" data-go="diagramas">Diagramas (${diagrams.length})</button>
      <button type="button" data-go="capas">Capas y E2E</button>
      <button type="button" data-go="howto">Cómo se trabaja</button>
      <button type="button" data-go="cerebro">Memoria</button>
      <button type="button" data-go="reglas">Reglas (${assets.length})</button>
${skillsNavButton()}
${extractNavButton()}
    </nav>
    <p class="stat">${esc(root)}${ignorePaths.length ? `<br>ignorados: ${esc(ignorePaths.join(', '))}` : ''}</p>
  </aside>
  <div>
    <div class="top">
      <span class="badge ${verified ? 'ok' : 'warn'}">${verified ? 'Arquitectura verificada' : 'Pendiente de evidencia LLM'}</span>
      <span class="muted">v${esc(FLOW_GENERATOR_VERSION)} · ${projects.length} proyectos · ${rels.length} conexiones · ${hasReadme ? 'README listo' : 'sin README'}</span>
    </div>
    <main>
${projectBarHtml()}
    <section data-view="readme">
      <h2>Arquitectura (README)</h2>
      <p class="lead">Esto es lo que el LLM lee: contexto, contenedores, comunicación, flujo E2E, rutas y esquemas. Archivo: <code>ARQUITECTURA.md</code>.</p>
      <div class="toolbar">
        <button type="button" class="btn" data-dl-flow>Descargar ARQUITECTURA.md</button>
      </div>
      <article id="readme-article" class="article" data-q="arquitectura readme nombres rutas endpoints flujo contenedores esquemas">${readmeHtml}</article>
    </section>
    <section data-view="datos" hidden>
      <h2>Tablas y procedimientos</h2>
      <p class="lead">Varios repos pueden tener varias fuentes. Catálogo: <code>.afn/db-connections.json</code>. Esquema vivo: <code>.afn/diagrams/datos.md</code>.</p>
      ${originsHtml}
      <article id="datos-article" class="article" data-q="tablas procedimientos esquema sql mongo pa stored">${datosHtml}</article>
    </section>
${workbenchSections()}
    <section data-view="notas" hidden>
      <div id="notes-list">
        <h2>Notas de trabajo</h2>
        <p class="lead">Wiki de entregas por tarea (<code>.afn/notes/tareas/</code>). Distinto del README de arquitectura. Para guardar: en Kiro, «dejá el README de esta tarea». Para marcar terminado o aprobar: «marcala como listo/aprobado» (el dashboard no escribe a disco).</p>
        <div class="grid">${noteCards}</div>
      </div>
      <div id="notes-reader" hidden>
        <div class="toolbar">
          <button type="button" class="btn" data-note-back>← Volver a notas</button>
          <button type="button" class="btn" id="note-dl" data-dl-note>Descargar .md</button>
        </div>
        <p class="muted"><span id="note-crumb"></span> · <span id="note-status"></span></p>
        <div id="note-toc" class="toolbar"></div>
        <article id="note-article" class="article"></article>
      </div>
    </section>
    <section data-view="inicio" hidden>
      <h2>Qué hay en este workspace</h2>
      <p class="lead">El README es la fuente. Los diagramas se abren a pantalla completa, con zoom y arrastre.</p>
      <div class="hero">
        <button type="button" data-go="readme" data-q="arquitectura readme rutas endpoints flujo nombres"><span class="k">README</span><strong>Arquitectura</strong><span class="muted">${hasReadme ? 'Abrir documento' : 'Todavía vacío'}</span></button>
        <button type="button" data-go="datos" data-q="tablas procedimientos esquema sql mongo datos pa"><span class="k">BD</span><strong>Tablas y PAs</strong><span class="muted">${hasDatos ? 'Esquema vivo' : 'Listar desde Kiro'}</span></button>
        <button type="button" data-go="origenes" data-q="origenes db-connections json conexiones"><span class="k">Orígenes</span><strong>Editar conexiones</strong><span class="muted">db-connections.json</span></button>
        <button type="button" data-go="esquema" data-q="elegir tablas procedimientos pa tables-config"><span class="k">Elegir</span><strong>Tablas / PAs</strong><span class="muted">Solo lo del flujo</span></button>
        <button type="button" data-go="sql" data-q="sql consulta select editor"><span class="k">SQL</span><strong>Editor SELECT</strong><span class="muted">Como Reportes BD</span></button>
        <button type="button" data-go="notas" data-q="notas wiki tareas entregas readme listo aprobado"><span class="k">Wiki</span><strong>${notes.length} entregas</strong><span class="muted">README por tarea</span></button>
        <button type="button" data-go="mapa" data-q="mapa proyectos conexiones flujo"><span class="k">Mapa</span><strong>${projects.length} proyectos</strong><span class="muted">${rels.length} conexiones</span></button>
        <button type="button" data-go="diagramas" data-q="diagramas mapas flujo componentes"><span class="k">Diagramas</span><strong>${diagrams.length} mapas</strong><span class="muted">Pantalla completa + zoom</span></button>
        <button type="button" data-go="capas" data-q="capas presentación api datos e2e trazabilidad"><span class="k">Capas</span><strong>Presentación · API · datos</strong><span class="muted">Quién llama qué</span></button>
        <button type="button" data-go="howto" data-q="local test desarrollar probar feature"><span class="k">Local / test</span><strong>Cómo agregar y probar</strong><span class="muted">Qué se toca y qué no</span></button>
        <button type="button" data-go="cerebro" data-q="memoria cerebro sesiones hechos"><span class="k">Memoria</span><strong>${lastSess ? esc(lastSess.goal || 'Sesión') : 'Sin sesiones'}</strong><span class="muted">${obs.length} hechos recientes</span></button>
        <button type="button" data-go="reglas" data-q="kiro copilot steering skills reglas"><span class="k">Kiro · Copilot</span><strong>${assets.length} reglas / skills</strong><span class="muted">Asociadas al workspace</span></button>
        <button type="button" data-go="skills" data-q="skills kiro editar flujo caja"><span class="k">Skills</span><strong>Abrir y editar</strong><span class="muted">Reutilizar sin tokens</span></button>
        <button type="button" data-go="extract" data-q="pdf excel imagen markdown textos"><span class="k">Textos</span><strong>PDF, Excel, imagen</strong><span class="muted">Siempre a .md</span></button>
      </div>
      <h3>Puertos con evidencia</h3>
      <table>
        <thead><tr><th>Proyecto</th><th>Puerto</th><th>Fuente</th><th>Stack</th></tr></thead>
        <tbody>${portRows || '<tr><td colspan="4" class="muted">Sin componentes.</td></tr>'}</tbody>
      </table>
    </section>
    <section data-view="mapa" hidden>
      <h2>Cómo se conectan</h2>
      <p class="lead">Contenedores del workspace. Ampliar abre el diagrama a pantalla completa (zoom con rueda, arrastrar para mover).</p>
      <div class="toolbar">
        <button type="button" class="btn" data-canvas="flow-src" data-title="Cómo se conectan">Ampliar diagrama</button>
        <button type="button" class="btn" data-dl-flow>Descargar ARQUITECTURA.md</button>
      </div>
      <div class="grid">${projCards || '<div class="empty">Corrê bootstrap desde el workspace del producto.</div>'}</div>
      <div class="canvas-wrap" style="margin-top:1rem">
        <div id="flow-mermaid" class="mermaid"></div>
      </div>
      <pre id="flow-src">${esc(flowMermaid(projects, rels, flow))}</pre>
    </section>
    <section data-view="capas" hidden>
      <h2>Capas y trazabilidad</h2>
      <p class="lead">Presentación, API, datos, cloud. Ampliar para verlo usable.</p>
      <div class="toolbar">
        <button type="button" class="btn" data-canvas="layers-src" data-title="Capas">Ampliar diagrama</button>
        <button type="button" class="btn" data-dl-flow>Descargar ARQUITECTURA.md</button>
      </div>
      <div class="canvas-wrap">
        <div id="layers-mermaid" class="mermaid"></div>
      </div>
      <pre id="layers-src">${esc(flow ? buildLayersMermaid(flow) : flowMermaid(projects, rels))}</pre>
    </section>
    <section data-view="howto" hidden>
      <h2>Cómo se desarrolla y se prueba</h2>
      <p class="lead">Inferido de manifiestos y scripts.</p>
      ${(flow?.how?.addFeature || []).map((x) => `<p>${esc(x)}</p>`).join('') || '<p class="muted">Generá el mapa (bootstrap) para ver esta guía.</p>'}
      <h3>Se toca</h3>
      <ul>${(flow?.how?.touch || []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">—</li>'}</ul>
      <h3>Qué no</h3>
      <ul>${(flow?.how?.ignore || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h3>Local</h3>
      <ul>${(flow?.how?.local || []).map((x) => `<li><code>${esc(x)}</code></li>`).join('') || '<li class="muted">Sin scripts dev en los manifiestos.</li>'}</ul>
      <h3>Probar un flujo</h3>
      <ul>${(flow?.how?.test || []).map((x) => `<li><code>${esc(x)}</code></li>`).join('')}</ul>
      <div class="toolbar" style="margin-top:1rem">
        <button type="button" class="btn" data-canvas="e2e-src" data-title="Flujo E2E">Ampliar E2E</button>
      </div>
      <div class="canvas-wrap">
        <div id="e2e-mermaid" class="mermaid"></div>
      </div>
      <pre id="e2e-src">${esc(flow ? buildE2eMermaid(flow) : '')}</pre>
    </section>
    <section data-view="diagramas" hidden>
      <h2>Diagramas</h2>
      <p class="lead">Clic = pantalla completa. Rueda para zoom, arrastrar para mover, + / − / encajar.</p>
      <div class="hero">${diagramCards}</div>
    </section>
    <section data-view="cerebro" hidden>
      <h2>Qué se ha trabajado</h2>
      <p class="lead">Diario del cerebro (<code>.afn/memory/cerebro.json</code>). Decisiones, no el chat entero.</p>
      <h3>Sesiones</h3>
      <ul>${sessHtml}</ul>
      <h3>Hechos</h3>
      <ul>${obsHtml}</ul>
      ${memoryMd ? `<h3>MEMORY.md</h3><pre class="muted" style="white-space:pre-wrap">${esc(memoryMd.slice(0, 1800))}</pre>` : ''}
      ${contextSafe ? `<h3>context.json (redactado)</h3><pre class="muted" style="white-space:pre-wrap">${esc(JSON.stringify(contextSafe, null, 2).slice(0, 1800))}</pre>` : ''}
    </section>
${skillsSection()}
${extractSection()}
    <section data-view="reglas" hidden>
      <h2>Steering, skills e instrucciones</h2>
      <p class="lead">Kiro, Copilot (.github), Cursor y AFN.</p>
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
        <button type="button" class="btn" data-zoom="out">−</button>
        <button type="button" class="btn" data-zoom="in">+</button>
        <button type="button" class="btn" data-zoom="fit">Encajar</button>
        <button type="button" class="btn" data-expand>Ampliar</button>
        <button type="button" class="btn" data-dl>Descargar .md</button>
        <button type="button" class="x" data-close aria-label="Cerrar">×</button>
      </div>
    </div>
    <div id="ov-stage">
      <div id="ov-mermaid" class="mermaid"></div>
    </div>
  </div>
</div>
<script type="application/json" id="diagrams-data">${payload.replace(/</g, '\\u003c')}</script>
<script type="application/json" id="notes-data">${notesPayload.replace(/</g, '\\u003c')}</script>
<script type="text/plain" id="flow-md">${esc(flowMd || '')}</script>
</body>
</html>
`;
}

function openInBrowser(fileAbs, hash = '') {
  const url = `${pathToFileURL(fileAbs).href}${hash}`;
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
    return true;
  } catch {
    return false;
  }
}

function openUrl(url) {
  const target = String(url || '').trim();
  if (!target) return false;
  try {
    if (process.platform === 'win32') {
      spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-WindowStyle',
          'Hidden',
          '-Command',
          `Start-Process -FilePath ${JSON.stringify(target)}`,
        ],
        { detached: true, stdio: 'ignore', windowsHide: true },
      ).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [target], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [target], { detached: true, stdio: 'ignore' }).unref();
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
  const hash = opts.slug ? `#d-${opts.slug}` : '#readme';
  const shouldOpen = opts.open !== false;
  let opened = false;
  let url = `${pathToFileURL(file).href}${hash}`;
  if (shouldOpen && opts.serve === false) {
    opened = openInBrowser(file, hash);
  }
  return {
    ok: true,
    file,
    url,
    opened,
    root: data.root,
    projects: data.projects.length,
    observations: data.cerebro.observations.length,
    diagrams: data.diagrams.length,
    assets: data.assets.length,
    notes: data.notes.length,
    readme: Boolean(String(data.flowMd || '').trim()),
    hint: opened
      ? 'Dashboard abierto. Para editar orígenes y SQL usá el servidor local (afn_dashboard).'
      : `Abrí: ${file}`,
  };
}

/** Abre el dashboard en http://127.0.0.1 (editar JSON, elegir tablas/PAs, SQL). */
export async function openDashboard(root, opts = {}) {
  const written = writeDashboard(root, { open: false, slug: opts.slug });
  if (opts.open === false) return written;
  const { startDashboardServer, dashboardPublicUrl } = await import('./dashboard-server.js');
  let hash = '#readme';
  if (opts.hash) hash = String(opts.hash).startsWith('#') ? String(opts.hash) : `#${opts.hash}`;
  else if (opts.slug) hash = `#d-${opts.slug}`;
  const info = await startDashboardServer(root, { port: opts.port });
  const url = dashboardPublicUrl(info, hash);
  const opened = opts.browser === false ? false : openUrl(url);
  return {
    ...written,
    url,
    opened,
    server: true,
    reused: info.reused === true,
    port: info.port,
    version: FLOW_GENERATOR_VERSION,
    hint: `Dashboard v${FLOW_GENERATOR_VERSION} en ${url} — CLI sin tokens: node …/index.js dashboard. Si dice «archivo local» no es esta URL.`,
  };
}

export { collectDashboard, buildHtml, flowMermaid };
