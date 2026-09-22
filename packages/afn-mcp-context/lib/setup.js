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
      'afn_data_sources',
    ],
  };
}

const STEERING = `# Memoria y mapa AFN (.afn)

Tenés tools MCP **afn-context** (no Engram). El mapa y el cerebro del producto están en \`.afn/\`, no en el historial de chat.

## Tokens

- Al empezar: \`afn_context_snapshot\` y \`afn_mem_context\`. La fuente es \`ARQUITECTURA.md\` **en la raíz del workspace**. **No** vuelques el repo.
- Buscá con \`afn_mem_search\` antes de re-explorar.
- Guardá **hechos** con \`afn_mem_save\` (title, type, What/Why/Where/Learned). No transcripts.
- Al abrir un trabajo: \`afn_session_start\` (goal). Al cerrar: \`afn_session_summary\`.
- Si el usuario pide **abre dashboard AFN**: solo \`afn_dashboard\`. **No** llames \`afn_diagram_generate\` ni \`afn_architecture_commit\`.
- Si pide **guardar el README de esta tarea**: \`afn_note_save\`. Si pide **marcar listo/aprobado**: \`afn_note_set_status\`.
- **No** regeneres arquitectura al abrir el proyecto, en SessionStart, ni en cada turno.
- Regenerar **solo** si el usuario dice “regenerá la arquitectura”, o el snapshot avisa un **cambio estructural** y el usuario lo confirma. Entonces: \`afn_diagram_generate\` recreate → leer \`filesToRead\` → \`afn_architecture_commit\`.
- El origen de datos **no se adivina**. Lo escribe el init (\`afn_bootstrap\` / \`setup kiro\` / el equivalente de \`/afn-init\`) en \`.afn/db-connection.json\` (motor, host, database, evidencia de compose o \`.env.example\`). **Sin passwords**. Las credenciales van en \`.afn/credentials/data-agent.json\` (no git).
- Si pide **conectar / listar tablas y PAs**: leé esa ficha. En Kiro **no hay UI de BD**. El usuario escribe «listá las tablas y PAs y guardalas en la arquitectura». Entonces: \`data_inspect_schema\` del MCP **afn-mcp-data-agent** (mismo \`.kiro/settings/mcp.json\`) con \`sample: true\`. Luego \`afn_schema_commit\` y \`afn_dashboard\` (pestaña Datos). Si \`needsCredentials\` o falta el MCP, pedí servidor/usuario/password; no inventes tablas ni el host.
- Las tools de arquitectura devuelven un resumen. El JSON completo está en disco (\`workspace-flow.json\`, \`projects.json\`, \`ARQUITECTURA.md\`).
- Si el snapshot dice mapa verificado o inventario en disco y nadie pidió regenerar: no toques el mapa.
- Regenerar no borra observaciones ni \`MEMORY.md\`.
- No vuelques specs enteras ni \`.afn/context.json\` crudo (hay secretos).

## Proyectos

- Solo los **activos**. \`ignorePaths\` / \`status: deprecated\` no existen para el flujo.
- Si el usuario dice que un paquete ya no se usa: \`afn_project_ignore\`.
- Si falta \`.afn/\` o el mapa es un solo \`mcp-context\`: \`afn_bootstrap\` (inventario de disco). El LLM no completa el mapa solo.
- Al entrar, SessionStart corre bootstrap: **crea** el mapa si no existe; **si ya existe, no lo regenera** y no dispara el LLM.
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

/**
 * Registra afn-mcp-data-agent usando la ficha de init. No pisa un MCP ya configurado.
 * Secretos solo desde .afn/credentials/data-agent.json (gitignored).
 */
function mergeDataAgentFromOrigin(mcpFile, pinRoot) {
  if (!pinRoot) return { merged: false, reason: 'sin-workspace' };
  const cur = readJson(mcpFile) || { mcpServers: {} };
  if (!cur.mcpServers || typeof cur.mcpServers !== 'object') cur.mcpServers = {};
  if (cur.mcpServers['afn-mcp-data-agent']) return { merged: false, reason: 'ya-existe' };
  const origin = readJson(path.join(pinRoot, '.afn', 'db-connection.json')) || {};
  const engine = String(origin.dbEngine || origin.engine || '').toLowerCase();
  const driver = /mongo/.test(engine) ? 'mongodb' : /sqlserver|mssql/.test(engine) ? 'mssql' : '';
  const cred = readJson(path.join(pinRoot, '.afn', 'credentials', 'data-agent.json')) || {};
  const env = {};
  if (driver) env.DATA_AGENT_DRIVER = driver;
  if (origin.host) env.DB_SERVER = String(origin.host);
  if (origin.port) env.DB_PORT = String(origin.port);
  if (origin.database) env.DB_DATABASE = String(origin.database);
  for (const [k, v] of Object.entries(cred && typeof cred === 'object' ? cred : {})) {
    if (typeof v !== 'string' || !v) continue;
    if (/password|secret|token|uri|user|database|server|host|port|driver/i.test(k)) env[k] = v;
  }
  cur.mcpServers['afn-mcp-data-agent'] = {
    command: 'npx',
    args: ['-y', '@afn-ecosystem/mcp-data-agent@latest'],
    disabled: false,
    env,
    autoApprove: ['data_inspect_schema', 'data_list_entities', 'data_describe_entity', 'data_list_actions'],
  };
  writeJson(mcpFile, cur);
  return { merged: true, driver: env.DATA_AGENT_DRIVER || driver || '' };
}

function afnContextServer(pinRoot) {
  return {
    command: process.execPath,
    args: [ENTRY],
    ...(pinRoot ? { env: { AFN_PROJECT_ROOT: pinRoot } } : {}),
    disabled: false,
    autoApprove: mcpServerBlock().autoApprove,
  };
}

/** El MCP de usuario aplica a todos los workspaces; AFN tiene que vivir en el proyecto. */
function stripUserAfnContext(file) {
  const cur = readJson(file);
  if (!cur?.mcpServers || typeof cur.mcpServers !== 'object') return { stripped: false, file };
  if (!Object.prototype.hasOwnProperty.call(cur.mcpServers, 'afn-context')) {
    return { stripped: false, file };
  }
  delete cur.mcpServers['afn-context'];
  writeJson(file, cur);
  return { stripped: true, file };
}

const USER_STEERING = `# AFN context (usuario)

Cada producto tiene su propio MCP en \`.kiro/settings/mcp.json\` de **ese** workspace (\`AFN_PROJECT_ROOT\`). No hay un \`.afn\` único para todos los repos.

Si abrís un proyecto y no hay mapa: en la raíz de **ese** producto corré \`node …/packages/afn-mcp-context/index.js setup kiro\`.
`;

function writeHooks(projectRoot, nodeCmd) {
  const dir = path.join(projectRoot, '.kiro', 'hooks');
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'afn-session-start.json'), {
    version: 'v1',
    hooks: [
      {
        name: 'AFN bootstrap',
        description: 'Crea .afn/ si falta (inventario de disco, sin inventar flechas).',
        trigger: 'SessionStart',
        action: { type: 'command', command: `${nodeCmd} bootstrap` },
        timeout: 30,
      },
    ],
  });
  writeJson(path.join(dir, 'afn-session-architecture.json'), {
    version: 'v1',
    hooks: [
      {
        name: 'AFN architecture status',
        description: 'Comprueba si el mapa existe. No regenera. No llama al LLM.',
        trigger: 'SessionStart',
        action: { type: 'command', command: `${nodeCmd} architecture-status` },
        timeout: 15,
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
            'Si este turno cambió APIs, un bugfix o una decisión, llamá afn_mem_save. No inventes arquitectura. Solo regenerá el mapa si el usuario lo pidió, con evidencia de disco + afn_architecture_commit.',
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

  if (kind === 'kiro') {
    const hookRoot = pinRoot || setupCwd;
    const mcpFile = path.join(hookRoot, '.kiro', 'settings', 'mcp.json');
    mergeMcpServers(mcpFile, afnContextServer(pinRoot));
    written.push(mcpFile);
    const steering = path.join(hookRoot, '.kiro', 'steering', 'afn-context.md');
    fs.mkdirSync(path.dirname(steering), { recursive: true });
    fs.writeFileSync(steering, STEERING, 'utf8');
    written.push(steering);
    writeHooks(hookRoot, nodeEntry);
    written.push(path.join(hookRoot, '.kiro', 'hooks'));
    const userMcp = path.join(home, '.kiro', 'settings', 'mcp.json');
    const stripped = stripUserAfnContext(userMcp);
    const userSteering = path.join(home, '.kiro', 'steering', 'afn-context.md');
    fs.mkdirSync(path.dirname(userSteering), { recursive: true });
    fs.writeFileSync(userSteering, USER_STEERING, 'utf8');
    written.push(userSteering);
    const boot = pinRoot ? bootstrapAfn(pinRoot, { ceiling: pinRoot }) : { ok: false, reason: 'raiz-catalogo' };
    const dataAgent = pinRoot ? mergeDataAgentFromOrigin(mcpFile, pinRoot) : { merged: false };
    return {
      ok: true,
      agent: 'kiro',
      written,
      workspace: pinRoot || workspace,
      mcpFile,
      userMcpStripped: stripped.stripped,
      bootstrap: boot,
      dataAgent,
      note: pinRoot
        ? `MCP de este workspace: ${mcpFile}. Origen: .afn/db-connection.json. Abrí otro producto → setup kiro ahí (no comparte la ruta).`
        : 'Corré setup otra vez desde el workspace del producto, no desde afn-ecosystem.',
    };
  }

  if (kind === 'cursor') {
    const mcpFile = path.join(pinRoot || setupCwd, '.cursor', 'mcp.json');
    mergeMcpServers(mcpFile, afnContextServer(pinRoot));
    const rules = path.join(pinRoot || setupCwd, '.cursor', 'rules', 'afn-context.mdc');
    fs.mkdirSync(path.dirname(rules), { recursive: true });
    fs.writeFileSync(rules, `---\ndescription: Mapa y memoria AFN (.afn)\nglobs:\nalwaysApply: true\n---\n\n${STEERING}`, 'utf8');
    written.push(mcpFile, rules);
    const boot = pinRoot ? bootstrapAfn(pinRoot) : { ok: false, reason: 'raiz-catalogo' };
    return { ok: true, agent: 'cursor', written, workspace: pinRoot || workspace, bootstrap: boot };
  }

  if (kind === 'claude') {
    const mcpFile = path.join(home, '.claude', 'mcp.json');
    mergeMcpServers(mcpFile, afnContextServer(pinRoot));
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

  const generic = path.join(pinRoot || setupCwd, '.mcp.json');
  mergeMcpServers(generic, afnContextServer(pinRoot));
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
