/**
 * Señales de “acá hay un proyecto”, sin amarrar el mapa a package.json.
 * Cubre JavaScript/TypeScript, Python, Go, .NET, Gradle y el resto de manifiestos.
 */
import fs from 'node:fs';
import path from 'node:path';

const SKIP = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'vendor',
  '.next',
  'venv',
  '.venv',
  '__pycache__',
  'bin',
  'obj',
]);

export const LAYOUT_MANIFEST_FILES = Object.freeze([
  'package.json',
  'go.mod',
  'pyproject.toml',
  'requirements.txt',
  'setup.py',
  'Pipfile',
  'Cargo.toml',
  'pubspec.yaml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'settings.gradle.kts',
  'angular.json',
  'serverless.yml',
  'serverless.yaml',
]);

function entries(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

export function hasFile(dir, name) {
  return fs.existsSync(path.join(dir, name));
}

function isProjFile(name) {
  return /\.(csproj|fsproj|vbproj)$/i.test(name);
}

function isSlnFile(name) {
  return String(name || '').toLowerCase().endsWith('.sln');
}

export function hasNamedManifest(dir) {
  return LAYOUT_MANIFEST_FILES.some((f) => hasFile(dir, f));
}

export function hasSolutionFile(dir) {
  return entries(dir).some((e) => e.isFile() && isSlnFile(e.name));
}

export function hasDotnetFileHere(dir) {
  return entries(dir).some((e) => e.isFile() && (isSlnFile(e.name) || isProjFile(e.name)));
}

/** `.csproj` (u otro proyecto .NET) en un subdirectorio inmediato. */
export function hasDotnetProjectOneLevelDown(dir) {
  for (const ent of entries(dir)) {
    if (!ent.isDirectory() || ent.name.startsWith('.')) continue;
    if (SKIP.has(ent.name.toLowerCase())) continue;
    const sub = path.join(dir, ent.name);
    if (entries(sub).some((e) => e.isFile() && isProjFile(e.name))) return true;
  }
  return false;
}

export function hasPythonLayout(dir) {
  return hasFile(dir, 'setup.py') || hasFile(dir, 'Pipfile') || hasFile(dir, 'pyproject.toml') || hasFile(dir, 'requirements.txt');
}

export function hasGradleLayout(dir) {
  return ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'].some((f) => hasFile(dir, f));
}

/**
 * La carpeta es un paquete o una solución, aunque el manifiesto no sea package.json.
 * @param {string} dir
 */
export function hasLayoutSignal(dir) {
  return hasNamedManifest(dir) || hasDotnetFileHere(dir) || hasDotnetProjectOneLevelDown(dir);
}

/**
 * Hijo de una solución: solo el .csproj, sin otro stack. No entra como proyecto aparte.
 * @param {string} dir
 */
export function isDotnetChildOfSolution(dir) {
  const foreign = [
    'package.json',
    'go.mod',
    'pyproject.toml',
    'requirements.txt',
    'setup.py',
    'Pipfile',
    'Cargo.toml',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'pubspec.yaml',
    'angular.json',
  ];
  if (foreign.some((f) => hasFile(dir, f))) return false;
  return entries(dir).some((e) => e.isFile() && isProjFile(e.name));
}

/**
 * La raíz del workspace entra al mapa cuando ella misma es el proyecto
 * (solución .NET, Python o Gradle), no solo porque tenga package.json de un monorepo.
 * @param {string} dir
 */
export function workspaceRootIsProject(dir) {
  return hasSolutionFile(dir)
    || hasFile(dir, 'setup.py')
    || hasFile(dir, 'Pipfile')
    || hasGradleLayout(dir)
    || hasDotnetFileHere(dir)
    || hasDotnetProjectOneLevelDown(dir);
}
