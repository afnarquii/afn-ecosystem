import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignDiff, prettyJson } from '../lib/text-diff.js';

test('prettyJson formatea y rechaza texto que no es JSON', () => {
  const ok = prettyJson('{"b":1,"a":2}');
  assert.equal(ok.ok, true);
  assert.match(ok.text, /"a": 2/);
  const bad = prettyJson('SELECT 1');
  assert.equal(bad.ok, false);
  assert.equal(bad.text, 'SELECT 1');
});

test('alignDiff marca cambio, alta y baja', () => {
  const rows = alignDiff('{\n  "a": 1\n}\n', '{\n  "a": 2\n  "b": 3\n}\n');
  assert.equal(rows[0].kind, 'eq');
  assert.equal(rows[0].leftNo, 1);
  assert.equal(rows[0].rightNo, 1);
  const change = rows.find((r) => r.kind === 'change');
  assert.ok(change);
  assert.equal(change.leftNo, 2);
  assert.equal(change.rightNo, 2);
  assert.ok(change.rightParts.some((p) => p.changed && String(p.text).includes('2')));
  const add = rows.find((r) => r.kind === 'add');
  assert.ok(add);
  assert.equal(add.leftNo, null);
  assert.match(add.right, /"b"/);
  assert.equal(rows[rows.length - 1].kind, 'eq');
});

test('alignDiff de textos iguales no inventa cambios', () => {
  const rows = alignDiff('a\r\nb\n', 'a\nb');
  assert.equal(rows.every((r) => r.kind === 'eq'), true);
  assert.equal(rows.length, 2);
});

test('archivo vacío contra otro queda en altas', () => {
  const rows = alignDiff('', 'solo\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'add');
  assert.equal(rows[0].right, 'solo');
});
