import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveWorkspaceRoot } from '../lib/resolve-root.js';
import { aggregateCatalogMemory, searchCatalogMemory } from '../lib/catalog-registry.js';
import { saveObservation, searchCerebro } from '../lib/cerebro.js';
import { portProjectAssets } from '../lib/project-port.js';
import { pickFolder } from '../lib/pick-folder.js';
import { projectBarHtml } from '../lib/dashboard-project-ui.js';

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'afn-scope-'));
}

function fakeCatalog(parent) {
  const cat = path.join(parent, 'afn-ecosystem');
  fs.mkdirSync(path.join(cat, 'packs'), { recursive: true });
  fs.mkdirSync(path.join(cat, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(cat, 'mcps'), { recursive: true });
  fs.mkdirSync(path.join(cat, 'packages', 'afn-mcp-context'), { recursive: true });
  fs.writeFileSync(
    path.join(cat, 'packages', 'afn-mcp-context', 'package.json'),
    JSON.stringify({ name: '@afn-ecosystem/mcp-context' }),
  );
  return cat;
}

test('abrir afn-ecosystem se queda en el catálogo aunque el padre tenga varios repos', () => {
  const parent = tmp();
  fs.writeFileSync(path.join(parent, 'package.json'), JSON.stringify({ name: 'padre' }));
  fs.mkdirSync(path.join(parent, 'otro'));
  fs.writeFileSync(path.join(parent, 'otro', 'package.json'), JSON.stringify({ name: 'otro' }));
  const cat = fakeCatalog(parent);
  assert.equal(path.resolve(resolveWorkspaceRoot(cat)), path.resolve(cat));
});

test('una carpeta suelta no hereda el .afn del padre', () => {
  const parent = tmp();
  fs.mkdirSync(path.join(parent, 'a'));
  fs.writeFileSync(path.join(parent, 'a', 'package.json'), JSON.stringify({ name: 'a' }));
  fs.mkdirSync(path.join(parent, 'b'));
  fs.writeFileSync(path.join(parent, 'b', 'package.json'), JSON.stringify({ name: 'b' }));
  fs.mkdirSync(path.join(parent, '.afn'), { recursive: true });
  fs.writeFileSync(path.join(parent, '.afn', 'projects.json'), JSON.stringify({ projects: [{ name: 'a', path: 'a' }] }));
  const scratch = path.join(parent, 'ensayo');
  fs.mkdirSync(scratch);
  fs.writeFileSync(path.join(scratch, '1.png'), Buffer.from([1]));
  assert.equal(path.resolve(resolveWorkspaceRoot(scratch)), path.resolve(scratch));
});

test('el catálogo lee la memoria de cada proyecto y un proyecto no ve la del otro', () => {
  const parent = tmp();
  const cat = fakeCatalog(parent);
  const uno = path.join(parent, 'uno');
  const dos = path.join(parent, 'dos');
  fs.mkdirSync(uno);
  fs.mkdirSync(dos);
  saveObservation(uno, { title: 'Hecho uno', what: 'solo en uno', type: 'decision' });
  saveObservation(dos, { title: 'Hecho dos', what: 'solo en dos', type: 'decision' });
  fs.mkdirSync(path.join(cat, '.afn'), { recursive: true });
  fs.writeFileSync(
    path.join(cat, '.afn', 'known-projects.json'),
    JSON.stringify({ version: 1, projects: [{ root: uno, name: 'uno' }, { root: dos, name: 'dos' }] }),
  );
  const all = aggregateCatalogMemory(cat);
  const titles = all.projects.flatMap((p) => p.observations.map((o) => o.title));
  assert.ok(titles.includes('Hecho uno'));
  assert.ok(titles.includes('Hecho dos'));
  assert.equal(searchCerebro(uno, 'dos').length, 0);
  assert.equal(searchCatalogMemory(cat, 'uno').some((o) => o.project === 'uno'), true);
});

test('el selector de carpeta devuelve la ruta y el readme ofrece Elegir carpeta', async () => {
  const picked = await pickFolder({ dialog: async () => ({ ok: true, path: 'C:\\demo\\producto', name: 'producto' }) });
  assert.equal(picked.ok, true);
  assert.equal(picked.path, 'C:\\demo\\producto');
  const html = projectBarHtml();
  assert.match(html, /Elegir carpeta/);
  assert.match(html, /id="afn-browse"/);
  assert.equal(html.includes('type="text"'), false);
});

test('portar skills no copia la memoria', () => {
  const src = tmp();
  const dest = tmp();
  fs.mkdirSync(path.join(src, '.kiro', 'skills', 'caja'), { recursive: true });
  fs.writeFileSync(path.join(src, '.kiro', 'skills', 'caja', 'SKILL.md'), '# Caja\n');
  fs.mkdirSync(path.join(src, '.kiro', 'steering'), { recursive: true });
  fs.writeFileSync(path.join(src, '.kiro', 'steering', 'turnos.md'), '# Turnos\n');
  fs.writeFileSync(path.join(src, '.kiro', 'steering', 'afn-context.md'), '# no copiar\n');
  fs.mkdirSync(path.join(src, '.afn', 'memory'), { recursive: true });
  fs.writeFileSync(path.join(src, '.afn', 'memory', 'cerebro.json'), '{"observations":[{"id":"o-1","title":"secreto"}]}');
  const r = portProjectAssets(dest, src);
  assert.equal(r.ok, true);
  assert.ok(fs.existsSync(path.join(dest, '.kiro', 'skills', 'caja', 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(dest, '.kiro', 'steering', 'turnos.md')));
  assert.equal(fs.existsSync(path.join(dest, '.kiro', 'steering', 'afn-context.md')), false);
  assert.equal(fs.existsSync(path.join(dest, '.afn', 'memory', 'cerebro.json')), false);
});
