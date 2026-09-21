import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyIgnorePath, activeProjects, activeRelationships, normalizeProjectsConfig } from '../lib/projects-policy.js';
import { detectProjects, inferProjectType, inferPort } from '../lib/detect-projects.js';
import { bootstrapAfn } from '../lib/bootstrap.js';
import { saveFact, searchFacts, loadFacts } from '../lib/memory.js';
import { buildSnapshot, doctorAfn } from '../lib/snapshot.js';
import { handleContextTool } from '../lib/handle-tool.js';
import { redactSecrets } from '../lib/redact.js';
import { setupAgent } from '../lib/setup.js';
import { resolveWorkspaceRoot, resolveProjectRoot } from '../lib/resolve-root.js';
import { isWeakProjectsMap } from '../lib/detect-projects.js';
import { saveObservation, startSession, endSession, getMemContext } from '../lib/cerebro.js';
import { writeDashboard } from '../lib/dashboard.js';

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
  assert.equal(d.relationships.length, 1);
  assert.match(d.relationships[0].endpoint, /4000/);
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
    JSON.stringify({ mcpServers: { engram: { command: 'engram', args: ['mcp'] } } }),
  );
  const r = setupAgent('kiro', { home, projectRoot: project });
  assert.equal(r.ok, true);
  const mcp = JSON.parse(fs.readFileSync(path.join(home, '.kiro', 'settings', 'mcp.json'), 'utf8'));
  assert.ok(mcp.mcpServers.engram);
  assert.ok(mcp.mcpServers['afn-context']);
  assert.ok(mcp.mcpServers['afn-context'].args?.length);
  assert.equal(mcp.mcpServers['afn-context'].env?.AFN_PROJECT_ROOT, project);
  assert.ok(fs.existsSync(path.join(home, '.kiro', 'steering', 'afn-context.md')));
  const hook = JSON.parse(fs.readFileSync(path.join(project, '.kiro', 'hooks', 'afn-session-start.json'), 'utf8'));
  assert.match(JSON.stringify(hook), /bootstrap/);
  assert.ok(fs.existsSync(path.join(project, '.kiro', 'hooks', 'afn-session-work.json')));
  assert.ok(fs.existsSync(path.join(project, '.afn', 'projects.json')));
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
  assert.ok(d.relationships.some((r) => r.from === 'frontend' && r.to === 'api'));
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
});

test('bootstrap escribe diagrama de flujo y no lo pisa si ya existe', () => {
  const root = tmp();
  writePkg(path.join(root, 'web'), 'web', { dependencies: { react: '18' } });
  writePkg(path.join(root, 'api'), 'api', { dependencies: { express: '4' } });
  const a = bootstrapAfn(root);
  assert.equal(a.diagram?.ok, true);
  assert.equal(a.diagram?.skipped, false);
  const dir = path.join(root, '.afn', 'diagrams');
  const files = fs.readdirSync(dir).filter((n) => n.endsWith('.architecture.json'));
  assert.equal(files.length, 1);
  const first = fs.readFileSync(path.join(dir, files[0]), 'utf8');
  const b = bootstrapAfn(root);
  assert.equal(b.skipped, true);
  assert.equal(b.diagram?.skipped, true);
  assert.equal(fs.readFileSync(path.join(dir, files[0]), 'utf8'), first);
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

