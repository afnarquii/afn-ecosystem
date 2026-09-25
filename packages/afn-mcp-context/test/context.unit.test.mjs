import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyIgnorePath, activeProjects, activeRelationships, normalizeProjectsConfig } from '../lib/projects-policy.js';
import { detectProjects, inferProjectType, inferPort } from '../lib/detect-projects.js';
import { bootstrapAfn } from '../lib/bootstrap.js';
import { saveFact, searchFacts, loadFacts } from '../lib/memory.js';
import { buildSnapshot, buildPromptHint, doctorAfn } from '../lib/snapshot.js';
import { handleContextTool } from '../lib/handle-tool.js';
import { CONTEXT_TOOLS } from '../lib/tools-def.js';
import { redactSecrets } from '../lib/redact.js';
import { setupAgent, packHasSqlDriver } from '../lib/setup.js';
import { resolveWorkspaceRoot, resolveProjectRoot } from '../lib/resolve-root.js';
import { isWeakProjectsMap } from '../lib/detect-projects.js';
import { saveObservation, startSession, endSession, getMemContext, loadCerebro } from '../lib/cerebro.js';
import { writeDashboard, mdToHtml } from '../lib/dashboard.js';
import { extractPortFromText, findPortEvidence } from '../lib/port-evidence.js';
import { saveTaskNote, setTaskNoteStatus, listTaskNotes, saveTaskNoteFromFile } from '../lib/task-notes.js';
import { parseLocalIntent, runPromptGate } from '../lib/prompt-gate.js';
import { collectDataSources, commitLiveSchema, inferDbOrigin, inferDbOrigins, saveDataSelection } from '../lib/data-sources.js';
import { assertSafeReadonlySql } from '../lib/sql-safety.js';
import { startDashboardServer, stopDashboardServer } from '../lib/dashboard-server.js';
import { compactDashboard } from '../lib/compact-result.js';
import { saveOriginsPack, normalizeOriginsInput, inspectCredentialsFile, loadSqlFavorites, saveSqlFavorites } from '../lib/dashboard-query.js';
import { findInstalledDriver, loadSqlDriver, resetSqlDriverCache, resolvePackDriver } from '../lib/sql-driver.js';

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'afn-ctx-'));
}

function writePkg(dir, name, extra = {}) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name, ...extra }, null, 2),
  );
}

test('infer type y puerto desde nombre y scripts', () => {
  assert.equal(inferProjectType('frontend', {}), 'frontend');
  assert.equal(inferProjectType('api', {}), 'backend');
  assert.equal(inferProjectType('app', { dependencies: { react: '1' } }), 'frontend');
  assert.equal(inferPort({ scripts: { dev: 'vite --port 4173' } }, 'frontend'), 4173);
});

test('deprecated e ignorePaths no entran al flujo', () => {
  const cfg = normalizeProjectsConfig({
    ignorePaths: ['./legacy'],
    projects: [
      { name: 'web', path: './web', type: 'frontend' },
      { name: 'api', path: './api', type: 'backend', port: 4000 },
      { name: 'old', path: './legacy', type: 'backend', status: 'deprecated' },
    ],
    relationships: [
      { from: 'web', to: 'api', type: 'api-communication', endpoint: 'http://localhost:4000/api' },
      { from: 'web', to: 'old', type: 'api-communication' },
    ],
  });
  const names = activeProjects(cfg).map((p) => p.name).sort();
  assert.deepEqual(names, ['api', 'web']);
  const rels = activeRelationships(cfg);
  assert.equal(rels.length, 1);
  assert.equal(rels[0].to, 'api');
});

test('applyIgnorePath persiste ignore y saca relationships', () => {
  const next = applyIgnorePath(
    {
      projects: [
        { name: 'web', path: './web', type: 'frontend' },
        { name: 'legacy', path: './legacy', type: 'backend' },
      ],
      relationships: [{ from: 'web', to: 'legacy', type: 'api' }],
    },
    './legacy',
  );
  assert.ok(next.ignorePaths.some((p) => p.includes('legacy')));
  assert.equal(activeProjects(next).length, 1);
  assert.equal(activeRelationships(next).length, 0);
});

test('detectProjects arma front→back y omite node_modules/tools', () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', { dependencies: { vite: '5' }, scripts: { dev: 'vite --port 5173' } });
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  writePkg(path.join(root, 'node_modules', 'leftpad'), 'leftpad');
  writePkg(path.join(root, 'tools', 'scaffold'), 'scaffold');
  const d = detectProjects(root);
  const names = d.projects.map((p) => p.name).sort();
  assert.ok(names.includes('web'));
  assert.ok(names.includes('api'));
  assert.equal(names.includes('leftpad'), false);
  assert.equal(names.includes('scaffold'), false);
  assert.equal(d.relationships.length, 0);
});

test('bootstrap escribe una vez y no pisa', () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'frontend', { dependencies: { react: '18' } });
  writePkg(path.join(root, 'api'), 'backend', { dependencies: { express: '4' } });
  const a = bootstrapAfn(root);
  assert.equal(a.wrote, true);
  assert.ok(fs.existsSync(path.join(root, '.afn', 'projects.json')));
  assert.ok(fs.existsSync(path.join(root, '.afn', 'MEMORY.md')));
  const first = fs.readFileSync(path.join(root, '.afn', 'projects.json'), 'utf8');
  const b = bootstrapAfn(root);
  assert.equal(b.skipped, true);
  assert.equal(fs.readFileSync(path.join(root, '.afn', 'projects.json'), 'utf8'), first);
});

test('bootstrap respeta ignorePaths previos en JSON vacío de proyectos', () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', { dependencies: { vite: '5' } });
  writePkg(path.join(root, 'old-admin'), 'old-admin', { dependencies: { express: '4' } });
  fs.mkdirSync(path.join(root, '.afn'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.afn', 'projects.json'),
    JSON.stringify({ ignorePaths: ['./old-admin'], projects: [] }),
  );
  const r = bootstrapAfn(root);
  assert.equal(r.wrote, true);
  const names = r.config.projects.map((p) => p.name);
  assert.equal(names.includes('old-admin'), false);
});

test('mem_save / search / snapshot redacta secretos y recorta', () => {
  const root = tmp();
  bootstrapAfn(root);
  const s = saveFact(root, { what: 'Auth en /api/auth', why: 'unificar login' });
  assert.equal(s.ok, true);
  const hit = searchFacts(root, 'auth');
  assert.ok(hit.length >= 1);
  fs.writeFileSync(
    path.join(root, '.afn', 'context.json'),
    JSON.stringify({ azurePat: 'SUPERSECRET', theme: 'dark' }),
  );
  const snap = buildSnapshot(root);
  assert.equal(snap.ok, true);
  assert.ok(snap.markdown.includes('AFN CONTEXT'));
  assert.equal(snap.markdown.includes('SUPERSECRET'), false);
  assert.ok(snap.markdown.includes('[redacted]'));
  assert.ok(snap.markdown.length <= 3200);
  const red = redactSecrets({ password: 'x', nested: { token: 'y' } });
  assert.equal(red.password, '[redacted]');
});

test('handleContextTool ignore + doctor', async () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', { dependencies: { react: '18' } });
  writePkg(path.join(root, 'legacy'), 'legacy', { dependencies: { express: '4' } });
  await handleContextTool(root, 'afn_bootstrap', {});
  await handleContextTool(root, 'afn_project_ignore', { path: './legacy' });
  const flow = await handleContextTool(root, 'afn_projects_flow', {});
  assert.ok(flow.ignorePaths.some((p) => p.includes('legacy')));
  assert.equal(flow.projects.some((p) => p.path.includes('legacy')), false);
  const d = doctorAfn(root);
  assert.equal(d.ok, true);
});

test('setup kiro escribe mcp + steering + hooks sin tocar Engram', () => {
  const home = tmp();
  const project = tmp();
  fs.mkdirSync(path.join(home, '.kiro', 'settings'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.kiro', 'settings', 'mcp.json'),
    JSON.stringify({ mcpServers: { engram: { command: 'engram', args: ['mcp'] }, 'afn-context': { command: 'old' } } }),
  );
  const r = setupAgent('kiro', { home, projectRoot: project });
  assert.equal(r.ok, true);
  const userMcp = JSON.parse(fs.readFileSync(path.join(home, '.kiro', 'settings', 'mcp.json'), 'utf8'));
  assert.ok(userMcp.mcpServers.engram);
  assert.equal(userMcp.mcpServers['afn-context'], undefined);
  const mcpFile = path.join(project, '.kiro', 'settings', 'mcp.json');
  assert.equal(r.mcpFile, mcpFile);
  const mcp = JSON.parse(fs.readFileSync(mcpFile, 'utf8'));
  assert.ok(mcp.mcpServers['afn-context']);
  assert.ok(mcp.mcpServers['afn-context'].args?.length);
  assert.equal(mcp.mcpServers['afn-context'].env?.AFN_PROJECT_ROOT, project);
  assert.ok(fs.existsSync(path.join(project, '.kiro', 'steering', 'afn-context.md')));
  assert.equal(fs.existsSync(path.join(project, '.kiro', 'hooks', 'afn-session-start.json')), false);
  assert.equal(fs.existsSync(path.join(project, '.kiro', 'hooks', 'afn-session-work.json')), false);
  const promptHook = JSON.parse(fs.readFileSync(path.join(project, '.kiro', 'hooks', 'afn-prompt-submit.json'), 'utf8'));
  assert.match(JSON.stringify(promptHook), /prompt-gate/);
  assert.equal(JSON.stringify(promptHook).includes('snapshot --hint'), false);
  assert.equal(fs.existsSync(path.join(project, '.kiro', 'hooks', 'afn-agent-stop.json')), false);
  assert.ok(fs.existsSync(path.join(project, '.afn', '_tmp', 'afn-dashboard.cmd')));
  assert.ok(fs.existsSync(path.join(project, '.kiro', 'hooks', 'afn-session-architecture.json')));
  const archHook = JSON.parse(fs.readFileSync(path.join(project, '.kiro', 'hooks', 'afn-session-architecture.json'), 'utf8'));
  assert.equal(archHook.hooks[0].action.type, 'command');
  assert.match(archHook.hooks[0].action.command, /architecture-status/);
  assert.equal(archHook.hooks[0].action.type === 'agent', false);
  assert.equal(fs.existsSync(path.join(project, '.afn', 'projects.json')), false);
  const mcpAfter = JSON.parse(fs.readFileSync(mcpFile, 'utf8'));
  assert.equal(mcpAfter.mcpServers['afn-mcp-data-agent'], undefined);
  assert.ok(mcpAfter.mcpServers['afn-context']);
  assert.equal(JSON.stringify(mcpAfter).toLowerCase().includes('password'), false);
});

test('setup kiro deja un AFN_PROJECT_ROOT distinto por workspace', () => {
  const home = tmp();
  const a = tmp();
  const b = tmp();
  writePkg(path.join(a, 'web'), 'web', { dependencies: { react: '18' } });
  writePkg(path.join(a, 'api'), 'api', { dependencies: { express: '4' } });
  writePkg(path.join(b, 'app'), 'app', { dependencies: { vue: '3' } });
  writePkg(path.join(b, 'svc'), 'svc', { dependencies: { express: '4' } });
  setupAgent('kiro', { home, projectRoot: a });
  setupAgent('kiro', { home, projectRoot: b });
  const mcpA = JSON.parse(fs.readFileSync(path.join(a, '.kiro', 'settings', 'mcp.json'), 'utf8'));
  const mcpB = JSON.parse(fs.readFileSync(path.join(b, '.kiro', 'settings', 'mcp.json'), 'utf8'));
  assert.equal(mcpA.mcpServers['afn-context'].env.AFN_PROJECT_ROOT, a);
  assert.equal(mcpB.mcpServers['afn-context'].env.AFN_PROJECT_ROOT, b);
  assert.notEqual(mcpA.mcpServers['afn-context'].env.AFN_PROJECT_ROOT, mcpB.mcpServers['afn-context'].env.AFN_PROJECT_ROOT);
  const userFile = path.join(home, '.kiro', 'settings', 'mcp.json');
  if (fs.existsSync(userFile)) {
    const userMcp = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    assert.equal(userMcp.mcpServers?.['afn-context'], undefined);
  }
});

test('detectProjects ve hermanos, packages/ y repos solo-git', () => {
  const root = tmp();
  writePkg(path.join(root, 'frontend'), 'frontend', { dependencies: { react: '18' } });
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  fs.mkdirSync(path.join(root, 'legacy-svc', '.git'), { recursive: true });
  writePkg(path.join(root, 'packages', 'payments'), 'payments', { dependencies: { express: '4' } });
  const d = detectProjects(root);
  const names = d.projects.map((p) => p.name).sort();
  assert.ok(names.includes('frontend'));
  assert.ok(names.includes('api'));
  assert.ok(names.includes('legacy-svc'));
  assert.ok(names.includes('payments'));
  assert.equal(d.relationships.some((r) => r.from === 'frontend' && r.to === 'api'), false);
});

test('bootstrap desde el paquete MCP sube al workspace multi-repo (no escribe mcp-context)', () => {
  const ws = tmp();
  writePkg(path.join(ws, 'frontend'), 'frontend', { dependencies: { vite: '5' } });
  writePkg(path.join(ws, 'api'), 'api', { dependencies: { express: '4' } });
  const mcpDir = path.join(ws, 'afn-ecosystem', 'packages', 'afn-mcp-context');
  fs.mkdirSync(path.join(ws, 'afn-ecosystem', 'packs'), { recursive: true });
  fs.mkdirSync(path.join(ws, 'afn-ecosystem', 'skills'), { recursive: true });
  fs.mkdirSync(path.join(ws, 'afn-ecosystem', 'mcps'), { recursive: true });
  writePkg(mcpDir, '@afn-ecosystem/mcp-context');
  const resolved = resolveWorkspaceRoot(mcpDir);
  assert.equal(path.resolve(resolved), path.resolve(ws));
  const r = bootstrapAfn(mcpDir);
  assert.equal(r.ok, true);
  assert.equal(r.wrote, true);
  assert.equal(path.resolve(r.root), path.resolve(ws));
  const names = r.config.projects.map((p) => p.name);
  assert.ok(names.includes('frontend'));
  assert.ok(names.includes('api'));
  assert.equal(names.includes('mcp-context'), false);
  assert.equal(isWeakProjectsMap(r.config), false);
  assert.ok(fs.existsSync(path.join(ws, '.afn', 'projects.json')));
  assert.equal(fs.existsSync(path.join(mcpDir, '.afn', 'projects.json')), false);
});

test('bootstrap reescribe mapa pobre mcp-context', () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', { dependencies: { react: '18' } });
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  fs.mkdirSync(path.join(root, '.afn'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.afn', 'projects.json'),
    JSON.stringify({ projects: [{ name: 'mcp-context', path: '.', type: 'unknown' }] }),
  );
  const r = bootstrapAfn(root);
  assert.equal(r.wrote, true);
  assert.equal(r.reason, 'mapa-pobre-reescrito');
  const names = r.config.projects.map((p) => p.name).sort();
  assert.ok(names.includes('web'));
  assert.ok(names.includes('api'));
});

test('bootstrap en el catálogo aislado no finge un producto mcp-context', () => {
  const catalog = tmp();
  fs.mkdirSync(path.join(catalog, 'packs'), { recursive: true });
  fs.mkdirSync(path.join(catalog, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(catalog, 'mcps'), { recursive: true });
  const mcpDir = path.join(catalog, 'packages', 'afn-mcp-context');
  writePkg(mcpDir, '@afn-ecosystem/mcp-context');
  const r = bootstrapAfn(mcpDir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'raiz-catalogo');
  assert.equal(r.wrote, false);
});

test('resolveProjectRoot ignora ${workspaceFolder} sin expandir', () => {
  const cwd = tmp();
  writePkg(path.join(cwd, 'web'), 'web', { dependencies: { react: '18' } });
  writePkg(path.join(cwd, 'api'), 'api', { dependencies: { express: '4' } });
  const r = resolveProjectRoot('', { cwd, envRoot: '${workspaceFolder}' });
  assert.equal(path.resolve(r), path.resolve(cwd));
});

test('cerebro guarda sesiones y observaciones; context las lista', () => {
  const root = tmp();
  bootstrapAfn(root);
  const s = startSession(root, { goal: 'auth unificado' });
  assert.equal(s.ok, true);
  const o = saveObservation(root, {
    type: 'decision',
    title: 'JWT',
    what: 'JWT en /api/auth',
    why: 'escalar instancias',
  });
  assert.equal(o.ok, true);
  const ctx = getMemContext(root);
  assert.equal(ctx.counts.observations >= 1, true);
  assert.equal(ctx.activeSessionId, s.session.id);
  const end = endSession(root, { done: 'middleware listo', next: 'refresh tokens' });
  assert.equal(end.ok, true);
  const snap = buildSnapshot(root);
  assert.match(snap.markdown, /JWT|auth|cerebro/i);
});

test('dashboard HTML lista proyectos y no abre el browser en test', () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', { dependencies: { react: '18' } });
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  bootstrapAfn(root);
  saveObservation(root, { type: 'architecture', title: 'web→api', what: 'front llama /api' });
  const d = writeDashboard(root, { open: false });
  assert.equal(d.ok, true);
  assert.equal(d.opened, false);
  const html = fs.readFileSync(d.file, 'utf8');
  assert.match(html, /web/);
  assert.match(html, /flowchart/);
  assert.match(html, /web→api|front llama/);
  assert.match(html, /data-open=/);
  assert.match(html, /data-view="inicio"/);
  assert.match(html, /Reglas/);
  assert.match(html, /id="overlay"/);
  assert.match(html, /Capas y E2E|Cómo se trabaja/);
  assert.match(html, /prefix|presentaci|express|react/i);
  assert.match(html, /id="q"/);
  assert.match(html, /data-q=/);
  assert.match(html, /applySearch|coincidencias/);
  assert.match(html, /data-view="readme"|Arquitectura \(README\)/);
  assert.match(html, /ARQUITECTURA\.md/);
  assert.match(html, /id="readme-article"/);
  assert.match(html, /data-expand/);
  assert.match(html, /data-dl/);
  assert.match(html, /data-zoom/);
  assert.match(html, /id="ov-stage"/);
  assert.match(html, /data-canvas=/);
  assert.match(html, /\|\| "readme"/);
  assert.match(d.url, /#readme/);
});

test('mdToHtml convierte README en tablas y títulos', () => {
  const h = mdToHtml('# Arquitectura\n\n## Contenedores\n\n| Nombre | Rol |\n| --- | --- |\n| web | UI |\n');
  assert.match(h, /<h1>/);
  assert.match(h, /<h2>/);
  assert.match(h, /doc-table/);
  assert.match(h, /web/);
});

test('dashboard embebe ARQUITECTURA.md de la raíz y abre en README', () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', { dependencies: { react: '18' } });
  bootstrapAfn(root);
  fs.writeFileSync(
    path.join(root, 'ARQUITECTURA.md'),
    '# Arquitectura visible\n\n## Contenedores\n\n| Nombre | Rol |\n| --- | --- |\n| web | presentación |\n',
  );
  const d = writeDashboard(root, { open: false });
  const html = fs.readFileSync(d.file, 'utf8');
  assert.match(html, /Arquitectura visible/);
  assert.match(html, /presentación/);
  assert.match(html, /id="readme-article"/);
  assert.match(html, /doc-table/);
  assert.equal(d.readme, true);
});

test('regenerar arquitectura usa el .afn del workspace, no el padre ni uno anidado', async () => {
  const parent = tmp();
  writePkg(path.join(parent, 'otro-a'), 'otro-a', { dependencies: { express: '4' } });
  writePkg(path.join(parent, 'otro-b'), 'otro-b', { dependencies: { express: '4' } });
  fs.mkdirSync(path.join(parent, '.afn'), { recursive: true });
  fs.writeFileSync(
    path.join(parent, '.afn', 'projects.json'),
    JSON.stringify({ projects: [{ name: 'ajeno', path: '.', type: 'unknown' }] }),
  );

  const ws = path.join(parent, 'producto');
  writePkg(path.join(ws, 'web'), 'web', { dependencies: { react: '18' } });
  writePkg(path.join(ws, 'api'), 'api', { dependencies: { express: '4' } });
  const boot = bootstrapAfn(ws, { ceiling: ws });
  assert.equal(path.resolve(boot.root), path.resolve(ws));

  const nested = path.join(ws, 'web');
  fs.mkdirSync(path.join(nested, '.afn'), { recursive: true });
  fs.writeFileSync(
    path.join(nested, '.afn', 'projects.json'),
    JSON.stringify({ projects: [{ name: 'solo-front', path: '.', type: 'frontend' }] }),
  );

  assert.equal(path.resolve(resolveWorkspaceRoot(ws)), path.resolve(ws));
  assert.equal(path.resolve(resolveWorkspaceRoot(nested)), path.resolve(ws));
  assert.equal(
    path.resolve(resolveProjectRoot(nested, { cwd: nested, envRoot: ws })),
    path.resolve(ws),
  );

  const gen = await handleContextTool(ws, 'afn_diagram_generate', { recreate: true });
  assert.equal(gen.ok, true);
  assert.equal(path.resolve(gen.root), path.resolve(ws));
  assert.equal(fs.existsSync(path.join(ws, '.afn', 'diagrams', 'workspace-flow.json')), true);
  assert.equal(fs.existsSync(path.join(parent, '.afn', 'diagrams', 'workspace-flow.json')), false);
  assert.equal(fs.existsSync(path.join(nested, '.afn', 'diagrams', 'workspace-flow.json')), false);
  const flow = JSON.parse(fs.readFileSync(path.join(ws, '.afn', 'diagrams', 'workspace-flow.json'), 'utf8'));
  const names = (flow.projects || []).map((p) => p.name);
  assert.ok(names.includes('web'));
  assert.ok(names.includes('api'));
  assert.equal(names.includes('ajeno'), false);
  assert.equal(names.includes('solo-front'), false);
});


test('si la arquitectura existe, bootstrap no regenera; el comando --refresh sí', () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', { dependencies: { react: '18' } });
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  const a = bootstrapAfn(root);
  assert.equal(a.diagram?.ok, true);
  const dir = path.join(root, '.afn', 'diagrams');
  const sample = fs.readdirSync(dir).find((n) => n.startsWith('workspace-flujo') && n.endsWith('.json'));
  const first = fs.readFileSync(path.join(dir, sample), 'utf8');
  const b = bootstrapAfn(root);
  assert.equal(b.skipped, true);
  assert.equal(b.diagram?.skipped, true);
  assert.equal(fs.readFileSync(path.join(dir, sample), 'utf8'), first);
  const c = bootstrapAfn(root, { refresh: true });
  assert.equal(c.diagram?.skipped, false);
});

test('afn_diagram_generate sin recreate no pisa; con recreate sí', async () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', { dependencies: { react: '18' } });
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  await handleContextTool(root, 'afn_bootstrap', {});
  const visible = path.join(root, 'ARQUITECTURA.md');
  assert.equal(fs.existsSync(visible), true);
  fs.unlinkSync(visible);
  const skip = await handleContextTool(root, 'afn_diagram_generate', {});
  assert.equal(skip.skipped, true);
  assert.equal(skip.flow, undefined);
  assert.equal(skip.config, undefined);
  assert.equal(skip.evidence, undefined);
  assert.equal(fs.existsSync(visible), true);
  assert.match(fs.readFileSync(visible, 'utf8'), /Arquitectura|Contenedores/);
  const gen = await handleContextTool(root, 'afn_diagram_generate', { recreate: true });
  assert.equal(gen.ok, true);
  assert.equal(gen.skipped, false);
  assert.equal(gen.flow, undefined);
  assert.equal(gen.config, undefined);
  assert.ok(!JSON.stringify(gen).includes('"ir"'));
});

test('regenerar arquitectura no borra observaciones del cerebro', async () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', { dependencies: { react: '18' } });
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  bootstrapAfn(root);
  startSession(root, { goal: 'auth' });
  const o1 = saveObservation(root, { type: 'decision', title: 'JWT', what: 'JWT en /api/auth', why: 'escalar' });
  saveObservation(root, { type: 'architecture', title: 'proxy', what: 'web llama /api', where: 'vite' });
  assert.equal(o1.ok, true);
  const before = loadCerebro(root);
  const memBefore = fs.readFileSync(path.join(root, '.afn', 'MEMORY.md'), 'utf8');
  const gen = await handleContextTool(root, 'afn_diagram_generate', { recreate: true });
  assert.equal(gen.ok, true);
  assert.equal(gen.skipped, false);
  const refresh = bootstrapAfn(root, { refresh: true });
  assert.equal(refresh.diagram?.skipped, false);
  const after = loadCerebro(root);
  assert.equal(after.observations.length, before.observations.length);
  assert.deepEqual(
    after.observations.map((o) => o.id),
    before.observations.map((o) => o.id),
  );
  assert.ok(after.observations.some((o) => o.title === 'JWT'));
  assert.ok(after.sessions.some((s) => s.goal === 'auth'));
  const memAfter = fs.readFileSync(path.join(root, '.afn', 'MEMORY.md'), 'utf8');
  assert.equal(memAfter, memBefore);
  assert.match(memAfter, /JWT/);
});

test('detectProjects no inventa flechas ni puerto 4000 sin evidencia', () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', { dependencies: { react: '18' } });
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  const d = detectProjects(root);
  assert.equal(d.relationships.length, 0);
  const api = d.projects.find((p) => p.name === 'api');
  assert.equal(api.port, undefined);
  assert.equal(api.prefix || '', '');
});

test('afn_architecture_commit rechaza nodos inventados y acepta evidencia', async () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', { dependencies: { vite: '5', react: '18' }, scripts: { dev: 'vite --port 5173' } });
  fs.writeFileSync(
    path.join(root, 'web', 'vite.config.js'),
    "export default { server: { proxy: { '/api': 'http://localhost:4000' } } }\n",
  );
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' }, scripts: { dev: 'node --port 4000' } });
  await handleContextTool(root, 'afn_bootstrap', {});
  const ev = await handleContextTool(root, 'afn_architecture_evidence', {});
  assert.equal(ev.ok, true);
  assert.ok(ev.filesToRead.some((f) => /vite\.config/.test(f.path)));
  const bad = await handleContextTool(root, 'afn_architecture_commit', {
    projects: [{ name: 'inventado', path: './no-existe' }],
    relationships: [{ from: 'web', to: 'fantasma', type: 'api' }],
  });
  assert.equal(bad.ok, true);
  assert.ok(bad.rejected.some((r) => r.reason === 'path-no-existe' || r.reason === 'nodo-inventado'));
  assert.equal((bad.projects || []).some((p) => p.name === 'inventado'), false);
  const ok = await handleContextTool(root, 'afn_architecture_commit', {
    relationships: [{ from: 'web', to: 'api', via: 'proxy', endpoint: '/api → http://localhost:4000' }],
  });
  assert.equal(ok.llmReviewed, true);
  assert.ok(ok.relationships.some((r) => r.from === 'web' && r.to === 'api'));
  assert.equal(ok.diagram, undefined);
  const flow = JSON.parse(fs.readFileSync(path.join(root, '.afn', 'diagrams', 'workspace-flow.json'), 'utf8'));
  assert.equal(flow.llmReviewed, true);
});

test('agent assets asocia steering Kiro y Copilot al proyecto', async () => {
  const root = tmp();
  const home = tmp();
  writePkg(path.join(root, 'web'), 'web', { dependencies: { react: '18' } });
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  bootstrapAfn(root);
  fs.mkdirSync(path.join(root, '.kiro', 'steering'), { recursive: true });
  fs.writeFileSync(path.join(root, '.kiro', 'steering', 'web-auth.md'), '# web auth\nJWT en el front\n');
  fs.mkdirSync(path.join(root, '.github', 'skills', 'api-review'), { recursive: true });
  fs.writeFileSync(path.join(root, '.github', 'skills', 'api-review', 'SKILL.md'), '# api review\nrevisá contratos\n');
  fs.writeFileSync(path.join(root, '.github', 'copilot-instructions.md'), '# Copilot\nusá el api\n');
  fs.mkdirSync(path.join(home, '.kiro', 'steering'), { recursive: true });
  fs.writeFileSync(path.join(home, '.kiro', 'steering', 'global.md'), '# kiro global\nsteering user\n');
  const { persistAgentAssets } = await import('../lib/agent-assets.js');
  const scanned = persistAgentAssets(root, { home });
  assert.ok(scanned.assets.some((a) => a.kind === 'kiro-steering' && a.project === 'web'));
  assert.ok(scanned.assets.some((a) => a.kind === 'copilot-skill' && a.project === 'api'));
  assert.ok(scanned.assets.some((a) => a.kind === 'copilot-instructions'));
  assert.ok(scanned.assets.some((a) => a.kind === 'kiro-steering' && String(a.rel).includes('.kiro')));
  const gen = await handleContextTool(root, 'afn_diagram_generate', { recreate: true });
  assert.equal(gen.ok, true);
  assert.equal(gen.skipped, false);
});

test('mapa cross-project infiere proxy, prefix, db y capas', () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', {
    dependencies: { vite: '5', react: '18' },
    scripts: { dev: 'vite --port 5173', test: 'vitest' },
  });
  fs.writeFileSync(
    path.join(root, 'web', 'vite.config.js'),
    "export default { server: { proxy: { '/api': 'http://localhost:4000' } } }\n",
  );
  writePkg(path.join(root, 'api'), 'api', {
    dependencies: { express: '4', pg: '8' },
    scripts: { dev: 'node server.js --port 4000', test: 'node --test' },
  });
  fs.mkdirSync(path.join(root, 'api', 'prisma'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'api', 'prisma', 'schema.prisma'),
    'datasource db { provider = "postgresql" url = env("DATABASE_URL") }\n',
  );
  fs.writeFileSync(
    path.join(root, 'docker-compose.yml'),
    'services:\n  postgres:\n    image: postgres:16\n    ports:\n      - "5432:5432"\n',
  );
  const d = detectProjects(root);
  const web = d.projects.find((p) => p.name === 'web');
  const api = d.projects.find((p) => p.name === 'api');
  assert.ok(web.framework === 'react' || web.framework === 'vite');
  assert.equal(api.framework, 'express');
  assert.equal(api.db, 'postgresql');
  assert.ok(d.relationships.some((r) => r.via === 'proxy' && /\/api/.test(r.endpoint)));
  const boot = bootstrapAfn(root);
  assert.equal(boot.ok, true);
  const flow = JSON.parse(fs.readFileSync(path.join(root, '.afn', 'diagrams', 'workspace-flow.json'), 'utf8'));
  assert.equal(flow.mode, 'cross');
  assert.ok(flow.layers.presentation.includes('web'));
  assert.ok(flow.layers.api.includes('api'));
  assert.ok(flow.layers.data.length >= 1);
  assert.ok(flow.how.local.some((x) => /web|api/.test(x)));
  assert.ok(flow.how.test.some((x) => /vitest|test/.test(x)));
  const html = fs.readFileSync(writeDashboard(root, { open: false }).file, 'utf8');
  assert.match(html, /subgraph|Presentaci|postgresql|proxy/i);
  const capas = fs.readFileSync(path.join(root, '.afn', 'diagrams', 'workspace-capas.architecture.json'), 'utf8');
  assert.match(capas, /Presentaci|datos|proxy/i);
});

test('puertos solo con evidencia: python, serverless, docker, env', () => {
  assert.equal(extractPortFromText('uvicorn app.main:app --host 0.0.0.0 --port 8080').port, 8080);
  assert.equal(extractPortFromText('EXPOSE 9000\nCMD uvicorn x').port, 9000);
  assert.equal(extractPortFromText('custom:\n  serverless-offline:\n    httpPort: 3002').port, 3002);
  assert.equal(extractPortFromText('PORT=7777\nSECRET=abc').port, 7777);
  assert.equal(extractPortFromText('hola sin puerto'), null);

  const py = tmp();
  fs.writeFileSync(path.join(py, 'requirements.txt'), 'fastapi==0.115.0\nuvicorn==0.30.0\n');
  fs.writeFileSync(path.join(py, 'Makefile'), 'run:\n\tuvicorn app.main:app --host 0.0.0.0 --port 8080\n');
  const pyEv = findPortEvidence(py);
  assert.equal(pyEv.port, 8080);
  assert.match(pyEv.portSource, /makefile/i);

  const sls = tmp();
  fs.writeFileSync(
    path.join(sls, 'serverless.yml'),
    'service: demo\nprovider:\n  name: aws\n  runtime: python3.11\ncustom:\n  serverless-offline:\n    httpPort: 3002\n',
  );
  assert.equal(findPortEvidence(sls).port, 3002);

  const dock = tmp();
  fs.writeFileSync(path.join(dock, 'Dockerfile'), 'FROM python:3.11\nEXPOSE 8001\nCMD ["uvicorn","app:app","--port","8001"]\n');
  assert.equal(findPortEvidence(dock).port, 8001);

  const envDir = tmp();
  fs.writeFileSync(path.join(envDir, '.env.example'), 'PORT=9100\nAPI_KEY=changeme\n');
  assert.equal(findPortEvidence(envDir).port, 9100);

  const local = tmp();
  fs.writeFileSync(path.join(local, '.env.local'), 'UVICORN_PORT=9200\nTOKEN=secret\n');
  assert.equal(findPortEvidence(local).port, 9200);

  const compose = tmp();
  fs.writeFileSync(
    path.join(compose, 'docker-compose.yml'),
    'services:\n  api:\n    image: api\n    ports:\n      - "8088:80"\n',
  );
  assert.equal(findPortEvidence(compose).port, 8088);
});

test('detectProjects python fastapi + no inventa puerto', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'api'), { recursive: true });
  fs.writeFileSync(path.join(root, 'api', 'requirements.txt'), 'fastapi\nuvicorn\n');
  fs.writeFileSync(path.join(root, 'api', 'Makefile'), 'serve:\n\tuvicorn app.main:app --port 8080\n');
  writePkg(path.join(root, 'web'), 'web', { dependencies: { react: '18' } });
  const d = detectProjects(root);
  const api = d.projects.find((p) => p.name === 'api');
  assert.ok(api);
  assert.equal(api.framework, 'fastapi');
  assert.equal(api.port, 8080);
  assert.match(String(api.portSource), /makefile/i);
  const web = d.projects.find((p) => p.name === 'web');
  assert.equal(web.port, undefined);
});

test('afn_architecture_commit rechaza puerto inventado', async () => {
  const root = tmp();
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  await handleContextTool(root, 'afn_bootstrap', {});
  const bad = await handleContextTool(root, 'afn_architecture_commit', {
    projects: [{ name: 'api', path: './api', port: 9999 }],
  });
  assert.equal(bad.ok, true);
  assert.ok(bad.rejected.some((r) => r.reason === 'puerto-sin-evidencia' || r.reason === 'puerto-no-coincide-disco'));
  const api = (bad.projects || []).find((p) => p.name === 'api');
  assert.notEqual(Number(api?.port), 9999);

  fs.writeFileSync(path.join(root, 'api', '.env.example'), 'PORT=4000\n');
  const ok = await handleContextTool(root, 'afn_architecture_commit', {
    projects: [{ name: 'api', path: './api', port: 4000 }],
  });
  const api2 = (ok.projects || []).find((p) => p.name === 'api');
  assert.equal(Number(api2.port), 4000);
  assert.match(String(api2.portSource), /env/i);
});

test('snapshot prioriza README de nombres, rutas y cerebro', () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', { dependencies: { vite: '5' }, scripts: { dev: 'vite --port 5173' } });
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' }, scripts: { dev: 'node --port 4000' } });
  bootstrapAfn(root);
  const snap = buildSnapshot(root);
  assert.match(snap.markdown, /Arquitectura|Contenedores|Comunicación|Flujo E2E/);
  assert.match(snap.markdown, /arquitectura\.md|:5173|:4000|sin evidencia/);
  assert.equal(snap.markdown.includes('afn_architecture_evidence'), false);
  assert.ok(snap.markdown.length <= 3200);
});

test('README de arquitectura lista rutas reales, no mermaid como fuente', () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', {
    dependencies: { vite: '5', react: '18' },
    scripts: { dev: 'vite --port 5173' },
  });
  fs.writeFileSync(
    path.join(root, 'web', 'vite.config.js'),
    "export default { server: { proxy: { '/api': 'http://localhost:4000' } } }\n",
  );
  writePkg(path.join(root, 'api'), 'api', {
    name: '@acme/payments-api',
    dependencies: { express: '4' },
    scripts: { dev: 'node server.js --port 4000' },
  });
  fs.writeFileSync(
    path.join(root, 'api', 'server.js'),
    "app.get('/health', ok);\napp.post('/auth/login', login);\n",
  );
  const py = path.join(root, 'worker');
  fs.mkdirSync(py, { recursive: true });
  fs.writeFileSync(path.join(py, 'requirements.txt'), 'fastapi\nuvicorn\n');
  fs.writeFileSync(
    path.join(py, 'app.py'),
    'from fastapi import FastAPI\napp = FastAPI()\n@app.get("/jobs")\ndef jobs(): return []\n',
  );
  fs.writeFileSync(path.join(py, 'Makefile'), 'run:\n\tuvicorn app:app --port 8080\n');
  const boot = bootstrapAfn(root);
  assert.equal(boot.ok, true);
  assert.equal(fs.existsSync(path.join(root, 'ARQUITECTURA.md')), true);
  const md = fs.readFileSync(path.join(root, 'ARQUITECTURA.md'), 'utf8');
  assert.match(md, /## 2\. Contenedores|## Contenedores/);
  assert.match(md, /## 3\. Comunicación|Quién llama/);
  assert.match(md, /## 5\. Rutas/);
  assert.match(md, /## 4\. Flujo E2E/);
  assert.match(md, /\/health|\/auth\/login/);
  assert.match(md, /\/jobs/);
  assert.match(md, /\/api/);
  assert.match(md, /payments-api|worker/);
  assert.equal(md.includes('```mermaid'), false);
  const html = fs.readFileSync(writeDashboard(root, { open: false }).file, 'utf8');
  assert.match(html, /\/health|Arquitectura/);
});

test('README E2E incluye esquema prisma/SQL y openapi si existen en disco', () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', { dependencies: { react: '18', vite: '5' } });
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4', pg: '8' } });
  fs.mkdirSync(path.join(root, 'api', 'prisma'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'api', 'prisma', 'schema.prisma'),
    'model User { id String @id email String posts Post[] }\nmodel Post { id String title String user User @relation(fields: [userId], references: [id]) userId String }\n',
  );
  fs.writeFileSync(
    path.join(root, 'api', 'openapi.yaml'),
    'openapi: 3.0.0\npaths:\n  /users:\n    get: {}\ncomponents:\n  schemas:\n    User:\n      type: object\n',
  );
  fs.writeFileSync(
    path.join(root, 'api', 'init.sql'),
    'CREATE TABLE orders (id int);\n',
  );
  bootstrapAfn(root);
  const md = fs.readFileSync(path.join(root, '.afn', 'diagrams', 'arquitectura.md'), 'utf8');
  assert.match(md, /## 6\. Datos y esquemas/);
  assert.match(md, /User/);
  assert.match(md, /Post|orders/);
  assert.match(md, /schema\.prisma|init\.sql|openapi/i);
  assert.match(md, /## 4\. Flujo E2E/);
});

test('wiki de tareas: varios md, status y dashboard; no pisa ARQUITECTURA.md', () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', { dependencies: { react: '18' } });
  bootstrapAfn(root);
  const a = saveTaskNote(root, {
    task: 'Login OAuth',
    title: 'Login OAuth',
    filename: 'readme.md',
    markdown: '# Login OAuth\n\nFlujo UI → API /auth.\n',
  });
  assert.equal(a.ok, true);
  assert.match(a.rel, /\.afn\/notes\/tareas\/login-oauth\/readme\.md/);
  const b = saveTaskNote(root, {
    task: 'Login OAuth',
    filename: 'e2e.md',
    markdown: '# E2E login\n\n1. Abrir /login\n',
  });
  assert.equal(b.ok, true);
  const listed = listTaskNotes(root);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].docs.length, 2);
  const st = setTaskNoteStatus(root, 'login-oauth', 'aprobado');
  assert.equal(st.status, 'aprobado');
  const bad = saveTaskNote(root, { task: 'x', filename: '../secret.md', markdown: '# no' });
  assert.equal(bad.ok, false);
  const html = fs.readFileSync(writeDashboard(root, { open: false }).file, 'utf8');
  assert.match(html, /data-view="notas"/);
  assert.match(html, /Login OAuth/);
  assert.match(html, /data-note-task=/);
  assert.match(html, /data-note-back/);
  const arch = fs.readFileSync(path.join(root, 'ARQUITECTURA.md'), 'utf8');
  assert.equal(arch.includes('Login OAuth'), false);
});

test('orígenes de datos: contexto sin secretos, PAs en código y schema_commit', () => {
  const root = tmp();
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  fs.mkdirSync(path.join(root, 'api'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'api', 'repo.js'),
    "await pool.request().query('EXEC dbo.usp_GetOrder @id');\n",
  );
  fs.mkdirSync(path.join(root, '.afn'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.afn', 'db-connection.json'),
    JSON.stringify({
      connectionName: 'QA pedidos',
      dbEngine: 'sqlserver',
      database: 'Pedidos',
      password: 'SUPERSECRET',
      savedProfileId: 'prof_1',
    }),
  );
  fs.mkdirSync(path.join(root, '.kiro', 'settings'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.kiro', 'settings', 'mcp.json'),
    JSON.stringify({ mcpServers: { 'afn-mcp-data-agent': { command: 'npx' } } }),
  );
  const src = collectDataSources(root);
  assert.equal(src.ok, true);
  assert.equal(src.preferred.name, 'QA pedidos');
  assert.equal(src.preferred.engine, 'sqlserver');
  assert.equal(JSON.stringify(src).includes('SUPERSECRET'), false);
  assert.ok(src.codeMentions.procedures.some((p) => /usp_GetOrder/.test(p)));
  assert.equal(src.useMcp, 'afn-context');
  assert.match(src.how, /afn_sql/);
  assert.match(src.how, /No pidas/);
  assert.match(src.how, /32000/);
  bootstrapAfn(root);
  const c = commitLiveSchema(root, {
    source: 'afn-mcp-data-agent',
    engine: 'sqlserver',
    connectionName: 'QA pedidos',
    tables: [{ name: 'Orders', columns: [{ name: 'id', type: 'int' }], sample: { id: 1, token: 'abc' } }],
    procedures: [{ name: 'usp_GetOrder', params: ['@id'], returns: 'result set', sample: { id: 1 } }],
    calls: [{ from: 'api', procedure: 'usp_GetOrder', via: 'EXEC' }],
  });
  assert.equal(c.ok, true);
  const datos = fs.readFileSync(path.join(root, '.afn', 'diagrams', 'datos.md'), 'utf8');
  assert.match(datos, /usp_GetOrder/);
  assert.match(datos, /Orders/);
  const md = fs.readFileSync(path.join(root, 'ARQUITECTURA.md'), 'utf8');
  assert.match(md, /## 6b\. Origen de datos/);
  assert.match(md, /usp_GetOrder/);
  const html = fs.readFileSync(writeDashboard(root, { open: false }).file, 'utf8');
  assert.match(html, /data-view="datos"/);
  assert.match(html, /usp_GetOrder/);
});

test('afn-init escribe ficha de origen desde compose y no pisa ni guarda password', () => {
  const root = tmp();
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  fs.writeFileSync(
    path.join(root, 'docker-compose.yml'),
    'services:\n  db:\n    image: postgres:15\n    ports:\n      - "5432:5432"\n',
  );
  const inferred = inferDbOrigin(root);
  assert.equal(inferred.dbEngine, 'postgresql');
  assert.equal(inferred.evidence, 'docker-compose');
  const a = bootstrapAfn(root);
  const file = path.join(root, '.afn', 'db-connection.json');
  assert.equal(fs.existsSync(file), true);
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(j.dbEngine, 'postgresql');
  assert.equal(j.needsCredentials, true);
  assert.equal(j.host, 'localhost');
  assert.equal(JSON.stringify(j).toLowerCase().includes('password'), false);
  assert.equal(a.origin.skipped, false);
  const pack = JSON.parse(fs.readFileSync(path.join(root, '.afn', 'db-connections.json'), 'utf8'));
  assert.ok(pack.connections.some((c) => c.dbEngine === 'postgresql'));
  j.connectionName = 'no-pisar';
  fs.writeFileSync(file, `${JSON.stringify(j, null, 2)}\n`);
  const b = bootstrapAfn(root);
  const j2 = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(j2.connectionName, 'no-pisar');
  assert.equal(b.origin.skipped, true);
});

test('bootstrap con arquitectura ya hecha igual crea la ficha si falta', () => {
  const root = tmp();
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  bootstrapAfn(root);
  fs.unlinkSync(path.join(root, '.afn', 'db-connection.json'));
  const b = bootstrapAfn(root);
  assert.equal(fs.existsSync(path.join(root, '.afn', 'db-connection.json')), true);
  assert.equal(b.origin.skipped, false);
});

test('setup kiro no registra npx data-agent; credenciales quedan fuera del origen', () => {
  const home = tmp();
  const project = tmp();
  writePkg(path.join(project, 'api'), 'api', { dependencies: { mssql: '10' } });
  fs.writeFileSync(
    path.join(project, 'docker-compose.yml'),
    'services:\n  db:\n    image: mcr.microsoft.com/mssql/server:2022-latest\n    ports:\n      - "1433:1433"\n',
  );
  fs.mkdirSync(path.join(project, '.afn', 'credentials'), { recursive: true });
  fs.writeFileSync(
    path.join(project, '.afn', 'credentials', 'data-agent.json'),
    JSON.stringify({ DB_USER: 'sa', DB_PASSWORD: 'LocalOnly' }),
  );
  const r = setupAgent('kiro', { home, projectRoot: project });
  assert.equal(Array.isArray(r.dataAgent.pruned), true);
  const mcp = JSON.parse(fs.readFileSync(path.join(project, '.kiro', 'settings', 'mcp.json'), 'utf8'));
  assert.equal(mcp.mcpServers['afn-mcp-data-agent'], undefined);
  assert.ok(mcp.mcpServers['afn-context']);
  assert.equal(fs.existsSync(path.join(project, '.afn', 'db-connection.json')), false);
  bootstrapAfn(project, { ceiling: project });
  const origin = JSON.parse(fs.readFileSync(path.join(project, '.afn', 'db-connection.json'), 'utf8'));
  assert.equal(origin.dbEngine, 'sqlserver');
  assert.equal(JSON.stringify(origin).includes('LocalOnly'), false);
});

test('setup kiro quita el stub npx data-agent que cierra con MCP 32000', () => {
  const home = tmp();
  const project = tmp();
  writePkg(path.join(project, 'api'), 'api', { dependencies: { express: '4' } });
  fs.mkdirSync(path.join(project, '.kiro', 'settings'), { recursive: true });
  fs.writeFileSync(
    path.join(project, '.kiro', 'settings', 'mcp.json'),
    JSON.stringify({
      mcpServers: {
        keep: { command: 'node', args: ['x.js'] },
        'afn-mcp-data-agent': { command: 'npx', args: ['-y', '@afn-ecosystem/mcp-data-agent@latest'] },
      },
    }),
  );
  setupAgent('kiro', { home, projectRoot: project });
  const mcp = JSON.parse(fs.readFileSync(path.join(project, '.kiro', 'settings', 'mcp.json'), 'utf8'));
  assert.equal(mcp.mcpServers['afn-mcp-data-agent'], undefined);
  assert.ok(mcp.mcpServers.keep);
  assert.ok(mcp.mcpServers['afn-context']);
});

test('varios repos / compose: varias fichas de origen, no una sola', () => {
  const root = tmp();
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4', mssql: '10' } });
  writePkg(path.join(root, 'catalog'), 'catalog', { dependencies: { mongoose: '8' } });
  fs.writeFileSync(
    path.join(root, 'docker-compose.yml'),
    [
      'services:',
      '  sql:',
      '    image: mcr.microsoft.com/mssql/server:2022-latest',
      '    ports:',
      '      - "1433:1433"',
      '  mongo:',
      '    image: mongo:6',
      '    ports:',
      '      - "27017:27017"',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(path.join(root, 'api', '.env.example'), 'DB_SERVER=sql.interno\nDB_DATABASE=Pedidos\nDB_PORT=1433\n');
  fs.writeFileSync(
    path.join(root, 'catalog', '.env.example'),
    'MONGO_HOST=mongo.interno\nMONGO_INITDB_DATABASE=catalog\n',
  );
  const inferred = inferDbOrigins(root, [
    { name: 'api', path: './api', db: 'sqlserver' },
    { name: 'catalog', path: './catalog', db: 'mongodb' },
  ]);
  const engines = new Set(inferred.map((o) => o.dbEngine));
  assert.equal(engines.has('sqlserver'), true);
  assert.equal(engines.has('mongodb'), true);
  assert.ok(inferred.length >= 2);
  const boot = bootstrapAfn(root);
  assert.ok(boot.origin.count >= 2);
  const pack = JSON.parse(fs.readFileSync(path.join(root, '.afn', 'db-connections.json'), 'utf8'));
  assert.ok(pack.connections.length >= 2);
  assert.equal(JSON.stringify(pack).toLowerCase().includes('password'), false);
  const home = tmp();
  setupAgent('kiro', { home, projectRoot: root });
  const mcp = JSON.parse(fs.readFileSync(path.join(root, '.kiro', 'settings', 'mcp.json'), 'utf8'));
  const dataServers = Object.keys(mcp.mcpServers).filter((k) => /data-agent/.test(k));
  assert.equal(dataServers.length, 0, String(dataServers));
  assert.ok(mcp.mcpServers['afn-context']);
  assert.ok(mcp.mcpServers['afn-context'].autoApprove.includes('afn_sql'));
  const steering = fs.readFileSync(path.join(root, '.kiro', 'steering', 'afn-context.md'), 'utf8');
  assert.match(steering, /afn_sql/);
  assert.match(steering, /No le pidas/);
  const html = fs.readFileSync(writeDashboard(root, { open: false }).file, 'utf8');
  assert.match(html, /db-connections\.json/);
  assert.match(html, /sqlserver|mssql/i);
  assert.match(html, /mongo/i);
});

test('afn_sql responde en el MCP y no manda al usuario a correr la consulta', async () => {
  const tool = CONTEXT_TOOLS.find((t) => t.name === 'afn_sql');
  assert.ok(tool);
  assert.match(tool.description, /No pidas/);
  const empty = tmp();
  const noOrigin = await handleContextTool(empty, 'afn_sql', { sql: 'SELECT 1' });
  assert.equal(noOrigin.ok, false);
  assert.match(noOrigin.error, /db-connections/);
  assert.match(noOrigin.hint, /No pidas al usuario/);
  const root = tmp();
  fs.mkdirSync(path.join(root, '.afn'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.afn', 'db-connections.json'),
    JSON.stringify({
      version: 1,
      connections: [{ id: 'o1', name: 'qa', dbEngine: 'sqlserver', host: 'db.interno', database: 'Pedidos' }],
    }),
  );
  const blocked = await handleContextTool(root, 'afn_sql', { sql: 'DELETE FROM Pedidos' });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /bloqueada/);
  assert.equal(blocked.rows.length, 0);
  const incomplete = await handleContextTool(root, 'afn_sql', { sql: 'SELECT TOP 1 * FROM Pedidos' });
  assert.equal(incomplete.ok, false);
  assert.match(incomplete.error, /DB_USER|incompleto/i);
  assert.match(incomplete.hint, /No pidas al usuario/);
  assert.equal(incomplete.origin.id, 'o1');
  fs.writeFileSync(
    path.join(root, '.afn', 'db-connections.json'),
    JSON.stringify({
      version: 1,
      connections: [
        { id: 'o1', name: 'pedidos', dbEngine: 'sqlserver', host: 'db.interno', database: 'Pedidos' },
        { id: 'o2', name: 'catalogo', dbEngine: 'sqlserver', host: 'otro.interno', database: 'Catalogo' },
      ],
    }),
  );
  const wrong = await handleContextTool(root, 'afn_sql', { sql: 'SELECT 1', connectionId: 'no-existe' });
  assert.equal(wrong.ok, false);
  assert.match(wrong.error, /No existe el origen/);
  assert.match(wrong.error, /o2/);
  assert.equal(wrong.origin, null);
  const many = collectDataSources(root);
  assert.match(many.how, /connectionId/);
  const src = collectDataSources(root);
  assert.equal(src.useMcp, 'afn-context');
  assert.match(src.how, /afn_sql/);
  fs.mkdirSync(path.join(root, '.kiro', 'settings'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.kiro', 'settings', 'mcp.json'),
    JSON.stringify({ mcpServers: { 'afn-mcp-data-agent': { command: 'node', args: ['server.js'] } } }),
  );
  const live = collectDataSources(root);
  assert.match(live.how, /afn_sql/);
  assert.match(live.how, /data_inspect_schema/);
});

test('sql-safety bloquea escrituras; selección recorta tablas del README', () => {
  assert.equal(assertSafeReadonlySql('SELECT 1').ok, true);
  assert.equal(assertSafeReadonlySql('DELETE FROM t').ok, false);
  assert.equal(assertSafeReadonlySql('EXEC dbo.usp_GetOrder @id = 1').ok, true);
  assert.equal(assertSafeReadonlySql('EXECUTE [dbo].[usp_List] @q = N\'x\'').ok, true);
  assert.equal(assertSafeReadonlySql('SET NOCOUNT ON; EXEC dbo.usp_Get @id = 1').ok, true);
  assert.equal(assertSafeReadonlySql('EXEC xp_cmdshell \'dir\'').ok, false);
  assert.equal(assertSafeReadonlySql('EXEC(\'SELECT 1\')').ok, false);
  assert.equal(assertSafeReadonlySql('INSERT INTO t VALUES (1)').ok, false);
  const root = tmp();
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  bootstrapAfn(root);
  commitLiveSchema(root, {
    source: 'afn-mcp-data-agent',
    engine: 'sqlserver',
    connectionName: 'QA',
    connectionId: 'qa',
    tables: [
      { name: 'Orders', columns: [{ name: 'id' }] },
      { name: 'Noise', columns: [{ name: 'x' }] },
    ],
    procedures: [{ name: 'usp_GetOrder' }, { name: 'usp_Unused' }],
  });
  const sel = saveDataSelection(root, 'qa', {
    enabledTables: ['Orders'],
    enabledProcedures: ['usp_GetOrder'],
  });
  assert.equal(sel.tables, 1);
  const datos = fs.readFileSync(path.join(root, '.afn', 'diagrams', 'datos.md'), 'utf8');
  assert.match(datos, /Orders/);
  assert.equal(datos.includes('Noise'), false);
  assert.equal(datos.includes('usp_Unused'), false);
  const html = fs.readFileSync(writeDashboard(root, { open: false }).file, 'utf8');
  assert.match(html, /data-view="sql"/);
  assert.match(html, /data-view="origenes"/);
  assert.match(html, /data-view="esquema"/);
  assert.match(html, /Ejecutar/);
  assert.match(html, /wb-o-host/);
  assert.match(html, /Guardar origen/);
  assert.match(html, /DB_USER/);
  assert.match(html, /sql-ide/);
  assert.match(html, /wb-sql-xls/);
  assert.match(html, /Excel/);
  assert.match(html, /JSON/);
  assert.match(html, /wb-sql-gutter/);
  assert.match(html, /wb-sql-inspect/);
  assert.match(html, /wb-sql-view-json/);
  assert.match(html, /sql-lupa-btn/);
  assert.match(html, /Previsualizaci/);
  assert.match(html, /wb-sql-inspect-fs/);
  assert.match(html, /EXEC dbo\.NombrePA/);
  assert.match(html, /v1\.4\.34/);
  assert.match(html, /data-afn-version="1\.4\.34"/);
  assert.match(html, /wb-sql-fav-modal/);
  assert.match(html, /wb-sql-fav-preview/);
  assert.match(html, /wb-sql-ed-max/);
  assert.match(html, /wb-sql-res-max/);
  assert.match(html, /data-view="skills"/);
  assert.match(html, /Nueva skill/);
  assert.match(html, /data-go="skills"/);
  assert.match(html, /\[hidden\] \{ display:none !important; \}/);
});

test('servidor local edita orígenes y rechaza DELETE', async () => {
  const root = tmp();
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  bootstrapAfn(root);
  const info = await startDashboardServer(root, { port: 0 });
  try {
    const headers = { 'x-afn-token': info.token, 'content-type': 'application/json' };
    const put = await fetch(`http://127.0.0.1:${info.port}/api/origins`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        connections: [{ id: 'a', name: 'Pedidos', dbEngine: 'sqlserver', host: 'h1', password: 'no' }],
      }),
    });
    const pj = await put.json();
    assert.equal(pj.ok, true);
    const disk = JSON.parse(fs.readFileSync(path.join(root, '.afn', 'db-connections.json'), 'utf8'));
    assert.equal(disk.connections[0].name, 'Pedidos');
    assert.equal(JSON.stringify(disk).includes('no'), false);
    const one = await fetch(`http://127.0.0.1:${info.port}/api/origins`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ host: 'db.local', port: 1433, database: 'Pedidos', dbEngine: 'sqlserver', name: 'QA' }),
    });
    const oj = await one.json();
    assert.equal(oj.ok, true);
    const disk2 = JSON.parse(fs.readFileSync(path.join(root, '.afn', 'db-connections.json'), 'utf8'));
    assert.equal(disk2.connections[0].host, 'db.local');
    assert.equal(disk2.connections[0].database, 'Pedidos');
    const session = JSON.parse(fs.readFileSync(path.join(root, '.afn', 'db-connection.json'), 'utf8'));
    assert.equal(session.host, 'db.local');
    assert.equal(JSON.stringify(session).includes('password'), false);
    const bad = await fetch(`http://127.0.0.1:${info.port}/api/sql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sql: 'DELETE FROM t' }),
    });
    assert.equal(bad.ok, false);
    const execProbe = await fetch(`http://127.0.0.1:${info.port}/api/sql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sql: 'EXEC dbo.usp_GetOrder @id = 1' }),
    });
    const execBody = await execProbe.json();
    assert.equal(String(execBody.error || '').includes('bloqueada'), false);
    const credDir = path.join(root, '.afn', 'credentials');
    fs.mkdirSync(credDir, { recursive: true });
    fs.writeFileSync(path.join(credDir, 'data-agent.json'), JSON.stringify({ DB_USER: 'sa', DB_PASSWORD: 'SuperSecretLeak' }));
    const got = await fetch(`http://127.0.0.1:${info.port}/api/origins`, { headers });
    const gj = await got.json();
    assert.equal(gj.credentials.exists, true);
    assert.equal(gj.credentials.hasUser, true);
    assert.equal(gj.credentials.hasPassword, true);
    assert.equal(JSON.stringify(gj).includes('SuperSecretLeak'), false);
    const health = await fetch(`http://127.0.0.1:${info.port}/api/health`, { headers });
    const hj = await health.json();
    assert.equal(hj.ok, true);
    assert.ok(hj.driver);
    assert.equal(hj.driver.mssql, 'ready');
    const page = await fetch(`http://127.0.0.1:${info.port}/?token=${info.token}`);
    const liveHtml = await page.text();
    assert.match(liveHtml, /v1\.4\.34/);
    assert.match(liveHtml, /data-view="skills"/);
    assert.match(liveHtml, /wb-sql-inspect/);
    assert.match(liveHtml, /wb-o-host/);
    assert.match(liveHtml, /DB_USER/);
    assert.match(liveHtml, /wb-sql-driver/);
    assert.match(liveHtml, /window\.AFN_API=\{token:/);
  } finally {
    stopDashboardServer(root);
  }
});

test('compactDashboard no entrega el html de _tmp', () => {
  const c = compactDashboard({
    ok: true,
    url: 'http://127.0.0.1:9/?token=x#readme',
    file: 'C:/varios/repos/.afn/_tmp/dashboard.html',
    server: true,
    port: 9,
    version: '1.4.30',
  });
  assert.match(c.url, /^http:\/\/127\.0\.0\.1/);
  assert.equal(c.url.includes('dashboard.html'), false);
  assert.equal(c.version, '1.4.30');
});

test('favoritos SQL se guardan en .afn y se pueden quitar', () => {
  const root = tmp();
  const saved = saveSqlFavorites(root, [
    { id: 'fav_1', title: 'tablas', sql: 'SELECT 1' },
    { id: 'fav_2', title: 'vacio', sql: '   ' },
  ]);
  assert.equal(saved.length, 1);
  assert.equal(loadSqlFavorites(root)[0].title, 'tablas');
  const left = saveSqlFavorites(root, saved.filter((f) => f.id !== 'fav_1'));
  assert.equal(left.length, 0);
  assert.equal(loadSqlFavorites(root).length, 0);
  const file = fs.readFileSync(path.join(root, '.afn', 'sql-favorites.json'), 'utf8');
  assert.match(file, /favorites/);
});

test('saveOriginsPack acepta un objeto suelto y no escribe password', () => {
  const root = tmp();
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  const wrapped = normalizeOriginsInput({ host: 'h', database: 'd', dbEngine: 'sqlserver' });
  assert.equal(wrapped.length, 1);
  const r = saveOriginsPack(root, { host: 'h', port: 5432, database: 'd', password: 'secret', dbEngine: 'postgresql' });
  assert.equal(r.ok, true);
  const pack = JSON.parse(fs.readFileSync(path.join(root, '.afn', 'db-connections.json'), 'utf8'));
  assert.equal(pack.connections[0].host, 'h');
  assert.equal(pack.connections[0].database, 'd');
  assert.equal(JSON.stringify(pack).includes('secret'), false);
  const session = JSON.parse(fs.readFileSync(path.join(root, '.afn', 'db-connection.json'), 'utf8'));
  assert.equal(session.port, 5432);
});

test('inspectCredentialsFile no filtra el password y detecta el shape', () => {
  const root = tmp();
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  bootstrapAfn(root);
  const prompt = fs.readFileSync(path.join(root, '.afn', 'prompts', 'data-agent-credentials.md'), 'utf8');
  assert.match(prompt, /DB_USER/);
  const missing = inspectCredentialsFile(root);
  assert.equal(missing.exists, false);
  const dir = path.join(root, '.afn', 'credentials');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'data-agent.json'), JSON.stringify({ DB_USER: 'sa', DB_PASSWORD: 'NoLeak' }));
  const flat = inspectCredentialsFile(root);
  assert.equal(flat.exists, true);
  assert.equal(flat.shape, 'flat');
  assert.equal(flat.hasUser, true);
  assert.equal(flat.hasPassword, true);
  assert.equal(JSON.stringify(flat).includes('NoLeak'), false);
  fs.writeFileSync(path.join(dir, 'data-agent.json'), JSON.stringify({ byId: { origen_1: { DB_USER: 'u', DB_PASSWORD: 'p' } } }));
  const nested = inspectCredentialsFile(root);
  assert.equal(nested.shape, 'byId');
  assert.deepEqual(nested.ids, ['origen_1']);
});

test('sql-driver encuentra mssql en node_modules del workspace, sin npm i en el producto', async () => {
  resetSqlDriverCache();
  const root = tmp();
  const pkg = path.join(root, 'node_modules', 'mssql');
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'mssql', main: 'index.js' }));
  fs.writeFileSync(path.join(pkg, 'index.js'), 'module.exports = { connect() { return { ok: true }; } };\n');
  const dir = findInstalledDriver('mssql', { roots: [root], scanPack: false });
  assert.equal(dir, pkg);
  const loaded = await loadSqlDriver('mssql', { roots: [root], scanPack: false, fresh: true });
  assert.equal(loaded.ok, true);
  assert.equal(typeof loaded.module.connect, 'function');
  const missing = findInstalledDriver('mssql', { roots: [tmp()], scanPack: false });
  assert.equal(missing, '');
  const blocked = await loadSqlDriver('evil');
  assert.equal(blocked.ok, false);
});

test('sql-driver resuelve mssql del pack con require.resolve, sin npx', async () => {
  const src = fs.readFileSync(new URL('../lib/sql-driver.js', import.meta.url), 'utf8');
  assert.equal(src.includes('npx.cmd'), false);
  assert.equal(src.includes('execFile'), false);
  resetSqlDriverCache();
  assert.equal(packHasSqlDriver(), true);
  const dir = resolvePackDriver('mssql');
  assert.ok(dir && dir.includes('mssql'));
  const loaded = await loadSqlDriver('mssql', { roots: [], fresh: true });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.source, 'pack');
  assert.equal(typeof loaded.module.connect, 'function');
});

test('prompt hint es corto; note-save copia un md sin LLM', () => {
  const h = buildPromptHint(tmp());
  assert.equal(h.hint, true);
  assert.ok(h.markdown.length < 500);
  assert.match(h.markdown, /dashboard/);
  const root = tmp();
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  const src = path.join(root, 'hu_102030_fondos.md');
  fs.writeFileSync(src, '# HU fondos\n\nDetalle.\n');
  const r = saveTaskNoteFromFile(root, src);
  assert.equal(r.ok, true);
  assert.equal(r.file, 'hu_102030_fondos.md');
  assert.ok(fs.existsSync(path.join(root, '.afn', 'notes', 'tareas', r.slug, 'hu_102030_fondos.md')));
});

test('prompt-gate intercepta dashboard y note-save; el resto no', async () => {
  assert.equal(parseLocalIntent('abre dashboard AFN')?.kind, 'dashboard');
  assert.equal(parseLocalIntent('abrir el dashboard sql')?.view, 'sql');
  assert.equal(parseLocalIntent('abre dashboard skills')?.view, 'skills');
  assert.equal(parseLocalIntent('abre las skills')?.view, 'skills');
  assert.equal(parseLocalIntent('abre los textos')?.view, 'extract');
  assert.equal(parseLocalIntent('extrae C:\\docs\\factura.pdf')?.kind, 'extract');
  assert.equal(parseLocalIntent('mira esta imagen C:/Users/a/foto.png')?.file, 'C:\\Users\\a\\foto.png');
  assert.equal(parseLocalIntent('qué dice esta foto C:\\docs\\captura.jpg')?.kind, 'extract');
  assert.equal(parseLocalIntent('convierte este componente a typescript'), null);
  assert.equal(parseLocalIntent('extrae imagenes/foto.png')?.file, 'imagenes/foto.png');
  assert.equal(parseLocalIntent('extrae la imagen')?.pick, 'imagen');
  assert.equal(parseLocalIntent('arregla el bug del componente logo.png'), null);
  assert.equal(parseLocalIntent('usa la skill caja y documentá el flujo'), null);
  assert.equal(parseLocalIntent('guarda el readme hu102030')?.kind, 'note-save');
  assert.equal(parseLocalIntent('guarda el readme hu_102030_fondos.md')?.file, 'hu_102030_fondos.md');
  assert.equal(parseLocalIntent('busca en el cerebro fondos')?.kind, 'mem-search');
  assert.equal(parseLocalIntent('cómo implemento el login'), null);
  const root = tmp();
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  fs.writeFileSync(path.join(root, 'hu102030.md'), '# HU\n');
  const r = await runPromptGate(root, 'guarda el readme hu102030');
  assert.equal(r.handled, true);
  assert.equal(r.exitCode, 2);
  assert.match(r.message, /sin LLM/i);
  const pass = await runPromptGate(root, 'explicame el flujo del api');
  assert.equal(pass.handled, false);
  assert.equal(pass.exitCode, 0);
});






