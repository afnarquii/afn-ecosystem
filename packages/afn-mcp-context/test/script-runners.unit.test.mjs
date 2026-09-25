import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { handleContextTool } from '../lib/handle-tool.js';
import { STEERING } from '../lib/setup.js';
import { writeDashboard } from '../lib/dashboard.js';
import {
  createScriptRunner,
  resolveScriptFile,
  runScriptRunner,
  saveScriptRunner,
} from '../lib/script-runners.js';

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'afn-script-'));
}

test('un script fuera del proyecto no se registra', () => {
  const root = tmp();
  const outside = resolveScriptFile(root, '../secreto.js');
  assert.equal(outside.ok, false);
  const saved = saveScriptRunner(root, { title: 'x', lang: 'node', path: '../secreto.js' });
  assert.equal(saved.ok, false);
});

test('afn_script lista sin ejecutar y run solo usa el catálogo', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'datos.js'), 'process.stdout.write(JSON.stringify([{n:1},{n:2}]))\n');
  const saved = saveScriptRunner(root, { title: 'Datos', lang: 'node', path: 'datos.js' });
  assert.equal(saved.ok, true);
  const listed = await handleContextTool(root, 'afn_script', {});
  assert.equal(listed.ran, false);
  assert.equal(listed.runners[0].id, 'datos');
  assert.equal(listed.rows, undefined);
  const ran = await handleContextTool(root, 'afn_script', { action: 'run', id: 'datos' });
  assert.equal(ran.ok, true);
  assert.equal(ran.ran, true);
  assert.equal(ran.rows.length, 2);
  assert.equal(ran.rows[1].n, 2);
  const missing = await handleContextTool(root, 'afn_script', { action: 'run', id: 'no-esta' });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /script-runners/);
});

test('crear un script nuevo lo deja en .afn/runners y devuelve JSON', async () => {
  const root = tmp();
  const created = createScriptRunner(root, { title: 'Informe', lang: 'node' });
  assert.equal(created.ok, true);
  assert.match(created.runner.path, /^\.afn\/runners\/informe\.js$/);
  const ran = await runScriptRunner(root, 'informe');
  assert.equal(ran.ok, true);
  assert.equal(ran.rows[0].fuente, 'node');
});

test('el steering no autoriza a Kiro a correr scripts por su cuenta', () => {
  assert.match(STEERING, /afn_script/);
  assert.match(STEERING, /no los ejecutes/i);
  const html = fs.readFileSync(writeDashboard(tmp(), { open: false }).file, 'utf8');
  assert.match(html, /data-go="scripts"/);
  assert.match(html, /wb-script-new/);
  assert.match(html, /id="wb-script-run"|data-script-run/);
});
