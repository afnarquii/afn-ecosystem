import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveWorkspaceRoot, isCatalogish } from './resolve-root.js';
import { bootstrapAfn } from './bootstrap.js';

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
    disabled: false,
    autoApprove: [
      'afn_context_snapshot',
      'afn_projects_flow',
      'afn_mem_search',
      'afn_mem_context',
      'afn_bootstrap',
      'afn_doctor',
      'afn_dashboard',
    ],
  };
}

const STEERING = `# Memoria y mapa AFN (.afn)

Tenés tools MCP **afn-context** (no Engram). El mapa y el cerebro del producto están en \`.afn/\`, no en el historial de chat.

## Tokens

- Al empezar: \`afn_context_snapshot\` y \`afn_mem_context\`. **No** listés el repo si eso alcanza.
- Buscá con \`afn_mem_search\` antes de re-explorar.
- Guardá **hechos** con \`afn_mem_save\` (title, type, What/Why/Where/Learned). No transcripts.
- Al abrir un trabajo: \`afn_session_start\` (goal). Al cerrar: \`afn_session_summary\`.
- Si el usuario pide **ver** el mapa / **abre dashboard AFN**: \`afn_dashboard\` (HTML con buscador). No regeneres nada para verlo.
- Regenerar arquitectura escribe en el \`.afn\` de **AFN_PROJECT_ROOT** (raíz del workspace), no en un \`.afn\` anidado ni en el padre de varios clones.
- **No** regeneres arquitectura vos. No inventes el flujo con el LLM. No llames \`afn_diagram_generate\` ni \`bootstrap refresh\` salvo que el usuario lo pida explícito (“regenerá la arquitectura”, “regenerá el mapa”).
- Si lo pide: \`afn_diagram_generate\` con \`recreate=true\` (comando, sin LLM). Si ya existe y no lo pidió: no toques.
- No vuelques specs enteras ni \`.afn/context.json\` crudo (hay secretos).

## Proyectos

- Solo los **activos**. \`ignorePaths\` / \`status: deprecated\` no existen para el flujo.
- Si el usuario dice que un paquete ya no se usa: \`afn_project_ignore\`.
- Si falta \`.afn/\` o el mapa es un solo \`mcp-context\`: \`afn_bootstrap\` con \`force=true\` (sin LLM).
- Al entrar, SessionStart corre bootstrap: **crea** el mapa si no existe; **si ya existe, no lo regenera**.
- **No** tomes \`packages/afn-mcp-context\` ni el clone de \`afn-ecosystem\` como el producto.

## Convivencia

Engram u otras memorias son opcionales. No dupliques el mismo hecho en dos sitios. El cerebro AFN vive en \`.afn/memory/cerebro.json\` + \`MEMORY.md\`.
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
        description: 'Crea .afn/ si falta. Si la arquitectura ya existe, no la regenera (ahorra tokens).',
        trigger: 'SessionStart',
        action: { type: 'command', command: `${nodeCmd} bootstrap` },
        timeout: 30,
      },
    ],
  });
  writeJson(path.join(dir, 'afn-session-work.json'), {
    version: 'v1',
    hooks: [
      {
        name: 'AFN session work',
        description: 'Abre una sesión en el cerebro .afn (qué se está trabajando).',
        trigger: 'SessionStart',
        action: { type: 'command', command: `${nodeCmd} session-start` },
        timeout: 20,
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
            'Si este turno cambió arquitectura, APIs, un bugfix o una decisión, llamá afn_mem_save (title + type + What/Why/Where). Si cerrás el trabajo, afn_session_summary. No regeneres el mapa a menos que el usuario lo haya pedido en este turno.',
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
  const setupCwd = path.resolve(opts.projectRoot || process.cwd());
  const workspace = resolveWorkspaceRoot(setupCwd);
  const pinRoot = isCatalogish(workspace) ? '' : workspace;
  const nodeEntry = `"${process.execPath}" "${ENTRY}"`;
  const written = [];
  const mcpEnv = pinRoot ? { AFN_PROJECT_ROOT: pinRoot } : undefined;

  if (kind === 'kiro') {
    const mcpFile = path.join(home, '.kiro', 'settings', 'mcp.json');
    mergeMcpServers(mcpFile, {
      command: process.execPath,
      args: [ENTRY],
      ...(mcpEnv ? { env: mcpEnv } : {}),
      disabled: false,
      autoApprove: mcpServerBlock().autoApprove,
    });
    written.push(mcpFile);
    const steering = path.join(home, '.kiro', 'steering', 'afn-context.md');
    fs.mkdirSync(path.dirname(steering), { recursive: true });
    fs.writeFileSync(steering, STEERING, 'utf8');
    written.push(steering);
    writeHooks(setupCwd, nodeEntry);
    written.push(path.join(setupCwd, '.kiro', 'hooks'));
    const boot = pinRoot ? bootstrapAfn(pinRoot) : { ok: false, reason: 'raiz-catalogo' };
    return {
      ok: true,
      agent: 'kiro',
      written,
      workspace: pinRoot || workspace,
      bootstrap: boot,
      note: pinRoot
        ? 'Reiniciá Kiro o recargá MCP. El mapa está en .afn/projects.json del workspace.'
        : 'Corré setup otra vez desde el workspace del producto, no desde afn-ecosystem.',
    };
  }

  if (kind === 'cursor') {
    const mcpFile = path.join(setupCwd, '.cursor', 'mcp.json');
    mergeMcpServers(mcpFile, {
      command: process.execPath,
      args: [ENTRY],
      ...(mcpEnv ? { env: mcpEnv } : {}),
    });
    const rules = path.join(setupCwd, '.cursor', 'rules', 'afn-context.mdc');
    fs.mkdirSync(path.dirname(rules), { recursive: true });
    fs.writeFileSync(rules, `---\ndescription: Mapa y memoria AFN (.afn)\nglobs:\nalwaysApply: true\n---\n\n${STEERING}`, 'utf8');
    written.push(mcpFile, rules);
    const boot = pinRoot ? bootstrapAfn(pinRoot) : { ok: false, reason: 'raiz-catalogo' };
    return { ok: true, agent: 'cursor', written, workspace: pinRoot || workspace, bootstrap: boot };
  }

  if (kind === 'claude') {
    const mcpFile = path.join(home, '.claude', 'mcp.json');
    mergeMcpServers(mcpFile, {
      command: process.execPath,
      args: [ENTRY],
      ...(mcpEnv ? { env: mcpEnv } : {}),
    });
    const md = path.join(setupCwd, 'CLAUDE.md');
    const block = `\n\n## AFN context\n\n${STEERING}\n`;
    let cur = '';
    try {
      cur = fs.readFileSync(md, 'utf8');
    } catch {
      cur = '';
    }
    if (!cur.includes('## AFN context')) fs.writeFileSync(md, `${cur}${block}`, 'utf8');
    written.push(mcpFile, md);
    const boot = pinRoot ? bootstrapAfn(pinRoot) : { ok: false, reason: 'raiz-catalogo' };
    return { ok: true, agent: 'claude', written, workspace: pinRoot || workspace, bootstrap: boot };
  }

  const generic = path.join(setupCwd, '.mcp.json');
  mergeMcpServers(generic, {
    command: process.execPath,
    args: [ENTRY],
    ...(mcpEnv ? { env: mcpEnv } : {}),
  });
  const agents = path.join(setupCwd, 'AGENTS.md');
  let ag = '';
  try {
    ag = fs.readFileSync(agents, 'utf8');
  } catch {
    ag = '';
  }
  if (!ag.includes('## AFN context')) fs.writeFileSync(agents, `${ag}\n\n## AFN context\n\n${STEERING}\n`, 'utf8');
  written.push(generic, agents);
  const boot = pinRoot ? bootstrapAfn(pinRoot) : { ok: false, reason: 'raiz-catalogo' };
  return { ok: true, agent: 'generic', written, workspace: pinRoot || workspace, bootstrap: boot };
}

export { STEERING };
