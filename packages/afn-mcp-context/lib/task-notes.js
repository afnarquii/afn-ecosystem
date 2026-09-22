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

function listMdFiles(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
      .sort();
  } catch {
    return [];
  }
}

/**
 * @param {string} root
 * @param {{ includeBody?: boolean }} [opts]
 */
export function listTaskNotes(root, opts = {}) {
  const base = taskNotesDir(root);
  let slugs = [];
  try {
    slugs = fs
      .readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((n) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(n));
  } catch {
    return [];
  }
  const includeBody = opts.includeBody === true;
  return slugs
    .map((slug) => {
      const dir = path.join(base, slug);
      const meta = readMeta(dir, slug);
      const docs = listMdFiles(dir).map((name) => {
        const text = fs.readFileSync(path.join(dir, name), 'utf8');
        const first = text.split('\n').find((l) => l.startsWith('# ')) || '';
        const item = {
          name,
          title: first.replace(/^#\s+/, '').trim() || name.replace(/\.md$/, ''),
          chars: text.length,
        };
        if (includeBody) item.markdown = text;
        return item;
      });
      return { ...meta, docs };
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
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
