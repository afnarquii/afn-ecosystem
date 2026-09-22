/**
 * Guardrail de consultas del dashboard: lectura (SELECT / WITH) y EXEC de PAs de consulta.
 * No ejecuta nada. Bloquea escrituras, xp_*, EXEC dinámico y sp_configure.
 */

const WRITE =
  /\b(DELETE|INSERT|UPDATE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|MERGE|GRANT|REVOKE|SHUTDOWN|INTO\s+OUTFILE|LOAD\s+DATA|BULK\s+INSERT)\b/i;

const DANGEROUS =
  /\bxp_|\b(sp_configure|sp_executesql|sp_addextendedproc|sp_oacreate|sp_oamethod|openrowset|opendatasource|dbcc)\b/i;

const DYNAMIC_EXEC = /\bEXEC(?:UTE)?\s*\(/i;

const READ_START = /^\s*(WITH|SELECT|EXEC(?:UTE)?|CALL)\b/i;
const SET_NOCOUNT = /^\s*SET\s+NOCOUNT\s+(ON|OFF)\s*$/i;
const DECLARE_ONLY = /^\s*DECLARE\b/i;

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

function splitBatches(sql) {
  return String(sql)
    .split(';')
    .map((p) => stripLeadingComments(p).trim())
    .filter(Boolean);
}

function checkOne(s) {
  if (!s) return { ok: true };
  if (WRITE.test(s)) {
    return { ok: false, error: 'Consulta bloqueada: no DELETE/INSERT/UPDATE/DROP ni otras escrituras.' };
  }
  if (DANGEROUS.test(s) || DYNAMIC_EXEC.test(s)) {
    return { ok: false, error: 'Consulta bloqueada: no EXEC dinámico, xp_*, sp_configure ni OPENROWSET.' };
  }
  if (SET_NOCOUNT.test(s) || DECLARE_ONLY.test(s)) return { ok: true };
  if (READ_START.test(s)) return { ok: true };
  return { ok: false, error: 'Solo SELECT, WITH, EXEC nombrePA o CALL (lectura).' };
}

/**
 * @param {string} sql
 * @returns {{ ok: true, sql: string } | { ok: false, error: string }}
 */
export function assertSafeReadonlySql(sql) {
  const raw = String(sql || '').trim();
  if (!raw) return { ok: false, error: 'SQL vacío' };
  const s = stripLeadingComments(raw).replace(/;+\s*$/g, '').trim();
  if (!s) return { ok: false, error: 'SQL vacío' };
  const parts = splitBatches(s);
  if (!parts.length) return { ok: false, error: 'SQL vacío' };
  let hasRead = false;
  for (const p of parts) {
    const r = checkOne(p);
    if (!r.ok) return r;
    if (READ_START.test(p)) hasRead = true;
  }
  if (!hasRead) {
    return { ok: false, error: 'Falta un SELECT, WITH, EXEC nombrePA o CALL.' };
  }
  return { ok: true, sql: s };
}
