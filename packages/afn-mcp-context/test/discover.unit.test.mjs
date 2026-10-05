import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discoverWorkspace } from '../lib/discover.js';
import { mapPickerScript } from '../lib/dashboard-project-ui.js';
import { buildWorkspaceFlow } from '../lib/workspace-flow.js';
import { workspaceFlowMarkdown } from '../lib/architecture-readme.js';

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'afn-discover-'));
}

test('descubrir no corre solo: sin carpetas no escribe skills', async () => {
  const root = tmp();
  const r = await discoverWorkspace(root, []);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'sin-carpetas');
  assert.equal(fs.existsSync(path.join(root, '.afn', 'skills', 'process-index.json')), false);
});

test('descubrir arma el mapa con las carpetas marcadas y skills solo de esas', async () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'front', 'src', 'caja'), { recursive: true });
  fs.writeFileSync(path.join(root, 'front', 'package.json'), JSON.stringify({ name: 'front', dependencies: { react: '18' } }));
  fs.writeFileSync(path.join(root, 'front', 'src', 'caja', 'Uno.jsx'), 'export function Uno(){ return null }\n');
  fs.writeFileSync(path.join(root, 'front', 'src', 'caja', 'Dos.jsx'), 'export function Dos(){ return null }\n');
  fs.mkdirSync(path.join(root, 'worker', 'jobs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'worker', 'setup.py'), 'from setuptools import setup\nsetup(name="worker")\n');
  fs.writeFileSync(path.join(root, 'worker', 'jobs', 'A.jsx'), 'export function A(){ return null }\n');
  fs.writeFileSync(path.join(root, 'worker', 'jobs', 'B.jsx'), 'export function B(){ return null }\n');

  const r = await discoverWorkspace(root, ['./front']);
  assert.equal(r.ok, true);
  assert.deepEqual(r.projects.map((p) => p.path), ['./front']);
  assert.ok(r.skills >= 1);
  const skill = fs.readFileSync(path.join(root, '.afn', 'skills', 'process-caja', 'SKILL.md'), 'utf8');
  assert.match(skill, /front\/src\/caja\/Uno\.jsx/);
  assert.equal(skill.includes(root), false);
  assert.equal(fs.existsSync(path.join(root, '.afn', 'skills', 'process-jobs', 'SKILL.md')), false);
  const map = JSON.parse(fs.readFileSync(path.join(root, '.afn', 'projects.json'), 'utf8'));
  assert.equal(map.architectureLocked, true);
  assert.ok(map.ignorePaths.some((p) => String(p).includes('worker')));
  const doc = fs.readFileSync(path.join(root, 'ARQUITECTURA.md'), 'utf8');
  assert.match(doc, /## 1\. Contexto/);
  assert.match(doc, /## 5\. Rutas y contratos/);
  assert.match(doc, /## 7\. Cómo se desarrolla y se prueba/);
});

test('una carpeta src hereda el manifiesto de la raíz y la llamada al otro puerto', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    name: 'front',
    dependencies: { react: '18', vite: '5' },
    scripts: { dev: 'vite' },
  }));
  fs.writeFileSync(path.join(root, 'vite.config.js'), 'export default { server: { port: 5173 } }\n');
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'cliente.js'), 'export const url = "http://localhost:4000/health"\n');
  fs.mkdirSync(path.join(root, 'api'), { recursive: true });
  fs.writeFileSync(path.join(root, 'api', 'package.json'), JSON.stringify({
    name: 'api',
    dependencies: { express: '4' },
    scripts: { dev: 'node server.js --port 4000' },
  }));
  const flow = buildWorkspaceFlow(root, {
    projects: [
      { name: 'Front', path: './src', type: 'frontend', status: 'active', enabled: true },
      { name: 'API', path: './api', type: 'backend', status: 'active', enabled: true },
    ],
  });
  const front = flow.projects.find((p) => p.name === 'Front');
  assert.equal(front.framework, 'react');
  assert.equal(Number(front.port), 5173);
  assert.ok(flow.relationships.some((r) => r.from === 'Front' && r.to === 'API' && r.via === 'localhost'));
  const md = workspaceFlowMarkdown(flow);
  assert.match(md, /localhost:4000/);
  assert.match(md, /## 4\. Flujo E2E/);
});

test('el botón Descubrir solo llama al endpoint en el click', () => {
  const src = mapPickerScript();
  const post = src.indexOf('/api/discover');
  const paint = src.lastIndexOf('paint()');
  assert.ok(post > src.indexOf('addEventListener'));
  assert.ok(paint > post);
  assert.equal(src.slice(paint).includes('/api/discover'), false);
});
