import fs from 'node:fs';
import path from 'node:path';
import { afnPath } from './paths.js';
import { detectProjects, isWeakProjectsMap } from './detect-projects.js';
import { normalizeProjectsConfig } from './projects-policy.js';
import { isCatalogish, resolveWorkspaceRoot } from './resolve-root.js';
import { persistWorkspaceFlowDiagram } from './diagram-store.js';
import { persistAgentAssets } from './agent-assets.js';
import { architectureExists } from './workspace-flow.js';
import { collectArchitectureEvidence, LLM_ARCHITECTURE_PROMPT } from './architecture-llm.js';

const GITIGNORE_MARKER = '# AFN IDE — exclusiones locales (auto)';

const GITIGNORE_BLOCK = `${GITIGNORE_MARKER}
.afn/*
!.afn/MEMORY.md
!.afn/projects.json
!.afn/projects.json.example
!.afn/skills/
!.afn/skills/**
!.afn/prompts/
!.afn/prompts/**
!.afn/specs/
!.afn/specs/**
!.afn/odd/
!.afn/odd/**
!.afn/diagrams/
!.afn/diagrams/**
!.afn/notes/
!.afn/notes/**
.kiro/settings/mcp.json
`;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function ensureAfnDirs(root) {
  fs.mkdirSync(afnPath(root), { recursive: true });
  fs.mkdirSync(afnPath(root, 'memory'), { recursive: true });
  fs.mkdirSync(afnPath(root, 'skills'), { recursive: true });
  fs.mkdirSync(afnPath(root, 'diagrams'), { recursive: true });
}

/**
 * Detecta y escribe `.afn/projects.json` (como /afn-init + detectProjectsConfig).
 * No pisa un mapa rico. Sí reescribe mapas pobres (un solo mcp-context) o si force.
 * No usa el catálogo afn-ecosystem / paquete MCP como raíz de producto.
 * @param {string} root
 * @param {{ force?: boolean, refresh?: boolean, lock?: boolean, unlock?: boolean }} [opts]
 */
export function bootstrapAfn(root, opts = {}) {
  const force = opts.force === true;
  const refresh = opts.refresh === true;
  const start = path.resolve(root);
  const ceiling = opts.ceiling ? path.resolve(opts.ceiling) : '';
  const base = resolveWorkspaceRoot(start, ceiling ? { ceiling } : {});
  const pjFile = afnPath(base, 'projects.json');
  const existing = readJson(pjFile);
  const existingNorm = existing ? normalizeProjectsConfig(existing) : null;
  const ignorePaths = existingNorm?.ignorePaths || [];
  const detected = normalizeProjectsConfig(detectProjects(base, { ignorePaths }));
  const weakExisting = isWeakProjectsMap(existingNorm);
  const existingCount = existingNorm?.projects?.length || 0;
  const richer = detected.projects.length > existingCount;
  let locked = existingNorm?.architectureLocked === true;
  if (opts.lock === true) locked = true;
  if (opts.unlock === true) locked = false;
  const missingArch = !architectureExists(base);
  const recreateDiagram = force || refresh || missingArch;

  if (isCatalogish(base)) {
    return {
      ok: false,
      skipped: true,
      wrote: false,
      root: base,
      config: existingNorm || detected,
      reason: 'raiz-catalogo',
      hint: 'Corré setup/bootstrap desde el workspace del producto (varios repos), no desde afn-ecosystem ni packages/afn-mcp-context.',
    };
  }

  if (existingCount && !force && !weakExisting && !richer) {
    const cfg = normalizeProjectsConfig({ ...existingNorm, architectureLocked: locked });
    const extra = enrichAfn(base, cfg, { recreateDiagram });
    const evidence = collectArchitectureEvidence(base);
    return {
      ok: true,
      skipped: true,
      wrote: false,
      root: base,
      config: extra.config || cfg,
      reason: recreateDiagram ? 'mapa-actualizado' : 'arquitectura-existe',
      diagram: extra.diagram,
      assets: extra.assets,
      refreshed: extra.diagram?.skipped === false,
      architectureLocked: locked,
      needsLlm: evidence.needsLlm,
      prompt: evidence.needsLlm ? LLM_ARCHITECTURE_PROMPT : undefined,
    };
  }

  ensureAfnDirs(base);
  const config = normalizeProjectsConfig({
    ...detected,
    ignorePaths,
    architectureLocked: locked,
  });
  fs.writeFileSync(pjFile, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  const extra = enrichAfn(base, config, { recreateDiagram });
  const evidence = collectArchitectureEvidence(base);
  return {
    ok: true,
    skipped: false,
    wrote: true,
    root: base,
    config: extra.config || config,
    reason: force ? 'force' : weakExisting ? 'mapa-pobre-reescrito' : 'detectado',
    diagram: extra.diagram,
    assets: extra.assets,
    refreshed: extra.diagram?.skipped === false,
    architectureLocked: locked,
    needsLlm: evidence.needsLlm,
    prompt: LLM_ARCHITECTURE_PROMPT,
  };
}

function enrichAfn(base, config, opts = {}) {
  ensureAfnDirs(base);
  ensureMemoryStub(base);
  ensureGitignore(base);
  if (!opts.recreateDiagram && architectureExists(base)) {
    return {
      diagram: { ok: true, skipped: true },
      assets: { ok: true, skipped: true, count: 0 },
      config,
    };
  }
  let assets = { ok: false, count: 0, assets: [] };
  try {
    assets = persistAgentAssets(base);
  } catch {
    assets = { ok: false, count: 0, assets: [] };
  }
  let diagram = { ok: false };
  try {
    diagram = persistWorkspaceFlowDiagram(base, config, {
      recreate: opts.recreateDiagram === true,
      assets,
      llmReviewed: false,
    });
  } catch {
    diagram = { ok: false };
  }
  if (diagram.config) {
    const pjFile = afnPath(base, 'projects.json');
    const next = `${JSON.stringify(diagram.config, null, 2)}\n`;
    let prev = '';
    try {
      prev = fs.readFileSync(pjFile, 'utf8');
    } catch {
      prev = '';
    }
    if (next !== prev) fs.writeFileSync(pjFile, next, 'utf8');
  }
  return { diagram, assets, config: diagram.config || config };
}

function ensureMemoryStub(root) {
  const mem = afnPath(root, 'MEMORY.md');
  if (fs.existsSync(mem)) return;
  fs.writeFileSync(
    mem,
    '# Memoria AFN\n\nHechos durables del producto (no transcripts). El MCP `afn-context` actualiza esta lista.\n',
    'utf8',
  );
  const facts = afnPath(root, 'memory', 'facts.json');
  if (!fs.existsSync(facts)) {
    fs.writeFileSync(facts, `${JSON.stringify({ version: 1, facts: [] }, null, 2)}\n`, 'utf8');
  }
}

function ensureGitignore(root) {
  const gi = path.join(root, '.gitignore');
  let cur = '';
  try {
    cur = fs.readFileSync(gi, 'utf8');
  } catch {
    cur = '';
  }
  const hasBlock = cur.includes(GITIGNORE_MARKER) || cur.includes('!.afn/MEMORY.md');
  if (hasBlock) {
    if (!cur.includes('.kiro/settings/mcp.json')) {
      const next = `${cur.trimEnd()}\n.kiro/settings/mcp.json\n`;
      fs.writeFileSync(gi, next, 'utf8');
    }
    return;
  }
  const next = cur.trimEnd() ? `${cur.trimEnd()}\n\n${GITIGNORE_BLOCK}` : GITIGNORE_BLOCK;
  fs.writeFileSync(gi, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
}
