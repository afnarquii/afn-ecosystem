import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { handleContextTool } from '../lib/handle-tool.js';
import { STEERING } from '../lib/setup.js';
import { writeDashboard } from '../lib/dashboard.js';
import {
  buildScriptArgv,
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

test('una ruta absoluta fuera del repo se ejecuta y Kiro no ve ni la ruta ni las claves', async () => {
  const root = tmp();
  const secretDir = tmp();
  const secret = 'TOKEN_SUPER_SECRETO_99';
  const file = path.join(secretDir, 'job.js');
  fs.writeFileSync(file, `const clave = "${secret}";\nprocess.stdout.write(JSON.stringify([{ok:true}]));\n`);
  const saved = saveScriptRunner(root, { title: 'Externo', lang: 'node', path: file });
  assert.equal(saved.ok, true);
  const catalog = fs.readFileSync(path.join(root, '.afn', 'script-runners.json'), 'utf8');
  assert.equal(catalog.includes(secret), false);
  assert.ok(catalog.includes(file.replace(/\\/g, '\\\\')) || catalog.includes(file.replace(/\\/g, '/')));
  const listed = await handleContextTool(root, 'afn_script', {});
  const ran = await handleContextTool(root, 'afn_script', { action: 'run', id: 'externo' });
  const blob = JSON.stringify({ listed, ran });
  assert.equal(blob.includes(secret), false);
  assert.equal(blob.includes(secretDir), false);
  assert.equal(ran.rows[0].ok, true);
});

test('si el script falla se ve el error y también las filas, sin la ruta', async () => {
  const root = tmp();
  const secretDir = tmp();
  const file = path.join(secretDir, 'job.js');
  fs.writeFileSync(
    file,
    'process.stderr.write("token expirado\\n"); process.stdout.write(JSON.stringify([{n:1}])); process.exit(1);\n',
  );
  const saved = saveScriptRunner(root, { title: 'Falla', lang: 'node', path: file });
  assert.equal(saved.ok, true);
  const ran = await handleContextTool(root, 'afn_script', { action: 'run', id: 'falla' });
  assert.equal(ran.ok, false);
  assert.equal(ran.ran, true);
  assert.match(ran.error, /token expirado/);
  assert.equal(ran.rows.length, 1);
  assert.equal(ran.rows[0].n, 1);
  const blob = JSON.stringify(ran);
  assert.equal(blob.includes(secretDir), false);
  assert.equal(blob.includes(file), false);
});

test('los parámetros son opcionales y llegan como argv, sin devolver la ruta', async () => {
  const root = tmp();
  fs.writeFileSync(
    path.join(root, 'eco.js'),
    'process.stdout.write(JSON.stringify(process.argv.slice(2)))\n',
  );
  saveScriptRunner(root, { title: 'Eco', lang: 'node', path: 'eco.js' });
  const plain = await handleContextTool(root, 'afn_script', { action: 'run', id: 'eco' });
  assert.equal(plain.ok, true);
  assert.equal(plain.argCount, 0);
  assert.equal(plain.rows.length, 0);
  const named = buildScriptArgv({ params: { desde: '2024-01-01', activo: true, oculto: false }, args: ['cliente-9'] });
  assert.deepEqual(named.argv, ['--desde', '2024-01-01', '--activo', 'cliente-9']);
  const ran = await handleContextTool(root, 'afn_script', {
    action: 'run',
    id: 'eco',
    params: { desde: '2024-01-01', activo: true, oculto: false },
    args: ['cliente-9'],
  });
  assert.equal(ran.ok, true);
  assert.equal(ran.argCount, 4);
  assert.deepEqual(ran.rows.map((r) => r.value), ['--desde', '2024-01-01', '--activo', 'cliente-9']);
  assert.equal(JSON.stringify(ran).includes('eco.js'), false);
});

test('un parámetro sin valor no se envía y el nombre queda para la próxima', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'eco.js'), 'process.stdout.write(JSON.stringify(process.argv.slice(2)))\n');
  const saved = saveScriptRunner(root, {
    title: 'Eco',
    lang: 'node',
    path: 'eco.js',
    params: ['desde', 'hasta', 'cliente'],
  });
  assert.deepEqual(saved.runner.params, ['desde', 'hasta', 'cliente']);
  const again = saveScriptRunner(root, { title: 'Eco', lang: 'node', path: 'eco.js' });
  assert.deepEqual(again.runner.params, ['desde', 'hasta', 'cliente']);
  const listed = await handleContextTool(root, 'afn_script', {});
  assert.deepEqual(listed.runners[0].params, ['desde', 'hasta', 'cliente']);
  assert.equal(JSON.stringify(listed).includes('eco.js'), false);
  const ran = await handleContextTool(root, 'afn_script', {
    action: 'run',
    id: 'eco',
    params: { desde: '2024-01-01', hasta: '', cliente: 'acme' },
  });
  assert.equal(ran.ok, true);
  assert.deepEqual(ran.rows.map((r) => r.value), ['--desde', '2024-01-01', '--cliente', 'acme']);
});

test('el steering no autoriza a Kiro a correr scripts por su cuenta', () => {
  assert.match(STEERING, /afn_script/);
  assert.match(STEERING, /No abras ese archivo/);
  const html = fs.readFileSync(writeDashboard(tmp(), { open: false }).file, 'utf8');
  assert.match(html, /data-go="scripts"/);
  assert.match(html, /Elegir archivo/);
  assert.match(html, /wb-script-browse/);
  assert.match(html, /script-panel/);
  assert.match(html, /wb-script-new/);
  assert.match(html, /id="wb-script-run"|data-script-run/);
  assert.match(html, /id="wb-run-error"/);
  assert.match(html, /id="wb-script-args-modal"/);
  assert.match(html, /data-param-name/);
  assert.match(html, /Agregar parámetro/);
  assert.match(html, /Sin parámetros/);
  assert.match(STEERING, /no inventes ninguno/);
});
