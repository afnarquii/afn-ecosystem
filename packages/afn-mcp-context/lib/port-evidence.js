import fs from 'node:fs';
import path from 'node:path';

const MAX = 40_000;

function readText(file, max = MAX) {
  try {
    return fs.readFileSync(file, 'utf8').slice(0, max);
  } catch {
    return '';
  }
}

function exists(dir, name) {
  return fs.existsSync(path.join(dir, name));
}

function firstExisting(dir, names) {
  for (const n of names) {
    const abs = path.join(dir, n);
    if (fs.existsSync(abs)) return abs;
  }
  return '';
}

function validPort(n) {
  const x = Number(n);
  return Number.isInteger(x) && x >= 1 && x <= 65535 ? x : 0;
}

/**
 * Extrae un puerto de texto real (scripts, yaml, Dockerfile, Makefile). Sin defaults.
 * @param {string} text
 * @returns {{ port: number, via: string } | null}
 */
export function extractPortFromText(text) {
  const s = String(text || '');
  if (!s.trim()) return null;
  const patterns = [
    { via: 'uvicorn', re: /uvicorn\b[\s\S]{0,180}?--port(?:\s+|=|,?\s*")(\d{2,5})/i },
    { via: 'gunicorn', re: /gunicorn\b[^\n]*-b\s+[\w.:]+:(\d{2,5})/i },
    { via: 'vite-port', re: /(?:server|preview)\s*:\s*\{[^}]{0,240}port\s*:\s*(\d{2,5})/ },
    { via: 'flag-port', re: /--port(?:\s+|=|,?\s*")(\d{2,5})/i },
    { via: 'expose', re: /^\s*EXPOSE\s+(\d{2,5})\b/im },
    { via: 'httpPort', re: /httpPort\s*:\s*(\d{2,5})/i },
    { via: 'provider.port', re: /(?:^|\n)\s{0,4}port\s*:\s*(\d{2,5})\s*$/im },
    { via: 'makefile-PORT', re: /^\s*PORT\s*[?:]?=\s*(\d{2,5})\s*$/im },
    { via: 'env-PORT', re: /^\s*(?:PORT|UVICORN_PORT|APP_PORT|HTTP_PORT|VITE_PORT|DEV_PORT|SERVER_PORT)\s*=\s*(\d{2,5})\s*$/im },
    { via: 'compose-map', re: /ports:\s*\n(?:[^\n]*\n){0,6}?\s*-\s*["']?(\d{2,5}):\d{2,5}/i },
  ];
  for (const p of patterns) {
    const m = s.match(p.re);
    if (!m) continue;
    const port = validPort(m[1]);
    if (port) return { port, via: p.via };
  }
  return null;
}

function hit(dir, rel, viaPrefix) {
  const abs = firstExisting(dir, Array.isArray(rel) ? rel : [rel]);
  if (!abs) return null;
  const found = extractPortFromText(readText(abs));
  if (!found) return null;
  return {
    port: found.port,
    source: `${viaPrefix || found.via}:${path.basename(abs)}`,
    file: path.relative(dir, abs).replace(/\\/g, '/') || path.basename(abs),
  };
}

/**
 * Puerto con evidencia de disco. Nunca inventa 3000/4000/5173/8000.
 * @param {string} dir
 * @param {object|null} pkg
 * @returns {{ port?: number, portSource?: string, portFile?: string }}
 */
export function findPortEvidence(dir, pkg = null) {
  const scripts = Object.values(pkg?.scripts || {}).join('\n');
  const fromScripts = extractPortFromText(scripts);
  if (fromScripts) {
    return { port: fromScripts.port, portSource: `scripts:${fromScripts.via}`, portFile: 'package.json' };
  }

  const named = [
    [['Makefile', 'makefile', 'GNUmakefile'], 'makefile'],
    [['serverless.yml', 'serverless.yaml', 'serverless.ts'], 'serverless'],
    [['Dockerfile', 'dockerfile'], 'docker'],
    [['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'], 'compose'],
    [['pyproject.toml'], 'pyproject'],
    [['main.py', 'app.py', 'src/main.py', 'src/app.py', 'api/main.py', 'app/main.py'], 'python'],
    [[path.join('Properties', 'launchSettings.json'), 'launchSettings.json'], 'launch'],
    [['vite.config.js', 'vite.config.ts', 'vite.config.mjs'], 'vite'],
  ];
  for (const [files, tag] of named) {
    const h = hit(dir, files, tag);
    if (h) return { port: h.port, portSource: h.source, portFile: h.file };
  }

  const envFiles = ['.env.example', '.env.sample', '.env.template', '.env.local.example', '.env.local', '.env'];
  for (const name of envFiles) {
    const h = hit(dir, name, 'env');
    if (h) return { port: h.port, portSource: h.source, portFile: name };
  }

  return {};
}

/**
 * Puertos publicados en compose (host:container). Evidencia, no default.
 * @param {string} root
 */
export function composePublishedPorts(root) {
  const file = firstExisting(root, ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']);
  if (!file) return [];
  const src = readText(file, 30_000);
  const out = [];
  const re = /(?:^|\n)\s{2}([\w-]+)\s*:\s*\n[\s\S]*?ports:\s*\n((?:\s+-\s+[^\n]+\n)+)/g;
  let m;
  while ((m = re.exec(src))) {
    const service = m[1];
    const portsBlock = m[2];
    const p = portsBlock.match(/["']?(\d{2,5}):(\d{2,5})/);
    if (p) out.push({ service, hostPort: Number(p[1]), containerPort: Number(p[2]), file: path.basename(file) });
  }
  if (!out.length) {
    for (const x of src.matchAll(/["']?(\d{4,5}):(\d{2,5})/g)) {
      out.push({ service: '', hostPort: Number(x[1]), containerPort: Number(x[2]), file: path.basename(file) });
    }
  }
  return out.slice(0, 12);
}

export { firstExisting, readText, exists, validPort };
