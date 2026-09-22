import fs from 'node:fs';
import path from 'node:path';

/**
 * README C4 + arc42 en texto (lo que un LLM entiende de punta a punta).
 * Contexto → contenedores → comunicación → runtime E2E → rutas → esquema.
 * Sin mermaid como fuente. Solo evidencia de disco.
 * @param {object} flow
 */
export function workspaceFlowMarkdown(flow) {
  const f = flow && typeof flow === 'object' ? flow : { projects: [], relationships: [], how: {}, e2e: [], layers: {} };
  const projects = Array.isArray(f.projects) ? f.projects : [];
  const rels = Array.isArray(f.relationships) ? f.relationships : [];
  const how = f.how || {};
  const scope = f.mode === 'cross' ? 'varios repos/paquetes (C4 container = cada uno)' : 'un solo repo (C4 container = este sistema)';
  const lines = [
    '# Arquitectura (punta a punta)',
    '',
    'Inventario del workspace para el agente. Basado en C4 (contexto, contenedores, runtime) y arc42 (bloques, escenario, persistencia).',
    `Ámbito: **${scope}**. ${projects.length} contenedores${f.llmReviewed ? ' · verificado' : ' · disco'}. No inventes lo que no esté acá.`,
    '',
    '## 1. Contexto',
    '',
    'Quién usa el sistema y con qué habla (C4 system context / arc42 §3).',
    '',
    '- Actor: usuario de la capa de presentación (si hay UI) o cliente HTTP de la API.',
  ];
  const neighbors = [];
  for (const p of projects) {
    for (const link of p.envLinks || []) {
      neighbors.push(`${link.key} → ${link.value}`);
    }
  }
  if (neighbors.length) {
    lines.push('- Sistemas vecinos (env, sin secretos):');
    for (const n of [...new Set(neighbors)].slice(0, 10)) lines.push(`  - ${n}`);
  } else {
    lines.push('- Sistemas vecinos: solo los que figuren en compose/env.example. No asumas Stripe/AWS/etc.');
  }

  lines.push('', '## 2. Contenedores', '');
  lines.push('Cada repo o paquete es un contenedor (C4 L2 / black box arc42): responsabilidad, stack, dónde está el código, cómo se llama en otras partes.', '');
  lines.push('| Contenedor | Carpeta | También se llama | Stack / rol | Puerto | Módulos |');
  lines.push('|------------|---------|------------------|---------------|--------|---------|');
  for (const p of projects) {
    const aliases = (p.aliases || []).filter((a) => String(a).toLowerCase() !== String(p.name).toLowerCase()).join(', ');
    const port = p.port ? `:${p.port} (${p.portSource || 'disco'})` : 'sin evidencia';
    const mods = (p.design?.modules || []).join(', ');
    lines.push(`| ${p.name} | \`${p.path || ''}\` | ${aliases || '—'} | ${(p.framework || p.role || p.type || '').trim()} | ${port} | ${mods || '—'} |`);
  }

  lines.push('', '## 3. Comunicación', '');
  lines.push('Cómo se hablan los contenedores (protocolo + contrato). Un repo o varios: la flecha es la misma.', '');
  if (rels.length) {
    lines.push('| Desde | Hasta | Protocolo | Contrato / ruta |');
    lines.push('|-------|-------|-----------|-----------------|');
    for (const r of rels) {
      const proto = r.via === 'proxy' ? 'HTTP proxy' : r.via === 'db' ? 'driver BD' : r.via === 'lambda' ? 'invoke' : (r.via || r.type || 'HTTP');
      lines.push(`| ${r.from} | ${r.to} | ${proto} | ${r.endpoint || '—'} |`);
    }
  } else {
    lines.push('_Sin flechas con evidencia (proxy, compose, env). Si hay un solo contenedor, el E2E es interno. No completes huecos._');
  }

  lines.push('', '## 4. Flujo E2E (runtime)', '');
  lines.push('Un request de punta a punta (C4 dynamic / arc42 §6). Pasos numerados que mapean contenedores reales.', '');
  if (f.e2e?.[0]?.steps?.length) {
    f.e2e[0].steps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
  } else {
    lines.push('_Sin escenario encadenado con evidencia._');
  }

  lines.push('', '## 5. Rutas y contratos', '');
  let anyEp = false;
  for (const p of projects) {
    const eps = Array.isArray(p.endpoints) ? p.endpoints : [];
    const proxies = Array.isArray(p.proxies) ? p.proxies : [];
    const oa = p.design?.openapi;
    if (!eps.length && !proxies.length && !p.prefix && !(oa?.paths || []).length) continue;
    anyEp = true;
    lines.push(`### ${p.name}`);
    if (p.prefix) lines.push(`- Prefix público: \`${p.prefix}\``);
    for (const px of proxies) lines.push(`- Proxy \`${px.path}\` → \`${px.target}\``);
    for (const e of eps) lines.push(`- \`${e.method || 'ANY'} ${e.path}\`${e.via ? ` (${e.via})` : ''}`);
    if (oa?.file) {
      lines.push(`- OpenAPI: \`${oa.file}\``);
      if (oa.schemas?.length) lines.push(`- Esquemas: ${oa.schemas.slice(0, 12).join(', ')}`);
      for (const pt of (oa.paths || []).slice(0, 16)) {
        const ms = (pt.methods || []).join(',') || 'ANY';
        lines.push(`- \`${ms} ${pt.path}\` (openapi)`);
      }
    }
    const env = Array.isArray(p.envLinks) ? p.envLinks : [];
    for (const link of env) lines.push(`- Env \`${link.key}\` = \`${link.value}\``);
    lines.push('');
  }
  if (!anyEp) lines.push('_No hay rutas en proxy, Express/FastAPI, serverless, app router ni OpenAPI._', '');

  lines.push('## 6. Datos y esquemas', '');
  lines.push('Persistencia (arc42 §8). Tablas/modelos leídos de prisma, SQL o ORM. No inventes columnas.', '');
  let anySchema = false;
  for (const p of projects) {
    const d = p.design;
    if (!d?.entities?.length && p.type !== 'database' && !p.db) continue;
    anySchema = true;
    lines.push(`### ${p.name}${p.db ? ` (${p.db})` : ''}`);
    if (d?.schemaFile) lines.push(`- Fuente: \`${d.schemaFile}\` (${d.schemaKind || 'schema'})`);
    for (const ent of d?.entities || []) {
      const fields = (ent.fields || []).slice(0, 8).join(', ');
      const rels = (ent.relations || []).slice(0, 4).join(', ');
      lines.push(`- **${ent.name}**${fields ? `: ${fields}` : ''}${rels ? ` · rel ${rels}` : ''}`);
    }
    if (!d?.entities?.length && p.db) lines.push(`- Motor: ${p.db} (sin schema en disco de este contenedor)`);
    lines.push('');
  }
  if (!anySchema) lines.push('_Sin prisma/SQL/ORM en disco. No asumas tablas._', '');

  lines.push('## 7. Cómo se desarrolla y se prueba', '');
  const local = how.local || [];
  if (local.length) {
    lines.push('Local:');
    for (const x of local) lines.push(`- ${x}`);
  } else lines.push('- Sin script/puerto evidentes.');
  lines.push('', 'Pruebas:');
  for (const x of how.test || []) lines.push(`- ${x}`);
  if (how.addFeature?.length) {
    lines.push('', 'Diseño al agregar una feature:');
    for (const x of how.addFeature) lines.push(`- ${x}`);
  }
  if (how.touch?.length) {
    lines.push('', 'Se toca:', '');
    for (const x of how.touch) lines.push(`- ${x}`);
  }
  if (how.ignore?.length) {
    lines.push('', 'No tocar / no versionar:', '');
    for (const x of how.ignore) lines.push(`- ${x}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Recorte para el prompt: contexto, contenedores, comunicación, E2E.
 * @param {object} flow
 * @param {number} [max]
 */
export function architectureReadmeBrief(flow, max = 1800) {
  const md = workspaceFlowMarkdown(flow);
  const keep = ['# Arquitectura', '## 1.', '## 2.', '## 3.', '## 4.', '## 5.', '## 6.'];
  const parts = md.split(/\n(?=## )/);
  const picked = parts.filter((p, i) => i === 0 || keep.some((k) => p.startsWith(k)));
  const text = (picked.length ? picked.join('\n') : md).replace(/\n{3,}/g, '\n\n');
  if (text.length <= max) return text;
  return `${text.slice(0, max - 48).trimEnd()}\n\n_(completo: ARQUITECTURA.md en la raíz del workspace)_`;
}

const BANNER = '<!-- generado-por-afn: regenerá la arquitectura para actualizar este archivo -->\n';

/**
 * Reinyecta el esquema vivo (MCP) para que regenerar el mapa no lo borre.
 * @param {string} root
 * @param {string} markdown
 */
export function mergeLiveDataIntoReadme(root, markdown) {
  let live = '';
  try {
    live = fs.readFileSync(path.join(root, '.afn', 'diagrams', 'datos.md'), 'utf8').trim();
  } catch {
    live = '';
  }
  if (!live) return String(markdown || '');
  const body = String(markdown || '');
  const without = body.replace(/\n## 6b\. Origen de datos \(MCP\)[\s\S]*?(?=\n## 7\. |\n## 7 |\n*$)/, '\n');
  if (/\n## 7[.\s]/.test(without)) {
    return without.replace(/\n## 7[.\s]/, `\n${live}\n## 7. `);
  }
  return `${without.trimEnd()}\n\n${live}\n`;
}

/**
 * Escribe el README donde se ve: raíz del workspace + .afn (el IDE oculta .afn/diagrams).
 * @param {string} root
 * @param {string} markdown
 */
export function writeArchitectureReadmeFiles(root, markdown) {
  const merged = mergeLiveDataIntoReadme(root, markdown);
  const body = String(merged || '').startsWith('<!-- generado-por-afn')
    ? String(merged)
    : `${BANNER}\n${String(merged || '').trimStart()}`;
  const rootFile = path.join(root, 'ARQUITECTURA.md');
  const afnFile = path.join(root, '.afn', 'ARQUITECTURA.md');
  const diagramsFile = path.join(root, '.afn', 'diagrams', 'arquitectura.md');
  fs.mkdirSync(path.join(root, '.afn', 'diagrams'), { recursive: true });
  fs.writeFileSync(rootFile, body.endsWith('\n') ? body : `${body}\n`, 'utf8');
  fs.writeFileSync(afnFile, body.endsWith('\n') ? body : `${body}\n`, 'utf8');
  fs.writeFileSync(diagramsFile, body.endsWith('\n') ? body : `${body}\n`, 'utf8');
  return { rootFile, afnFile, diagramsFile };
}
