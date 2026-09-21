import fs from 'node:fs';
import path from 'node:path';
import { afnPath } from './paths.js';
import { resolveWorkspaceRoot } from './resolve-root.js';
import { bootstrapAfn } from './bootstrap.js';
import { searchFacts } from './memory.js';
import { saveObservation, searchCerebro, startSession, endSession, getMemContext } from './cerebro.js';
import { writeDashboard } from './dashboard.js';
import { persistWorkspaceFlowDiagram } from './diagram-store.js';
import { persistAgentAssets } from './agent-assets.js';
import { loadWorkspaceFlow } from './workspace-flow.js';
import { buildSnapshot, doctorAfn } from './snapshot.js';
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

/**
 * @param {string} root
 * @param {string} name
 * @param {object} args
 */
export async function handleContextTool(root, name, args = {}) {
  const base = resolveWorkspaceRoot(path.resolve(root || '.'));
  switch (name) {
    case 'afn_bootstrap':
      return bootstrapAfn(base, {
        force: args.force === true,
        refresh: args.refresh === true,
        lock: args.lock === true,
        unlock: args.unlock === true || args.lock === false,
      });
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
        projects,
        relationships: rels,
        layers: flow?.layers || null,
        e2e: flow?.e2e || [],
        how: flow?.how || null,
        ignorePaths: cfg.ignorePaths,
      };
    }
    case 'afn_mem_context':
      return getMemContext(base, { limit: Number(args.limit) || 8 });
    case 'afn_mem_search': {
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
    case 'afn_dashboard':
      return writeDashboard(base, { open: args.open !== false, slug: args.slug });
    case 'afn_diagram_generate': {
      const r = persistWorkspaceFlowDiagram(base, readProjects(base), { recreate: args.recreate === true });
      if (r.config) writeProjects(base, r.config);
      return r;
    }
    case 'afn_agent_assets':
      return persistAgentAssets(base);
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
