import fs from 'node:fs';
import path from 'node:path';
import { afnPath } from './paths.js';
import { detectProjects } from './detect-projects.js';
import { normalizeProjectsConfig } from './projects-policy.js';

const GITIGNORE_MARKER = '# AFN IDE — exclusiones locales (auto)';

const GITIGNORE_BLOCK = `${GITIGNORE_MARKER}
.afn/*
!.afn/MEMORY.md
!.afn/projects.json
!.afn/projects.json.example
!.afn/skills/
!.afn/skills/**
!.afn/prompts/
!.afn/prompts/**
!.afn/specs/
!.afn/specs/**
!.afn/odd/
!.afn/odd/**
!.afn/diagrams/
!.afn/diagrams/**
`;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Si falta projects.json, detecta y escribe. No pisa un JSON existente con proyectos.
 * @param {string} root
 */
export function bootstrapAfn(root) {
  const base = path.resolve(root);
  fs.mkdirSync(afnPath(base), { recursive: true });
  fs.mkdirSync(afnPath(base, 'memory'), { recursive: true });
  fs.mkdirSync(afnPath(base, 'skills'), { recursive: true });

  const pjFile = afnPath(base, 'projects.json');
  const existing = readJson(pjFile);
  const existingNorm = existing ? normalizeProjectsConfig(existing) : null;
  if (existingNorm?.projects?.length) {
    ensureMemoryStub(base);
    ensureGitignore(base);
    return { ok: true, skipped: true, wrote: false, config: existingNorm, reason: 'projects.json ya existe' };
  }

  const ignorePaths = existingNorm?.ignorePaths || [];
  const detected = detectProjects(base, { ignorePaths });
  const config = normalizeProjectsConfig(detected);
  fs.writeFileSync(pjFile, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  ensureMemoryStub(base);
  ensureGitignore(base);
  return { ok: true, skipped: false, wrote: true, config, reason: 'detectado' };
}

function ensureMemoryStub(root) {
  const mem = afnPath(root, 'MEMORY.md');
  if (fs.existsSync(mem)) return;
  fs.writeFileSync(
    mem,
    '# Memoria AFN\n\nHechos durables del producto (no transcripts). El MCP `afn-context` actualiza esta lista.\n',
    'utf8',
  );
  const facts = afnPath(root, 'memory', 'facts.json');
  if (!fs.existsSync(facts)) {
    fs.writeFileSync(facts, `${JSON.stringify({ version: 1, facts: [] }, null, 2)}\n`, 'utf8');
  }
}

function ensureGitignore(root) {
  const gi = path.join(root, '.gitignore');
  let cur = '';
  try {
    cur = fs.readFileSync(gi, 'utf8');
  } catch {
    cur = '';
  }
  if (cur.includes(GITIGNORE_MARKER) || cur.includes('!.afn/MEMORY.md')) return;
  const next = cur.trimEnd() ? `${cur.trimEnd()}\n\n${GITIGNORE_BLOCK}` : GITIGNORE_BLOCK;
  fs.writeFileSync(gi, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
}
