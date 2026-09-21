const SECRET_KEYS = new Set([
  'apikey',
  'api_key',
  'apikeysbyprovider',
  'azurepat',
  'trelotoken',
  'trelloapikey',
  'token',
  'accesstoken',
  'refreshtoken',
  'password',
  'secret',
  'privatekey',
  'credentials',
  'pat',
]);

function normKey(k) {
  return String(k || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Quita secretos de objetos anidados (context.json → prompt).
 * @param {unknown} value
 * @param {number} [depth]
 */
export function redactSecrets(value, depth = 0) {
  if (depth > 6) return null;
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 40).map((v) => redactSecrets(v, depth + 1));
  }
  if (typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 400) return `${value.slice(0, 400)}…`;
    return value;
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SECRET_KEYS.has(normKey(k))) {
      out[k] = '[redacted]';
      continue;
    }
    out[k] = redactSecrets(v, depth + 1);
  }
  return out;
}
