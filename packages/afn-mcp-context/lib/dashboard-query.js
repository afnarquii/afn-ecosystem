import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afnPath } from './paths.js';
import { assertSafeReadonlySql } from './sql-safety.js';

const MAX_ROWS = 500;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function loadOrigins(root) {
  const pack = readJson(afnPath(root, 'db-connections.json'));
  const list = Array.isArray(pack?.connections) ? pack.connections : Array.isArray(pack) ? pack : [];
  const session = readJson(afnPath(root, 'db-connection.json'));
  if (!list.length && session) return [session];
  return list;
}

export const DATA_AGENT_CREDENTIALS_EXAMPLE = {
  flat: { DB_USER: 'sa', DB_PASSWORD: 'TU_PASSWORD' },
  byId: { byId: { origen_1: { DB_USER: 'sa', DB_PASSWORD: 'TU_PASSWORD' } } },
  mongo: { MONGODB_URI: 'mongodb://USER:PASSWORD@localhost:27017/db' },
};

function hasUserKey(o) {
  return Boolean(o && (o.DB_USER || o.user || o.DB_USERNAME));
}

function hasSecretKey(o) {
  return Boolean(o && (o.DB_PASSWORD || o.password || o.MONGODB_URI));
}

/** Estado del archivo de credenciales. Nunca devuelve valores secretos. */
export function inspectCredentialsFile(root) {
  const example = DATA_AGENT_CREDENTIALS_EXAMPLE;
  const file = afnPath(root, 'credentials', 'data-agent.json');
  if (!fs.existsSync(file)) {
    return { exists: false, validJson: false, shape: 'missing', hasUser: false, hasPassword: false, ids: [], example };
  }
  const cred = readJson(file);
  if (!cred || typeof cred !== 'object' || Array.isArray(cred)) {
    return { exists: true, validJson: false, shape: 'invalid', hasUser: false, hasPassword: false, ids: [], example };
  }
  if (cred.byId && typeof cred.byId === 'object' && !Array.isArray(cred.byId)) {
    const ids = Object.keys(cred.byId);
    const vals = ids.map((k) => cred.byId[k]).filter((v) => v && typeof v === 'object');
    return {
      exists: true,
      validJson: true,
      shape: 'byId',
      hasUser: vals.some(hasUserKey),
      hasPassword: vals.some(hasSecretKey),
      ids,
      example,
    };
  }
  if (cred.connections && typeof cred.connections === 'object' && !Array.isArray(cred.connections)) {
    const ids = Object.keys(cred.connections);
    const vals = ids.map((k) => cred.connections[k]).filter((v) => v && typeof v === 'object');
    return {
      exists: true,
      validJson: true,
      shape: 'connections',
      hasUser: vals.some(hasUserKey),
      hasPassword: vals.some(hasSecretKey),
      ids,
      example,
    };
  }
  const keys = Object.keys(cred).filter((k) => typeof cred[k] === 'string');
  return {
    exists: true,
    validJson: true,
    shape: keys.length ? 'flat' : 'empty',
    hasUser: hasUserKey(cred),
    hasPassword: hasSecretKey(cred),
    ids: [],
    example,
  };
}

function credsFor(root, id) {
  const cred = readJson(afnPath(root, 'credentials', 'data-agent.json')) || {};
  const nested = cred.byId?.[id] || cred.connections?.[id];
  if (nested && typeof nested === 'object') return nested;
  const flat = {};
  for (const [k, v] of Object.entries(cred)) {
    if (typeof v === 'string') flat[k] = v;
  }
  return flat;
}

function pickOrigin(root, connectionId) {
  const list = loadOrigins(root);
  if (connectionId) {
    const hit = list.find((c) => String(c.id || '') === String(connectionId) || String(c.name || '') === String(connectionId));
    if (hit) return hit;
  }
  const session = readJson(afnPath(root, 'db-connection.json'));
  if (session) return session;
  return list[0] || null;
}

async function tryImport(name) {
  const extras = [process.env.AFN_NODE_PATH, process.cwd()].filter(Boolean);
  for (const base of extras) {
    const candidates = [
      path.join(base, 'node_modules', name, 'index.js'),
      path.join(base, 'node_modules', name, 'index.mjs'),
    ];
    for (const abs of candidates) {
      if (!fs.existsSync(abs)) continue;
      try {
        return await import(pathToFileURL(abs).href);
      } catch {
        /* */
      }
    }
  }
  try {
    return await import(name);
  } catch {
    return null;
  }
}

function engineOf(origin) {
  return String(origin?.dbEngine || origin?.engine || '').toLowerCase();
}

/**
 * Ejecuta SELECT contra el origen (mssql/pg si el driver está instalado en el workspace).
 * Sin secretos en la respuesta.
 */
export async function runDashboardSql(root, { sql, connectionId, limit } = {}) {
  const safe = assertSafeReadonlySql(sql);
  if (!safe.ok) return { ok: false, error: safe.error, rows: [], columns: [] };
  const origin = pickOrigin(root, connectionId);
  if (!origin) return { ok: false, error: 'No hay origen en .afn/db-connections.json', rows: [], columns: [] };
  const cred = credsFor(root, origin.id);
  const engine = engineOf(origin);
  const cap = Math.min(MAX_ROWS, Math.max(1, Number(limit) || 100));
  const cfg = {
    host: origin.host || cred.DB_SERVER || cred.DB_HOST || '',
    port: Number(origin.port || cred.DB_PORT || 0) || undefined,
    database: origin.database || cred.DB_DATABASE || '',
    user: cred.DB_USER || cred.user || '',
    password: cred.DB_PASSWORD || cred.password || '',
  };

  if (/sqlserver|mssql/.test(engine)) {
    const mssql = await tryImport('mssql');
    if (!mssql?.default && !mssql?.connect) {
      return {
        ok: false,
        error: 'Falta el driver mssql. En el workspace: npm i mssql. Credenciales en .afn/credentials/data-agent.json.',
        rows: [],
        columns: [],
      };
    }
    const sqlMod = mssql.default || mssql;
    if (!cfg.host || !cfg.database || !cfg.user) {
      return { ok: false, error: 'Origen incompleto: host, database y DB_USER (credentials).', rows: [], columns: [] };
    }
    const pool = await sqlMod.connect({
      server: cfg.host,
      port: cfg.port || 1433,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      options: { encrypt: true, trustServerCertificate: true },
      requestTimeout: 30_000,
    });
    try {
      const result = await pool.request().query(safe.sql);
      const rows = Array.isArray(result.recordset) ? result.recordset.slice(0, cap) : [];
      const columns = rows[0] ? Object.keys(rows[0]) : [];
      return { ok: true, rows, columns, truncated: (result.recordset || []).length > cap, engine: 'sqlserver' };
    } finally {
      await pool.close?.();
    }
  }

  if (/postgres/.test(engine)) {
    const pg = await tryImport('pg');
    const Client = pg?.Client || pg?.default?.Client;
    if (!Client) {
      return { ok: false, error: 'Falta el driver pg. En el workspace: npm i pg.', rows: [], columns: [] };
    }
    const client = new Client({
      host: cfg.host || 'localhost',
      port: cfg.port || 5432,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
    });
    await client.connect();
    try {
      const result = await client.query(safe.sql);
      const rows = Array.isArray(result.rows) ? result.rows.slice(0, cap) : [];
      const columns = rows[0] ? Object.keys(rows[0]) : (result.fields || []).map((f) => f.name);
      return { ok: true, rows, columns, truncated: (result.rows || []).length > cap, engine: 'postgresql' };
    } finally {
      await client.end();
    }
  }

  return {
    ok: false,
    error: `Motor ${engine || '?'} sin runner en el dashboard. SQL Server (mssql) o PostgreSQL (pg).`,
    rows: [],
    columns: [],
  };
}

export function loadSqlFavorites(root) {
  const j = readJson(afnPath(root, 'sql-favorites.json'));
  return Array.isArray(j?.favorites) ? j.favorites : [];
}

export function saveSqlFavorites(root, favorites) {
  const list = (Array.isArray(favorites) ? favorites : [])
    .slice(0, 40)
    .map((f) => ({
      id: String(f.id || `fav_${Date.now()}`).slice(0, 40),
      title: String(f.title || 'consulta').slice(0, 80),
      sql: String(f.sql || '').slice(0, 8000),
    }))
    .filter((f) => f.sql.trim());
  fs.mkdirSync(afnPath(root), { recursive: true });
  fs.writeFileSync(afnPath(root, 'sql-favorites.json'), `${JSON.stringify({ version: 1, favorites: list }, null, 2)}\n`, 'utf8');
  return list;
}

export function normalizeOriginsInput(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.connections)) return raw.connections;
  if (raw && typeof raw === 'object' && (raw.host || raw.database || raw.dbEngine || raw.engine || raw.name || raw.connectionName)) {
    return [raw];
  }
  return null;
}

export function saveOriginsPack(root, connections) {
  const SECRET = /password|secret|token|connectionstring|connstr|pwd/i;
  const list = normalizeOriginsInput(connections);
  if (!list) return { ok: false, error: 'Mandá una lista connections o un origen con host/database' };
  const clean = list.map((c, i) => {
    const o = c && typeof c === 'object' ? { ...c } : {};
    for (const k of Object.keys(o)) {
      if (SECRET.test(k)) delete o[k];
    }
    if (!o.id) o.id = `origen_${i + 1}`;
    if (!o.name) o.name = o.connectionName || o.database || o.host || o.id;
    if (o.dbEngine && !o.engine) o.engine = o.dbEngine;
    if (o.engine && !o.dbEngine) o.dbEngine = o.engine;
    o.needsCredentials = true;
    o.scope = o.scope || 'project';
    return o;
  });
  fs.mkdirSync(afnPath(root), { recursive: true });
  fs.writeFileSync(afnPath(root, 'db-connections.json'), `${JSON.stringify({ version: 1, connections: clean }, null, 2)}\n`, 'utf8');
  const first = clean[0];
  if (first) {
    const session = {
      version: 1,
      id: first.id,
      connectionName: first.connectionName || first.name || '',
      dbEngine: first.dbEngine || first.engine || '',
      host: first.host || '',
      port: first.port || null,
      database: first.database || '',
      evidence: first.evidence || 'dashboard',
      mcp: first.mcp || 'afn-mcp-data-agent',
      needsCredentials: true,
    };
    fs.writeFileSync(afnPath(root, 'db-connection.json'), `${JSON.stringify(session, null, 2)}\n`, 'utf8');
  }
  return { ok: true, count: clean.length, saved: true };
}
