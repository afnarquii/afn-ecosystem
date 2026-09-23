/**
 * Une fragmentos de una página respetando columnas (un hueco grande no pega los números).
 * @param {Array<{ str?: string, transform?: number[], width?: number }>} items
 */
export function pdfItemsToLines(items) {
  const glyphs = [];
  for (const item of items || []) {
    const str = item && typeof item === 'object' ? String(item.str || '') : '';
    if (!str) continue;
    const x = Array.isArray(item.transform) ? Number(item.transform[4]) || 0 : 0;
    const y = Array.isArray(item.transform) ? Number(item.transform[5]) || 0 : 0;
    const width = Number(item.width) || Math.max(str.length * 5, 4);
    glyphs.push({ str, x, y, width });
  }
  glyphs.sort((a, b) => b.y - a.y || a.x - b.x);
  /** @type {{ y: number, parts: typeof glyphs }[]} */
  const lines = [];
  for (const g of glyphs) {
    const last = lines[lines.length - 1];
    if (!last || Math.abs(last.y - g.y) > 2) lines.push({ y: g.y, parts: [g] });
    else last.parts.push(g);
  }
  return lines
    .map((line) => {
      const parts = line.parts.sort((a, b) => a.x - b.x);
      let out = '';
      let prevEnd = null;
      for (const p of parts) {
        if (prevEnd != null && p.x - prevEnd > 14) out += ' | ';
        out += p.str;
        prevEnd = p.x + p.width;
      }
      return out.trim();
    })
    .filter(Boolean);
}

/**
 * PDF → texto. Capa de texto del archivo (no OCR).
 * @param {Buffer} buf
 * @returns {Promise<{ text: string, pages: number, textPages: number, emptyPages: number, method: 'pdf-text' | 'pdf-scan' }>}
 */
export async function readPdfText(buf) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
  const lib = pdfjs.default || pdfjs;
  const warn = console.warn;
  console.warn = (...args) => {
    const s = String(args[0] || '');
    if (/polyfill|standard font|canvas/i.test(s)) return;
    warn(...args);
  };
  try {
    const task = lib.getDocument({
      data: new Uint8Array(buf),
      disableWorker: true,
      isEvalSupported: false,
    });
    const doc = await task.promise;
    const pageCount = doc.numPages;
    const pages = [];
    let textPages = 0;
    let emptyPages = 0;
    for (let i = 1; i <= pageCount; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const body = pdfItemsToLines(content.items).join('\n').trim();
      if (body) textPages += 1;
      else emptyPages += 1;
      pages.push(`## Página ${i}\n\n${body || '_Esta página no tiene capa de texto. No se leyeron valores (no es OCR)._'} `);
    }
    try {
      await doc.destroy?.();
    } catch {
      /* */
    }
    const method = textPages === 0 ? 'pdf-scan' : 'pdf-text';
    return { text: pages.join('\n\n').trim(), pages: pageCount, textPages, emptyPages, method };
  } finally {
    console.warn = warn;
  }
}

/**
 * @param {Buffer} buf
 */
export async function pdfBufferToMarkdown(buf) {
  const read = await readPdfText(buf);
  return read.text;
}
