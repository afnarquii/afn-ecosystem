import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import XLSX from 'xlsx';
import { saveExtractMarkdown, listExtractMarkdown, readExtractMarkdown, estimateExtractTokens, extractFileToMarkdown, deleteExtractMarkdown, keepExtractInContext } from '../lib/extract-text.js';
import { rowsToMarkdownTable } from '../lib/extract-sheet.js';
import { pdfItemsToLines } from '../lib/extract-pdf.js';
import { writeDashboard } from '../lib/dashboard.js';
import { startDashboardServer, stopDashboardServer } from '../lib/dashboard-server.js';

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'afn-extract-'));
}

function miniPdf(text) {
  const stream = `BT /F1 24 Tf 72 100 Td (${text}) Tj ET`;
  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n',
    `4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n',
  ];
  let body = '%PDF-1.1\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(body.length);
    body += obj;
  }
  const xref = body.length;
  let out = `${body}xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i += 1) {
    out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out);
}

test('excel, csv, pdf e imagen quedan en .md dentro de .afn/extract', async () => {
  const root = tmp();
  const cols = pdfItemsToLines([
    { str: '1200', transform: [1, 0, 0, 1, 72, 700], width: 28 },
    { str: '40', transform: [1, 0, 0, 1, 320, 700], width: 16 },
  ]);
  assert.equal(cols[0], '1200 | 40');
  const cost = estimateExtractTokens({ chars: 4000, pages: 80, kind: 'pdf' });
  assert.equal(cost.extractTokens, 0);
  assert.equal(cost.markdownTokensIfPasted, 1000);
  assert.equal(cost.attachFileTokensEstimate, 80 * 1700);
  const table = rowsToMarkdownTable([
    ['Turno', 'Total'],
    ['Mañana', '1200'],
  ]);
  assert.match(table, /\| Turno \| Total \|/);
  assert.match(table, /\| Mañana \| 1200 \|/);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Turno', 'Total'], ['Noche', '40']]), 'Caja');
  const xlsx = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const excel = await saveExtractMarkdown(root, 'caja.xlsx', Buffer.from(xlsx));
  assert.equal(excel.ok, true);
  assert.match(excel.rel, /^\.afn\/extract\/.+\.md$/);
  assert.match(excel.markdown, /# caja\.xlsx/);
  assert.match(excel.markdown, /\| Turno \| Total \|/);
  assert.match(excel.markdown, /\| Noche \| 40 \|/);
  assert.equal(excel.kind, 'excel');

  const csv = await saveExtractMarkdown(root, 'lista.csv', Buffer.from('Nombre,Cantidad\nPan,2\n'));
  assert.equal(csv.ok, true);
  assert.match(csv.markdown, /\| Pan \| 2 \|/);

  const pdf = await saveExtractMarkdown(root, 'nota.pdf', miniPdf('HolaCaja'));
  assert.equal(pdf.ok, true, pdf.detail || pdf.error);
  assert.match(pdf.markdown, /HolaCaja/);
  assert.match(pdf.markdown, /method: pdf-text/);
  assert.match(pdf.markdown, /no OCR/);
  assert.equal(pdf.extractTokens, 0);
  assert.equal(pdf.kind, 'pdf');

  const img = await saveExtractMarkdown(root, 'foto.png', Buffer.from([1, 2, 3]), {
    ocr: async () => 'Turno abierto',
  });
  assert.equal(img.ok, true);
  assert.match(img.markdown, /Turno abierto/);
  assert.equal(img.kind, 'image');

  const listed = listExtractMarkdown(root);
  assert.equal(listed.files.length, 4);
  assert.equal(listed.files.every((f) => f.rel.endsWith('.md')), true);
  const one = readExtractMarkdown(root, listed.files[0].name);
  assert.equal(one.ok, true);
  assert.match(one.markdown, /^---/);
  assert.equal(readExtractMarkdown(root, '../secrets.md').ok, false);
  assert.equal((await saveExtractMarkdown(root, 'nota.txt', Buffer.from('x'))).error, 'unsupported');

  const html = fs.readFileSync(writeDashboard(root, { open: false }).file, 'utf8');
  assert.match(html, /data-view="extract"/);
  assert.match(html, /Eliminar/);
  assert.match(html, /Guardar en memoria/);
  assert.match(html, /Siempre a \.md|siempre es un/);
});

test('eliminar un ensayo lo saca del disco y de la memoria', () => {
  const root = tmp();
  const dir = path.join(root, '.afn', 'extract');
  fs.mkdirSync(dir, { recursive: true });
  const name = 'ensayo-1.md';
  fs.writeFileSync(path.join(dir, name), '---\nsource: 1.png\nkind: image\n---\n\nHola ensayo\n', 'utf8');
  const kept = keepExtractInContext(root, name);
  assert.equal(kept.ok, true);
  const cerebro = JSON.parse(fs.readFileSync(path.join(root, '.afn', 'memory', 'cerebro.json'), 'utf8'));
  assert.equal(cerebro.observations.length, 1);
  assert.match(cerebro.observations[0].where, /ensayo-1\.md$/);
  const gone = deleteExtractMarkdown(root, name);
  assert.equal(gone.ok, true);
  assert.equal(gone.memoryRemoved, 1);
  assert.equal(fs.existsSync(path.join(dir, name)), false);
  const after = JSON.parse(fs.readFileSync(path.join(root, '.afn', 'memory', 'cerebro.json'), 'utf8'));
  assert.equal(after.observations.length, 0);
  assert.equal(deleteExtractMarkdown(root, '../MEMORY.md').ok, false);
});

test('encuentra la imagen en la carpeta imagenes del proyecto', async () => {
  const root = tmp();
  const dir = path.join(root, 'imagenes');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'caja.png'), Buffer.from([1, 2, 3]));
  const byName = await extractFileToMarkdown(root, 'caja.png', { ocr: async () => 'Turno 1' });
  assert.equal(byName.ok, true);
  assert.match(byName.markdown, /Turno 1/);
  const byFolder = await extractFileToMarkdown(root, 'imagenes/caja.png', { ocr: async () => 'Turno 2' });
  assert.equal(byFolder.ok, true);
  assert.match(byFolder.markdown, /Turno 2/);
  fs.writeFileSync(path.join(dir, 'otra.png'), Buffer.from([4]));
  const many = await extractFileToMarkdown(root, '', { pick: 'imagen', ocr: async () => 'x' });
  assert.equal(many.ok, false);
  assert.equal(many.error, 'several');
  assert.ok(many.matches.some((m) => String(m).replace(/\\/g, '/').endsWith('imagenes/caja.png')));
});

test('API guarda el markdown y no acepta otra extensión', async () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.afn'), { recursive: true });
  const info = await startDashboardServer(root, { port: 0 });
  try {
    const headers = { 'x-afn-token': info.token, 'content-type': 'application/json' };
    const csv = Buffer.from('A,B\n1,2\n').toString('base64');
    const res = await fetch(`http://127.0.0.1:${info.port}/api/extract`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ filename: 'tabla.csv', base64: csv }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.match(body.rel, /\.md$/);
    assert.match(body.markdown, /\| 1 \| 2 \|/);
    const disk = fs.readdirSync(path.join(root, '.afn', 'extract'));
    assert.equal(disk.every((n) => n.endsWith('.md')), true);
    const kept = await fetch(`http://127.0.0.1:${info.port}/api/extract/keep`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: body.file }),
    });
    assert.equal(kept.ok, true);
    const del = await fetch(`http://127.0.0.1:${info.port}/api/extract/file?name=${encodeURIComponent(body.file)}`, {
      method: 'DELETE',
      headers,
    });
    const deleted = await del.json();
    assert.equal(del.status, 200);
    assert.equal(deleted.memoryRemoved, 1);
    assert.equal(fs.existsSync(path.join(root, '.afn', 'extract', body.file)), false);
    const bad = await fetch(`http://127.0.0.1:${info.port}/api/extract`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ filename: 'notas.txt', base64: Buffer.from('hola').toString('base64') }),
    });
    assert.equal(bad.ok, false);
  } finally {
    stopDashboardServer(root);
  }
});
