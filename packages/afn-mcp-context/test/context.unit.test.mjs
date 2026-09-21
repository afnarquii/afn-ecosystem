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
  assert.ok(fs.existsSync(path.join(home, '.kiro', 'steering', 'afn-context.md')));
  assert.ok(fs.existsSync(path.join(project, '.kiro', 'hooks', 'afn-session-start.json')));
});
