import fs from 'node:fs';
import path from 'node:path';

const MAX_READ = 48_000;

function readText(file, max = MAX_READ) {
  try {
    return fs.readFileSync(file, 'utf8').slice(0, max);
  } catch {
    return '';
  }
}

function exists(dir, name) {
  return fs.existsSync(path.join(dir, name));
}

function listNames(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function firstExisting(dir, names) {
  for (const n of names) {
    const abs = path.join(dir, n);
    if (fs.existsSync(abs)) return abs;
  }
  return '';
}

function depBlob(pkg) {
  return Object.keys({ ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) }).join(' ').toLowerCase();
}

function envExample(dir) {
  const file = firstExisting(dir, ['.env.example', '.env.sample', '.env.template', '.env.local.example']);
  return file ? readText(file, 12_000) : '';
}

function pickEnv(text, keys) {
  const lines = String(text || '').split(/\r?\n/);
  for (const key of keys) {
    const re = new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, 'i');
    for (const line of lines) {
      if (/^\s*#/.test(line)) continue;
      const m = line.match(re);
      if (m) return m[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

function urlPath(raw) {
  const s = String(raw || '').trim();
  if (!s || s.includes('${')) return '';
  try {
    const u = new URL(s);
    return u.pathname && u.pathname !== '/' ? u.pathname.replace(/\/+$/, '') : '';
  } catch {
    if (s.startsWith('/')) return s.replace(/\/+$/, '') || '';
    return '';
  }
}

function urlPort(raw) {
  const s = String(raw || '').trim();
  try {
    const u = new URL(s);
    if (u.port) return Number(u.port);
  } catch {
    const m = s.match(/localhost:(\d{2,5})/i);
    if (m) return Number(m[1]);
  }
  return 0;
}

function dbKindFrom(text, deps) {
  const blob = `${text} ${deps}`.toLowerCase();
  if (/postgres|postgresql|pg\b/.test(blob)) return 'postgresql';
  if (/mysql|mariadb/.test(blob)) return 'mysql';
  if (/\bmongodb|mongoose\b/.test(blob)) return 'mongodb';
  if (/\bsqlite\b/.test(blob)) return 'sqlite';
  if (/\bredis\b/.test(blob)) return 'redis';
  if (/\bsqlserver|mssql|tedious\b/.test(blob)) return 'sqlserver';
  if (/\bdynamodb\b/.test(blob)) return 'dynamodb';
  return '';
}

export function inferFramework(dir, pkg) {
  const deps = depBlob(pkg);
  if (exists(dir, 'angular.json') || /@angular\/core/.test(deps)) return 'angular';
  if (/\bnext\b/.test(deps) || exists(dir, 'next.config.js') || exists(dir, 'next.config.mjs') || exists(dir, 'next.config.ts')) return 'next';
  if (/\bnuxt\b/.test(deps)) return 'nuxt';
  if (/\bsvelte\b/.test(deps) || exists(dir, 'svelte.config.js')) return 'svelte';
  if (/\bvue\b/.test(deps) || exists(dir, 'vue.config.js')) return 'vue';
  if (/\breact-native\b/.test(deps)) return 'react-native';
  if (/\breact\b/.test(deps)) return 'react';
  if (/\bvite\b/.test(deps) || exists(dir, 'vite.config.js') || exists(dir, 'vite.config.ts') || exists(dir, 'vite.config.mjs')) return 'vite';
  if (/\b@nestjs\/core\b/.test(deps)) return 'nestjs';
  if (/\bexpress\b/.test(deps)) return 'express';
  if (/\bfastify\b/.test(deps)) return 'fastify';
  if (/\bhono\b/.test(deps)) return 'hono';
  if (/\bkoa\b/.test(deps)) return 'koa';
  if (exists(dir, 'go.mod')) return 'go';
  if (exists(dir, 'pyproject.toml') || exists(dir, 'requirements.txt')) return 'python';
  if (exists(dir, 'Cargo.toml')) return 'rust';
  if (listNames(dir).some((n) => n.endsWith('.csproj'))) return 'dotnet';
  if (exists(dir, 'pom.xml') || exists(dir, 'build.gradle')) return 'jvm';
  if (exists(dir, 'pubspec.yaml')) return 'flutter';
  return '';
}

export function inferRole(type, framework) {
  const t = String(type || '').toLowerCase();
  if (t === 'frontend' || t === 'web' || t === 'client') return 'presentación';
  if (t === 'mobile') return 'app móvil';
  if (t === 'desktop') return 'escritorio';
  if (t === 'database' || t === 'db') return 'datos';
  if (t === 'cloud' || t === 'infra') return 'cloud / lambda';
  if (t === 'security' || t === 'auth') return 'seguridad';
  if (t === 'queue' || t === 'messagebus') return 'mensajería';
  if (framework === 'next' || framework === 'nuxt') return 'presentación + api';
  if (t === 'backend' || t === 'api') return 'api';
  return t || 'servicio';
}

function inferPrefixFromDisk(dir, type, env) {
  const apiUrl = pickEnv(env, ['VITE_API_URL', 'REACT_APP_API_URL', 'NEXT_PUBLIC_API_URL', 'API_URL', 'API_BASE', 'API_PREFIX']);
  const fromUrl = urlPath(apiUrl);
  if (fromUrl) return fromUrl;
  const proxy = inferProxyTargets(dir);
  if (proxy[0]?.path) return proxy[0].path;
  const entry = firstExisting(dir, ['server.js', 'index.js', 'app.js', 'src/index.js', 'src/server.js', 'src/app.js', 'src/main.ts']);
  if (entry) {
    const src = readText(entry, 20_000);
    const m = src.match(/\.(?:use|get|post|all)\(\s*['"](\/[^'"]+)['"]/);
    if (m) return m[1].replace(/\/+$/, '') || m[1];
  }
  if (type === 'backend') return '';
  return '';
}

export function inferProxyTargets(dir) {
  const file = firstExisting(dir, [
    'vite.config.js', 'vite.config.ts', 'vite.config.mjs',
    'webpack.config.js', 'webpack.config.ts',
    'next.config.js', 'next.config.mjs', 'next.config.ts',
  ]);
  if (!file) return [];
  const src = readText(file);
  const out = [];
  const pair = /['"](\/[^'"]+)['"]\s*:\s*['"](https?:\/\/[^'"]+)['"]/g;
  let m;
  while ((m = pair.exec(src))) {
    out.push({ path: m[1], target: m[2], port: urlPort(m[2]) });
  }
  const obj = /['"](\/[^'"]+)['"]\s*:\s*\{[^}]*target\s*:\s*['"](https?:\/\/[^'"]+)['"]/g;
  while ((m = obj.exec(src))) {
    out.push({ path: m[1], target: m[2], port: urlPort(m[2]) });
  }
  return out.slice(0, 8);
}

function inferPortExtra(dir, pkg, type, env) {
  const fromEnv = Number(pickEnv(env, ['PORT', 'VITE_PORT', 'DEV_PORT']) || 0);
  if (fromEnv >= 1) return fromEnv;
  const launch = firstExisting(dir, [
    path.join('Properties', 'launchSettings.json'),
    'launchSettings.json',
  ]);
  if (launch) {
    const u = readText(launch).match(/https?:\/\/[^"'\s]+:(\d{2,5})/);
    if (u) return Number(u[1]);
  }
  const scripts = Object.values(pkg?.scripts || {}).join(' ');
  const m = scripts.match(/--port(?:\s|=)(\d{2,5})/i) || scripts.match(/-p\s+(\d{2,5})/);
  if (m) return Number(m[1]);
  return undefined;
}

function inferDb(dir, pkg, env) {
  const prisma = readText(path.join(dir, 'prisma', 'schema.prisma'), 8_000);
  const fromPrisma = prisma.match(/provider\s*=\s*"([^"]+)"/);
  if (fromPrisma) return fromPrisma[1];
  const url = pickEnv(env, ['DATABASE_URL', 'DB_URL', 'MONGO_URL', 'REDIS_URL']);
  const fromUrl = dbKindFrom(url, '');
  if (fromUrl) return fromUrl;
  if (exists(dir, 'prisma')) return 'sql';
  return dbKindFrom('', depBlob(pkg));
}

function inferTechnologies(dir, pkg, framework, db) {
  const deps = depBlob(pkg);
  const tech = [];
  if (framework) tech.push(framework);
  if (db) tech.push(db);
  if (/\btypescript\b/.test(deps) || exists(dir, 'tsconfig.json')) tech.push('typescript');
  if (exists(dir, 'Dockerfile')) tech.push('docker');
  if (exists(dir, 'serverless.yml') || exists(dir, 'serverless.ts') || exists(dir, 'template.yaml')) tech.push('serverless');
  if (exists(dir, path.join('src', 'app', 'api')) || exists(dir, path.join('pages', 'api'))) tech.push('http-routes');
  if (exists(dir, 'openapi.yaml') || exists(dir, 'swagger.json') || exists(dir, 'openapi.json')) tech.push('openapi');
  if (/\baws-sdk|@aws-sdk\b/.test(deps)) tech.push('aws-sdk');
  return [...new Set(tech)].slice(0, 10);
}

function inferLayer(type, framework, hasLambda) {
  const t = String(type || '').toLowerCase();
  if (t === 'frontend' || t === 'mobile' || t === 'desktop') return 'presentation';
  if (t === 'database') return 'data';
  if (t === 'cloud' || hasLambda) return 'cloud';
  if (t === 'security') return 'auth';
  if (t === 'queue' || t === 'messagebus') return 'async';
  if (framework === 'next' || framework === 'nuxt') return 'presentation';
  return 'api';
}

function inferCommands(pkg) {
  const s = pkg?.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
  const dev = s.dev || s.start || s.serve || '';
  const test = s.test || s['test:unit'] || s['test:e2e'] || '';
  return { devCommand: String(dev).slice(0, 80), testCommand: String(test).slice(0, 80) };
}

function inferLambdas(dir) {
  const yml = readText(firstExisting(dir, ['serverless.yml', 'serverless.yaml', 'serverless.ts', 'template.yaml']) || '', 20_000);
  const names = [];
  const fn = /(?:^|\n)\s{2,4}([A-Za-z][\w-]*)\s*:\s*(?:\n|.*handler)/g;
  let m;
  while ((m = fn.exec(yml))) {
    const n = m[1];
    if (['provider', 'plugins', 'package', 'custom', 'resources', 'service'].includes(n)) continue;
    names.push(n);
  }
  const folders = ['functions', 'lambda', 'lambdas', 'src/functions'];
  for (const f of folders) {
    if (exists(dir, f)) names.push(f);
  }
  return [...new Set(names)].slice(0, 8);
}

function inferEndpoints(dir, prefix, proxies) {
  const out = [];
  for (const p of proxies) {
    out.push({ method: 'ANY', path: p.path, via: 'proxy' });
  }
  if (prefix && !out.some((e) => e.path === prefix)) {
    out.push({ method: 'ANY', path: prefix, via: exists(dir, path.join('src', 'app', 'api')) ? 'direct' : 'direct' });
  }
  return out.slice(0, 12);
}

/**
 * Señales de un directorio de proyecto. Sin LLM. Sin producto hardcodeado.
 * @param {string} abs
 * @param {{ name?: string, type?: string, pkg?: object }} [hint]
 */
export function scanProjectSignals(abs, hint = {}) {
  const pkg = hint.pkg && typeof hint.pkg === 'object' ? hint.pkg : (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(abs, 'package.json'), 'utf8'));
    } catch {
      return null;
    }
  })();
  const type = hint.type || 'unknown';
  const env = envExample(abs);
  const framework = inferFramework(abs, pkg);
  const proxies = inferProxyTargets(abs);
  const prefix = inferPrefixFromDisk(abs, type, env);
  const db = inferDb(abs, pkg, env);
  const lambdas = inferLambdas(abs);
  const cmds = inferCommands(pkg);
  const port = inferPortExtra(abs, pkg, type, env);
  const technologies = inferTechnologies(abs, pkg, framework, db);
  const layer = inferLayer(type, framework, lambdas.length > 0);
  return {
    framework,
    role: inferRole(type, framework),
    db,
    prefix,
    port,
    proxies,
    lambdas,
    technologies,
    layer,
    devCommand: cmds.devCommand,
    testCommand: cmds.testCommand,
    endpoints: inferEndpoints(abs, prefix, proxies),
    hasServerless: lambdas.length > 0,
  };
}

export function scanComposeServices(root) {
  const file = firstExisting(root, ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']);
  if (!file) return [];
  const src = readText(file, 30_000);
  const out = [];
  if (/postgres|mysql|mongo|redis|mssql/i.test(src)) {
    const db = dbKindFrom(src, '') || 'database';
    const portM = src.match(/["']?(\d{4,5}):(?:5432|3306|27017|6379|1433)/);
    out.push({
      name: db === 'database' ? 'db' : db,
      type: 'database',
      db,
      port: portM ? Number(portM[1]) : undefined,
      role: 'datos',
      layer: 'data',
    });
  }
  return out;
}

export { inferPortExtra, envExample, pickEnv, urlPort };
