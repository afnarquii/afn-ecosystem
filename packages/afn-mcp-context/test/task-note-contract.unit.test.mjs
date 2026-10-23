import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseLocalIntent } from '../lib/prompt-gate.js';
import { buildPromptHint } from '../lib/snapshot.js';
import { STEERING } from '../lib/setup.js';
import { saveTaskNote } from '../lib/task-notes.js';
import {
  TASK_NOTE_SECTIONS,
  isTaskNoteFlowAsk,
  isTaskNoteImplementAsk,
  missingTaskNoteSections,
  noteFollowsTaskContract,
} from '../lib/task-note-contract.js';

function fullNote() {
  return TASK_NOTE_SECTIONS.map((title) => `## ${title}\n\ntexto`).join('\n\n');
}

test('nota-flujo es el turno de la nota, aunque pida implementar', () => {
  assert.equal(isTaskNoteFlowAsk('nota-flujo el alta de pagos'), true);
  assert.equal(isTaskNoteFlowAsk('NOTA-FLUJO con acento no hace falta'), true);
  assert.equal(isTaskNoteFlowAsk('dejá la nota de la tarea'), false);
  assert.equal(isTaskNoteFlowAsk('nota-flujo e implementá ya el código'), true);
  assert.equal(isTaskNoteImplementAsk('nota-flujo e implementá ya el código'), false);
  assert.equal(isTaskNoteImplementAsk('implementá la nota de pagos'), true);
  assert.equal(isTaskNoteImplementAsk('tirá el código de la nota'), true);
  assert.equal(isTaskNoteFlowAsk('implementá la nota de pagos'), false);
});

test('el contrato exige las siete secciones', () => {
  assert.equal(noteFollowsTaskContract(fullNote()), true);
  assert.deepEqual(missingTaskNoteSections('## Veredicto\n\nsí'), [
    'Por qué',
    'Qué hay hoy',
    'Qué cambia',
    'Código propuesto',
    'Pruebas propuestas',
    'Qué no se toca',
  ]);
});

test('guarda el readme sigue en local; nota-flujo llega al modelo', () => {
  assert.equal(parseLocalIntent('guarda el readme pagos.md')?.kind, 'note-save');
  assert.equal(parseLocalIntent('guarda el readme pagos.md nota-flujo'), null);
  assert.equal(parseLocalIntent('nota-flujo pagos'), null);
});

test('flow true no escribe una nota a medias', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'afn-nota-flujo-'));
  const bad = saveTaskNote(root, { task: 'pagos', markdown: '## Veredicto\n\nsí', flow: true });
  assert.equal(bad.ok, false);
  assert.match(bad.error, /nota-flujo incompleta/);
  assert.equal(fs.existsSync(path.join(root, '.afn', 'notes', 'tareas', 'pagos')), false);
  const good = saveTaskNote(root, { task: 'pagos', markdown: fullNote(), flow: 'true' });
  assert.equal(good.ok, true);
  assert.match(good.rel, /tareas\/pagos\/readme\.md$/);
});

test('sin flow una nota corta se guarda igual', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'afn-nota-corta-'));
  const r = saveTaskNote(root, { task: 'corta', markdown: '# Hola\n' });
  assert.equal(r.ok, true);
});

test('la pista y las reglas nombran la palabra y las secciones', () => {
  const hint = buildPromptHint('C:/tmp').markdown;
  assert.match(hint, /nota-flujo/);
  assert.match(hint, /afn_note_save/);
  assert.match(STEERING, /nota-flujo/);
  for (const title of TASK_NOTE_SECTIONS) assert.match(STEERING, new RegExp(title));
});
