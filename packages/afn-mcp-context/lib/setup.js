import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolveWorkspaceRoot, isCatalogish } from './resolve-root.js';
import { bootstrapAfn } from './bootstrap.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = path.resolve(here, '..');
export const ENTRY = path.join(PACKAGE_ROOT, 'index.js');
const packRequire = createRequire(path.join(PACKAGE_ROOT, 'package.json'));

/** mssql es dep del pack. Sin npx -p en runtime. */
export function packHasSqlDriver() {
  try {
    packRequire.resolve('mssql');
    return true;
  } catch {
    return false;
  }
}

/**
 * Instala deps del pack (mssql pin 11.x) si falta. engine-strict off: EBADENGINE de nested deps no tumba el install.
 * @param {{ install?: boolean }} [opts]
 */
export function ensurePackSqlDeps(opts = {}) {
  if (packHasSqlDriver()) return { ok: true, installed: false, source: 'pack' };
  if (opts.install !== true) {
    return {
      ok: false,
      installed: false,
      error: 'mssql no está en node_modules del pack. cd packages/afn-mcp-context && npm install',
    };
  }
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = spawnSync(npm, ['install', '--omit=dev', '--no-fund', '--no-audit'], {
    cwd: PACKAGE_ROOT,
    timeout: 180000,
    windowsHide: true,
    encoding: 'utf8',
    env: { ...process.env, npm_config_engine_strict: 'false' },
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) {
    return {
      ok: false,
      installed: false,
      error: String(r.stderr || r.stdout || 'npm install falló').slice(0, 400),
    };
  }
  return { ok: packHasSqlDriver(), installed: true, source: 'pack' };
}

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

## Tokens (no gastar chat en operativos)

- **Antes del LLM:** si escribís *abre dashboard AFN*, *guarda el readme …* o *busca en el cerebro …*, el hook \`prompt-gate\` lo hace en local y **bloquea** el envío al modelo (exit 2). No gasta tokens.
- Dashboard también: \`.afn/_tmp/afn-dashboard.cmd\` o \`node …/index.js dashboard\` (\`http://127.0.0.1:5847\`).
- Guardar un README: \`node …/index.js note-save hu_102030_fondos.md\` (o \`.afn/_tmp/afn-note-save.cmd\`).
- Cerebro: pestaña Cerebro del dashboard, o \`node …/index.js mem-search texto\`.
- Si el usuario **igual** lo pide en el chat: **una sola tool** (\`afn_dashboard\` / \`afn_note_save\` / \`afn_mem_search\`). **No** llames snapshot, diagram ni architecture. Abrí **solo** el campo \`url\` (\`http://127.0.0.1\`). **Nunca** \`.afn/_tmp/dashboard.html\`.
- Al empezar un trabajo de código (no un comando operativo): \`afn_context_snapshot\` si hace falta. Fuente: \`ARQUITECTURA.md\` en la raíz. **No** vuelques el repo.
- Guardá **hechos** con \`afn_mem_save\` solo si el usuario pidió recordar algo. No transcripts.
- **No** regeneres arquitectura al abrir el proyecto, en SessionStart, ni en cada turno.
- Regenerar **solo** si el usuario dice “regenerá la arquitectura”. Entonces: \`afn_diagram_generate\` recreate → leer \`filesToRead\` → \`afn_architecture_commit\`.
- El origen de datos **no se adivina**. Init → \`.afn/db-connections.json\`. Credenciales: \`.afn/credentials/data-agent.json\`. SQL: pestaña SQL del dashboard (SELECT o EXEC de PA).
- Si pide **conectar / listar tablas y PAs**: catálogo + \`data_inspect_schema\` + \`afn_schema_commit\`. No inventes host ni tablas.
- Las tools de arquitectura devuelven un resumen. Completo en disco.
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
 * Registra un MCP data-agent por origen mssql/mongo. No pisa servers ya configurados.
 * Secretos solo desde .afn/credentials/data-agent.json (gitignored).
 * Credenciales: env plano (primer origen) o byId / connections[id].
 */
function credsFor(cred, id, isFirst) {
  if (!cred || typeof cred !== 'object') return {};
  const nested = cred.byId?.[id] || cred.connections?.[id] || (typeof cred[id] === 'object' && cred[id] && !Array.isArray(cred[id]) ? cred[id] : null);
  const src = nested && typeof nested === 'object' ? nested : isFirst ? cred : {};
  const env = {};
  for (const [k, v] of Object.entries(src)) {
    if (typeof v !== 'string' || !v) continue;
    if (/password|secret|token|uri|user|database|server|host|port|driver/i.test(k)) env[k] = v;
  }
  return env;
}

function driverForEngine(engine) {
  const e = String(engine || '').toLowerCase();
  if (/mongo/.test(e)) return 'mongodb';
  if (/sqlserver|mssql/.test(e)) return 'mssql';
  return '';
}

function mcpIdForOrigin(conn, connectableIndex) {
  if (connectableIndex === 0) return 'afn-mcp-data-agent';
  const slug = String(conn.id || conn.name || connectableIndex)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `afn-mcp-data-agent-${slug || connectableIndex}`;
}

function mergeDataAgentFromOrigin(mcpFile, pinRoot) {
  if (!pinRoot) return { merged: false, reason: 'sin-workspace' };
  const cur = readJson(mcpFile) || { mcpServers: {} };
  if (!cur.mcpServers || typeof cur.mcpServers !== 'object') cur.mcpServers = {};
  const pack = readJson(path.join(pinRoot, '.afn', 'db-connections.json'));
  const session = readJson(path.join(pinRoot, '.afn', 'db-connection.json'));
  let list = Array.isArray(pack?.connections) ? pack.connections : Array.isArray(pack) ? pack : [];
  if (!list.length && session) list = [session];
  const cred = readJson(path.join(pinRoot, '.afn', 'credentials', 'data-agent.json')) || {};
  const autoApprove = ['data_inspect_schema', 'data_list_entities', 'data_describe_entity', 'data_list_actions'];
  let merged = 0;
  let connectable = 0;
  const ids = [];
  for (const conn of list) {
    const driver = driverForEngine(conn.dbEngine || conn.engine);
    if (!driver) continue;
    const serverId = mcpIdForOrigin(conn, connectable);
    connectable += 1;
    ids.push(serverId);
    if (cur.mcpServers[serverId]) continue;
    const env = { DATA_AGENT_DRIVER: driver };
    if (conn.host) env.DB_SERVER = String(conn.host);
    if (conn.port) env.DB_PORT = String(conn.port);
    if (conn.database) env.DB_DATABASE = String(conn.database);
    Object.assign(env, credsFor(cred, conn.id, connectable === 1));
    cur.mcpServers[serverId] = {
      command: 'npx',
      args: ['-y', '@afn-ecosystem/mcp-data-agent@latest'],
      disabled: false,
      env,
      autoApprove,
    };
    merged += 1;
  }
  if (!connectable && !cur.mcpServers['afn-mcp-data-agent']) {
    cur.mcpServers['afn-mcp-data-agent'] = {
      command: 'npx',
      args: ['-y', '@afn-ecosystem/mcp-data-agent@latest'],
      disabled: false,
      env: credsFor(cred, '', true),
      autoApprove,
    };
    merged += 1;
    ids.push('afn-mcp-data-agent');
  }
  writeJson(mcpFile, cur);
  return { merged: merged > 0, count: ids.length, ids };
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
        name: 'AFN local',
        description: 'Dashboard / guardar readme / cerebro en local. Exit 2 = no mandar al LLM.',
        trigger: 'PromptSubmit',
        action: { type: 'command', command: `${nodeCmd} prompt-gate` },
        timeout: 25,
      },
      {
        name: 'AFN local v1',
        description: 'Igual para Kiro 1.x (UserPromptSubmit).',
        trigger: 'UserPromptSubmit',
        action: { type: 'command', command: `${nodeCmd} prompt-gate` },
        timeout: 25,
      },
    ],
  });
  try {
    fs.unlinkSync(path.join(dir, 'afn-agent-stop.json'));
  } catch {
    /* el hook agent gastaba un turno LLM extra en cada stop */
  }
  writeLocalLaunchers(projectRoot);
}

function writeLocalLaunchers(projectRoot) {
  const dir = path.join(projectRoot, '.afn', '_tmp');
  fs.mkdirSync(dir, { recursive: true });
  const node = process.execPath;
  const dashCmd = `@echo off\r\ncd /d "${projectRoot}"\r\n"${node}" "${ENTRY}" dashboard %*\r\necho.\r\necho Dashboard local: no usa tokens de Kiro. Ctrl+C para parar.\r\n`;
  fs.writeFileSync(path.join(dir, 'afn-dashboard.cmd'), dashCmd, 'utf8');
  fs.writeFileSync(
    path.join(dir, 'afn-note-save.cmd'),
    `@echo off\r\ncd /d "${projectRoot}"\r\n"${node}" "${ENTRY}" note-save %*\r\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(dir, 'afn-mem-search.cmd'),
    `@echo off\r\ncd /d "${projectRoot}"\r\n"${node}" "${ENTRY}" mem-search %*\r\n`,
    'utf8',
  );
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
        ? `MCP: ${mcpFile}. Dashboard SIN tokens: .afn/_tmp/afn-dashboard.cmd (http://127.0.0.1:5847). note-save / mem-search en .afn/_tmp. No pidas esas cosas en el chat.`
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
