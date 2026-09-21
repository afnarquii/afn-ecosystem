import fs from 'node:fs';
import path from 'node:path';
import { afnPath } from './paths.js';
import { resolveWorkspaceRoot } from './resolve-root.js';
import { bootstrapAfn } from './bootstrap.js';
import { saveFact, searchFacts } from './memory.js';
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
      return bootstrapAfn(base, { force: args.force === true });
    case 'afn_context_snapshot':
      return buildSnapshot(base);
    case 'afn_projects_flow': {
      const cfg = readProjects(base);
      return {
        ok: true,
        root: base,
        projects: activeProjects(cfg),
        relationships: activeRelationships(cfg),
        ignorePaths: cfg.ignorePaths,
      };
    }
    case 'afn_mem_search':
      return { ok: true, facts: searchFacts(base, args.query, Number(args.limit) || 8) };
    case 'afn_mem_save':
      return saveFact(base, args);
    case 'afn_session_summary': {
      const text = [
        args.goal && `**Goal**: ${args.goal}`,
        args.done && `**Done**: ${args.done}`,
        args.next && `**Next**: ${args.next}`,
        args.files && `**Files**: ${args.files}`,
      ]
        .filter(Boolean)
        .join(' ');
      return saveFact(base, { text: text || args.text, what: 'session-summary' });
    }
    case 'afn_doctor':
      return doctorAfn(base);
    case 'afn_project_ignore': {
      const rel = String(args.path || '').trim();
      if (!rel) return { ok: false, error: 'path requerido' };
      const next = applyIgnorePath(readProjects(base), rel, args.reason || 'deprecated');
      writeProjects(base, next);
      return { ok: true, ignorePaths: next.ignorePaths, projects: next.projects };
    }
    default:
      return { ok: false, error: `tool desconocida: ${name}` };
  }
}
