#!/usr/bin/env node
/**
 * @afn-ecosystem/mcp-context
 *   node index.js              → MCP stdio
 *   node index.js snapshot     → markdown a stdout (hook PromptSubmit)
 *   node index.js bootstrap    → .afn/ sin LLM
 *   node index.js doctor
 *   node index.js setup kiro|cursor|claude|generic
 */

import { startMcpStdioServer } from './lib/stdio-server.js';
import { CONTEXT_TOOLS } from './lib/tools-def.js';
import { handleContextTool } from './lib/handle-tool.js';
import { resolveProjectRoot } from './lib/paths.js';
import { buildSnapshot } from './lib/snapshot.js';
import { bootstrapAfn } from './lib/bootstrap.js';
import { doctorAfn } from './lib/snapshot.js';
import { setupAgent } from './lib/setup.js';

const VERSION = '1.0.1';

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
    const r = bootstrapAfn(root, { force });
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
    process.exit(r.ok ? 0 : 1);
    return;
  }

  if (cmd === 'doctor') {
    const r = doctorAfn(root);
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
    process.exit(r.ok ? 0 : 1);
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
    'Uso: node index.js [mcp|snapshot|bootstrap|doctor|setup kiro|cursor|claude|generic]\n',
  );
  process.exit(2);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack || e}\n`);
  process.exit(1);
});
