import http from 'node:http';
import crypto from 'node:crypto';
import { collectDashboard, buildHtml } from './dashboard.js';
import { saveOriginsPack, runDashboardSql, loadSqlFavorites, saveSqlFavorites, inspectCredentialsFile, sqlDriverStatus } from './dashboard-query.js';
import { readLiveSchema, saveDataSelection, readDataSelection, readDataSelectionPack } from './data-sources.js';
import { afnPath } from './paths.js';
import fs from 'node:fs';

const live = new Map();

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function send(res, code, body, extra = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  const type = extra.type || (typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8');
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    ...extra.headers,
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > 2_000_000) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function authOk(req, token, url) {
  const h = String(req.headers['x-afn-token'] || '');
  const q = url.searchParams.get('token') || '';
  return Boolean(token) && (h === token || q === token);
}

async function handleApi(root, token, req, res, url) {
  if (!authOk(req, token, url)) {
    send(res, 401, { ok: false, error: 'token' });
    return;
  }
  const route = url.pathname.replace(/\/+$/, '') || '/';
  if (req.method === 'GET' && route === '/api/health') {
    send(res, 200, { ok: true, driver: sqlDriverStatus(root) });
    return;
  }
  if (req.method === 'GET' && route === '/api/origins') {
    const pack = readJson(afnPath(root, 'db-connections.json')) || { connections: [] };
    send(res, 200, {
      ok: true,
      connections: pack.connections || pack,
      credentials: inspectCredentialsFile(root),
    });
    return;
  }
  if (req.method === 'PUT' && route === '/api/origins') {
    const raw = JSON.parse((await readBody(req)) || '{}');
    const r = saveOriginsPack(root, raw.connections || raw);
    send(res, r.ok ? 200 : 400, r);
    return;
  }
  if (req.method === 'GET' && route === '/api/schema') {
    const liveData = readLiveSchema(root);
    const pack = readDataSelectionPack(root);
    const id = url.searchParams.get('connectionId') || liveData.connectionId || liveData.connectionName || '_default';
    const selection = readDataSelection(root, id);
    send(res, 200, { ok: true, live: liveData, selection, connectionId: id, byConnection: pack.byConnection });
    return;
  }
  if (req.method === 'PUT' && route === '/api/schema') {
    const raw = JSON.parse((await readBody(req)) || '{}');
    const id = String(raw.connectionId || '_default');
    const r = saveDataSelection(root, id, raw);
    send(res, 200, r);
    return;
  }
  if (req.method === 'POST' && route === '/api/sql') {
    const raw = JSON.parse((await readBody(req)) || '{}');
    const r = await runDashboardSql(root, raw);
    send(res, r.ok ? 200 : 400, r);
    return;
  }
  if (req.method === 'GET' && route === '/api/sql/favorites') {
    send(res, 200, { ok: true, favorites: loadSqlFavorites(root) });
    return;
  }
  if (req.method === 'PUT' && route === '/api/sql/favorites') {
    const raw = JSON.parse((await readBody(req)) || '{}');
    const favorites = saveSqlFavorites(root, raw.favorites);
    send(res, 200, { ok: true, favorites });
    return;
  }
  send(res, 404, { ok: false, error: 'not_found' });
}

/**
 * Servidor loopback para editar orígenes / esquema y correr SELECT / EXEC.
 * @param {string} root
 * @param {{ port?: number }} [opts]
 */
export function startDashboardServer(root, opts = {}) {
  const abs = String(root || '');
  const prev = live.get(abs);
  if (prev?.ready) return prev.ready;
  const token = crypto.randomBytes(16).toString('hex');
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/')) {
        await handleApi(abs, token, req, res, url);
        return;
      }
      const data = collectDashboard(abs);
      const html = buildHtml(data, { api: { token } });
      send(res, 200, html, { type: 'text/html; charset=utf-8' });
    } catch (e) {
      send(res, 500, { ok: false, error: String(e?.message || e).slice(0, 300) });
    }
  });
  const info = { server, token, root: abs, port: 0, url: '', ready: null };
  info.ready = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('listening', () => {
      const addr = server.address();
      info.port = addr.port;
      info.url = `http://127.0.0.1:${addr.port}/?token=${token}`;
      resolve(info);
    });
  });
  live.set(abs, info);
  server.listen(Number(opts.port) || 0, '127.0.0.1');
  return info.ready;
}

export function stopDashboardServer(root) {
  const prev = live.get(String(root || ''));
  if (!prev?.server) return;
  prev.server.close();
  live.delete(String(root || ''));
}

export function dashboardPublicUrl(info, hash = '#readme') {
  const h = hash.startsWith('#') ? hash : `#${hash}`;
  return `${String(info?.url || '')}${h}`;
}
