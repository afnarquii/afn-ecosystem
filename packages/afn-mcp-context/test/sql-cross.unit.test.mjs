import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crossSqlResults } from '../lib/sql-cross.js';

test('cruza dos consultas por un campo y marca las que no coinciden', () => {
  const out = crossSqlResults(
    [
      { name: 'Consulta 1', rows: [{ idconsecutivo: 1, a: 'x' }, { idconsecutivo: 2, a: 'y' }] },
      { name: 'Consulta 2', rows: [{ id: 1, b: 'ok' }, { id: 9, b: 'no' }] },
      { name: 'Consulta 3', rows: [] },
    ],
    [{ a: 0, b: 1, aField: 'idconsecutivo', bField: 'id' }],
  );
  assert.equal(out.panes[0][0].cruza, true);
  assert.equal(out.panes[0][1].cruza, false);
  assert.equal(out.panes[1][0].cruza, true);
  assert.equal(out.panes[1][1].cruza, false);
  assert.deepEqual(out.panes[0][0].con, ['Consulta 2']);
  const hit = out.filas.find((f) => f.consulta1 && f.consulta1.idconsecutivo === 1);
  assert.equal(hit.cruza, true);
  assert.equal(hit.consulta2.b, 'ok');
  const miss = out.filas.find((f) => f.consulta1 && f.consulta1.idconsecutivo === 2);
  assert.equal(miss.cruza, false);
  assert.equal(miss.consulta2, null);
  assert.ok(out.campos.solo['Consulta 1'].includes('a'));
  assert.ok(out.campos.solo['Consulta 2'].includes('b'));
});

test('varios campos entre las mismas pestañas tienen que coincidir todos', () => {
  const out = crossSqlResults(
    [
      { name: 'Consulta 1', rows: [{ id: 1, tipo: 'A' }, { id: 1, tipo: 'B' }] },
      { name: 'Consulta 2', rows: [{ id: 1, tipo: 'B', extra: 1 }] },
      { rows: [] },
    ],
    [
      { a: 0, b: 1, aField: 'id', bField: 'id' },
      { a: 0, b: 1, aField: 'tipo', bField: 'tipo' },
    ],
  );
  assert.equal(out.panes[0][0].cruza, false);
  assert.equal(out.panes[0][1].cruza, true);
  assert.equal(out.panes[1][0].cruza, true);
});
