/**
 * Genera skills de proceso a partir de rutas de archivos del proyecto.
 * Sin nombres de producto hardcodeados: agrupa por carpeta de dominio.
 *
 * Uso CLI:
 *   node generate.mjs --paths-json paths.json --outDir .afn/skills
 */

export const AFN_PROCESS_SKILL_PREFIX = 'process-';
export const AFN_PROCESS_SKILLS_INDEX_REL = '.afn/skills/process-index.json';
export const AFN_PROCESS_SKILLS_MAX = 36;
export const AFN_PROCESS_SKILL_MAX_FILES = 14;

const SKIP_DIR = new Set([
  'common',
  'hooks',
  'utils',
  '__tests__',
  'test',
  'tests',
  'styles',
  'estilos',
  'contexts',
  'context',
  'assets',
  'images',
  'css',
  'shared',
  'lib',
  'internal',
  'node_modules',
  'dist',
  'build',
  'public',
  'scripts',
  'types',
  'fixtures',
  'mocks',
  'components',
  'pages',
  'views',
  'src',
  'app',
  'admin',
  'frontend',
  'backend',
  'client',
  'server',
  'api',
  'core',
  'ui',
  'layout',
  'modals',
  'dialogs',
  'screens',
  'routes',
]);

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function slugProcessId(raw) {
  return String(raw || '')
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/^ui[-_]/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/**
 * @param {string} relPath
 * @returns {string|null}
 */
export function processKeyFromRelPath(relPath) {
  const rel = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel) return null;

  const note = rel.match(/(?:^|\/)\.afn\/notes\/(?:ui-)?([^/]+)\.md$/i);
  if (note) {
    const slug = slugProcessId(note[1]);
    return slug || null;
  }

  const parts = rel.split('/').filter(Boolean);
  parts.pop();
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const name = parts[i];
    const n = name.toLowerCase();
    if (!n || SKIP_DIR.has(n)) continue;
    if (n.startsWith('__')) continue;
    if (n.length < 3) continue;
    const slug = slugProcessId(name);
    if (slug && slug.length >= 3) return slug;
  }
  return null;
}

/**
 * @param {string[]} relPaths
 * @returns {Array<{ id: string, slash: string, files: string[] }>}
 */
export function clusterProcessSkillsFromPaths(relPaths) {
  /** @type {Map<string, Set<string>>} */
  const buckets = new Map();
  for (const raw of relPaths || []) {
    const rel = String(raw || '').replace(/\\/g, '/');
    if (!rel || rel.includes('node_modules/')) continue;
    const key = processKeyFromRelPath(rel);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, new Set());
    buckets.get(key).add(rel);
  }

  const clusters = [...buckets.entries()]
    .map(([id, set]) => ({
      id,
      slash: id,
      files: [...set].sort(),
    }))
    .filter((c) => c.files.length >= 2)
    .sort((a, b) => b.files.length - a.files.length || a.id.localeCompare(b.id))
    .slice(0, AFN_PROCESS_SKILLS_MAX);

  return clusters;
}

/**
 * @param {{ id: string, slash: string, files: string[] }} cluster
 * @returns {string}
 */
export function renderProcessSkillMarkdown(cluster) {
  const id = String(cluster?.id || '').trim();
  const slash = String(cluster?.slash || id).trim() || id;
  const folder = `${AFN_PROCESS_SKILL_PREFIX}${id}`;
  const files = (cluster?.files || []).slice(0, AFN_PROCESS_SKILL_MAX_FILES);
  const extra = Math.max(0, (cluster?.files || []).length - files.length);
  const fileList = files.map((f) => `- \`${f}\``).join('\n');
  const more = extra > 0 ? `\n- _(+${extra} archivos más en este proceso)_` : '';

  return `---
name: ${folder}
slash: ${slash}
description: Cambios en el proceso «${id}» de este proyecto. Usar cuando el usuario pide ${id}, /${slash}, o «usa la skill ${id}».
user-invocable: true
managed: true
tags: [process, ${id}]
---

# Proceso: ${id}

Skill de **proceso** de este repo (no genérica). Leela **antes** de tocar código de «${id}».

## Qué puede hacer

- Cambiar UI, layout, estados y tests **solo** en los archivos ancla de este proceso.
- Crear un componente o flujo **dentro** de este proceso si el usuario lo pide (ej. «usa la skill ${id} y crea…»).
- Seguir convenciones ya presentes en esos archivos (nombres, estilos, store, tests).

## Qué no puede hacer

- Inventar pantallas, tablas, SPs o APIs **fuera** de las anclas.
- Tocar otros procesos (otra carpeta de dominio) salvo que el usuario lo pida explícitamente.
- Hardcodear datos de demo / otro producto.
- Saltar SDD si el change es grande: entonces spec primero.

## Archivos ancla

${fileList || '- _(sin archivos)_'}${more}

## Cómo invocarlo

En AFN IDE / chat:

- \`/${slash}\`
- «usa la skill ${id} y …»
- \`@skill ${folder}\`

Cuando el usuario nombra esta skill, **no** improvises fuera de estas anclas.
`;
}

/**
 * @param {string[]} relPaths
 * @returns {{ index: object, skills: Array<{ folder: string, relPath: string, content: string, slash: string }> }}
 */
export function buildProcessSkillsBundle(relPaths) {
  const clusters = clusterProcessSkillsFromPaths(relPaths);
  const skills = clusters.map((c) => {
    const folder = `${AFN_PROCESS_SKILL_PREFIX}${c.id}`;
    return {
      folder,
      slash: c.slash,
      relPath: `.afn/skills/${folder}/SKILL.md`,
      content: renderProcessSkillMarkdown(c),
      fileCount: c.files.length,
    };
  });
  const index = {
    version: 1,
    generatedAt: new Date().toISOString(),
    count: skills.length,
    skills: skills.map((s) => ({
      folder: s.folder,
      slash: s.slash,
      fileCount: s.fileCount,
    })),
  };
  return { index, skills };
}

function parseArgs(argv) {
  const out = { pathsJson: '', outDir: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--paths-json') out.pathsJson = String(argv[++i] || '');
    else if (a === '--outDir') out.outDir = String(argv[++i] || '');
  }
  return out;
}

async function mainCli() {
  const { readFile, mkdir, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const args = parseArgs(process.argv);
  if (!args.pathsJson) {
    console.error('Uso: node generate.mjs --paths-json paths.json [--outDir .afn/skills]');
    process.exit(1);
  }
  const raw = JSON.parse(await readFile(args.pathsJson, 'utf8'));
  const paths = Array.isArray(raw) ? raw : raw.paths || [];
  const bundle = buildProcessSkillsBundle(paths);
  const outDir = args.outDir || '.afn/skills';
  for (const s of bundle.skills) {
    const dir = join(outDir, s.folder);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'SKILL.md'), s.content, 'utf8');
  }
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'process-index.json'), `${JSON.stringify(bundle.index, null, 2)}\n`, 'utf8');
  console.log(`OK ${bundle.skills.length} skills → ${outDir}`);
}

const isMain = process.argv[1] && String(process.argv[1]).includes('generate.mjs');
if (isMain) {
  mainCli().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
