/**
 * PDF → texto en Markdown. pdf.js local, sin modelo.
 * @param {Buffer} buf
 */
export async function pdfBufferToMarkdown(buf) {
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
    const pages = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      /** @type {string[]} */
      const lines = [];
      let line = '';
      let lastY = null;
      for (const item of content.items) {
        const str = item && typeof item === 'object' ? String(item.str || '') : '';
        if (!str) continue;
        const y = Array.isArray(item.transform) ? item.transform[5] : null;
        if (lastY != null && y != null && Math.abs(y - lastY) > 2) {
          lines.push(line.trimEnd());
          line = '';
        }
        line += str;
        lastY = y ?? lastY;
      }
      if (line.trim()) lines.push(line.trimEnd());
      const body = lines.join('\n').trim();
      pages.push(`## Página ${i}\n\n${body || '_Sin texto en esta página (puede ser un escaneo)._'} `);
    }
    try {
      await doc.destroy?.();
    } catch {
      /* */
    }
    return pages.join('\n\n').trim();
  } finally {
    console.warn = warn;
  }
}
