#!/usr/bin/env node
/**
 * @afn-ecosystem/mcp-context
 *   node index.js              → MCP stdio
 *   node index.js prompt-gate   → hook Kiro: comando local o pista (exit 2 = no LLM)
 *   node index.js dashboard [sql|cerebro|notas|skills|extract] → http://127.0.0.1:5847 (sin Kiro, sin tokens)
 *   node index.js extract archivo.pdf|xlsx|png  → .md en .afn/extract (sin tokens)
 *   node index.js note-save archivo.md
 *   node index.js mem-search texto
 *   node index.js mem-context
 *   node index.js bootstrap
 *   node index.js setup kiro|cursor|claude|generic
 */

import { startMcpStdioServer } from './lib/stdio-server.js';
import { CONTEXT_TOOLS } from './lib/tools-def.js';
import { handleContextTool } from './lib/handle-tool.js';
import { resolveProjectRoot, afnPath } from './lib/paths.js';
import { buildSnapshot, buildPromptHint } from './lib/snapshot.js';
import { bootstrapAfn } from './lib/bootstrap.js';
import { doctorAfn } from './lib/snapshot.js';
import { startSession, getMemContext, searchCerebro } from './lib/cerebro.js';
import { isAfnEcosystemCatalog } from './lib/resolve-root.js';
import { searchCatalogMemory } from './lib/catalog-registry.js';
import { writeDashboard, openDashboard } from './lib/dashboard.js';
import { persistWorkspaceFlowDiagram } from './lib/diagram-store.js';
import { setupAgent, ensurePackSqlDeps } from './lib/setup.js';
import { FLOW_GENERATOR_VERSION } from './lib/version.js';
import { architectureStatus } from './lib/architecture-llm.js';
import { compactBootstrap, compactDiagramResult, compactDashboard } from './lib/compact-result.js';
import { saveTaskNoteFromFile } from './lib/task-notes.js';
import { extractFileToMarkdown } from './lib/extract-text.js';
import { runPromptGate, readHookPrompt } from './lib/prompt-gate.js';
import fs from 'node:fs';

const VERSION = FLOW_GENERATOR_VERSION;

async function main() {
  const argv = process.argv.slice(2);
  const cmd = String(argv[0] || '').toLowerCase();
  const root = resolveProjectRoot(process.env.AFN_PROJECT_ROOT);

  if (!cmd || cmd === 'mcp') {
    startMcpStdioServer({
      name: 'afn-mcp-context',
      version: VERSION,
      tools: CONTEXT_TOOLS,
      onCallTool: (name, args) => handleContextTool(resolveProjectRoot(process.env.AFN_PROJECT_ROOT), name, args),
    });
    return;
  }

  if (cmd === 'prompt-gate') {
    const text = await readHookPrompt();
    const r = await runPromptGate(root, text);
    const msg = `${r.message}\n`;
    process.stdout.write(msg);
    if (r.handled) process.stderr.write(msg);
    process.exit(r.exitCode);
    return;
  }

  if (cmd === 'snapshot') {
    const hint = argv.includes('--hint') || argv.includes('--mini');
    const s = hint ? buildPromptHint(root) : buildSnapshot(root);
    process.stdout.write(s.markdown.endsWith('\n') ? s.markdown : `${s.markdown}\n`);
    process.exit(s.ok || s.missing || s.hint ? 0 : 1);
    return;
  }

  if (cmd === 'bootstrap') {
    const force = argv.includes('--force');
    const refresh = argv.includes('--refresh');
    const lock = argv.includes('--lock');
    const unlock = argv.includes('--unlock');
    const r = bootstrapAfn(root, { force, refresh, lock, unlock, ceiling: root });
    process.stdout.write(`${JSON.stringify(compactBootstrap(r), null, 2)}\n`);
    process.exit(r.ok ? 0 : 1);
    return;
  }

  if (cmd === 'doctor') {
    const r = doctorAfn(root);
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
    process.exit(r.ok ? 0 : 1);
    return;
  }

  if (cmd === 'session-start') {
    const r = startSession(root, { goal: argv.slice(1).filter((a) => a !== '--force').join(' ') });
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
    process.exit(r.ok ? 0 : 1);
    return;
  }

  if (cmd === 'dashboard') {
    if (argv.includes('--no-open')) {
      const r = writeDashboard(root, { open: false });
      process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
      process.exit(r.ok ? 0 : 1);
      return;
    }
    const VIEWS = new Set(['inicio', 'readme', 'datos', 'origenes', 'esquema', 'sql', 'mapa', 'diagramas', 'capas', 'howto', 'cerebro', 'reglas', 'notas', 'skills', 'extract']);
    const extra = argv.slice(1).find((a) => !String(a).startsWith('-')) || '';
    const hash = VIEWS.has(extra) ? extra : extra ? `d-${extra}` : 'readme';
    const keep = !argv.includes('--once');
    const r = compactDashboard(await openDashboard(root, { open: true, hash: `#${hash}`, browser: !argv.includes('--no-browser') }));
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
    process.stderr.write(`Dashboard local (sin tokens de Kiro): ${r.url}\nDejá esta ventana abierta. Ctrl+C para parar.\n`);
    if (!keep) process.exit(r.ok ? 0 : 1);
    return;
  }

  if (cmd === 'extract') {
    const file = argv.slice(1).filter((a) => !String(a).startsWith('-')).join(' ');
    const r = await extractFileToMarkdown(root, file);
    process.stdout.write(`${JSON.stringify({ ok: r.ok, rel: r.rel, kind: r.kind, method: r.method, pages: r.pages, chars: r.chars, extractTokens: r.extractTokens, markdownTokensIfPasted: r.markdownTokensIfPasted, attachFileTokensEstimate: r.attachFileTokensEstimate, error: r.error, detail: r.detail }, null, 2)}\n`);
    process.exit(r.ok ? 0 : 1);
    return;
  }

  if (cmd === 'note-save') {
    const file = argv.slice(1).filter((a) => !String(a).startsWith('-')).join(' ');
    const r = saveTaskNoteFromFile(root, file);
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
    process.exit(r.ok ? 0 : 1);
    return;
  }

  if (cmd === 'mem-search' || cmd === 'cerebro') {
    const q = argv.slice(1).filter((a) => !String(a).startsWith('-')).join(' ');
    const facts = isAfnEcosystemCatalog(root)
      ? searchCatalogMemory(root, q, { limit: 80 })
      : searchCerebro(root, q, { limit: 12 });
    const lines = [`=== cerebro${q ? ` · ${q}` : ''} (${facts.length}) ===`];
    for (const o of facts) {
      const where = o.project ? ` (${o.project})` : '';
      lines.push(`- ${String(o.title || '').slice(0, 120)}${o.type ? ` [${o.type}]` : ''}${where}`);
      const what = String(o.what || o.text || '').trim();
      if (what) lines.push(`  ${what.slice(0, 240)}`);
    }
    if (!facts.length) lines.push('(sin coincidencias. También: pestaña Cerebro del dashboard.)');
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exit(0);
    return;
  }

  if (cmd === 'mem-context') {
    const c = isAfnEcosystemCatalog(root)
      ? { counts: { observations: searchCatalogMemory(root, '', { limit: 80 }).length }, active: null, observations: searchCatalogMemory(root, '', { limit: 80 }) }
      : getMemContext(root, { limit: 8 });
    process.stdout.write(`${JSON.stringify({ ok: true, counts: c.counts, active: c.active?.goal || '', titles: (c.observations || []).map((o) => o.title) }, null, 2)}\n`);
    process.exit(0);
    return;
  }

  if (cmd === 'architecture' || cmd === 'diagram') {
    const recreate = argv.includes('--recreate') || argv.includes('--refresh');
    const r = persistWorkspaceFlowDiagram(root, undefined, { recreate, llmReviewed: false });
    if (r.config && !r.skipped) {
      fs.mkdirSync(afnPath(root), { recursive: true });
      fs.writeFileSync(afnPath(root, 'projects.json'), `${JSON.stringify(r.config, null, 2)}\n`, 'utf8');
    }
    process.stdout.write(`${JSON.stringify(compactDiagramResult(r), null, 2)}\n`);
    process.exit(r.ok ? 0 : 1);
    return;
  }

  if (cmd === 'architecture-status') {
    const r = architectureStatus(root);
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
    process.exit(0);
    return;
  }

  if (cmd === 'setup') {
    const agent = String(argv[1] || 'kiro').toLowerCase();
    const packDeps = ensurePackSqlDeps({ install: true });
    const r = setupAgent(agent, { projectRoot: root });
    r.packDeps = packDeps;
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
    process.exit(r.ok ? 0 : 1);
    return;
  }

  process.stderr.write(
    'Uso: node index.js [mcp|prompt-gate|snapshot [--hint]|dashboard [sql|cerebro|notas|skills|extract]|extract archivo.pdf|note-save archivo.md|mem-search texto|mem-context|bootstrap|architecture [--recreate]|architecture-status|doctor|session-start|setup kiro|cursor|claude|generic]\n',
  );
  process.exit(2);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack || e}\n`);
  process.exit(1);
});
