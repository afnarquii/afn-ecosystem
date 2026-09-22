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

function engineFromBlob(blob) {
  const t = String(blob || '').toLowerCase();
  if (/sqlserver|mssql|tedious/.test(t)) return 'sqlserver';
  if (/postgres|postgresql/.test(t)) return 'postgresql';
  if (/mysql|mariadb/.test(t)) return 'mysql';
  if (/\bmongo(?:db)?\b/.test(t)) return 'mongodb';
  if (/\bsqlite\b/.test(t)) return 'sqlite';
  return '';
}

function parseEnvExampleOrigin(dir, evidence = '.env.example') {
  const names = ['.env.example', '.env.sample', '.env.template', 'env.example'];
  let blob = '';
  for (const n of names) blob += `\n${readText(path.join(dir, n), 8_000)}`;
  if (!blob.trim()) return null;
  const engine = engineFromBlob(blob);
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
    evidence,
  };
}

function originId(o) {
  const raw = [o.dbEngine || o.engine, o.host, o.port, o.database, o.project, o.connectionName]
    .filter((x) => x !== undefined && x !== null && String(x) !== '')
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 56);
  return `init_${raw || 'origen'}`;
}

function sameishOrigin(a, b) {
  const ea = String(a.dbEngine || a.engine || '').toLowerCase();
  const eb = String(b.dbEngine || b.engine || '').toLowerCase();
  if (!ea || !eb || ea !== eb) return false;
  const hostA = String(a.host || '').toLowerCase();
  const hostB = String(b.host || '').toLowerCase();
  if (hostA && hostB && hostA !== hostB) return false;
  const dbA = String(a.database || '').toLowerCase();
  const dbB = String(b.database || '').toLowerCase();
  if (dbA && dbB && dbA !== dbB) return false;
  const pA = Number(a.port || 0);
  const pB = Number(b.port || 0);
  if (pA && pB && pA !== pB) return false;
  if (!hostA && !hostB && !dbA && !dbB && !pA && !pB) {
    return String(a.project || '') === String(b.project || '');
  }
  return true;
}

function mergeOrigin(into, extra) {
  const evA = String(into.evidence || '');
  const evB = String(extra.evidence || '');
  return {
    ...into,
    connectionName: into.connectionName || extra.connectionName,
    host: into.host || extra.host,
    port: into.port || extra.port,
    database: into.database || extra.database,
    project: into.project || extra.project,
    evidence: evA && evB && evA !== evB ? `${evA}+${evB}` : evA || evB,
  };
}

function fromComposeService(s, project = '') {
  if (!s || s.type !== 'database') return null;
  const engine = s.db === 'database' ? '' : s.db;
  if (SKIP_ENGINE.has(String(engine || '').toLowerCase())) return null;
  return {
    connectionName: s.name || engine || 'db',
    dbEngine: engine,
    host: s.port ? 'localhost' : '',
    port: s.port || null,
    database: '',
    evidence: project ? `${project}:docker-compose` : 'docker-compose',
    project,
  };
}

function toConnRecord(inf) {
  const id = inf.id || originId(inf);
  return {
    id,
    name: inf.connectionName || inf.name || inf.dbEngine || id,
    connectionName: inf.connectionName || inf.name || '',
    dbEngine: inf.dbEngine || inf.engine || '',
    engine: inf.dbEngine || inf.engine || '',
    host: inf.host || '',
    port: inf.port || null,
    database: inf.database || '',
    project: inf.project || '',
    evidence: inf.evidence || 'afn-init',
    mcp: mcpForEngine(),
    needsCredentials: true,
    scope: 'project',
  };
}

function stripSecretsFromConn(c) {
  if (!c || typeof c !== 'object') return {};
  const out = { ...c };
  for (const k of Object.keys(out)) {
    if (SECRET_KEY.test(k)) delete out[k];
    if (typeof out[k] === 'string' && /pwd=|password=|mongodb(\+srv)?:\/\/[^:]+:[^@]+@/i.test(out[k])) delete out[k];
  }
  return out;
}

/**
 * Todos los orígenes con evidencia de disco (varios repos / varios compose).
 * Sin secretos. No conecta.
 */
export function inferDbOrigins(root, projects = []) {
  const list = [];
  const push = (raw) => {
    if (!raw) return;
    const engine = String(raw.dbEngine || raw.engine || '').toLowerCase();
    if (SKIP_ENGINE.has(engine) && !raw.host && !raw.database) return;
    const hit = list.find((x) => sameishOrigin(x, raw));
    if (hit) {
      const idx = list.indexOf(hit);
      list[idx] = mergeOrigin(hit, raw);
      return;
    }
    list.push({ ...raw });
  };

  for (const s of scanComposeServices(root) || []) push(fromComposeService(s));
  push(parseEnvExampleOrigin(root));

  const rootAbs = path.resolve(root);
  for (const p of projects || []) {
    const dir = path.resolve(root, p.path || '.');
    if (dir !== rootAbs) {
      for (const s of scanComposeServices(dir) || []) push(fromComposeService(s, p.name));
      const env = parseEnvExampleOrigin(dir, `${p.name}:.env.example`);
      if (env) push({ ...env, project: p.name, connectionName: env.connectionName || p.name });
    }
    if (p.db && !SKIP_ENGINE.has(String(p.db).toLowerCase())) {
      push({
        connectionName: p.name || p.db,
        dbEngine: p.db,
        host: '',
        port: null,
        database: '',
        evidence: `projects:${p.name}`,
        project: p.name,
      });
    }
  }

  return list.map((o) => ({ ...o, id: originId(o) }));
}

export function inferDbOrigin(root, projects = []) {
  return inferDbOrigins(root, projects)[0] || null;
}

function readConnectionsPack(root) {
  const pack = readJson(afnPath(root, 'db-connections.json'));
  const list = Array.isArray(pack?.connections) ? pack.connections : Array.isArray(pack) ? pack : [];
  return list.map(stripSecretsFromConn).filter((c) => c && (c.id || c.name || c.connectionName));
}

/**
 * Catálogo de orígenes del init. Varios repos → varias fichas.
 * `.afn/db-connections.json` = lista. `.afn/db-connection.json` = sesión activa (la primera, no pisa).
 * Nunca escribe password.
 */
export function ensureDbOriginFile(root, projects = []) {
  fs.mkdirSync(afnPath(root), { recursive: true });
  const packFile = afnPath(root, 'db-connections.json');
  const sessionFile = afnPath(root, 'db-connection.json');
  const inferred = inferDbOrigins(root, projects);
  const existing = readConnectionsPack(root);
  const byId = new Map();
  for (const c of existing) {
    const rec = toConnRecord(c);
    byId.set(rec.id, { ...rec, ...stripSecretsFromConn(c), id: rec.id });
  }
  let added = 0;
  for (const inf of inferred) {
    const body = toConnRecord(inf);
    if (byId.has(body.id)) continue;
    const dup = [...byId.values()].find((x) => sameishOrigin(x, body));
    if (dup) {
      byId.set(dup.id, mergeOrigin(dup, body));
      continue;
    }
    byId.set(body.id, body);
    added += 1;
  }
  let connections = [...byId.values()];
  if (!connections.length) {
    if (fs.existsSync(sessionFile)) {
      connections = [toConnRecord(stripSecretsFromConn(readJson(sessionFile) || {}))];
    } else {
      connections = [toConnRecord({ connectionName: '', dbEngine: '', evidence: 'afn-init-sin-evidencia' })];
      added += 1;
    }
  }
  fs.writeFileSync(packFile, `${JSON.stringify({ version: 1, connections }, null, 2)}\n`, 'utf8');

  let sessionSkipped = true;
  let sessionOrigin;
  if (fs.existsSync(sessionFile)) {
    sessionOrigin = sanitizeConn(readJson(sessionFile) || {});
  } else {
    const first = connections[0];
    const sessionBody = {
      version: 1,
      id: first.id,
      connectionName: first.connectionName || first.name || '',
      dbEngine: first.dbEngine || first.engine || '',
      host: first.host || '',
      port: first.port || null,
      database: first.database || '',
      evidence: first.evidence || 'afn-init',
      mcp: first.mcp || mcpForEngine(),
      needsCredentials: true,
    };
    fs.writeFileSync(sessionFile, `${JSON.stringify(sessionBody, null, 2)}\n`, 'utf8');
    sessionSkipped = false;
    sessionOrigin = sanitizeConn(sessionBody);
  }

  return {
    ok: true,
    skipped: sessionSkipped && added === 0,
    path: '.afn/db-connections.json',
    session: '.afn/db-connection.json',
    origin: sessionOrigin,
    origins: connections.map(sanitizeConn),
    count: connections.length,
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
    port: c.port ? Number(c.port) || null : null,
    project: String(c.project || '').slice(0, 80),
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
    const agents = mcp.filter((m) => /data-agent/.test(m.id)).map((m) => m.id);
    useMcp = agents.join(', ');
    how = 'Usá data_inspect_schema del MCP de ese origen (sample:true). Si hay varios, elegí el id de .afn/db-connections.json. Luego afn_schema_commit.';
  }

  const names = profiles.map((p) => `${p.name || p.id} (${p.engine || '?'})`).filter(Boolean);

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
    hint: profiles.length
      ? `Orígenes (${profiles.length}): ${names.slice(0, 8).join('; ') || preferred.name}. Activo: ${preferred?.name || preferred?.id || '—'}. MCP: ${useMcp}. ${how}`
      : `Sin db-connections.json. ${how}`,
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
