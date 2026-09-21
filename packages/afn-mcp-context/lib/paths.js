import path from 'node:path';
import { resolveProjectRoot as resolveRootSmart } from './resolve-root.js';

export const AFN_DIR = '.afn';
export const MAX_SNAPSHOT_CHARS = 3200;
export const MAX_FACTS = 200;
export const MAX_PROJECTS = 40;
export const MAX_FACT_CHARS = 2000;

/**
 * @param {string} [override]
 */
export function resolveProjectRoot(override) {
  return resolveRootSmart(override);
}

/**
 * @param {string} root
 * @param {...string} parts
 */
export function afnPath(root, ...parts) {
  return path.join(root, AFN_DIR, ...parts);
}

/**
 * @param {string} raw
 */
export function pathKeyOf(raw) {
  return (
    String(raw || '')
      .replace(/\\/g, '/')
      .replace(/^\.\//, '')
      .replace(/\/+$/, '')
      .toLowerCase() || '.'
  );
}

/**
 * @param {string} name
 */
export function slugify(name) {
  const s = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return s || 'proyecto';
}
