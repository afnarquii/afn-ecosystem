import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { collectDashboard, buildHtml } from './dashboard.js';
import { saveOriginsPack, runDashboardSql, loadSqlFavorites, saveSqlFavorites, inspectCredentialsFile, sqlDriverStatus } from './dashboard-query.js';
import { createScriptRunner, listScriptRunners, removeScriptRunner, runScriptRunner, saveScriptRunner } from './script-runners.js';
import { readLiveSchema, saveDataSelection, readDataSelection, readDataSelectionPack } from './data-sources.js';
import { afnPath } from './paths.js';
import { createWorkspaceSkill, listWorkspaceSkills, readWorkspaceSkill, saveWorkspaceSkill } from './skill-library.js';
import { deleteExtractMarkdown, keepExtractInContext, listExtractMarkdown, readExtractMarkdown, saveExtractMarkdown } from './extract-text.js';
import { bootstrapAfn } from './bootstrap.js';
import { isAfnEcosystemCatalog } from './resolve-root.js';
import { aggregateCatalogMemory, registerKnownProject } from './catalog-registry.js';
import { portProjectAssets } from './project-port.js';
import { pickFolder, pickScriptFile } from './pick-folder.js';

/**
 * Cambia el repo que sirve este dashboard. El HTML y las APIs leen `state.root`.
 * @param {{ root: string }} state
 * @param {string} next
 */
export function applyWorkspaceRoot(state, next) {
  const abs = path.resolve(String(next || ''));
  if (!abs || !fs.existsSync(abs)) return { ok: false, error: 'not_found' };
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    return { ok: false, error: 'not_found' };
  }
  if (!st.isDirectory()) return { ok: false, error: 'not_found' };
  state.root = abs;
  if (!isAfnEcosystemCatalog(abs)) {
    try { registerKnownProject(abs); } catch { /* el catálogo puede no estar en esta PC */ }
  }
  return { ok: true, root: abs, name: path.basename(abs), mode: isAfnEcosystemCatalog(abs) ? 'catalog' : 'project' };
}

/** Puerto fijo para abrir el dashboard sin Kiro (`node index.js dashboard`). */
export const AFN_DASHBOARD_PORT = 5847;

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

function readBody(req, max = 2_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > max) {
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

async function handleApi(state, token, req, res, url) {
  const root = state.root;
  const route = url.pathname.replace(/\/+$/, '') || '/';
  if (req.method === 'GET' && route === '/api/who') {
    const abs = path.resolve(root);
    send(res, 200, {
      ok: true,
      root: abs,
      name: path.basename(abs),
      mode: isAfnEcosystemCatalog(abs) ? 'catalog' : 'project',
      initialized: fs.existsSync(afnPath(abs, 'projects.json')),
    });
    return;
  }
  if (!authOk(req, token, url)) {
    send(res, 401, { ok: false, error: 'token' });
    return;
  }
  if (req.method === 'GET' && route === '/api/health') {
    send(res, 200, { ok: true, driver: sqlDriverStatus(root) });
    return;
  }
  if (req.method === 'POST' && route === '/api/bootstrap') {
    const r = bootstrapAfn(root, { ceiling: root });
    send(res, r.ok ? 200 : 400, { ok: r.ok, root: r.root, reason: r.reason, error: r.ok ? '' : (r.reason || 'bootstrap_failed') });
    return;
  }
  if (req.method === 'POST' && route === '/api/workspace') {
    const raw = JSON.parse((await readBody(req)) || '{}');
    const r = applyWorkspaceRoot(state, raw.root || '');
    send(res, r.ok ? 200 : 400, r);
    return;
  }
  if (req.method === 'POST' && route === '/api/pick-folder') {
    const r = await pickFolder();
    send(res, r.ok ? 200 : 400, r);
    return;
  }
  if (req.method === 'POST' && route === '/api/pick-file') {
    const r = await pickScriptFile();
    send(res, r.ok ? 200 : 400, r);
    return;
  }
  if (req.method === 'POST' && route === '/api/import-assets') {
    const raw = JSON.parse((await readBody(req)) || '{}');
    const r = portProjectAssets(root, raw.from || '');
    send(res, r.ok ? 200 : 400, r);
    return;
  }
  if (req.method === 'GET' && route === '/api/catalog') {
    if (!isAfnEcosystemCatalog(root)) {
      send(res, 400, { ok: false, error: 'not_catalog' });
      return;
    }
    send(res, 200, aggregateCatalogMemory(root));
    return;
  }
  if (req.method === 'POST' && route === '/api/catalog/register') {
    if (!isAfnEcosystemCatalog(root)) {
      send(res, 400, { ok: false, error: 'not_catalog' });
      return;
    }
    const raw = JSON.parse((await readBody(req)) || '{}');
    const r = registerKnownProject(raw.root || raw.from || '');
    send(res, r.ok ? 200 : 400, r);
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
  if (req.method === 'GET' && route === '/api/scripts') {
    send(res, 200, { ok: true, runners: listScriptRunners(root) });
    return;
  }
  if (req.method === 'POST' && route === '/api/scripts') {
    const raw = JSON.parse((await readBody(req)) || '{}');
    const r = raw.create ? createScriptRunner(root, raw) : saveScriptRunner(root, raw);
    send(res, r.ok ? 200 : 400, r.ok ? r : { ok: false, error: r.error });
    return;
  }
  if (req.method === 'DELETE' && route === '/api/scripts') {
    const raw = JSON.parse((await readBody(req)) || '{}');
    send(res, 200, removeScriptRunner(root, raw.id));
    return;
  }
  if (req.method === 'POST' && route === '/api/scripts/run') {
    const raw = JSON.parse((await readBody(req)) || '{}');
    const r = await runScriptRunner(root, raw.id, { limit: raw.limit });
    send(res, r.ran || r.ok ? 200 : 400, r);
    return;
  }
  if (req.method === 'GET' && route === '/api/skills') {
    send(res, 200, listWorkspaceSkills(root));
    return;
  }
  if (req.method === 'GET' && route === '/api/skills/file') {
    const r = readWorkspaceSkill(root, url.searchParams.get('rel') || '');
    send(res, r.ok ? 200 : r.error === 'not_found' ? 404 : 400, r);
    return;
  }
  if (req.method === 'PUT' && route === '/api/skills/file') {
    const raw = JSON.parse((await readBody(req)) || '{}');
    const r = saveWorkspaceSkill(root, raw.rel, raw.markdown);
    send(res, r.ok ? 200 : r.error === 'not_found' ? 404 : 400, r);
    return;
  }
  if (req.method === 'POST' && route === '/api/skills') {
    const raw = JSON.parse((await readBody(req)) || '{}');
    const r = createWorkspaceSkill(root, raw);
    send(res, r.ok ? 200 : r.error === 'exists' ? 409 : 400, r);
    return;
  }
  if (req.method === 'GET' && route === '/api/extract') {
    send(res, 200, listExtractMarkdown(root));
    return;
  }
  if (req.method === 'GET' && route === '/api/extract/file') {
    const r = readExtractMarkdown(root, url.searchParams.get('name') || '');
    send(res, r.ok ? 200 : r.error === 'not_found' ? 404 : 400, r);
    return;
  }
  if (req.method === 'DELETE' && route === '/api/extract/file') {
    const r = deleteExtractMarkdown(root, url.searchParams.get('name') || '');
    send(res, r.ok ? 200 : r.error === 'not_found' ? 404 : 400, r);
    return;
  }
  if (req.method === 'POST' && route === '/api/extract/keep') {
    const raw = JSON.parse((await readBody(req)) || '{}');
    const r = keepExtractInContext(root, String(raw.name || ''));
    send(res, r.ok ? 200 : r.error === 'not_found' ? 404 : 400, r);
    return;
  }
  if (req.method === 'POST' && route === '/api/extract') {
    const raw = JSON.parse((await readBody(req, 22_000_000)) || '{}');
    const buf = Buffer.from(String(raw.base64 || ''), 'base64');
    const r = await saveExtractMarkdown(root, String(raw.filename || 'archivo'), buf);
    const body = r.ok ? r : { ok: false, error: r.error, detail: r.detail };
    send(res, r.ok ? 200 : 400, body);
    return;
  }
  send(res, 404, { ok: false, error: 'not_found' });
}

export function readDashboardPointer(root) {
  return readJson(afnPath(root, '_tmp', 'dashboard.json'));
}

function persistDashboardPointer(root, info) {
  const dir = afnPath(root, '_tmp');
  fs.mkdirSync(dir, { recursive: true });
  const url = String(info.url || '');
  fs.writeFileSync(path.join(dir, 'dashboard-url.txt'), `${url}\n`, 'utf8');
  fs.writeFileSync(
    path.join(dir, 'dashboard.json'),
    `${JSON.stringify({ url, port: info.port, token: info.token, pid: process.pid }, null, 2)}\n`,
    'utf8',
  );
}

function preferredPort(opts = {}) {
  if (opts.port === 0) return 0;
  if (opts.port != null && Number(opts.port) > 0) return Number(opts.port);
  const env = Number(process.env.AFN_DASHBOARD_PORT);
  if (Number.isFinite(env) && env > 0) return env;
  return AFN_DASHBOARD_PORT;
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
  if (opts.port !== 0) {
    const saved = readDashboardPointer(abs);
    const wantPort = preferredPort(opts);
    if (saved?.url && Number(saved.port) === wantPort) {
      const reused = {
        server: null,
        token: saved.token,
        root: abs,
        port: saved.port,
        url: saved.url,
        reused: true,
        ready: null,
      };
      reused.ready = Promise.resolve()
        .then(async () => {
          const ac = new AbortController();
          const t = setTimeout(() => ac.abort(), 600);
          try {
            const r = await fetch(`http://127.0.0.1:${saved.port}/api/who`, { signal: ac.signal });
            const who = await r.json().catch(() => ({}));
            const same = String(who.root || '').toLowerCase() === abs.toLowerCase();
            if (r.ok && who.mode && same) return reused;
          } catch {
            /* arrancar de nuevo */
          } finally {
            clearTimeout(t);
          }
          return startFreshDashboardServer(abs, opts, wantPort);
        });
      return reused.ready;
    }
  }
  return startFreshDashboardServer(abs, opts, preferredPort(opts));
}

function startFreshDashboardServer(abs, opts, want) {
  const prev = live.get(abs);
  if (prev?.ready) return prev.ready;
  const token = crypto.randomBytes(16).toString('hex');
  const state = { root: path.resolve(abs) };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/')) {
        await handleApi(state, token, req, res, url);
        return;
      }
      const data = collectDashboard(state.root);
      const html = buildHtml(data, { api: { token } });
      send(res, 200, html, { type: 'text/html; charset=utf-8' });
    } catch (e) {
      send(res, 500, { ok: false, error: String(e?.message || e).slice(0, 300) });
    }
  });
  const info = { server, token, root: abs, port: 0, url: '', ready: null };
  info.ready = new Promise((resolve, reject) => {
    const finish = () => {
      const addr = server.address();
      info.port = addr.port;
      info.url = `http://127.0.0.1:${addr.port}/?token=${token}`;
      persistDashboardPointer(abs, info);
      resolve(info);
    };
    server.once('listening', finish);
    server.once('error', (err) => {
      if (want && err && err.code === 'EADDRINUSE') {
        server.removeAllListeners('listening');
        server.once('listening', finish);
        server.listen(0, '127.0.0.1');
        return;
      }
      reject(err);
    });
  });
  live.set(abs, info);
  server.listen(want, '127.0.0.1');
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
