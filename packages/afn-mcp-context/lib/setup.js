import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = path.resolve(here, '..');
export const ENTRY = path.join(PACKAGE_ROOT, 'index.js');

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

function mcpServerBlock() {
  return {
    command: 'node',
    args: [ENTRY],
    env: {
      AFN_PROJECT_ROOT: '${workspaceFolder}',
    },
    disabled: false,
    autoApprove: ['afn_context_snapshot', 'afn_projects_flow', 'afn_mem_search', 'afn_bootstrap', 'afn_doctor'],
  };
}

const STEERING = `# Memoria y mapa AFN (.afn)

Tenés tools MCP **afn-context** (no Engram). El mapa del producto está en \`.afn/\`, no en el historial de chat.

## Tokens

- Al empezar: \`afn_context_snapshot\` (o el hook PromptSubmit). **No** listés el repo si el snapshot alcanza.
- Buscá con \`afn_mem_search\` antes de re-explorar.
- Guardá **hechos**, no transcripts: \`afn_mem_save\` (What/Why/Where/Learned).
- Al cerrar trabajo: \`afn_session_summary\`.
- No vuelques specs enteras ni \`.afn/context.json\` crudo (hay secretos).

## Proyectos

- Solo los **activos**. \`ignorePaths\` / \`status: deprecated\` no existen para el flujo.
- Si el usuario dice que un paquete ya no se usa: \`afn_project_ignore\`.
- Si falta \`.afn/\`: \`afn_bootstrap\` (sin LLM). No ejecutes slash de otro IDE.

## Convivencia

Engram u otras memorias son opcionales. No dupliques el mismo hecho en dos sitios.
`;

function mergeMcpServers(file, extra) {
  const cur = readJson(file) || { mcpServers: {} };
  if (!cur.mcpServers || typeof cur.mcpServers !== 'object') cur.mcpServers = {};
  cur.mcpServers['afn-context'] = extra;
  writeJson(file, cur);
}

function writeHooks(projectRoot, nodeCmd) {
  const dir = path.join(projectRoot, '.kiro', 'hooks');
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'afn-session-start.json'), {
    version: 'v1',
    hooks: [
      {
        name: 'AFN bootstrap',
        description: 'Crea .afn/ si falta (sin LLM). No pisa projects.json existente.',
        trigger: 'SessionStart',
        action: { type: 'command', command: nodeCmd },
        timeout: 30,
      },
    ],
  });
  writeJson(path.join(dir, 'afn-prompt-submit.json'), {
    version: 'v1',
    hooks: [
      {
        name: 'AFN snapshot',
        description: 'Inyecta mapa compacto al prompt.',
        trigger: 'PromptSubmit',
        action: { type: 'command', command: `${nodeCmd} snapshot` },
        timeout: 20,
      },
    ],
  });
  writeJson(path.join(dir, 'afn-agent-stop.json'), {
    version: 'v1',
    hooks: [
      {
        name: 'AFN persist fact',
        description: 'El stop de Kiro a menudo no trae el texto; la tool MCP es la fuente de verdad.',
        trigger: 'AgentStop',
        action: {
          type: 'agent',
          prompt:
            'Si este turno cambió arquitectura, APIs, proyectos activos/deprecados o una decisión durable, llamá afn_mem_save (hecho corto What/Why/Where). No vuelques el chat. Si cerrás el trabajo, afn_session_summary.',
        },
      },
    ],
  });
}

/**
 * @param {'kiro'|'cursor'|'claude'|'generic'} agent
 * @param {{ projectRoot?: string, home?: string }} [opts]
 */
export function setupAgent(agent, opts = {}) {
  const kind = String(agent || 'kiro').toLowerCase();
  const home = opts.home || os.homedir();
  const projectRoot = path.resolve(opts.projectRoot || process.cwd());
  const nodeEntry = `"${process.execPath}" "${ENTRY}"`;
  const written = [];

  if (kind === 'kiro') {
    const mcpFile = path.join(home, '.kiro', 'settings', 'mcp.json');
    mergeMcpServers(mcpFile, {
      command: process.execPath,
      args: [ENTRY],
      env: { AFN_PROJECT_ROOT: projectRoot },
      disabled: false,
      autoApprove: mcpServerBlock().autoApprove,
    });
    written.push(mcpFile);
    const steering = path.join(home, '.kiro', 'steering', 'afn-context.md');
    fs.mkdirSync(path.dirname(steering), { recursive: true });
    fs.writeFileSync(steering, STEERING, 'utf8');
    written.push(steering);
    writeHooks(projectRoot, nodeEntry);
    written.push(path.join(projectRoot, '.kiro', 'hooks'));
    return { ok: true, agent: 'kiro', written, note: 'Reiniciá Kiro o recargá MCP.' };
  }

  if (kind === 'cursor') {
    const mcpFile = path.join(projectRoot, '.cursor', 'mcp.json');
    mergeMcpServers(mcpFile, {
      command: process.execPath,
      args: [ENTRY],
      env: { AFN_PROJECT_ROOT: projectRoot },
    });
    const rules = path.join(projectRoot, '.cursor', 'rules', 'afn-context.mdc');
    fs.mkdirSync(path.dirname(rules), { recursive: true });
    fs.writeFileSync(rules, `---\ndescription: Mapa y memoria AFN (.afn)\nglobs:\nalwaysApply: true\n---\n\n${STEERING}`, 'utf8');
    written.push(mcpFile, rules);
    return { ok: true, agent: 'cursor', written };
  }

  if (kind === 'claude') {
    const mcpFile = path.join(home, '.claude', 'mcp.json');
    mergeMcpServers(mcpFile, {
      command: process.execPath,
      args: [ENTRY],
      env: { AFN_PROJECT_ROOT: projectRoot },
    });
    const md = path.join(projectRoot, 'CLAUDE.md');
    const block = `\n\n## AFN context\n\n${STEERING}\n`;
    let cur = '';
    try {
      cur = fs.readFileSync(md, 'utf8');
    } catch {
      cur = '';
    }
    if (!cur.includes('## AFN context')) fs.writeFileSync(md, `${cur}${block}`, 'utf8');
    written.push(mcpFile, md);
    return { ok: true, agent: 'claude', written };
  }

  const generic = path.join(projectRoot, '.mcp.json');
  mergeMcpServers(generic, {
    command: process.execPath,
    args: [ENTRY],
    env: { AFN_PROJECT_ROOT: projectRoot },
  });
  const agents = path.join(projectRoot, 'AGENTS.md');
  let ag = '';
  try {
    ag = fs.readFileSync(agents, 'utf8');
  } catch {
    ag = '';
  }
  if (!ag.includes('## AFN context')) fs.writeFileSync(agents, `${ag}\n\n## AFN context\n\n${STEERING}\n`, 'utf8');
  written.push(generic, agents);
  return { ok: true, agent: 'generic', written };
}

export { STEERING };
