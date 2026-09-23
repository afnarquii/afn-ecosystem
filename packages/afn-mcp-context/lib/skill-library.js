/**
 * Skills del workspace (Kiro / AFN / Copilot) para el dashboard local.
 * Solo lee y escribe SKILL.md dentro de las carpetas permitidas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { slugify } from './paths.js';

export const SKILL_BUCKETS = Object.freeze([
  { id: 'kiro', dir: '.kiro/skills', label: 'Kiro' },
  { id: 'afn', dir: '.afn/skills', label: 'AFN' },
  { id: 'copilot', dir: '.github/skills', label: 'Copilot' },
]);

const MAX_SKILL_CHARS = 180_000;

/**
 * @param {string} value
 */
function yamlScalar(value) {
  const v = String(value || '').replace(/\r?\n/g, ' ').trim();
  if (!v) return '""';
  if (/[:#]|"|^\s|\s$/.test(v)) return JSON.stringify(v);
  return v;
}

/**
 * @param {string} markdown
 */
export function parseSkillDocument(markdown) {
  const text = String(markdown || '').replace(/^\uFEFF/, '');
  const fence = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  /** @type {Record<string, string>} */
  const meta = {};
  let body = text;
  if (fence) {
    const lines = fence[1].split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i]);
      if (!kv) continue;
      let v = kv[2].trim();
      if (v === '>-' || v === '>' || v === '|' || v === '|-') {
        const parts = [];
        const block = v.startsWith('|');
        while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) {
          i += 1;
          parts.push(lines[i].trim());
        }
        v = parts.join(block ? '\n' : ' ');
      } else if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      meta[kv[1]] = v;
    }
    body = text.slice(fence[0].length);
  }
  const heading = body.match(/^#\s+(.+)$/m);
  return {
    meta,
    body,
    title: heading ? heading[1].trim().slice(0, 120) : '',
  };
}

/**
 * @param {string} rel
 */
function bucketOfRel(rel) {
  const n = String(rel || '').replace(/\\/g, '/');
  return SKILL_BUCKETS.find((b) => n === b.dir || n.startsWith(`${b.dir}/`)) || null;
}

/**
 * @param {string} root
 * @param {string} rel
 */
export function resolveSkillMarkdownPath(root, rel) {
  const norm = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!norm || norm.includes('..') || norm.includes('\0')) return null;
  if (!/\/SKILL\.md$/i.test(norm)) return null;
  const bucket = bucketOfRel(norm);
  if (!bucket) return null;
  const absRoot = path.resolve(root);
  const abs = path.resolve(absRoot, ...norm.split('/'));
  const fromRoot = path.relative(absRoot, abs);
  if (!fromRoot || fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) return null;
  return { abs, rel: fromRoot.split(path.sep).join('/'), bucket };
}

/**
 * @param {string} dir
 * @param {number} depth
 * @param {string[]} out
 */
function walkSkillFiles(dir, depth, out) {
  if (depth > 4) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith('.')) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) walkSkillFiles(abs, depth + 1, out);
    else if (ent.isFile() && /^skill\.md$/i.test(ent.name)) out.push(abs);
  }
}

/**
 * @param {string} root
 */
export function listWorkspaceSkills(root) {
  const absRoot = path.resolve(root);
  /** @type {object[]} */
  const skills = [];
  for (const bucket of SKILL_BUCKETS) {
    const files = [];
    walkSkillFiles(path.join(absRoot, ...bucket.dir.split('/')), 0, files);
    for (const abs of files) {
      let text = '';
      try {
        text = fs.readFileSync(abs, 'utf8');
      } catch {
        continue;
      }
      const doc = parseSkillDocument(text);
      const rel = path.relative(absRoot, abs).split(path.sep).join('/');
      const folder = path.basename(path.dirname(abs));
      skills.push({
        rel,
        bucket: bucket.id,
        bucketLabel: bucket.label,
        name: doc.meta.name || folder,
        description: String(doc.meta.description || doc.title || '').replace(/\s+/g, ' ').slice(0, 280),
        slash: doc.meta.slash || '',
        title: doc.title || doc.meta.name || folder,
      });
    }
  }
  skills.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  return { ok: true, skills };
}

/**
 * @param {string} root
 * @param {string} rel
 */
export function readWorkspaceSkill(root, rel) {
  const resolved = resolveSkillMarkdownPath(root, rel);
  if (!resolved) return { ok: false, error: 'invalid_path' };
  if (!fs.existsSync(resolved.abs)) return { ok: false, error: 'not_found' };
  const markdown = fs.readFileSync(resolved.abs, 'utf8');
  const doc = parseSkillDocument(markdown);
  const folder = path.basename(path.dirname(resolved.abs));
  return {
    ok: true,
    rel: resolved.rel,
    bucket: resolved.bucket.id,
    bucketLabel: resolved.bucket.label,
    name: doc.meta.name || folder,
    description: String(doc.meta.description || '').slice(0, 500),
    slash: doc.meta.slash || '',
    title: doc.title || doc.meta.name || folder,
    markdown,
  };
}

/**
 * @param {string} root
 * @param {string} rel
 * @param {string} markdown
 */
export function saveWorkspaceSkill(root, rel, markdown) {
  const resolved = resolveSkillMarkdownPath(root, rel);
  if (!resolved) return { ok: false, error: 'invalid_path' };
  const text = String(markdown ?? '');
  if (!text.trim()) return { ok: false, error: 'empty' };
  if (text.length > MAX_SKILL_CHARS) return { ok: false, error: 'too_large' };
  if (!fs.existsSync(resolved.abs)) return { ok: false, error: 'not_found' };
  const out = text.endsWith('\n') ? text : `${text}\n`;
  fs.writeFileSync(resolved.abs, out, 'utf8');
  return readWorkspaceSkill(root, resolved.rel);
}

/**
 * @param {string} root
 * @param {{ name?: string, description?: string, title?: string, body?: string, bucket?: string }} input
 */
export function createWorkspaceSkill(root, input = {}) {
  const bucket = SKILL_BUCKETS.find((b) => b.id === String(input.bucket || 'kiro')) || null;
  if (!bucket) return { ok: false, error: 'invalid_bucket' };
  const rawName = String(input.name || input.slug || '').trim();
  if (rawName.length < 2) return { ok: false, error: 'invalid_name' };
  const slug = slugify(rawName);
  if (!slug || slug.length < 2) return { ok: false, error: 'invalid_name' };
  const rel = `${bucket.dir}/${slug}/SKILL.md`;
  const resolved = resolveSkillMarkdownPath(root, rel);
  if (!resolved) return { ok: false, error: 'invalid_path' };
  if (fs.existsSync(resolved.abs)) return { ok: false, error: 'exists', rel };
  const description = String(input.description || '').trim().slice(0, 400) || 'Flujo reutilizable del equipo.';
  const title = String(input.title || rawName).trim().slice(0, 80);
  const extra = String(input.body || '').trim();
  const markdown = [
    '---',
    `name: ${slug}`,
    `description: ${yamlScalar(description)}`,
    '---',
    '',
    `# ${title}`,
    '',
    '## Cuándo usarla',
    '',
    description,
    '',
    '## Qué hace',
    '',
    extra || '(Describí pantallas, cómo entra la data, cómo se consulta y cómo se guarda.)',
    '',
    '## Qué no hacer',
    '',
    '- No inventar APIs ni tablas.',
    '- No guardar secretos en esta skill.',
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(resolved.abs), { recursive: true });
  fs.writeFileSync(resolved.abs, markdown, 'utf8');
  return readWorkspaceSkill(root, rel);
}
