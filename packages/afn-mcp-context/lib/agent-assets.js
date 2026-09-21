import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afnPath, slugify } from './paths.js';
import { activeProjects, normalizeProjectsConfig } from './projects-policy.js';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function firstHeading(text) {
  const m = String(text || '').match(/^#\s+(.+)$/m);
  return m ? m[1].trim().slice(0, 80) : '';
}

function excerpt(text) {
  return String(text || '')
    .replace(/^---[\s\S]*?---\s*/m, '')
    .trim()
    .slice(0, 220);
}

function listFiles(dir, pred) {
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names.filter(pred).map((n) => path.join(dir, n));
}

function walkSkillMd(dir, depth = 0) {
  if (depth > 3) return [];
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory() && !ent.name.startsWith('.')) out.push(...walkSkillMd(abs, depth + 1));
    else if (ent.isFile() && /^skill\.md$/i.test(ent.name)) out.push(abs);
  }
  return out;
}

function associateProject(rel, title, projects) {
  const blob = `${rel} ${title}`.toLowerCase();
  for (const p of projects) {
    const n = String(p.name || '').toLowerCase();
    if (n && blob.includes(n)) return p.name;
  }
  return '';
}

function pushAsset(out, seen, item) {
  const key = `${item.kind}:${item.rel}`.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  out.push(item);
}

/**
 * Reglas/skills/steering de Kiro, Copilot e instrucciones del repo.
 * @param {string} root
 * @param {{ home?: string }} [opts]
 */
export function scanAgentAssets(root, opts = {}) {
  const base = path.resolve(root);
  const home = opts.home || os.homedir();
  const cfg = normalizeProjectsConfig(readJson(afnPath(base, 'projects.json')) || {});
  const projects = activeProjects(cfg);
  const out = [];
  const seen = new Set();

  const addMd = (abs, kind) => {
    let text = '';
    try {
      text = fs.readFileSync(abs, 'utf8');
    } catch {
      return;
    }
    const rel = path.relative(base, abs).replace(/\\/g, '/') || abs.replace(/\\/g, '/');
    const title = firstHeading(text) || path.basename(abs);
    pushAsset(out, seen, {
      kind,
      rel,
      title,
      project: associateProject(rel, title, projects),
      excerpt: excerpt(text),
    });
  };

  for (const f of listFiles(path.join(base, '.kiro', 'steering'), (n) => n.endsWith('.md'))) {
    addMd(f, 'kiro-steering');
  }
  for (const f of listFiles(path.join(home, '.kiro', 'steering'), (n) => n.endsWith('.md'))) {
    addMd(f, 'kiro-steering');
  }
  for (const f of walkSkillMd(path.join(base, '.kiro', 'skills'))) addMd(f, 'kiro-skill');
  for (const f of walkSkillMd(path.join(base, '.github', 'skills'))) addMd(f, 'copilot-skill');
  for (const f of walkSkillMd(path.join(base, '.afn', 'skills'))) addMd(f, 'afn-skill');
  for (const f of listFiles(path.join(base, '.afn', 'prompts'), (n) => n.endsWith('.md'))) {
    addMd(f, 'afn-prompt');
  }

  const copilot = path.join(base, '.github', 'copilot-instructions.md');
  if (fs.existsSync(copilot)) addMd(copilot, 'copilot-instructions');
  for (const f of listFiles(path.join(base, '.github', 'instructions'), (n) => n.endsWith('.md'))) {
    addMd(f, 'copilot-instructions');
  }
  for (const f of listFiles(path.join(base, '.github', 'prompts'), (n) => n.endsWith('.md') || n.endsWith('.prompt.md'))) {
    addMd(f, 'copilot-prompt');
  }

  for (const f of listFiles(path.join(base, '.cursor', 'rules'), (n) => n.endsWith('.mdc') || n.endsWith('.md'))) {
    addMd(f, 'cursor-rule');
  }
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    const f = path.join(base, name);
    if (fs.existsSync(f)) addMd(f, slugify(name.replace('.md', '')) || 'agents-md');
  }

  return {
    ok: true,
    count: out.length,
    assets: out.slice(0, 80),
  };
}

/**
 * @param {string} root
 * @param {{ home?: string }} [opts]
 */
export function persistAgentAssets(root, opts = {}) {
  const scanned = scanAgentAssets(root, opts);
  fs.mkdirSync(afnPath(root), { recursive: true });
  const file = afnPath(root, 'agent-assets.json');
  fs.writeFileSync(file, `${JSON.stringify({ version: 1, scannedAt: new Date().toISOString(), ...scanned }, null, 2)}\n`, 'utf8');
  return { ...scanned, file };
}

export function loadAgentAssets(root) {
  const j = readJson(afnPath(root, 'agent-assets.json'));
  if (j && Array.isArray(j.assets)) return j;
  return scanAgentAssets(root);
}
