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

export function saveOriginsPack(root, connections) {
  const SECRET = /password|secret|token|connectionstring|connstr|pwd/i;
  if (!Array.isArray(connections)) return { ok: false, error: 'connections debe ser un array' };
  const clean = connections.map((c) => {
    const o = c && typeof c === 'object' ? { ...c } : {};
    for (const k of Object.keys(o)) {
      if (SECRET.test(k)) delete o[k];
    }
    return o;
  });
  fs.mkdirSync(afnPath(root), { recursive: true });
  fs.writeFileSync(afnPath(root, 'db-connections.json'), `${JSON.stringify({ version: 1, connections: clean }, null, 2)}\n`, 'utf8');
  return { ok: true, count: clean.length };
}
