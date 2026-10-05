/**
 * Descubrir a pedido: mapa de las carpetas marcadas + skills de proceso.
 * No se llama al abrir el dashboard. No usa un modelo.
 */
import { saveMapSelection, listMapFolders } from './map-selection.js';
import { bootstrapAfn } from './bootstrap.js';
import { writeProcessSkills } from '../../afn-project-process-skills/generate.mjs';

/**
 * @param {string} root
 * @param {string[]|null} [paths] vacío = las que ya están marcadas en el mapa
 */
export async function discoverWorkspace(root, paths = null) {
  let selected = Array.isArray(paths) ? paths.map((p) => String(p || '').trim()).filter(Boolean) : [];
  if (!selected.length) {
    const listed = listMapFolders(root);
    selected = (listed.folders || []).filter((f) => f.selected).map((f) => f.path);
  }
  if (!selected.length) return { ok: false, error: 'sin-carpetas' };

  const saved = saveMapSelection(root, selected);
  if (!saved.ok) return saved;

  const boot = bootstrapAfn(root, { refresh: true, ceiling: root });
  if (!boot.ok) return { ok: false, error: boot.reason || 'bootstrap_failed', projects: saved.projects };

  const skills = await writeProcessSkills(root, {
    include: (saved.projects || []).map((p) => p.path),
  });
  return {
    ok: true,
    projects: saved.projects,
    ignorePaths: saved.ignorePaths,
    skills: skills.count,
    slashes: skills.slashes,
    mapReason: boot.reason,
  };
}
