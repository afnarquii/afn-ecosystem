/**
 * Copia skills y steering de otro proyecto. No toca memoria, extract ni credenciales.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_BUCKETS } from './skill-library.js';

const MAX_FILES = 80;
const MAX_BYTES = 200_000;

function inside(root, abs) {
  const r = path.resolve(root);
  const d = path.resolve(abs);
  const R = process.platform === 'win32' ? r.toLowerCase() : r;
  const D = process.platform === 'win32' ? d.toLowerCase() : d;
  return D === R || D.startsWith(`${R}${path.sep}`);
}

/**
 * @param {string} srcDir
 * @param {string} destDir
 * @param {string[]} copied
 * @param {string[]} skipped
 * @param {(name: string) => boolean} [allow]
 * @param {number} [depth]
 */
function copyMarkdownTree(srcDir, destDir, copied, skipped, allow, depth = 0) {
  if (depth > 4 || copied.length + skipped.length >= MAX_FILES) return;
  let entries = [];
  try {
    entries = fs.readdirSync(srcDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (copied.length + skipped.length >= MAX_FILES) return;
    if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
    const from = path.join(srcDir, ent.name);
    const to = path.join(destDir, ent.name);
    if (!inside(srcDir, from) || !inside(destDir, to)) continue;
    if (ent.isDirectory()) {
      copyMarkdownTree(from, to, copied, skipped, allow, depth + 1);
      continue;
    }
    if (!ent.isFile() || !ent.name.toLowerCase().endsWith('.md')) continue;
    if (allow && !allow(ent.name)) {
      skipped.push(path.basename(to));
      continue;
    }
    let st;
    try {
      st = fs.statSync(from);
    } catch {
      continue;
    }
    if (st.size > MAX_BYTES) {
      skipped.push(ent.name);
      continue;
    }
    if (fs.existsSync(to)) {
      skipped.push(path.relative(path.dirname(destDir), to).replace(/\\/g, '/'));
      continue;
    }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied.push(path.relative(path.dirname(destDir), to).replace(/\\/g, '/'));
  }
}

/**
 * @param {string} root proyecto destino
 * @param {string} from carpeta de otro proyecto
 */
export function portProjectAssets(root, from) {
  const src = path.resolve(String(from || ''));
  const dest = path.resolve(root);
  if (!from || !fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    return { ok: false, error: 'not_found' };
  }
  const same = process.platform === 'win32' ? src.toLowerCase() === dest.toLowerCase() : src === dest;
  if (same) return { ok: false, error: 'same_project' };
  /** @type {string[]} */
  const copied = [];
  /** @type {string[]} */
  const skipped = [];
  for (const bucket of SKILL_BUCKETS) {
    copyMarkdownTree(path.join(src, bucket.dir), path.join(dest, bucket.dir), copied, skipped);
  }
  copyMarkdownTree(
    path.join(src, '.kiro', 'steering'),
    path.join(dest, '.kiro', 'steering'),
    copied,
    skipped,
    (name) => name.toLowerCase() !== 'afn-context.md',
  );
  return { ok: true, copied, skipped, from: src };
}
