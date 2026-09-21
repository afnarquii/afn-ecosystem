import fs from 'node:fs';
import path from 'node:path';

const SKIP = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', 'vendor',
  '.next', 'venv', '.venv', '__pycache__', '.afn', '.kiro', '.cursor',
  'tools', 'miniverse', 'afnbd',
]);

function readText(file, max = 40_000) {
  try {
    return fs.readFileSync(file, 'utf8').slice(0, max);
  } catch {
    return '';
  }
}

function firstExisting(dir, names) {
  for (const n of names) {
    const abs = path.join(dir, n);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  return '';
}

function parsePrisma(src, file) {
  const entities = [];
  const re = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(src))) {
    const fields = [];
    const relations = [];
    for (const line of m[2].split('\n')) {
      const f = line.trim();
      if (!f || f.startsWith('//') || f.startsWith('@@')) continue;
      const parts = f.split(/\s+/);
      if (parts.length < 2) continue;
      fields.push(parts[0]);
      const typ = parts[1].replace(/\?$/, '');
      if (/\[\]/.test(parts[1]) || (/^[A-Z]/.test(typ) && !/^(String|Int|Boolean|DateTime|Float|Decimal|BigInt|Json|Bytes|Unsupported)/.test(typ))) {
        relations.push(`${parts[0]}:${parts[1]}`);
      }
    }
    entities.push({ name: m[1], fields: fields.slice(0, 12), relations: relations.slice(0, 8), file });
  }
  return entities;
}

function parseSqlTables(src, file) {
  const entities = [];
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"[]?(\w+)[`"\]]?/gi;
  let m;
  while ((m = re.exec(src))) {
    entities.push({ name: m[1], fields: [], relations: [], file });
  }
  return entities;
}

function parseOrmClasses(src, file) {
  const entities = [];
  const re = /class\s+(\w+)\s*\((?:models\.Model|Base|db\.Model)\)/g;
  let m;
  while ((m = re.exec(src))) {
    entities.push({ name: m[1], fields: [], relations: [], file });
  }
  return entities;
}

function parseOpenApi(src, file) {
  let json = null;
  try {
    json = JSON.parse(src);
  } catch {
    json = null;
  }
  const paths = [];
  const schemas = [];
  if (json && json.paths && typeof json.paths === 'object') {
    for (const [p, ops] of Object.entries(json.paths).slice(0, 40)) {
      const methods = ops && typeof ops === 'object' ? Object.keys(ops).filter((k) => /get|post|put|patch|delete|options|head/i.test(k)) : [];
      paths.push({ path: p, methods: methods.map((x) => x.toUpperCase()) });
    }
    const comps = json.components?.schemas || json.definitions || {};
    schemas.push(...Object.keys(comps).slice(0, 24));
    return { file, paths, schemas };
  }
  const yPaths = [...src.matchAll(/(?:^|\n)\s{1,4}(\/[\w\-{}]+)\s*:/g)].map((x) => x[1]);
  const ySch = [...src.matchAll(/(?:^|\n)\s{2,6}([A-Z][\w]+):\s*(?:\n|\s*\{)/g)].map((x) => x[1]);
  return {
    file,
    paths: [...new Set(yPaths)].slice(0, 40).map((p) => ({ path: p, methods: [] })),
    schemas: [...new Set(ySch)].slice(0, 24),
  };
}

function walkFiles(dir, acc, depth, pred) {
  if (depth > 4 || acc.length >= 36) return;
  let ents = [];
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of ents) {
    if (acc.length >= 36) return;
    if (e.name.startsWith('.')) continue;
    if (SKIP.has(e.name.toLowerCase())) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      walkFiles(abs, acc, depth + 1, pred);
      continue;
    }
    if (pred(e.name)) acc.push(abs);
  }
}

function topModules(dir) {
  const roots = ['src', 'app', 'lib', 'api', 'functions', 'prisma', 'sql', 'db'].filter((n) => fs.existsSync(path.join(dir, n)));
  return roots.slice(0, 8);
}

/**
 * Diseño de datos y contratos en un directorio. Solo lo que está en disco.
 * @param {string} dir
 */
export function scanDataDesign(dir) {
  const entities = [];
  let schemaFile = '';
  let schemaKind = '';

  const prisma = firstExisting(dir, ['prisma/schema.prisma', 'schema.prisma']);
  if (prisma) {
    const found = parsePrisma(readText(prisma), path.relative(dir, prisma).replace(/\\/g, '/') || 'schema.prisma');
    entities.push(...found);
    schemaFile = found[0]?.file || 'prisma/schema.prisma';
    schemaKind = 'prisma';
  }

  const sqlFiles = [];
  walkFiles(dir, sqlFiles, 0, (n) => /\.(sql)$/i.test(n));
  for (const f of sqlFiles.slice(0, 8)) {
    const rel = path.relative(dir, f).replace(/\\/g, '/');
    const found = parseSqlTables(readText(f, 20_000), rel);
    if (found.length && !schemaKind) {
      schemaKind = 'sql';
      schemaFile = rel;
    }
    entities.push(...found);
  }

  const ormFiles = [];
  walkFiles(dir, ormFiles, 0, (n) => /models?\.py$/i.test(n) || /models?\.(t|j)s$/i.test(n));
  for (const f of ormFiles.slice(0, 6)) {
    const rel = path.relative(dir, f).replace(/\\/g, '/');
    const found = parseOrmClasses(readText(f, 16_000), rel);
    if (found.length && !schemaKind) {
      schemaKind = 'orm';
      schemaFile = rel;
    }
    entities.push(...found);
  }

  const oaFile = firstExisting(dir, [
    'openapi.yaml', 'openapi.yml', 'openapi.json',
    'swagger.yaml', 'swagger.json', 'docs/openapi.yaml',
  ]);
  const openapi = oaFile
    ? parseOpenApi(readText(oaFile, 48_000), path.relative(dir, oaFile).replace(/\\/g, '/') || path.basename(oaFile))
    : { file: '', paths: [], schemas: [] };

  const seen = new Set();
  const uniq = [];
  for (const e of entities) {
    const k = e.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(e);
  }

  return {
    schemaKind,
    schemaFile,
    entities: uniq.slice(0, 24),
    openapi,
    modules: topModules(dir),
  };
}

/**
 * Archivos extra de rutas (src/routes, controllers) sin volcar el repo.
 * @param {string} dir
 * @returns {string[]}
 */
export function listRouteSourceFiles(dir) {
  const acc = [];
  walkFiles(dir, acc, 0, (n) =>
    /^(routes?|controller|handlers?|endpoints?|router)\./i.test(n)
    || /routes?\.(t|j)sx?$/i.test(n)
    || /controller\.(t|j)sx?$/i.test(n)
    || /urls\.py$/i.test(n)
    || /views\.py$/i.test(n),
  );
  return acc.slice(0, 20);
}

export { SKIP };
