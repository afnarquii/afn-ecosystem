import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolveWorkspaceRoot, isCatalogish, isAfnEcosystemCatalog } from './resolve-root.js';
import { registerKnownProject } from './catalog-registry.js';
import { pruneAutoNpxDataAgent } from './kiro-mcp-policy.js';

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
      'afn_sql',
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
- Si el usuario pide datos de la base (listado, conteo, un PA, qué hay en una tabla): llamá **afn_sql** en este MCP (y **afn_data_sources** si no sabés el origen). El origen está en \`.afn/db-connections.json\` y las credenciales en \`.afn/credentials/data-agent.json\`. **Devolvé las filas.** No le pidas que corra la consulta ni que pegue el resultado. Varios orígenes en el mismo repo no son varios MCP: pasá \`connectionId\` (id o name). Sin id se usa la sesión \`.afn/db-connection.json\`. Otro repo abierto en Kiro tiene su propio MCP \`afn-context\` y su propio \`.afn/\`. La pestaña SQL del dashboard es para la persona. **No** arranques \`npx @afn-ecosystem/mcp-data-agent\` (cierra con MCP 32000).
- Scripts Python o Node: la ruta vive solo en \`.afn/script-runners.json\` (puede estar fuera del repo, con claves). **No abras ese archivo**, no lo cites y no pidas tokens. \`afn_script\` con \`action: "list"\` no trae la ruta ni corre nada. \`action: "run"\` e \`id\` **solo** si el usuario nombra el script. Si también dio parámetros, pasá \`args\` (lista) o \`params\` (objeto, llega como \`--clave valor\`). Si no dio parámetros, no inventes ninguno. La respuesta es el JSON de salida, no el código.
- Skills que el equipo reutiliza (caja, turnos, un flujo): pestaña **Skills** del dashboard (\`http://127.0.0.1:5847/#skills\`). Ahí se abren, leen y editan. No reescribas el \`SKILL.md\` en el chat si el usuario puede hacerlo en esa pestaña.
- PDF, Excel e imágenes por **ruta o por nombre dentro del proyecto** (carpeta \`imagenes/\`): *extrae imagenes/foto.png* o *extrae foto.png*. Si hay una sola imagen, *extrae la imagen*. El hook escribe \`.afn/extract/*.md\` **antes** del modelo. **Prohibido** decir que no podés leer imágenes. Si el mensaje igual llegó, **una** tool \`afn_extract_file\` con \`path\`.
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

Cada producto tiene su .afn propio. Si abrís el clon afn-ecosystem como proyecto, ahí se lee la memoria de todos los que se registraron con setup kiro.
`;

function writeHooks(projectRoot, nodeCmd) {
  const dir = path.join(projectRoot, '.kiro', 'hooks');
  fs.mkdirSync(dir, { recursive: true });
  for (const stale of ['afn-session-start.json', 'afn-session-work.json']) {
    try {
      fs.unlinkSync(path.join(dir, stale));
    } catch {
      /* el init y la sesión ya no se crean solos al abrir el proyecto */
    }
  }
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
  writeJson(path.join(dir, 'afn-prompt-submit.json'), {
    version: 'v1',
    hooks: [
      {
        name: 'AFN local',
        description: 'Dashboard, cerebro, y PDF/Excel/imagen por ruta → .md. Exit 2 = no mandar al LLM.',
        trigger: 'PromptSubmit',
        action: { type: 'command', command: `${nodeCmd} prompt-gate` },
        timeout: 60,
      },
      {
        name: 'AFN local v1',
        description: 'Igual para Kiro 1.x (UserPromptSubmit).',
        trigger: 'UserPromptSubmit',
        action: { type: 'command', command: `${nodeCmd} prompt-gate` },
        timeout: 60,
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
  const pinRoot = isAfnEcosystemCatalog(workspace) ? workspace : (isCatalogish(workspace) ? '' : workspace);
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
    pruneAutoNpxDataAgent(userMcp);
    const dataAgent = pinRoot ? pruneAutoNpxDataAgent(mcpFile) : { pruned: [] };
    const userSteering = path.join(home, '.kiro', 'steering', 'afn-context.md');
    fs.mkdirSync(path.dirname(userSteering), { recursive: true });
    fs.writeFileSync(userSteering, USER_STEERING, 'utf8');
    written.push(userSteering);
    const boot = { ok: true, skipped: true, reason: 'a-pedido' };
    const registered = pinRoot && !isAfnEcosystemCatalog(pinRoot) ? registerKnownProject(pinRoot) : { ok: true, skipped: true };
    return {
      ok: true,
      agent: 'kiro',
      written,
      workspace: pinRoot || workspace,
      mcpFile,
      userMcpStripped: stripped.stripped,
      bootstrap: boot,
      registered,
      dataAgent,
      note: isAfnEcosystemCatalog(pinRoot)
        ? `Catálogo global: ${pinRoot}. El dashboard de este proyecto lee la memoria de cada producto registrado. No mezcla eso dentro de un producto.`
        : pinRoot
          ? `MCP de este proyecto: ${mcpFile}. Su memoria queda en ${pinRoot}\\.afn. Init solo si lo pedís en el dashboard.`
          : 'Corré setup desde la carpeta del producto, o desde la raíz de afn-ecosystem si querés la memoria global.',
    };
  }

  if (kind === 'cursor') {
    const mcpFile = path.join(pinRoot || setupCwd, '.cursor', 'mcp.json');
    mergeMcpServers(mcpFile, afnContextServer(pinRoot));
    const rules = path.join(pinRoot || setupCwd, '.cursor', 'rules', 'afn-context.mdc');
    fs.mkdirSync(path.dirname(rules), { recursive: true });
    fs.writeFileSync(rules, `---\ndescription: Mapa y memoria AFN (.afn)\nglobs:\nalwaysApply: true\n---\n\n${STEERING}`, 'utf8');
    written.push(mcpFile, rules);
    const boot = { ok: true, skipped: true, reason: 'a-pedido' };
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
    const boot = { ok: true, skipped: true, reason: 'a-pedido' };
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
  const boot = { ok: true, skipped: true, reason: 'a-pedido' };
  return { ok: true, agent: 'generic', written, workspace: pinRoot || workspace, bootstrap: boot };
}

export { STEERING };
