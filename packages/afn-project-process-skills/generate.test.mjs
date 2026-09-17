import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  processKeyFromRelPath,
  clusterProcessSkillsFromPaths,
  renderProcessSkillMarkdown,
  buildProcessSkillsBundle,
} from './generate.mjs';

test('processKeyFromRelPath agrupa por carpeta de dominio, no por Common/hooks', () => {
  assert.equal(
    processKeyFromRelPath('src/components/Admin/SanColombia/Common/Caja/SanCajaTotalesYPago.jsx'),
    'caja',
  );
  assert.equal(
    processKeyFromRelPath('src/components/Admin/SanColombia/Temas/coloresTema.js'),
    'temas',
  );
  assert.equal(
    processKeyFromRelPath('src/components/Admin/SanColombia/estilos/coloresCajaSanColombia.js'),
    'sancolombia',
  );
  assert.equal(processKeyFromRelPath('.afn/notes/ui-caja-totales.md'), 'caja-totales');
  assert.equal(processKeyFromRelPath('src/components/Common/hooks/useFoo.js'), null);
});

test('clusterProcessSkillsFromPaths exige ≥2 archivos y recorta', () => {
  const paths = [
    'src/components/Caja/A.jsx',
    'src/components/Caja/B.jsx',
    'src/components/Temas/TemaA.jsx',
    'src/components/Temas/TemaB.jsx',
    'src/components/Temas/TemaC.jsx',
    'src/orphan/OnlyOne.jsx',
  ];
  const clusters = clusterProcessSkillsFromPaths(paths);
  assert.deepEqual(
    clusters.map((c) => c.id).sort(),
    ['caja', 'temas'],
  );
  const temas = clusters.find((c) => c.id === 'temas');
  assert.equal(temas.files.length, 3);
});

test('renderProcessSkillMarkdown declara puede / no puede y slash', () => {
  const md = renderProcessSkillMarkdown({
    id: 'caja',
    slash: 'caja',
    files: ['src/Caja/A.jsx', 'src/Caja/B.jsx'],
  });
  assert.match(md, /slash: caja/);
  assert.match(md, /Qué puede hacer/);
  assert.match(md, /Qué no puede hacer/);
  assert.match(md, /SanCajaTotalesYPago|src\/Caja\/A\.jsx/);
  assert.match(md, /`\/caja`/);
});

test('buildProcessSkillsBundle escribe process-caja', () => {
  const bundle = buildProcessSkillsBundle([
    'src/Caja/A.jsx',
    'src/Caja/B.jsx',
    'src/Temas/X.jsx',
    'src/Temas/Y.jsx',
  ]);
  assert.equal(bundle.skills.length, 2);
  assert.ok(bundle.skills.some((s) => s.folder === 'process-caja' && s.slash === 'caja'));
  assert.equal(bundle.index.count, 2);
});
