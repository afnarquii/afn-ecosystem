import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createWorkspaceSkill,
  listWorkspaceSkills,
  readWorkspaceSkill,
  resolveSkillMarkdownPath,
  saveWorkspaceSkill,
} from '../lib/skill-library.js';
import { startDashboardServer, stopDashboardServer } from '../lib/dashboard-server.js';
import { writeDashboard } from '../lib/dashboard.js';

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'afn-skills-'));
}

test('lista, crea, lee y guarda skills solo dentro de las carpetas permitidas', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.kiro', 'skills', 'caja'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.kiro', 'skills', 'caja', 'SKILL.md'),
    '---\nname: caja\ndescription: >-\n  Turnos y comandas de caja\nslash: caja\n---\n\n# Caja\n\n## Qué hace\n\nAbre el turno.\n',
    'utf8',
  );
  const listed = listWorkspaceSkills(root);
  assert.equal(listed.skills.length, 1);
  assert.equal(listed.skills[0].name, 'caja');
  assert.match(listed.skills[0].description, /Turnos y comandas/);
  assert.equal(listed.skills[0].bucket, 'kiro');

  const created = createWorkspaceSkill(root, {
    bucket: 'afn',
    name: 'Temas',
    description: 'Catálogo de temas: qué pantalla y qué no tocar',
  });
  assert.equal(created.ok, true);
  assert.match(created.rel.replace(/\\/g, '/'), /^\.afn\/skills\/temas\/SKILL\.md$/);
  assert.match(created.markdown, /# Temas/);

  const again = createWorkspaceSkill(root, { name: 'Temas', bucket: 'afn' });
  assert.equal(again.ok, false);
  assert.equal(again.error, 'exists');

  const saved = saveWorkspaceSkill(root, created.rel, `${created.markdown}\nDetalle de guardado.\n`);
  assert.equal(saved.ok, true);
  assert.match(saved.markdown, /Detalle de guardado/);
  const disk = fs.readFileSync(path.join(root, '.afn', 'skills', 'temas', 'SKILL.md'), 'utf8');
  assert.match(disk, /Detalle de guardado/);

  assert.equal(resolveSkillMarkdownPath(root, '../.kiro/skills/caja/SKILL.md'), null);
  assert.equal(resolveSkillMarkdownPath(root, '.kiro/skills/caja/notes.md'), null);
  assert.equal(saveWorkspaceSkill(root, '.afn/credentials/data-agent.json', 'x').ok, false);
  assert.equal(readWorkspaceSkill(root, '.kiro/skills/no-existe/SKILL.md').error, 'not_found');
  assert.equal(createWorkspaceSkill(root, { name: 'a' }).error, 'invalid_name');

  const html = fs.readFileSync(writeDashboard(root, { open: false }).file, 'utf8');
  assert.match(html, /data-view="skills"/);
  assert.match(html, /Nueva skill/);
  assert.match(html, /id="sk-text"/);
});

test('API del dashboard lista y edita una skill', async () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.afn'), { recursive: true });
  const info = await startDashboardServer(root, { port: 0 });
  try {
    const headers = { 'x-afn-token': info.token, 'content-type': 'application/json' };
    const created = await fetch(`http://127.0.0.1:${info.port}/api/skills`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        bucket: 'kiro',
        name: 'Caja turnos',
        description: 'Turnos y comandas',
      }),
    });
    const body = await created.json();
    assert.equal(created.status, 200);
    assert.equal(body.ok, true);
    assert.match(body.rel.replace(/\\/g, '/'), /^\.kiro\/skills\/caja-turnos\/SKILL\.md$/);
    const listed = await fetch(`http://127.0.0.1:${info.port}/api/skills`, { headers });
    const list = await listed.json();
    assert.equal(list.skills.length, 1);
    const put = await fetch(`http://127.0.0.1:${info.port}/api/skills/file`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ rel: body.rel, markdown: `${body.markdown}\nEditada en el dashboard.\n` }),
    });
    const saved = await put.json();
    assert.equal(saved.ok, true);
    assert.match(saved.markdown, /Editada en el dashboard/);
    const sneak = await fetch(`http://127.0.0.1:${info.port}/api/skills/file?rel=${encodeURIComponent('../../package.json')}`, {
      headers,
    });
    assert.equal(sneak.ok, false);
    const anon = await fetch(`http://127.0.0.1:${info.port}/api/skills`);
    assert.equal(anon.status, 401);
  } finally {
    stopDashboardServer(root);
  }
});
