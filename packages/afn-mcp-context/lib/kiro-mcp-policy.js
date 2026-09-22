/**
 * El SQL del pack va por el dashboard (afn-context), no por un segundo MCP.
 * setup kiro no debe registrar `npx @afn-ecosystem/mcp-data-agent`: el paquete
 * no está en npm público y, sin DATA_AGENT_MANIFEST, el proceso sale → MCP 32000.
 */
import fs from 'node:fs';
import path from 'node:path';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
}

export function isAutoNpxDataAgent(block) {
  if (!block || typeof block !== 'object') return false;
  const cmd = String(block.command || '');
  const args = (Array.isArray(block.args) ? block.args : [block.args]).filter(Boolean).join(' ');
  return /\bnpx\b/i.test(cmd) && /@afn-ecosystem\/mcp-data-agent/.test(args);
}

/** Quita stubs npx que Kiro intenta arrancar y cierran el stdio (error 32000). */
export function pruneAutoNpxDataAgent(mcpFile) {
  const cur = readJson(mcpFile);
  if (!cur?.mcpServers || typeof cur.mcpServers !== 'object') {
    return { pruned: [], file: mcpFile, wrote: false };
  }
  const pruned = [];
  for (const [id, block] of Object.entries(cur.mcpServers)) {
    if (!isAutoNpxDataAgent(block)) continue;
    delete cur.mcpServers[id];
    pruned.push(id);
  }
  if (!pruned.length) return { pruned, file: mcpFile, wrote: false };
  writeJson(mcpFile, cur);
  return { pruned, file: mcpFile, wrote: true };
}

export function pruneWorkspaceKiroDataAgent(root) {
  if (!root) return { pruned: [], wrote: false };
  return pruneAutoNpxDataAgent(path.join(root, '.kiro', 'settings', 'mcp.json'));
}
