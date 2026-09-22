#!/usr/bin/env node
/**
 * @afn-ecosystem/mcp-context
 *   node index.js              → MCP stdio
 *   node index.js snapshot     → markdown a stdout (hook PromptSubmit)
 *   node index.js bootstrap    → .afn/ sin LLM
 *   node index.js dashboard    → HTML cerebro/mapa (navegador)
 *   node index.js architecture [--recreate]  → inventario (solo a pedido)
 *   node index.js architecture-status        → ¿existe el mapa? no regenera
 *   node index.js session-start
 *   node index.js setup kiro|cursor|claude|generic
 */

import { startMcpStdioServer } from './lib/stdio-server.js';
import { CONTEXT_TOOLS } from './lib/tools-def.js';
import { handleContextTool } from './lib/handle-tool.js';
import { resolveProjectRoot, afnPath } from './lib/paths.js';
import { buildSnapshot } from './lib/snapshot.js';
import { bootstrapAfn } from './lib/bootstrap.js';
import { doctorAfn } from './lib/snapshot.js';
import { startSession } from './lib/cerebro.js';
import { writeDashboard } from './lib/dashboard.js';
import { persistWorkspaceFlowDiagram } from './lib/diagram-store.js';
import { setupAgent } from './lib/setup.js';
import { FLOW_GENERATOR_VERSION } from './lib/version.js';
import { architectureStatus } from './lib/architecture-llm.js';
import { compactBootstrap, compactDiagramResult } from './lib/compact-result.js';
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

  if (cmd === 'snapshot') {
    const s = buildSnapshot(root);
    process.stdout.write(s.markdown.endsWith('\n') ? s.markdown : `${s.markdown}\n`);
    process.exit(s.ok || s.missing ? 0 : 1);
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
    const open = !argv.includes('--no-open');
    const r = writeDashboard(root, { open });
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
    process.exit(r.ok ? 0 : 1);
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
    const r = setupAgent(agent, { projectRoot: root });
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
    process.exit(r.ok ? 0 : 1);
    return;
  }

  process.stderr.write(
    'Uso: node index.js [mcp|snapshot|bootstrap [--force|--refresh]|architecture [--recreate]|architecture-status|doctor|dashboard|session-start|setup kiro|cursor|claude|generic]\n',
  );
  process.exit(2);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack || e}\n`);
  process.exit(1);
});
