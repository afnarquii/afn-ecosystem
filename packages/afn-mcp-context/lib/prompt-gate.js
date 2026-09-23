/**
 * PromptSubmit de Kiro: si el mensaje es un comando AFN (dashboard / note-save / cerebro),
 * lo ejecuta en local y sale 2 para bloquear el LLM (no gasta tokens).
 * Si no coincide, imprime la pista corta y sale 0 (el chat sigue).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildPromptHint } from './snapshot.js';
import { saveTaskNoteFromFile } from './task-notes.js';
import { extractFileToMarkdown } from './extract-text.js';
import { searchCerebro } from './cerebro.js';
import { readDashboardPointer } from './dashboard-server.js';

const ENTRY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.js');

function fold(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function key(s) {
  return fold(s).replace(/\.md$/i, '').replace(/[_\-\s]/g, '');
}

const EXTRACT_EXT = 'pdf|xlsx|xlsm|xls|csv|png|jpe?g|webp|bmp|gif|tiff?';

/**
 * Ruta de PDF, Excel o imagen dentro del mensaje.
 * Acepta C:\..., C:/... y file:///.
 * @param {string} text
 */
export function findExtractFile(text) {
  const raw = String(text || '');
  const fileUrl = raw.match(new RegExp(String.raw`file:\/\/\/([A-Za-z]:\/[^\s"'<>]+)\.(${EXTRACT_EXT})\b`, 'i'));
  if (fileUrl) {
    return decodeURIComponent(`${fileUrl[1]}.${fileUrl[2]}`).replace(/\//g, '\\');
  }
  const m = raw.match(new RegExp(String.raw`((?:[A-Za-z]:[\\/]|\\\\)[^"'\r\n<>|]+?)\.(${EXTRACT_EXT})\b`, 'i'));
  if (m) {
    let file = `${m[1]}.${m[2]}`.replace(/[),.;]+$/, '');
    if (/^[A-Za-z]:\//.test(file)) file = file.replace(/\//g, '\\');
    return file;
  }
  const rel = raw.match(new RegExp(String.raw`(?:^|[\s"'])((?:[\w.\-]+[\\/])*[\w.\-]+)\.(${EXTRACT_EXT})\b`, 'i'));
  if (!rel) return '';
  return `${rel[1]}.${rel[2]}`.replace(/[),.;]+$/, '');
}

/**
 * Imagen, PDF o Excel por ruta de disco → Markdown local, sin LLM.
 * No exige la palabra «extrae»: «mira esta imagen C:/…/foto.png» también.
 * @param {string} raw
 */
export function parseExtractIntent(raw) {
  const text = String(raw || '').trim();
  if (!text || text.length > 2000) return null;
  const file = findExtractFile(text);
  if (!file) {
    const only = text.match(/^(?:extrae|extraer|extra[eé]|convierte|convertir|convert[ií])\s+(?:el|la|los|las)?\s*(imagen|im[aá]genes?|foto|pdf|excel|xlsx)\s*$/i);
    if (only) return { kind: 'extract', file: '', pick: only[1].toLowerCase() };
    return null;
  }
  const asks =
    /\b(extrae|extraer|extra[eé]|convierte|convertir|convert[ií]|pasa a|markdown|imagen|im[aá]genes?|foto|captura|ocr|pdf|excel|xlsx|que dice|qu[eé] dice|lee|leer|le[eé]|mira|mir[aá]|mostra(?:r|me)?|contenido|texto)\b/i.test(text);
  const codeTask = /\b(implementa|arregla|refactor|componente|funcion|bug|commit|import)\b/i.test(text);
  if (codeTask && !asks) return null;
  if (asks || text.length < 220) return { kind: 'extract', file };
  return null;
}

/**
 * @param {string} text
 * @returns {{ kind: 'dashboard', view: string } | { kind: 'note-save', file: string } | { kind: 'mem-search', query: string } | null}
 */
export function parseLocalIntent(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const extracted = parseExtractIntent(raw);
  if (extracted) return extracted;
  if (raw.length > 280) return null;
  const n = fold(raw);

  const note = n.match(/\b(?:guarda(?:r)?|save)\b(?:\s+el)?\s+(?:readme|nota|md)\s+([a-z0-9._\-]+)/i);
  if (note) return { kind: 'note-save', file: note[1] };

  const mem =
    n.match(/^(?:cerebro|mem-search|memoria)\s*[:\-]\s*(.+)$/i)
    || n.match(/\bbusca(?:r)?(?:\s+en)?(?:\s+el)?\s+cerebro\s+(.+)/i)
    || n.match(/\bconsult(?:a|ar|a)\s+(?:el\s+)?cerebro(?:\s+(?:sobre|de))?\s+(.+)/i);
  if (mem) return { kind: 'mem-search', query: String(mem[1] || '').trim() };

  if (/^(abre|abrir|editar|mostrar)\s+(las\s+)?skills?\b/.test(n) && n.length < 48) {
    return { kind: 'dashboard', view: 'skills' };
  }
  if (/^(abre|abrir|mostrar)\s+(los\s+)?textos\b/.test(n) && n.length < 40) {
    return { kind: 'dashboard', view: 'extract' };
  }

  const dash =
    /\bdashboard\b/.test(n)
    && (/\b(abre|abri|abrir|open|mostra(?:r)?|levant(?:a|ar)|pon[eé])\b/.test(n) || /^(afn\s+)?dashboard\b/.test(n) || /\bafn dashboard\b/.test(n));
  if (dash || /^(abre|abrir)\s+(el\s+)?dashboard\b/.test(n)) {
    let view = 'readme';
    if (/\bskills?\b/.test(n)) view = 'skills';
    else if (/\b(textos|pdf|excel)\b/.test(n)) view = 'extract';
    else if (/\bsql\b|consulta/.test(n)) view = 'sql';
    else if (/cerebro|memoria/.test(n)) view = 'cerebro';
    else if (/\bnotas?\b/.test(n)) view = 'notas';
    else if (/origen/.test(n)) view = 'origenes';
    else if (/esquema|tablas/.test(n)) view = 'esquema';
    return { kind: 'dashboard', view };
  }
  return null;
}

function findMd(root, token) {
  const needle = key(token);
  if (!needle) return '';
  const names = [token, token.endsWith('.md') ? token : `${token}.md`];
  const dirs = [process.cwd(), root];
  for (const dir of dirs) {
    for (const name of names) {
      const p = path.join(dir, name);
      try {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
      } catch {
        /* */
      }
    }
    let list = [];
    try {
      list = fs.readdirSync(dir);
    } catch {
      continue;
    }
    const hit = list.find((f) => f.toLowerCase().endsWith('.md') && key(f).includes(needle));
    if (hit) return path.join(dir, hit);
  }
  return '';
}

function spawnDashboard(root, view) {
  const args = [ENTRY, 'dashboard'];
  if (view && view !== 'readme') args.push(view);
  const child = spawn(process.execPath, args, {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, AFN_PROJECT_ROOT: root },
  });
  child.unref();
  return child.pid;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitDashboardUrl(root, ms = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const p = readDashboardPointer(root);
    if (p?.url) return p.url;
    await sleep(120);
  }
  return readDashboardPointer(root)?.url || '';
}

/**
 * @param {string} root
 * @param {string} text
 * @returns {Promise<{ handled: boolean, exitCode: number, message: string, intent?: object }>}
 */
export async function runPromptGate(root, text) {
  const intent = parseLocalIntent(text);
  if (!intent) {
    const hint = buildPromptHint(root);
    return { handled: false, exitCode: 0, message: hint.markdown.trim() };
  }

  if (intent.kind === 'dashboard') {
    spawnDashboard(root, intent.view);
    const url = await waitDashboardUrl(root);
    const msg = url
      ? `AFN (sin LLM): dashboard abierto.\n${url}${intent.view && intent.view !== 'readme' ? `#${intent.view}` : ''}\nNo se envió el mensaje al modelo.`
      : 'AFN (sin LLM): levantando dashboard en http://127.0.0.1:5847 — si no abre, corré .afn/_tmp/afn-dashboard.cmd';
    return { handled: true, exitCode: 2, message: msg, intent };
  }

  if (intent.kind === 'extract') {
    const r = await extractFileToMarkdown(root, intent.file, { pick: intent.pick });
    let msg;
    if (r.ok) {
      msg = `AFN (sin LLM): Markdown en ${r.rel} (${r.chars} caracteres, ${r.kind}).\nAbrilo, corregilo si hace falta, y pasale ese .md al chat.\nNo se envió el archivo al modelo.`;
    } else if (r.error === 'several') {
      msg = `AFN (sin LLM): hay varios. Decí el nombre:\n${(r.matches || []).map((m) => `- ${m}`).join('\n')}`;
    } else {
      msg = `AFN (sin LLM): no pude convertir ${intent.file || intent.pick || 'el archivo'}. ${r.error || 'error'}.`;
    }
    return { handled: true, exitCode: 2, message: msg, intent };
  }

  if (intent.kind === 'note-save') {
    const file = findMd(root, intent.file) || intent.file;
    const r = saveTaskNoteFromFile(root, file);
    const msg = r.ok
      ? `AFN (sin LLM): guardado ${r.rel || r.file} (tarea ${r.slug}).\nNo se envió el mensaje al modelo.`
      : `AFN (sin LLM): no pude guardar. ${r.error || 'archivo no encontrado'}.`;
    return { handled: true, exitCode: 2, message: msg, intent };
  }

  if (intent.kind === 'mem-search') {
    const facts = searchCerebro(root, intent.query, { limit: 12 });
    const lines = [`AFN (sin LLM): cerebro · ${intent.query} (${facts.length})`];
    for (const o of facts) {
      lines.push(`- ${String(o.title || '').slice(0, 120)}${o.type ? ` [${o.type}]` : ''}`);
    }
    if (!facts.length) lines.push('(sin coincidencias)');
    lines.push('No se envió el mensaje al modelo.');
    return { handled: true, exitCode: 2, message: lines.join('\n'), intent };
  }

  const hint = buildPromptHint(root);
  return { handled: false, exitCode: 0, message: hint.markdown.trim() };
}

function readStdinSync(limitMs) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    const chunks = [];
    const t = setTimeout(() => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    }, limitMs);
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => {
      clearTimeout(t);
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
  });
}

function promptFromPayload(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(promptFromPayload).filter(Boolean).join('\n');
  if (typeof value !== 'object') return '';
  const keys = ['prompt', 'user_prompt', 'userPrompt', 'userInput', 'user_input', 'userMessage', 'user_message', 'text', 'content', 'message', 'query', 'input'];
  for (const key of keys) {
    if (value[key] != null) {
      const s = promptFromPayload(value[key]);
      if (s.trim()) return s;
    }
  }
  return '';
}

export async function readHookPrompt() {
  const env = process.env.USER_PROMPT || process.env.KIRO_USER_PROMPT || process.env.PROMPT || '';
  if (String(env).trim()) return String(env);
  const raw = String(await readStdinSync(400)).trim();
  if (!raw) return '';
  try {
    const direct = promptFromPayload(JSON.parse(raw));
    if (direct.trim()) return direct;
  } catch {
    /* texto plano */
  }
  return raw;
}
