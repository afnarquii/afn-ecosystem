import fs from 'node:fs';
import { afnPath, MAX_FACTS, MAX_FACT_CHARS } from './paths.js';

function factsFile(root) {
  return afnPath(root, 'memory', 'facts.json');
}

function memoryMd(root) {
  return afnPath(root, 'MEMORY.md');
}

/**
 * @param {string} root
 * @returns {{ version: number, facts: object[] }}
 */
export function loadFacts(root) {
  try {
    const j = JSON.parse(fs.readFileSync(factsFile(root), 'utf8'));
    const facts = Array.isArray(j.facts) ? j.facts : [];
    return { version: 1, facts: facts.filter((x) => x && typeof x.text === 'string') };
  } catch {
    return { version: 1, facts: [] };
  }
}

/**
 * @param {object[]} facts
 */
export function formatMemoryMarkdown(facts) {
  const lines = [
    '# Memoria AFN',
    '',
    'Hechos durables del producto (no transcripts de chat).',
    '',
  ];
  const list = Array.isArray(facts) ? facts.slice(-80) : [];
  if (!list.length) {
    lines.push('_Sin hechos todavía._', '');
    return lines.join('\n');
  }
  for (const f of [...list].reverse()) {
    const when = String(f.createdAt || '').slice(0, 19);
    lines.push(`- **${when}** ${String(f.text || '').trim()}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

/**
 * @param {string} root
 * @param {object[]} facts
 */
export function writeFacts(root, facts) {
  fs.mkdirSync(afnPath(root, 'memory'), { recursive: true });
  const next = facts.slice(-MAX_FACTS);
  fs.writeFileSync(factsFile(root), `${JSON.stringify({ version: 1, facts: next }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(memoryMd(root), formatMemoryMarkdown(next), 'utf8');
  return next;
}

/**
 * @param {string} root
 * @param {{ text?: string, what?: string, why?: string, where?: string, learned?: string }} input
 */
export function saveFact(root, input = {}) {
  const parts = [
    input.what && `**What**: ${input.what}`,
    input.why && `**Why**: ${input.why}`,
    input.where && `**Where**: ${input.where}`,
    input.learned && `**Learned**: ${input.learned}`,
  ].filter(Boolean);
  let text = String(input.text || parts.join(' ') || '').trim();
  if (!text) return { ok: false, error: 'texto vacío' };
  text = text.slice(0, MAX_FACT_CHARS);
  const pack = loadFacts(root);
  const fact = {
    id: `m-${Date.now()}`,
    text,
    createdAt: new Date().toISOString(),
  };
  pack.facts.push(fact);
  writeFacts(root, pack.facts);
  return { ok: true, fact, count: pack.facts.length };
}

/**
 * @param {string} root
 * @param {string} query
 * @param {number} [limit]
 */
export function searchFacts(root, query, limit = 8) {
  const q = String(query || '').trim().toLowerCase();
  const facts = loadFacts(root).facts;
  if (!q) return facts.slice(-limit).reverse();
  return facts
    .filter((f) => String(f.text || '').toLowerCase().includes(q))
    .slice(-limit)
    .reverse();
}

/**
 * @param {string} root
 */
export function readMemoryMarkdown(root) {
  try {
    return fs.readFileSync(memoryMd(root), 'utf8');
  } catch {
    return '';
  }
}
