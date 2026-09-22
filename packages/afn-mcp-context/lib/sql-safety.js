/**
 * Guardrail de consultas del dashboard (espejo de notions: solo SELECT/WITH).
 * No ejecuta nada.
 */

const FORBIDDEN =
  /\b(DELETE|INSERT|UPDATE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|MERGE|GRANT|REVOKE|SHUTDOWN|EXEC(?:UTE)?|CALL|INTO\s+OUTFILE|LOAD\s+DATA|BULK\s+INSERT|xp_|sp_configure|OPENROWSET|OPENDATASOURCE)\b/i;

const SELECT_LIKE = /^\s*(WITH|SELECT)\b/is;

function stripLeadingComments(sql) {
  let s = String(sql || '').trim();
  while (s.length) {
    if (s.startsWith('--')) {
      const nl = s.indexOf('\n');
      s = nl === -1 ? '' : s.slice(nl + 1).trimStart();
      continue;
    }
    if (s.startsWith('/*')) {
      const end = s.indexOf('*/');
      s = end === -1 ? '' : s.slice(end + 2).trimStart();
      continue;
    }
    break;
  }
  return s;
}

/**
 * @param {string} sql
 * @returns {{ ok: true, sql: string } | { ok: false, error: string }}
 */
export function assertSafeReadonlySql(sql) {
  const raw = String(sql || '').trim();
  if (!raw) return { ok: false, error: 'SQL vacío' };
  let s = stripLeadingComments(raw).replace(/;+\s*$/g, '').trim();
  if (!s) return { ok: false, error: 'SQL vacío' };
  if (FORBIDDEN.test(s)) {
    return { ok: false, error: 'Consulta bloqueada: solo lectura (SELECT / WITH). No DELETE/INSERT/UPDATE/DROP/EXEC.' };
  }
  if (!SELECT_LIKE.test(s)) {
    return { ok: false, error: 'Solo se permite SELECT o WITH … SELECT.' };
  }
  if (/;/.test(s)) {
    const parts = s.split(';').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      for (const p of parts) {
        const r = assertSafeReadonlySql(p);
        if (!r.ok) return { ok: false, error: `Lote SQL inválido: ${r.error}` };
      }
    }
  }
  return { ok: true, sql: s };
}
