import fs from 'node:fs';
import path from 'node:path';
import { afnPath } from './paths.js';
import { redactSecrets } from './redact.js';
import { writeArchitectureReadmeFiles, mergeLiveDataIntoReadme } from './architecture-readme.js';
import { scanComposeServices } from './stack-signals.js';

const SKIP = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', 'vendor',
  '.next', 'venv', '.venv', '__pycache__', '.afn', '.kiro', '.cursor',
  'tools', 'miniverse', 'afnbd',
]);

const SECRET_KEY = /password|secret|token|connectionstring|connstr|pwd|api[_-]?key/i;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readText(file, max = 40_000) {
  try {
    return fs.readFileSync(file, 'utf8').slice(0, max);
  } catch {
    return '';
  }
}

function stripSecretFields(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEY.test(k)) continue;
    if (typeof v === 'string' && /pwd=|password=|mongodb(\+srv)?:\/\/[^:]+:[^@]+@/i.test(v)) continue;
    if (typeof v === 'object') continue;
    out[k] = v;
  }
  return out;
}

export function liveDataFile(root) {
  return afnPath(root, 'diagrams', 'datos.md');
}

const SKIP_ENGINE = new Set(['', 'redis', 'dynamodb']);

function mcpForEngine() {
  return 'afn-mcp-data-agent';
}

function parseEnvExampleOrigin(root) {
  const names = ['.env.example', '.env.sample', '.env.template', 'env.example'];
  let blob = '';
  for (const n of names) blob += `\n${readText(path.join(root, n), 8_000)}`;
  if (!blob.trim()) return null;
  const engine = (() => {
    const t = blob.toLowerCase();
    if (/sqlserver|mssql|tedious/.test(t)) return 'sqlserver';
    if (/postgres|postgresql/.test(t)) return 'postgresql';
    if (/mysql|mariadb/.test(t)) return 'mysql';
    if (/\bmongo(?:db)?\b/.test(t)) return 'mongodb';
    if (/\bsqlite\b/.test(t)) return 'sqlite';
    return '';
  })();
  const dbM = blob.match(
    /^\s*(?:POSTGRES_DB|MYSQL_DATABASE|MONGO_INITDB_DATABASE|DB_DATABASE|DB_NAME|DATABASE_NAME)\s*=\s*["']?([^\s#"']+)/im,
  );
  const hostM = blob.match(
    /^\s*(?:DB_SERVER|DB_HOST|SQL_HOST|MONGO_HOST|POSTGRES_HOST)\s*=\s*["']?([^\s#"']+)/im,
  );
  const portM = blob.match(
    /^\s*(?:DB_PORT|SQL_PORT|MONGO_PORT|POSTGRES_PORT)\s*=\s*["']?(\d{2,5})/im,
  );
  const host = hostM?.[1] && !SECRET_KEY.test(hostM[1]) ? hostM[1] : '';
  const database = dbM?.[1] && !SECRET_KEY.test(dbM[1]) ? dbM[1] : '';
  if (!engine && !host && !database) return null;
  return {
    connectionName: database || engine || 'origen',
    dbEngine: engine,
    host,
    port: portM ? Number(portM[1]) : null,
    database,
    evidence: '.env.example',
  };
}

/**
 * Origen candidato con evidencia de disco (compose, env.example, projects.db).
 * Sin secretos. No conecta.
 */
export function inferDbOrigin(root, projects = []) {
  const compose = (scanComposeServices(root) || []).find(
    (s) => s.type === 'database' && !SKIP_ENGINE.has(String(s.db || '').toLowerCase()),
  );
  if (compose) {
    const engine = compose.db === 'database' ? '' : compose.db;
    return {
      connectionName: compose.name || engine || 'db',
      dbEngine: engine,
      host: compose.port ? 'localhost' : '',
      port: compose.port || null,
      database: '',
      evidence: 'docker-compose',
    };
  }
  const env = parseEnvExampleOrigin(root);
  if (env) return env;
  const withDb = (projects || []).find((p) => p.db && !SKIP_ENGINE.has(String(p.db).toLowerCase()));
  if (withDb) {
    return {
      connectionName: withDb.name || withDb.db,
      dbEngine: withDb.db,
      host: '',
      port: null,
      database: '',
      evidence: `projects:${withDb.name}`,
    };
  }
  return null;
}

/**
 * Ficha de origen del init (`/afn-init` / bootstrap). No pisa si ya existe.
 * Nunca escribe password.
 */
export function ensureDbOriginFile(root, projects = []) {
  const file = afnPath(root, 'db-connection.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    return {
      ok: true,
      skipped: true,
      path: '.afn/db-connection.json',
      origin: sanitizeConn(readJson(file) || {}),
    };
  }
  const inferred = inferDbOrigin(root, projects);
  const body = {
    version: 1,
    connectionName: inferred?.connectionName || '',
    dbEngine: inferred?.dbEngine || '',
    host: inferred?.host || '',
    port: inferred?.port || null,
    database: inferred?.database || '',
    evidence: inferred?.evidence || 'afn-init-sin-evidencia',
    mcp: mcpForEngine(inferred?.dbEngine),
    needsCredentials: true,
  };
  fs.writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  return {
    ok: true,
    skipped: false,
    path: '.afn/db-connection.json',
    origin: sanitizeConn(body),
  };
}

function sanitizeConn(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  return {
    id: String(c.id || c.savedProfileId || '').slice(0, 80),
    name: String(c.name || c.connectionName || c.database || '').slice(0, 80),
    engine: String(c.engine || c.dbEngine || c.dbType || c.type || '').slice(0, 40),
    database: String(c.database || c.db || '').slice(0, 80),
    host: String(c.server || c.host || '').slice(0, 120),
  };
}

function listMcpHints(root) {
  const hints = [];
  const kiro = readJson(path.join(root, '.kiro', 'settings', 'mcp.json'));
  const servers = kiro?.mcpServers && typeof kiro.mcpServers === 'object' ? kiro.mcpServers : {};
  for (const id of Object.keys(servers)) {
    const low = id.toLowerCase();
    if (/data-agent|session-db|global-db|mssql|mongo/.test(low)) {
      hints.push({ id, via: '.kiro/settings/mcp.json' });
    }
  }
  const mcpsDir = afnPath(root, 'mcps');
  try {
    for (const name of fs.readdirSync(mcpsDir)) {
      if (!name.endsWith('.json')) continue;
      const j = readJson(path.join(mcpsDir, name));
      const id = String(j?.id || name.replace(/\.json$/i, ''));
      if (/data-agent|session-db|global-db|mssql|mongo/.test(id.toLowerCase())) {
        hints.push({ id, via: `.afn/mcps/${name}` });
      }
    }
  } catch {
    /* */
  }
  return hints;
}

function walkCodeMentions(root, maxFiles = 80) {
  const procedures = new Set();
  const collections = new Set();
  const files = [];
  const walk = (dir, depth) => {
    if (depth > 5 || files.length >= maxFiles) return;
    let names = [];
    try {
      names = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of names) {
      if (files.length >= maxFiles) return;
      if (SKIP.has(ent.name) || ent.name.startsWith('.')) continue;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(abs, depth + 1);
        continue;
      }
      if (!/\.(js|ts|mjs|cjs|cs|py|sql)$/i.test(ent.name)) continue;
      files.push(abs);
    }
  };
  walk(root, 0);
  for (const abs of files) {
    const src = readText(abs);
    if (!src) continue;
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    let m;
    const execRe = /\bEXEC(?:UTE)?\s+(?:\[?dbo\]?\.)?\[?([A-Za-z_][\w]*)\]?/gi;
    while ((m = execRe.exec(src))) procedures.add(`${m[1]} · ${rel}`);
    const spRe = /\b(sp_[A-Za-z0-9_]+|usp_[A-Za-z0-9_]+)\b/g;
    while ((m = spRe.exec(src))) procedures.add(`${m[1]} · ${rel}`);
    const mongoRe = /mongoose\.model\(\s*['"](\w+)/g;
    while ((m = mongoRe.exec(src))) collections.add(`${m[1]} · ${rel}`);
    const collRe = /\.collection\(\s*['"](\w+)/g;
    while ((m = collRe.exec(src))) collections.add(`${m[1]} · ${rel}`);
  }
  return {
    procedures: [...procedures].slice(0, 40),
    collections: [...collections].slice(0, 40),
  };
}

/**
 * Orígenes de datos del workspace: contexto/perfiles + MCP ya instalado + menciones en código.
 * No conecta. No lee secretos.
 */
export function collectDataSources(root) {
  const session = sanitizeConn(readJson(afnPath(root, 'db-connection.json')) || {});
  const pack = readJson(afnPath(root, 'db-connections.json'));
  const profiles = (Array.isArray(pack?.connections) ? pack.connections : Array.isArray(pack) ? pack : [])
    .map(sanitizeConn)
    .filter((c) => c.id || c.name);
  const ctx = redactSecrets(readJson(afnPath(root, 'context.json')) || {});
  const ctxSafe = stripSecretFields(ctx && typeof ctx === 'object' ? ctx : {});
  const mcp = listMcpHints(root);
  const code = walkCodeMentions(root);
  const skillDirs = [];
  try {
    const skills = afnPath(root, 'skills');
    for (const name of fs.readdirSync(skills)) {
      if (/^db-schema-/i.test(name)) skillDirs.push(`.afn/skills/${name}`);
    }
  } catch {
    /* */
  }

  const preferred = session.name || session.id
    ? { ...session, reason: '.afn/db-connection.json' }
    : profiles[0] || null;

  let useMcp = 'ninguno en este workspace';
  let how = 'Configurá afn-session-db (IDE) o afn-mcp-data-agent en .kiro/settings/mcp.json. No inventes el origen.';
  if (mcp.some((m) => /session-db|global-db/.test(m.id))) {
    useMcp = mcp.find((m) => /session-db|global-db/.test(m.id)).id;
    how = 'Usá list_tables / describe_table / run_readonly_sql (solo SELECT TOP 1). Luego afn_schema_commit.';
  } else if (mcp.some((m) => /data-agent/.test(m.id))) {
    useMcp = mcp.find((m) => /data-agent/.test(m.id)).id;
    how = 'Usá data_list_entities, data_describe_entity, data_list_actions. Un data_find con limit 1. Luego afn_schema_commit.';
  }

  return {
    ok: true,
    preferred,
    profiles,
    mcp,
    useMcp,
    how,
    codeMentions: code,
    schemaSkills: skillDirs,
    contextFlags: {
      mcpSessionDbTools: ctxSafe.mcpSessionDbTools === true,
    },
    liveFile: fs.existsSync(liveDataFile(root)) ? '.afn/diagrams/datos.md' : '',
    hint: preferred
      ? `Origen: ${preferred.name || preferred.id} (${preferred.engine || 'motor ?'}). MCP: ${useMcp}. ${how}`
      : `Sin db-connection.json. Hay ${profiles.length} perfiles y ${mcp.length} MCP de datos. ${how}`,
  };
}

function sampleToLine(sample) {
  if (sample == null) return '';
  const safe = redactSecrets(typeof sample === 'object' ? sample : { value: sample });
  const txt = JSON.stringify(safe);
  if (!txt) return '';
  return txt.length > 280 ? `${txt.slice(0, 277)}…` : txt;
}

function buildDatosMarkdown(input = {}) {
  const engine = String(input.engine || '').slice(0, 40);
  const name = String(input.connectionName || input.source || 'BD').slice(0, 80);
  const lines = [
    `## 6b. Origen de datos (MCP)`,
    '',
    `_Captura a pedido. Motor: **${engine || '—'}**. Perfil: **${name}**. Fuente MCP: \`${String(input.source || '').slice(0, 80)}\`. Sin secretos._`,
    '',
  ];
  const tables = Array.isArray(input.tables) ? input.tables.slice(0, 80) : [];
  if (tables.length) {
    lines.push('### Tablas / colecciones', '');
    lines.push('| Nombre | Columnas | Ejemplo (1 fila, recortado) |');
    lines.push('|--------|----------|------------------------------|');
    for (const t of tables) {
      const cols = (t.columns || [])
        .slice(0, 16)
        .map((c) => (typeof c === 'string' ? c : `${c.name}${c.type ? `:${c.type}` : ''}`))
        .join(', ');
      lines.push(`| \`${String(t.name || '').slice(0, 80)}\` | ${cols || '—'} | ${sampleToLine(t.sample) || '—'} |`);
    }
    lines.push('');
  }
  const procs = Array.isArray(input.procedures) ? input.procedures.slice(0, 60) : [];
  if (procs.length) {
    lines.push('### Procedimientos / actions', '');
    lines.push('| Nombre | Parámetros | Devuelve | Ejemplo |');
    lines.push('|--------|------------|----------|---------|');
    for (const p of procs) {
      const params = Array.isArray(p.params) ? p.params.slice(0, 12).join(', ') : String(p.params || '—').slice(0, 120);
      lines.push(
        `| \`${String(p.name || '').slice(0, 80)}\` | ${params || '—'} | ${String(p.returns || '—').slice(0, 80)} | ${sampleToLine(p.sample) || '—'} |`,
      );
    }
    lines.push('');
  }
  const calls = Array.isArray(input.calls) ? input.calls.slice(0, 40) : [];
  if (calls.length) {
    lines.push('### Quién llama qué', '');
    lines.push('| Desde (flujo/contenedor) | PA / entidad | Cómo |');
    lines.push('|--------------------------|--------------|------|');
    for (const c of calls) {
      lines.push(`| ${String(c.from || '').slice(0, 60)} | \`${String(c.procedure || c.entity || '').slice(0, 80)}\` | ${String(c.via || '').slice(0, 40)} |`);
    }
    lines.push('');
  }
  if (!tables.length && !procs.length) {
    lines.push('_Sin tablas ni procedimientos en esta captura._', '');
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Persiste esquema vivo (el LLM lo obtuvo del MCP de datos). No ejecuta SQL.
 */
export function commitLiveSchema(root, input = {}) {
  const md = buildDatosMarkdown(input);
  const file = liveDataFile(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, md.endsWith('\n') ? md : `${md}\n`, 'utf8');
  let arch = readText(path.join(root, 'ARQUITECTURA.md'), 200_000);
  if (!arch.trim()) arch = '# Arquitectura (punta a punta)\n\n## 6. Datos y esquemas\n\n';
  const merged = mergeLiveDataIntoReadme(root, arch);
  const wrote = writeArchitectureReadmeFiles(root, merged);
  return {
    ok: true,
    file: '.afn/diagrams/datos.md',
    readme: wrote.rootFile,
    tables: Array.isArray(input.tables) ? input.tables.length : 0,
    procedures: Array.isArray(input.procedures) ? input.procedures.length : 0,
    hint: 'Esquema vivo en ARQUITECTURA.md §6b y .afn/diagrams/datos.md. Regenerar arquitectura no debe inventar columnas; este archivo es la evidencia MCP.',
  };
}
