import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { writeDashboard } from '../lib/dashboard.js';

test('el script del dashboard compila', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'afn-syn-'));
  fs.mkdirSync(path.join(root, '.afn'), { recursive: true });
  const file = writeDashboard(root, { open: false }).file;
  const html = fs.readFileSync(file, 'utf8');
  const parts = html.split('<script type="module">');
  assert.equal(parts.length >= 2, true);
  const script = parts[1].split('</script>')[0].replace(
    /import mermaid from[\s\S]*?;/,
    'const mermaid = { initialize() {} };',
  );
  const out = path.join(root, 'dash.mjs');
  fs.writeFileSync(out, script);
  const check = spawnSync(process.execPath, ['--check', out], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
});
