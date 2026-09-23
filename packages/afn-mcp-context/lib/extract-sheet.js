/**
 * Excel / CSV → cuerpo Markdown (tabla). Sin modelo.
 */
import path from 'node:path';
import XLSX from 'xlsx';

/**
 * @param {string[][]} rows
 */
export function rowsToMarkdownTable(rows) {
  const clean = (rows || [])
    .map((r) => (Array.isArray(r) ? r : []).map((c) => String(c ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()))
    .filter((r) => r.some((c) => c));
  if (!clean.length) return '_Hoja vacía._';
  const width = Math.max(...clean.map((r) => r.length));
  const norm = clean.map((r) => {
    const cells = r.slice();
    while (cells.length < width) cells.push('');
    return cells;
  });
  if (width > 12 || norm.length > 400) {
    const csv = norm.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
    return `\`\`\`csv\n${csv}\n\`\`\``;
  }
  const line = (cells) => `| ${cells.join(' | ')} |`;
  const sep = `| ${norm[0].map(() => '---').join(' | ')} |`;
  const body = norm.slice(1);
  return [line(norm[0]), sep, ...(body.length ? body.map(line) : [])].join('\n');
}

/**
 * @param {Buffer} buf
 * @param {string} filename
 */
export function spreadsheetBufferToMarkdown(buf, filename) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  const wb = ext === '.csv'
    ? XLSX.read(buf.toString('utf8').replace(/^\uFEFF/, ''), { type: 'string' })
    : XLSX.read(buf, { type: 'buffer' });
  const parts = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
    parts.push(`## ${name}\n\n${rowsToMarkdownTable(rows)}`);
  }
  return parts.join('\n\n') || '_Libro vacío._';
}
