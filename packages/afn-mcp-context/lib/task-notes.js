import fs from 'node:fs';
import path from 'node:path';
import { afnPath } from './paths.js';

const STATUSES = new Set(['draft', 'listo', 'aprobado']);
const MAX_NOTE_CHARS = 80_000;

export function taskNotesDir(root) {
  return afnPath(root, 'notes', 'tareas');
}

export function slugifyTask(raw) {
  const s = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return s || 'tarea';
}

function safeFile(raw) {
  const s = String(raw || 'readme.md');
  if (/[\\/]/.test(s) || s.includes('..')) return null;
  const base = path.basename(s).toLowerCase();
  const name = base.endsWith('.md') ? base : `${base}.md`;
  if (!/^[a-z0-9][a-z0-9._-]{0,80}\.md$/.test(name)) return null;
  return name;
}

function metaPath(dir) {
  return path.join(dir, 'meta.json');
}

function readMeta(dir, slug) {
  try {
    const j = JSON.parse(fs.readFileSync(metaPath(dir), 'utf8'));
    return {
      slug,
      title: String(j?.title || slug),
      status: STATUSES.has(j?.status) ? j.status : 'draft',
      createdAt: String(j?.createdAt || ''),
      updatedAt: String(j?.updatedAt || ''),
    };
  } catch {
    return { slug, title: slug, status: 'draft', createdAt: '', updatedAt: '' };
  }
}

function writeMeta(dir, meta) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(metaPath(dir), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git']);
const MAX_NOTE_READ = 200_000;
const MAX_NOTE_FILES = 400;
const MAX_NOTE_DEPTH = 8;

function isNoteFile(name) {
  if (!name || name.startsWith('.')) return false;
  if (name.toLowerCase() === 'meta.json') return false;
  return true;
}

/** @param {string} name */
export function noteKindFromName(name) {
  const base = String(name || '').split('/').pop().split('\\').pop().toLowerCase();
  if (/\.(html|htm)$/.test(base)) return 'html';
  if (/\.pdf$/.test(base)) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/.test(base)) return 'image';
  if (/\.(txt|json|csv|xml|ya?ml|log|css|sql)$/.test(base)) return 'text';
  if (/\.(js|mjs|cjs|py)$/.test(base)) return 'script';
  if (/\.(md|markdown)$/.test(base) || base === 'readme') return 'markdown';
  return 'file';
}

/** Tipo que el navegador necesita para mostrar el archivo, no solo descargarlo. */
export function noteMime(name, kind) {
  const base = String(name || '').split('/').pop().split('\\').pop().toLowerCase();
  const k = kind || noteKindFromName(base);
  if (k === 'pdf' || base.endsWith('.pdf')) return 'application/pdf';
  if (k === 'html' || /\.html?$/.test(base)) return 'text/html; charset=utf-8';
  if (k === 'markdown' || /\.(md|markdown)$/.test(base) || base === 'readme') return 'text/markdown; charset=utf-8';
  if (k === 'text' || /\.(txt|json|csv|xml|ya?ml|log|css|sql)$/.test(base)) return 'text/plain; charset=utf-8';
  if (base.endsWith('.py')) return 'text/plain; charset=utf-8';
  if (k === 'script' || /\.(mjs|cjs|js)$/.test(base)) return 'text/javascript; charset=utf-8';
  if (base.endsWith('.png')) return 'image/png';
  if (/\.jpe?g$/.test(base)) return 'image/jpeg';
  if (base.endsWith('.gif')) return 'image/gif';
  if (base.endsWith('.webp')) return 'image/webp';
  if (base.endsWith('.svg')) return 'image/svg+xml';
  if (base.endsWith('.bmp')) return 'image/bmp';
  if (base.endsWith('.ico')) return 'image/x-icon';
  if (base.endsWith('.avif')) return 'image/avif';
  return 'application/octet-stream';
}

export function isTextNoteName(name) {
  const kind = noteKindFromName(name);
  return kind === 'html' || kind === 'markdown';
}

function entryKind(dir, ent) {
  if (ent.isSymbolicLink()) return 'link';
  if (ent.isDirectory()) return 'dir';
  if (ent.isFile()) return 'file';
  try {
    const st = fs.statSync(path.join(dir, ent.name));
    if (st.isDirectory()) return 'dir';
    if (st.isFile()) return 'file';
  } catch {
    /* */
  }
  return 'other';
}

/** Markdown y README (con o sin extensión) dentro de una carpeta, también en subcarpetas. */
function walkNoteFiles(dir, rel, depth, acc) {
  if (depth > MAX_NOTE_DEPTH || acc.length >= MAX_NOTE_FILES) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const dirs = [];
  const files = [];
  for (const ent of entries) {
    if (!ent.name || ent.name.startsWith('.') || SKIP_DIRS.has(ent.name)) continue;
    const kind = entryKind(dir, ent);
    if (kind === 'dir') dirs.push(ent);
    else if (kind === 'file' && isNoteFile(ent.name)) files.push(ent);
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  for (const ent of files) {
    if (acc.length >= MAX_NOTE_FILES) return;
    const relPosix = (rel ? `${rel}/${ent.name}` : ent.name).split('\\').join('/');
    acc.push({ abs: path.join(dir, ent.name), rel: relPosix });
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  for (const ent of dirs) {
    walkNoteFiles(path.join(dir, ent.name), rel ? `${rel}/${ent.name}` : ent.name, depth + 1, acc);
  }
}

function docRank(rel) {
  const base = String(rel || '').split('/').pop().toLowerCase();
  if (base === 'readme.md' || base === 'readme' || base === 'readme.markdown') return 0;
  if (base.startsWith('readme')) return 1;
  return 2;
}

function readNoteFile(abs, rel) {
  let text = '';
  let mtime = '';
  let bytes = 0;
  const kind = noteKindFromName(rel);
  try {
    const st = fs.statSync(abs);
    mtime = st.mtime.toISOString();
    bytes = st.size;
    if (kind === 'html' || kind === 'markdown' || kind === 'text' || kind === 'script') text = fs.readFileSync(abs, 'utf8');
  } catch {
    text = '';
  }
  if (text.length > MAX_NOTE_READ) text = `${text.slice(0, MAX_NOTE_READ)}\n\n_(recortado)_\n`;
  const base = String(rel || '').split('/').pop() || 'nota';
  let title = '';
  if (kind === 'html') {
    const fromTitle = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    const fromH1 = text.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    title = (fromTitle?.[1] || fromH1?.[1] || '').trim();
  }
  if (!title) {
    const first = text.split('\n').find((l) => l.startsWith('# ')) || '';
    title = first.replace(/^#\s+/, '').trim();
  }
  return {
    name: rel,
    kind,
    title: title || base.replace(/\.(md|markdown|html|htm)$/i, '') || base,
    chars: kind === 'html' || kind === 'markdown' || kind === 'text' || kind === 'script' ? text.length : bytes,
    mtime,
    text,
  };
}

function noteDiskPath(groupRel, name) {
  const rel = String(groupRel || '').split('\\').join('/');
  const base = rel.split('/').pop() || '';
  const loose = /\.[a-z0-9]{1,12}$/i.test(base) || /^readme$/i.test(base);
  if (loose && base.toLowerCase() !== 'meta.json') return rel;
  return `${rel.replace(/\/$/, '')}/${name}`;
}

function finishGroup(dir, slug, rel, rawDocs, includeBody) {
  if (!rawDocs.length) return null;
  const meta = readMeta(dir, slug);
  const hasMeta = fs.existsSync(metaPath(dir));
  const newest = rawDocs.map((d) => d.mtime).filter(Boolean).sort().pop() || '';
  const updatedAt = [meta.updatedAt, newest].filter(Boolean).sort().pop() || '';
  return {
    slug,
    title: hasMeta ? meta.title : slug,
    status: meta.status,
    createdAt: meta.createdAt || newest,
    updatedAt,
    rel,
    docs: rawDocs.map((d) => {
      const item = {
        name: d.name,
        title: d.title,
        chars: d.chars,
        kind: d.kind || noteKindFromName(d.name),
        file: noteDiskPath(rel, d.name),
      };
      if (includeBody) item.markdown = d.text;
      return item;
    }),
  };
}

function groupFromDir(dir, slug, rel, includeBody) {
  const found = [];
  walkNoteFiles(dir, '', 0, found);
  const raw = found
    .map((f) => readNoteFile(f.abs, f.rel))
    .sort((a, b) => docRank(a.name) - docRank(b.name) || a.name.localeCompare(b.name));
  return finishGroup(dir, slug, rel, raw, includeBody);
}

/**
 * Toda nota bajo `.afn/notes/`: carpetas de tareas con cualquier nombre,
 * README anidado y markdown suelto. No exige slug en minúsculas.
 * @param {string} root
 * @param {{ includeBody?: boolean }} [opts]
 */
export function listTaskNotes(root, opts = {}) {
  const includeBody = opts.includeBody === true;
  const notesRoot = afnPath(root, 'notes');
  let top = [];
  try {
    top = fs.readdirSync(notesRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const used = new Set();
  const groups = [];
  const takeSlug = (raw) => {
    const base = String(raw || 'nota').slice(0, 160) || 'nota';
    if (!used.has(base)) {
      used.add(base);
      return base;
    }
    let i = 2;
    while (used.has(`${base}-${i}`)) i += 1;
    const next = `${base}-${i}`;
    used.add(next);
    return next;
  };
  const pushDir = (dir, slugHint, rel) => {
    const group = groupFromDir(dir, takeSlug(slugHint), rel, includeBody);
    if (group) groups.push(group);
  };
  const pushFile = (abs, slugHint, rel) => {
    const raw = [readNoteFile(abs, path.posix.basename(rel))];
    const group = finishGroup(path.dirname(abs), takeSlug(slugHint), rel, raw, includeBody);
    if (group) groups.push(group);
  };

  for (const ent of top) {
    if (!ent.name || ent.name.startsWith('.')) continue;
    const abs = path.join(notesRoot, ent.name);
    const kind = entryKind(notesRoot, ent);
    if (kind === 'dir' && ent.name.toLowerCase() === 'tareas') {
      let children = [];
      try {
        children = fs.readdirSync(abs, { withFileTypes: true });
      } catch {
        children = [];
      }
      for (const ch of children) {
        if (!ch.name || ch.name.startsWith('.')) continue;
        const childAbs = path.join(abs, ch.name);
        const childKind = entryKind(abs, ch);
        const rel = `.afn/notes/tareas/${ch.name}`;
        if (childKind === 'dir') pushDir(childAbs, ch.name, rel);
        else if (childKind === 'file' && isNoteFile(ch.name)) {
          pushFile(childAbs, ch.name.replace(/\.[^.]+$/, '') || ch.name, rel);
        }
      }
      continue;
    }
    if (kind === 'dir') pushDir(abs, ent.name, `.afn/notes/${ent.name}`);
    else if (kind === 'file' && isNoteFile(ent.name)) {
      pushFile(abs, ent.name.replace(/\.[^.]+$/, '') || ent.name, `.afn/notes/${ent.name}`);
    }
  }
  return groups.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.title.localeCompare(b.title));
}

/**
 * Guarda un markdown de entrega (varios por tarea). No es ARQUITECTURA.md ni el cerebro.
 * @param {string} root
 * @param {object} input
 */
export function saveTaskNote(root, input = {}) {
  const slug = slugifyTask(input.task || input.title);
  const file = safeFile(input.filename || input.file || 'readme.md');
  if (!file) return { ok: false, error: 'nombre de archivo inválido' };
  let markdown = String(input.markdown || input.text || '').trim();
  if (!markdown) return { ok: false, error: 'markdown vacío' };
  if (markdown.length > MAX_NOTE_CHARS) markdown = `${markdown.slice(0, MAX_NOTE_CHARS)}\n\n_(recortado)_\n`;
  const dir = path.join(taskNotesDir(root), slug);
  fs.mkdirSync(dir, { recursive: true });
  const prev = readMeta(dir, slug);
  const now = new Date().toISOString();
  const title = String(input.title || prev.title || slug).trim().slice(0, 160);
  let status = String(input.status || prev.status || 'draft').toLowerCase();
  if (!STATUSES.has(status)) status = 'draft';
  const meta = {
    slug,
    title,
    status,
    createdAt: prev.createdAt || now,
    updatedAt: now,
  };
  fs.writeFileSync(path.join(dir, file), markdown.endsWith('\n') ? markdown : `${markdown}\n`, 'utf8');
  writeMeta(dir, meta);
  return {
    ok: true,
    slug,
    file,
    rel: path.posix.join('.afn/notes/tareas', slug, file),
    status,
    title,
    hint: 'Quedó en .afn/notes/tareas. Dashboard → Notas (CLI: node … dashboard notas). No mezclar con ARQUITECTURA.md.',
  };
}

/**
 * Copia un .md del disco al wiki de tareas. Sin LLM.
 * @param {string} root
 * @param {string} filePath
 */
export function saveTaskNoteFromFile(root, filePath) {
  const raw = String(filePath || '').trim().replace(/^["']|["']$/g, '');
  if (!raw) return { ok: false, error: 'indica el archivo .md' };
  const candidates = [path.resolve(process.cwd(), raw), path.resolve(root, raw)];
  if (path.isAbsolute(raw)) candidates.unshift(raw);
  const file = candidates.find((f) => {
    try {
      return fs.existsSync(f) && fs.statSync(f).isFile();
    } catch {
      return false;
    }
  });
  if (!file) return { ok: false, error: `no existe ${raw}` };
  const markdown = fs.readFileSync(file, 'utf8');
  const base = path.basename(file);
  const stem = base.replace(/\.md$/i, '');
  return saveTaskNote(root, { task: stem, title: stem, filename: base, markdown });
}

/**
 * @param {string} root
 * @param {string} task
 * @param {string} status
 */
export function setTaskNoteStatus(root, task, status) {
  const slug = slugifyTask(task);
  const next = String(status || '').toLowerCase();
  if (!STATUSES.has(next)) return { ok: false, error: 'status: draft | listo | aprobado' };
  const dir = path.join(taskNotesDir(root), slug);
  if (!fs.existsSync(dir)) return { ok: false, error: `no hay notas para ${slug}` };
  const prev = readMeta(dir, slug);
  const meta = { ...prev, status: next, updatedAt: new Date().toISOString() };
  writeMeta(dir, meta);
  return { ok: true, slug, status: next, title: meta.title };
}

function touchNoteMeta(notesRoot, startDir) {
  let dir = startDir;
  while (dir && dir !== notesRoot) {
    const rel = path.relative(notesRoot, dir);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) break;
    if (fs.existsSync(metaPath(dir))) {
      const prev = readMeta(dir, path.basename(dir));
      writeMeta(dir, { ...prev, updatedAt: new Date().toISOString() });
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

/**
 * Sobrescribe una nota que ya está en `.afn/notes/`. Markdown o HTML.
 * @param {string} root
 * @param {string} rel
 * @param {string} text
 */
export function saveExistingNote(root, rel, text) {
  const notesRoot = path.resolve(afnPath(root, 'notes'));
  let raw = String(rel || '').trim().replace(/\\/g, '/');
  if (raw.startsWith('./')) raw = raw.slice(2);
  if (raw.toLowerCase().startsWith('.afn/notes/')) raw = raw.slice('.afn/notes/'.length);
  if (!raw || raw.split('/').some((part) => !part || part === '.' || part === '..')) {
    return { ok: false, error: 'ruta inválida' };
  }
  const abs = path.resolve(notesRoot, ...raw.split('/'));
  const inside = path.relative(notesRoot, abs);
  if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) return { ok: false, error: 'ruta inválida' };
  if (!isTextNoteName(path.basename(abs))) return { ok: false, error: 'solo markdown o html' };
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    return { ok: false, error: 'no existe' };
  }
  if (!st.isFile()) return { ok: false, error: 'no existe' };
  const body = String(text ?? '');
  if (body.length > MAX_NOTE_READ) return { ok: false, error: 'demasiado largo' };
  fs.writeFileSync(abs, body, 'utf8');
  touchNoteMeta(notesRoot, path.dirname(abs));
  const posix = inside.split(path.sep).join('/');
  return { ok: true, path: `.afn/notes/${posix}`, kind: noteKindFromName(path.basename(abs)) };
}

const MAX_NOTE_DOWNLOAD = 40_000_000;

/**
 * Archivo real dentro de `.afn/notes/` para descargarlo (readme, html, pdf u otro).
 * @param {string} root
 * @param {string} rel
 */
export function resolveNoteFile(root, rel) {
  const notesRoot = path.resolve(afnPath(root, 'notes'));
  let raw = String(rel || '').trim().replace(/\\/g, '/');
  if (raw.startsWith('./')) raw = raw.slice(2);
  if (raw.toLowerCase().startsWith('.afn/notes/')) raw = raw.slice('.afn/notes/'.length);
  if (!raw || raw.split('/').some((part) => !part || part === '.' || part === '..')) {
    return { ok: false, error: 'ruta inválida' };
  }
  const abs = path.resolve(notesRoot, ...raw.split('/'));
  const inside = path.relative(notesRoot, abs);
  if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) return { ok: false, error: 'ruta inválida' };
  const base = path.basename(abs);
  if (!isNoteFile(base)) return { ok: false, error: 'archivo no descargable' };
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    return { ok: false, error: 'no existe' };
  }
  if (!st.isFile()) return { ok: false, error: 'no existe' };
  if (st.size > MAX_NOTE_DOWNLOAD) return { ok: false, error: 'demasiado grande' };
  const posix = inside.split(path.sep).join('/');
  return {
    ok: true,
    abs,
    name: base,
    kind: noteKindFromName(base),
    path: `.afn/notes/${posix}`,
    size: st.size,
  };
}
