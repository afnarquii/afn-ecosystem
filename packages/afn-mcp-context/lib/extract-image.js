/**
 * Imagen → texto con OCR de Windows (o un lector inyectado en tests). Sin modelo.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ocr-windows.ps1');

/**
 * @param {string} file
 */
function windowsOcrFile(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-Path', file],
      { windowsHide: true },
    );
    const out = [];
    const err = [];
    child.stdout.on('data', (c) => out.push(c));
    child.stderr.on('data', (c) => err.push(c));
    child.on('error', reject);
    child.on('close', (code) => {
      const text = Buffer.concat(out).toString('utf8').trim();
      const error = Buffer.concat(err).toString('utf8').trim();
      if (code !== 0) {
        const e = new Error(error || `ocr_exit_${code}`);
        e.code = /ocr_unavailable/i.test(error) ? 'ocr_unavailable' : 'ocr_failed';
        reject(e);
        return;
      }
      resolve(text);
    });
  });
}

/**
 * @param {Buffer} buf
 * @param {string} filename
 * @param {{ ocr?: ((buf: Buffer, filename: string) => Promise<string>) | false }} [opts]
 */
export async function imageBufferToMarkdown(buf, filename, opts = {}) {
  if (typeof opts.ocr === 'function') {
    const text = String(await opts.ocr(buf, filename) || '').trim();
    return text || '_La imagen no devolvió texto._';
  }
  if (process.platform !== 'win32' || opts.ocr === false) {
    const e = new Error('ocr_unavailable');
    e.code = 'ocr_unavailable';
    throw e;
  }
  const ext = path.extname(filename || '').toLowerCase() || '.png';
  const tmp = path.join(os.tmpdir(), `afn-ocr-${Date.now()}${ext}`);
  fs.writeFileSync(tmp, buf);
  try {
    const text = String(await windowsOcrFile(tmp) || '').trim();
    return text || '_La imagen no devolvió texto. Si es una foto, acercá el recorte o revisá el idioma de OCR de Windows._';
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* */
    }
  }
}
