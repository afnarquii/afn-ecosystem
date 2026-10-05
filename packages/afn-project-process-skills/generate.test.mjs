import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  processKeyFromRelPath,
  clusterProcessSkillsFromPaths,
  renderProcessSkillMarkdown,
  buildProcessSkillsBundle,
  skillMarkdownConReglas,
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

test('clusterProcessSkillsFromPaths ignora migracion/mobile y prioriza src/', () => {
  const clusters = clusterProcessSkillsFromPaths([
    'migracion/san-front/src/pages/caja/caja.ts',
    'migracion/san-front/src/pages/caja/caja.scss',
    'san-colombia-mobile/src/components/Caja/CajaCarrito.jsx',
    'san-colombia-mobile/src/components/Caja/CajaTotales.jsx',
    'src/components/Admin/SanColombia/Common/Caja/SanCajaTotalesYPago.jsx',
    'src/components/Admin/SanColombia/Common/Caja/SanCajaFormasPago.jsx',
    'src/components/Admin/SanColombia/Salon/CajaComponent.jsx',
  ]);
  const caja = clusters.find((c) => c.id === 'caja');
  assert.ok(caja);
  assert.ok(caja.files.every((f) => f.startsWith('src/')));
  assert.ok(caja.files.some((f) => f.includes('CajaComponent.jsx')));
  assert.ok(!caja.files.some((f) => f.startsWith('migracion/')));
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

test('renderProcessSkillMarkdown incluye insight de snippets', () => {
  const md = renderProcessSkillMarkdown({
    id: 'caja',
    slash: 'caja',
    files: ['src/Caja/CajaComponent.jsx', 'src/Caja/B.jsx'],
    snippets: {
      'src/App.jsx': '<Route path="/app/*" element={<Layout />} />',
      'src/Rutas.jsx': '<Route path="/caja" element={<CajaComponent />} />',
      'src/Caja/CajaComponent.jsx': '/** Cobra la venta actual. */\nfunction CajaComponent({ mesaId }) { useAppSelector(selectTotal); dispatch(limpiar()); }',
    },
  });
  assert.match(md, /Rutas en la app/);
  assert.match(md, /\/app\/caja/);
  assert.match(md, /Cobra la venta/);
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

test('skillMarkdownConReglas pega REGLAS.md y no lo duplica', () => {
  const generado = '# Proceso: caja\n\nTexto.\n';
  const reglas = '## Cálculo de impuesto (no romper)\n\nNo sumar el 8.\n';
  const una = skillMarkdownConReglas(generado, reglas);
  assert.match(una, /No sumar el 8/);
  assert.equal(skillMarkdownConReglas(una, reglas), una);
  assert.equal(skillMarkdownConReglas(generado, '   '), generado);
});
