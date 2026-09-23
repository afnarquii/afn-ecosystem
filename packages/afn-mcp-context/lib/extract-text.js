/**
 * PDF, Excel e imágenes → Markdown en `.afn/extract/`.
 * Lectura local. No llama a un modelo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afnPath } from './paths.js';
import { readPdfText } from './extract-pdf.js';
import { spreadsheetBufferToMarkdown } from './extract-sheet.js';
import { imageBufferToMarkdown } from './extract-image.js';

export const EXTRACT_SUBDIR = 'extract';
export const MAX_EXTRACT_BYTES = 15 * 1024 * 1024;

const EXT_KIND = Object.freeze({
  '.pdf': 'pdf',
  '.xlsx': 'excel',
  '.xlsm': 'excel',
  '.xls': 'excel',
  '.csv': 'excel',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.bmp': 'image',
  '.gif': 'image',
  '.tif': 'image',
  '.tiff': 'image',
});

/**
 * @param {string} name
 */
export function extractKind(name) {
  const ext = path.extname(String(name || '')).toLowerCase();
  return EXT_KIND[ext] || '';
}

/**
 * @param {string} name
 */
export function safeSourceName(name) {
  const base = path.basename(String(name || 'archivo')).replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]+/g, '_');
  return base.slice(0, 80) || 'archivo';
}

/**
 * @param {string} sourceName
 * @param {Date} [now]
 */
export function extractMarkdownName(sourceName, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const stem = safeSourceName(sourceName).replace(/\.[^.]+$/, '').slice(0, 48) || 'archivo';
  return `${stamp}-${stem}.md`;
}

/**
 * @param {{ source: string, kind: string, body: string, method?: string }} p
 */
export function formatExtractMarkdown(p) {
  const source = safeSourceName(p.source);
  const kind = String(p.kind || 'text');
  const method = String(p.method || (kind === 'image' ? 'ocr' : kind === 'excel' ? 'table' : 'text'));
  const note =
    method === 'ocr'
      ? 'OCR de Windows. Un dígito puede salir mal. Contrastá importes con el original.'
      : method === 'pdf-scan'
        ? 'Este PDF no tiene capa de texto. No se inventaron valores y no es una lectura OCR.'
        : method === 'pdf-text'
          ? 'Capa de texto del PDF, no OCR. Los números salen del archivo.'
          : 'Tabla leída del archivo, no OCR.';
  const body = String(p.body || '').trim() || '_Sin texto reconocible._';
  return [
    '---',
    `source: ${source}`,
    `kind: ${kind}`,
    `method: ${method}`,
    'format: markdown',
    `extractedAt: ${new Date().toISOString()}`,
    `note: ${note}`,
    '---',
    '',
    `# ${source}`,
    '',
    body,
    '',
  ].join('\n');
}

/**
 * La extracción local es 0 tokens.
 * Adjuntar PDF o imagen al modelo se estima en 1700 tokens por página.
 * Pegar el .md después se estima en 1 token cada 4 caracteres.
 * @param {{ chars?: number, pages?: number, kind?: string }} p
 */
export function estimateExtractTokens(p) {
  const chars = Number(p.chars) || 0;
  const pages = Math.max(0, Number(p.pages) || 0);
  const markdownTokensIfPasted = Math.ceil(chars / 4);
  const visual = p.kind === 'pdf' || p.kind === 'image';
  const attachFileTokensEstimate = visual ? Math.max(pages, 1) * 1700 : markdownTokensIfPasted;
  return { extractTokens: 0, markdownTokensIfPasted, attachFileTokensEstimate };
}

/**
 * @param {Buffer} buf
 * @param {string} filename
 * @param {{ ocr?: (buf: Buffer, filename: string) => Promise<string> }} [opts]
 */
export async function bufferToMarkdownBody(buf, filename, opts = {}) {
  const kind = extractKind(filename);
  if (!kind) return { ok: false, error: 'unsupported' };
  if (!buf || !buf.length) return { ok: false, error: 'empty' };
  if (buf.length > MAX_EXTRACT_BYTES) return { ok: false, error: 'too_large' };
  try {
    let body = '';
    let method = kind === 'image' ? 'ocr' : kind === 'excel' ? 'table' : '';
    let pages = kind === 'image' ? 1 : 0;
    if (kind === 'pdf') {
      const read = await readPdfText(buf);
      body = read.text;
      method = read.method;
      pages = read.pages;
    } else if (kind === 'excel') body = spreadsheetBufferToMarkdown(buf, filename);
    else body = await imageBufferToMarkdown(buf, filename, opts);
    return { ok: true, kind, method, pages, body: String(body || '').trim() };
  } catch (e) {
    const code = e?.code || '';
    if (code === 'ocr_unavailable') return { ok: false, error: 'ocr_unavailable' };
    return { ok: false, error: 'extract_failed', detail: String(e?.message || e).slice(0, 240) };
  }
}

/**
 * @param {string} root
 * @param {string} filename
 * @param {Buffer} buf
 * @param {{ ocr?: (buf: Buffer, filename: string) => Promise<string> }} [opts]
 */
export async function saveExtractMarkdown(root, filename, buf, opts = {}) {
  const got = await bufferToMarkdownBody(buf, filename, opts);
  if (!got.ok) return got;
  const dir = afnPath(root, EXTRACT_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  const file = extractMarkdownName(filename);
  const markdown = formatExtractMarkdown({ source: filename, kind: got.kind, method: got.method, body: got.body });
  fs.writeFileSync(path.join(dir, file), markdown, 'utf8');
  const tokens = estimateExtractTokens({ chars: got.body.length, pages: got.pages, kind: got.kind });
  return {
    ok: true,
    kind: got.kind,
    method: got.method,
    pages: got.pages || 0,
    file,
    rel: `.afn/${EXTRACT_SUBDIR}/${file}`,
    chars: got.body.length,
    preview: got.body.slice(0, 1500),
    markdown,
    ...tokens,
  };
}

/**
 * @param {string} root
 */
export function listExtractMarkdown(root) {
  const dir = afnPath(root, EXTRACT_SUBDIR);
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return { ok: true, files: [] };
  }
  const files = names
    .filter((n) => n.toLowerCase().endsWith('.md') && !n.startsWith('.'))
    .map((name) => {
      const abs = path.join(dir, name);
      let text = '';
      let stat = null;
      try {
        stat = fs.statSync(abs);
        text = fs.readFileSync(abs, 'utf8');
      } catch {
        return null;
      }
      const source = (text.match(/^source:\s*(.+)$/m) || [])[1] || name;
      const kind = (text.match(/^kind:\s*(.+)$/m) || [])[1] || '';
      return {
        name,
        rel: `.afn/${EXTRACT_SUBDIR}/${name}`,
        source: source.trim(),
        kind: kind.trim(),
        bytes: stat?.size || 0,
        mtimeMs: stat?.mtimeMs || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return { ok: true, files };
}

/**
 * @param {string} root
 * @param {string} name
 */
export function readExtractMarkdown(root, name) {
  const base = path.basename(String(name || ''));
  if (!base || base !== String(name || '').replace(/\\/g, '/').split('/').pop() || !base.toLowerCase().endsWith('.md')) {
    return { ok: false, error: 'invalid_path' };
  }
  if (base.includes('..')) return { ok: false, error: 'invalid_path' };
  const abs = path.join(afnPath(root, EXTRACT_SUBDIR), base);
  if (!fs.existsSync(abs)) return { ok: false, error: 'not_found' };
  const markdown = fs.readFileSync(abs, 'utf8');
  return { ok: true, name: base, rel: `.afn/${EXTRACT_SUBDIR}/${base}`, markdown };
}

/**
 * Lee un archivo del disco (ruta absoluta o relativa al workspace) y lo guarda como .md.
 * @param {string} root
 * @param {string} filePath
 * @param {{ ocr?: (buf: Buffer, filename: string) => Promise<string> }} [opts]
 */
export async function extractFileToMarkdown(root, filePath, opts = {}) {
  const raw = String(filePath || '').trim().replace(/^["']|["']$/g, '');
  if (!raw) return { ok: false, error: 'empty' };
  const abs = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(root, raw);
  if (!extractKind(abs)) return { ok: false, error: 'unsupported' };
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return { ok: false, error: 'not_found' };
  const buf = fs.readFileSync(abs);
  return saveExtractMarkdown(root, path.basename(abs), buf, opts);
}
