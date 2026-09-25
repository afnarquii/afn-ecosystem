import fs from 'node:fs';
import path from 'node:path';
import { afnPath } from './paths.js';
import { resolveProjectRoot, isAfnEcosystemCatalog } from './resolve-root.js';
import { bootstrapAfn } from './bootstrap.js';
import { searchFacts } from './memory.js';
import { saveObservation, searchCerebro, startSession, endSession, getMemContext } from './cerebro.js';
import { searchCatalogMemory } from './catalog-registry.js';
import { openDashboard } from './dashboard.js';
import { listTaskNotes, saveTaskNote, setTaskNoteStatus } from './task-notes.js';
import { persistWorkspaceFlowDiagram } from './diagram-store.js';
import { persistAgentAssets } from './agent-assets.js';
import { architectureExists, loadWorkspaceFlow } from './workspace-flow.js';
import { buildSnapshot, doctorAfn } from './snapshot.js';
import { collectArchitectureEvidence, commitArchitecture, LLM_ARCHITECTURE_PROMPT } from './architecture-llm.js';
import { collectDataSources, commitLiveSchema } from './data-sources.js';
import { runDashboardSql } from './dashboard-query.js';
import { agentScriptView, listScriptRunners, runScriptRunner } from './script-runners.js';
import { extractFileToMarkdown } from './extract-text.js';
import {
  compactBootstrap,
  compactCommit,
  compactDiagramResult,
  compactEvidence,
  compactProject,
  compactRel,
  compactDashboard,
} from './compact-result.js';
import {
  activeProjects,
  activeRelationships,
  applyIgnorePath,
  normalizeProjectsConfig,
} from './projects-policy.js';

function readProjects(root) {
  try {
    return normalizeProjectsConfig(JSON.parse(fs.readFileSync(afnPath(root, 'projects.json'), 'utf8')));
  } catch {
    return normalizeProjectsConfig();
  }
}

function writeProjects(root, cfg) {
  fs.mkdirSync(afnPath(root), { recursive: true });
  fs.writeFileSync(afnPath(root, 'projects.json'), `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
}

function compactSqlValue(v) {
  if (v == null) return v;
  if (typeof v === 'string') return v.length > 400 ? `${v.slice(0, 397)}…` : v;
  if (v instanceof Date) return v.toISOString();
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) return `[binary ${v.length}]`;
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s.length > 400 ? `${s.slice(0, 397)}…` : v;
  }
  return v;
}

function compactSqlRows(rows, cap) {
  return (Array.isArray(rows) ? rows : []).slice(0, cap).map((row) => {
    if (!row || typeof row !== 'object') return row;
    const out = {};
    for (const [k, v] of Object.entries(row)) out[k] = compactSqlValue(v);
    return out;
  });
}

async function runAfnSqlTool(base, args = {}) {
  const cap = Math.min(200, Math.max(1, Number(args.limit) || 80));
  const r = await runDashboardSql(base, {
    sql: args.sql,
    connectionId: args.connectionId || args.connection || args.id,
    limit: cap,
  });
  const rows = compactSqlRows(r.rows, cap);
  const out = {
    ok: r.ok === true,
    origin: r.origin || null,
    engine: r.engine || r.origin?.engine || '',
    kind: r.kind || '',
    columns: r.columns || [],
    rowCount: rows.length,
    truncated: r.truncated === true,
    rows,
    hint: r.ok
      ? 'Filas del origen configurado. Mostralas al usuario. No pidas que vuelva a correr el SQL.'
      : 'No pidas al usuario que ejecute la consulta. Si falta origen o credencial, decilo: .afn/db-connections.json y .afn/credentials/data-agent.json.',
  };
  if (!r.ok) {
    out.error = String(r.error || 'consulta fallida')
      .replace(/(password|pwd)\s*[=:]\s*\S+/gi, '$1=***')
      .slice(0, 300);
  }
  return out;
}

async function runAfnScriptTool(base, args = {}) {
  const action = String(args.action || 'list').toLowerCase();
  const runners = listScriptRunners(base).map(agentScriptView);
  if (action !== 'run') {
    return {
      ok: true,
      ran: false,
      runners,
      hint: 'Solo id, título y lenguaje. No hay ruta ni código. No ejecutes un script salvo que el usuario lo pida por nombre. No abras el archivo.',
    };
  }
  const cap = Math.min(200, Math.max(1, Number(args.limit) || 80));
  const r = await runScriptRunner(base, args.id || args.name || args.title, { limit: cap });
  if (!r.ok) {
    const rows = compactSqlRows(r.rows, cap);
    return {
      ok: false,
      ran: r.ran === true,
      error: r.error || 'El script falló',
      runner: r.runner || null,
      columns: r.columns || [],
      rowCount: rows.length,
      rows,
      runners,
      hint: 'Mostrá este error al usuario. Si hay filas, mostralas también. No leas el archivo ni pidas la ruta.',
    };
  }
  const rows = compactSqlRows(r.rows, cap);
  return {
    ok: true,
    ran: true,
    runner: r.runner,
    columns: r.columns,
    rowCount: rows.length,
    truncated: r.truncated === true,
    rows,
    hint: 'El usuario pidió este script. Mostrá las filas. No leas el archivo ni pidas tokens. No lo vuelvas a ejecutar si no lo pide.',
  };
}

/**
 * @param {string} root
 * @param {string} name
 * @param {object} args
 */
export async function handleContextTool(root, name, args = {}) {
  const base = resolveProjectRoot(root || process.env.AFN_PROJECT_ROOT);
  switch (name) {
    case 'afn_bootstrap':
      return compactBootstrap(
        bootstrapAfn(base, {
          force: args.force === true,
          refresh: args.refresh === true,
          lock: args.lock === true,
          unlock: args.unlock === true || args.lock === false,
          ceiling: base,
        }),
      );
    case 'afn_context_snapshot':
      return buildSnapshot(base);
    case 'afn_projects_flow': {
      const cfg = readProjects(base);
      const flow = loadWorkspaceFlow(base);
      const active = activeProjects(cfg);
      const names = new Set(active.map((p) => p.name));
      const projects = (flow?.projects || active).filter(
        (p) => names.has(p.name) || p.type === 'database' || p.type === 'cloud',
      );
      const rels = (flow?.relationships || activeRelationships(cfg)).filter(
        (r) => projects.some((p) => p.name === r.from) && projects.some((p) => p.name === r.to),
      );
      return {
        ok: true,
        root: base,
        mode: flow?.mode,
        projects: projects.map(compactProject),
        relationships: rels.map(compactRel),
        layers: flow?.layers || null,
        readme: path.join(base, 'ARQUITECTURA.md'),
        ignorePaths: cfg.ignorePaths,
      };
    }
    case 'afn_mem_context':
      if (isAfnEcosystemCatalog(base)) {
        const observations = searchCatalogMemory(base, '', { limit: Number(args.limit) || 80 });
        return { ok: true, mode: 'catalog', observations, counts: { observations: observations.length } };
      }
      return getMemContext(base, { limit: Number(args.limit) || 8 });
    case 'afn_mem_search': {
      if (isAfnEcosystemCatalog(base)) {
        return { ok: true, mode: 'catalog', facts: searchCatalogMemory(base, args.query, { limit: Number(args.limit) || 80 }) };
      }
      const fromCerebro = searchCerebro(base, args.query, { limit: Number(args.limit) || 8, type: args.type });
      const facts = fromCerebro.length ? fromCerebro : searchFacts(base, args.query, Number(args.limit) || 8);
      return { ok: true, facts };
    }
    case 'afn_mem_save':
      return saveObservation(base, args);
    case 'afn_session_start':
      return startSession(base, args);
    case 'afn_session_summary':
      return endSession(base, args);
    case 'afn_note_save':
      return saveTaskNote(base, args);
    case 'afn_note_list': {
      const all = listTaskNotes(base);
      const slug = String(args.task || '').trim();
      const notes = slug ? all.filter((n) => n.slug === slug || n.title.toLowerCase().includes(slug.toLowerCase())) : all;
      return { ok: true, notes, dir: '.afn/notes/tareas' };
    }
    case 'afn_note_set_status':
      return setTaskNoteStatus(base, args.task, args.status);
    case 'afn_dashboard':
      return compactDashboard(await openDashboard(base, { open: args.open !== false, slug: args.slug }));
    case 'afn_diagram_generate': {
      const recreate = args.recreate === true;
      if (!recreate && architectureExists(base)) {
        const r = persistWorkspaceFlowDiagram(base, readProjects(base), { recreate: false });
        const compact = compactDiagramResult({ ...r, root: base });
        compact.hint = `Arquitectura ya estaba en disco. README: ${compact.readme || path.join(base, 'ARQUITECTURA.md')}. No regeneré. Pedí «regenerá la arquitectura» para recrear.`;
        return compact;
      }
      const r = persistWorkspaceFlowDiagram(base, readProjects(base), { recreate: true, llmReviewed: false });
      if (r.config && !r.skipped) writeProjects(base, r.config);
      const evidence = compactEvidence(collectArchitectureEvidence(base));
      return {
        ...compactDiagramResult({ ...r, root: base }),
        needsLlm: true,
        llmReviewed: false,
        evidence,
        prompt: LLM_ARCHITECTURE_PROMPT,
        hint: `Inventario de disco. Leé filesToRead y llamá afn_architecture_commit. README: ${r.readmeFile || path.join(base, 'ARQUITECTURA.md')}.`,
      };
    }
    case 'afn_architecture_evidence':
      return compactEvidence(collectArchitectureEvidence(base));
    case 'afn_architecture_commit':
      return compactCommit(commitArchitecture(base, args));
    case 'afn_data_sources':
      return collectDataSources(base);
    case 'afn_sql':
      return runAfnSqlTool(base, args);
    case 'afn_script':
      return runAfnScriptTool(base, args);
    case 'afn_schema_commit':
      return commitLiveSchema(base, args);
    case 'afn_agent_assets':
      return persistAgentAssets(base);
    case 'afn_extract_file': {
      const file = String(args.path || args.file || '').trim();
      const r = await extractFileToMarkdown(base, file);
      if (!r.ok) return { ok: false, error: r.error, detail: r.detail };
      return {
        ok: true,
        rel: r.rel,
        kind: r.kind,
        chars: r.chars,
        preview: String(r.preview || '').slice(0, 800),
        hint: 'El texto ya está en ese .md. No pidas adjuntar la imagen ni digas que no podés leerla.',
      };
    }
    case 'afn_doctor':
      return doctorAfn(base);
    case 'afn_project_ignore': {
      const rel = String(args.path || '').trim();
      if (!rel) return { ok: false, error: 'path requerido' };
      const next = applyIgnorePath(readProjects(base), rel, args.reason || 'deprecated');
      writeProjects(base, next);
      persistWorkspaceFlowDiagram(base, next, { recreate: true });
      return { ok: true, ignorePaths: next.ignorePaths, projects: next.projects };
    }
    default:
      return { ok: false, error: `tool desconocida: ${name}` };
  }
}
