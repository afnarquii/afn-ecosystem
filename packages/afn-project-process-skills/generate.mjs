/**
 * Genera skills de proceso a partir de rutas de archivos del proyecto.
 * Sin nombres de producto hardcodeados: agrupa por carpeta de dominio.
 *
 * Uso CLI:
 *   node generate.mjs --paths-json paths.json --outDir .afn/skills
 *   node generate.mjs --root /proyecto --outDir .afn/skills
 */

import {
  extractProcessSkillInsight,
  formatProcessSkillInsightMarkdown,
  selectProcessSkillSnippetRels,
  snippetCharBudget,
} from './insight.mjs';

export const AFN_PROCESS_SKILL_PREFIX = 'process-';
export const AFN_PROCESS_SKILLS_INDEX_REL = '.afn/skills/process-index.json';
export const AFN_PROCESS_SKILLS_MAX = 36;
export const AFN_PROCESS_SKILL_MAX_FILES = 18;

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

const ARCHIVE_PATH_SEGMENTS = new Set([
  'migracion',
  'migration',
  'legacy',
  'archive',
  'ejecutable',
  'android',
  'ios',
]);

export function isArchivedOrForeignAppRelPath(relPath) {
  const rel = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel) return false;
  const parts = rel.split('/').filter(Boolean);
  const first = String(parts[0] || '').toLowerCase();
  if (ARCHIVE_PATH_SEGMENTS.has(first)) return true;
  if (parts.some((p) => ARCHIVE_PATH_SEGMENTS.has(String(p).toLowerCase()))) return true;
  if (/mobile|mobil/i.test(first) && first !== 'src' && first !== 'app') return true;
  return false;
}

export function isWorkspacePrimaryRelPath(relPath) {
  const rel = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel || isArchivedOrForeignAppRelPath(rel)) return false;
  if (/^\.afn\/notes\//i.test(rel)) return true;
  return /^(src|app)\//i.test(rel);
}

export function filenameMatchesProcessId(relPath, processId) {
  const id = String(processId || '').trim().toLowerCase();
  if (!id || id.length < 3) return false;
  const base = String(relPath || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/\.[a-z0-9]+$/i, '');
  const tokens = base
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .split(/[-_]+/)
    .filter(Boolean);
  return tokens.includes(id);
}

export function scoreProcessSkillFile(relPath, processId) {
  const rel = String(relPath || '').replace(/\\/g, '/');
  let score = 0;
  if (isWorkspacePrimaryRelPath(rel)) score += 100;
  else if (!/^(src|app)\//i.test(rel) && /\/src\//i.test(rel)) score -= 40;
  if (isArchivedOrForeignAppRelPath(rel)) score -= 200;
  if (filenameMatchesProcessId(rel, processId)) score += 45;
  if (/Component\.(jsx|tsx|js|ts)$/i.test(rel)) score += 12;
  if (/Slice\.(js|ts)$/i.test(rel)) score += 8;
  const base = rel.split('/').pop() || '';
  const kebab = base
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
  const id = String(processId || '').toLowerCase();
  if (id && (kebab === `${id}-component` || kebab === `${id}-slice` || kebab === id)) score += 30;
  return score;
}

export function selectProcessSkillAnchorFiles(files, processId) {
  const list = (files || []).map((f) => String(f).replace(/\\/g, '/')).filter(Boolean);
  const primary = list.filter((f) => isWorkspacePrimaryRelPath(f));
  const usable = primary.length >= 2 ? primary : list.filter((f) => !isArchivedOrForeignAppRelPath(f));
  return [...usable].sort((a, b) => {
    const d = scoreProcessSkillFile(b, processId) - scoreProcessSkillFile(a, processId);
    if (d) return d;
    return a.localeCompare(b);
  });
}

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
  const all = [];
  for (const raw of relPaths || []) {
    const rel = String(raw || '').replace(/\\/g, '/');
    if (!rel || rel.includes('node_modules/')) continue;
    if (isArchivedOrForeignAppRelPath(rel)) continue;
    all.push(rel);
    const key = processKeyFromRelPath(rel);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, new Set());
    buckets.get(key).add(rel);
  }

  for (const rel of all) {
    for (const id of buckets.keys()) {
      if (!filenameMatchesProcessId(rel, id)) continue;
      buckets.get(id).add(rel);
    }
  }

  const clusters = [...buckets.entries()]
    .map(([id, set]) => ({
      id,
      slash: id,
      files: selectProcessSkillAnchorFiles([...set], id),
    }))
    .filter((c) => c.files.length >= 2)
    .sort((a, b) => b.files.length - a.files.length || a.id.localeCompare(b.id))
    .slice(0, AFN_PROCESS_SKILLS_MAX);

  return clusters;
}

/**
 * @param {{ id: string, slash: string, files: string[], insight?: object }} cluster
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
  const insight = cluster?.insight || extractProcessSkillInsight(cluster, cluster?.snippets || {});
  const insightMd = formatProcessSkillInsightMarkdown(insight);
  const routeHint = insight?.canonical ? ` Ruta: \`${insight.canonical}\`.` : '';

  return `---
name: ${folder}
slash: ${slash}
description: Cambios en el proceso «${id}» de este proyecto. Usar cuando el usuario pide ${id}, /${slash}, o «usa la skill ${id}».${routeHint}
user-invocable: true
managed: true
tags: [process, ${id}]
---

# Proceso: ${id}

Skill de **proceso** de este repo (no genérica). Leela **antes** de tocar código de «${id}».
${insightMd ? `\n${insightMd}\n` : ''}
## Qué puede hacer

- Cambiar UI, layout, estados y tests **solo** en los archivos ancla de este proceso (\`src/\` o \`app/\` del repo abierto).
- Crear un componente o flujo **dentro** de este proceso si el usuario lo pide (ej. «usa la skill ${id} y crea…»).
- Seguir convenciones ya presentes en esos archivos (nombres, estilos, store, tests).

## Qué no puede hacer

- Inventar pantallas, tablas, SPs o APIs **fuera** de las anclas.
- Tocar copias en \`migracion/\`, apps mobile anidadas u otros procesos salvo pedido explícito.
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
 * @param {{ snippets?: Record<string, string> }} [opts]
 * @returns {{ index: object, skills: Array<{ folder: string, relPath: string, content: string, slash: string }> }}
 */
export function buildProcessSkillsBundle(relPaths, opts = {}) {
  const clusters = clusterProcessSkillsFromPaths(relPaths);
  const snippets = opts.snippets && typeof opts.snippets === 'object' ? opts.snippets : {};
  const skills = clusters.map((c) => {
    const folder = `${AFN_PROCESS_SKILL_PREFIX}${c.id}`;
    const insight = extractProcessSkillInsight(c, snippets);
    return {
      folder,
      slash: c.slash,
      relPath: `.afn/skills/${folder}/SKILL.md`,
      content: renderProcessSkillMarkdown({ ...c, insight }),
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
  const out = { pathsJson: '', outDir: '', root: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--paths-json') out.pathsJson = String(argv[++i] || '');
    else if (a === '--outDir') out.outDir = String(argv[++i] || '');
    else if (a === '--root') out.root = String(argv[++i] || '');
  }
  return out;
}

const WALK_SKIP = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'migracion',
  'migration',
  'legacy',
  'archive',
  'ejecutable',
  'android',
  'ios',
]);

const WALK_EXT = /\.(jsx?|tsx?|mjs|cjs|vue|svelte|css|scss|less|md|py|cs|go|java)$/i;

async function walkRelPaths(root) {
  const { readdir } = await import('node:fs/promises');
  const { join, relative } = await import('node:path');
  const acc = [];
  async function walk(abs, depth) {
    if (acc.length >= 1500 || depth > 12) return;
    let entries = [];
    try {
      entries = await readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    const prefer = [];
    const rest = [];
    for (const e of entries) {
      const name = e.name;
      if (!name || name === '.' || name === '..') continue;
      const child = join(abs, name);
      const rel = relative(root, child).replace(/\\/g, '/');
      if (e.isDirectory()) {
        const n = name.toLowerCase();
        if (n.startsWith('.') && n !== '.afn') continue;
        if (WALK_SKIP.has(n)) continue;
        if (depth === 0 && /mobile|mobil/i.test(n) && n !== 'src' && n !== 'app') continue;
        if (rel.startsWith('.afn/') && !rel.startsWith('.afn/notes')) continue;
        if (depth === 0 && (n === 'src' || n === 'app')) prefer.push(child);
        else if (depth === 0 && n === '.afn') rest.push(child);
        else if (depth === 0) continue;
        else rest.push(child);
        continue;
      }
      if (/(?:^|\/)\.afn\/notes\/[^/]+\.md$/i.test(rel) || (WALK_EXT.test(name) && !rel.startsWith('.afn/'))) {
        acc.push(rel);
      }
    }
    for (const d of [...prefer, ...rest]) {
      if (acc.length >= 1500) break;
      await walk(d, depth + 1);
    }
  }
  await walk(root, 0);
  return acc;
}

async function readSnippetsFromRoot(root, relPaths, clusters) {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const rels = selectProcessSkillSnippetRels(relPaths, clusters);
  /** @type {Record<string, string>} */
  const out = {};
  for (const rel of rels) {
    try {
      const text = await readFile(join(root, rel), 'utf8');
      if (text) out[rel] = text.slice(0, snippetCharBudget(rel));
    } catch {
      /* skip */
    }
  }
  return out;
}

function normInclude(raw) {
  const rel = String(raw || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
  return rel;
}

/**
 * Recorre solo las carpetas elegidas. Las rutas quedan relativas al workspace, sin absolutas.
 * @param {string} root
 * @param {string[]} includes
 */
async function walkIncluded(root, includes) {
  const { readdir } = await import('node:fs/promises');
  const { join, relative } = await import('node:path');
  const acc = [];
  async function walk(abs, depth) {
    if (acc.length >= 1500 || depth > 12) return;
    let entries = [];
    try {
      entries = await readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (acc.length >= 1500) return;
      const name = e.name;
      if (!name || name === '.' || name === '..') continue;
      const child = join(abs, name);
      const rel = relative(root, child).replace(/\\/g, '/');
      if (e.isDirectory()) {
        const n = name.toLowerCase();
        if (n.startsWith('.') && n !== '.afn') continue;
        if (WALK_SKIP.has(n)) continue;
        if (rel.startsWith('.afn/') && !rel.startsWith('.afn/notes')) continue;
        await walk(child, depth + 1);
        continue;
      }
      if (/(?:^|\/)\.afn\/notes\/[^/]+\.md$/i.test(rel) || (WALK_EXT.test(name) && !rel.startsWith('.afn/'))) {
        acc.push(rel);
      }
    }
  }
  for (const raw of includes) {
    const rel = normInclude(raw);
    if (!rel || rel === '.') {
      await walk(root, 0);
      continue;
    }
    await walk(join(root, rel), 1);
  }
  return acc;
}

/**
 * Escribe `.afn/skills/process-*` desde el árbol. Sin modelo y sin rutas de la máquina.
 * @param {string} root
 * @param {{ include?: string[], outDir?: string, paths?: string[] }} [opts]
 */
/** Conserva REGLAS.md de la carpeta al regenerar el SKILL.md. */
export function skillMarkdownConReglas(generated, reglas) {
  const extra = String(reglas || '').trim();
  if (!extra) return generated;
  if (String(generated).includes(extra)) return generated;
  return `${String(generated).trimEnd()}\n\n${extra}\n`;
}

export async function writeProcessSkills(root, opts = {}) {
  const { mkdir, writeFile, readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const include = (Array.isArray(opts.include) ? opts.include : []).map(normInclude).filter(Boolean);
  let paths = Array.isArray(opts.paths) ? opts.paths : [];
  if (!paths.length) {
    paths = include.length ? await walkIncluded(root, include) : await walkRelPaths(root);
  }
  const clusters = clusterProcessSkillsFromPaths(paths);
  const snippets = root ? await readSnippetsFromRoot(root, paths, clusters) : {};
  const bundle = buildProcessSkillsBundle(paths, { snippets });
  const outDir = opts.outDir || join(root, '.afn', 'skills');
  for (const s of bundle.skills) {
    const dir = join(outDir, s.folder);
    await mkdir(dir, { recursive: true });
    let reglas = '';
    try {
      reglas = await readFile(join(dir, 'REGLAS.md'), 'utf8');
    } catch {
      reglas = '';
    }
    await writeFile(join(dir, 'SKILL.md'), skillMarkdownConReglas(s.content, reglas), 'utf8');
  }
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'process-index.json'), `${JSON.stringify(bundle.index, null, 2)}\n`, 'utf8');
  return {
    ok: true,
    count: bundle.skills.length,
    outDir,
    slashes: bundle.skills.map((s) => s.slash),
  };
}

async function mainCli() {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const args = parseArgs(process.argv);
  if (!args.pathsJson && !args.root) {
    console.error('Uso: node generate.mjs --root /proyecto [--outDir .afn/skills]');
    console.error('   o: node generate.mjs --paths-json paths.json [--root /proyecto] [--outDir .afn/skills]');
    process.exit(1);
  }
  let paths = [];
  if (args.pathsJson) {
    const raw = JSON.parse(await readFile(args.pathsJson, 'utf8'));
    paths = Array.isArray(raw) ? raw : raw.paths || [];
  }
  const written = await writeProcessSkills(args.root || process.cwd(), {
    paths,
    outDir: args.outDir || (args.root ? join(args.root, '.afn', 'skills') : '.afn/skills'),
  });
  console.log(`OK ${written.count} skills → ${written.outDir}`);
}

const isMain = process.argv[1] && String(process.argv[1]).includes('generate.mjs');
if (isMain) {
  mainCli().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
