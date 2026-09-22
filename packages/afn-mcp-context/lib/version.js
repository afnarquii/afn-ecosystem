/** Versión del generador de mapa/flujo. Si el pack es más nuevo que el stamp en `.afn/diagrams/workspace-flow.json`, SessionStart regenera las gráficas. */
export const FLOW_GENERATOR_VERSION = '1.4.3';

/**
 * @param {string} a
 * @param {string} b
 * @returns {-1|0|1}
 */
export function compareSemver(a, b) {
  const pa = String(a || '0').split('.').map((x) => Number(x) || 0);
  const pb = String(b || '0').split('.').map((x) => Number(x) || 0);
  for (let i = 0; i < 3; i += 1) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}
