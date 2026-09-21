/**
 * README de arquitectura para el LLM: nombres, rutas, quién llama a quién, flujo.
 * Un modelo lee esto mejor que mermaid (el diagrama queda opcional para humanos).
 * @param {object} flow
 */
export function workspaceFlowMarkdown(flow) {
  const f = flow && typeof flow === 'object' ? flow : { projects: [], relationships: [], how: {}, e2e: [], layers: {} };
  const projects = Array.isArray(f.projects) ? f.projects : [];
  const rels = Array.isArray(f.relationships) ? f.relationships : [];
  const how = f.how || {};
  const lines = [
    '# Arquitectura del workspace',
    '',
    'Documento para el agente: nombres reales, rutas, conexiones y cómo correr. No inventes lo que no esté acá.',
    '',
    `Modo: **${f.mode || 'single'}** · ${projects.length} componentes${f.llmReviewed ? ' · verificado' : ' · inventario de disco'}.`,
    '',
    '## Nombres (cómo se llama en cada parte)',
    '',
    '| Nombre en el mapa | Carpeta | También se llama | Stack | Puerto (evidencia) |',
    '|-------------------|---------|------------------|-------|---------------------|',
  ];
  for (const p of projects) {
    const aliases = (p.aliases || []).filter((a) => String(a).toLowerCase() !== String(p.name).toLowerCase()).join(', ');
    const port = p.port ? `:${p.port} (${p.portSource || 'disco'})` : 'sin evidencia';
    lines.push(`| ${p.name} | \`${p.path || ''}\` | ${aliases || '—'} | ${(p.framework || p.role || p.type || '').trim()} | ${port} |`);
  }

  lines.push('', '## Quién llama a quién', '');
  if (rels.length) {
    lines.push('| Desde | Hasta | Cómo | Ruta / contrato |');
    lines.push('|-------|-------|------|-----------------|');
    for (const r of rels) {
      lines.push(`| ${r.from} | ${r.to} | ${r.via || r.type || 'link'} | ${r.endpoint || '—'} |`);
    }
  } else {
    lines.push('_Sin flechas con evidencia (proxy, compose, env). No completes huecos._');
  }

  lines.push('', '## Rutas y endpoints', '');
  let anyEp = false;
  for (const p of projects) {
    const eps = Array.isArray(p.endpoints) ? p.endpoints : [];
    const proxies = Array.isArray(p.proxies) ? p.proxies : [];
    if (!eps.length && !proxies.length && !p.prefix) continue;
    anyEp = true;
    lines.push(`### ${p.name}`);
    if (p.prefix) lines.push(`- Prefix público: \`${p.prefix}\``);
    for (const px of proxies) {
      lines.push(`- Proxy \`${px.path}\` → \`${px.target}\``);
    }
    for (const e of eps) {
      lines.push(`- \`${e.method || 'ANY'} ${e.path}\`${e.via ? ` (${e.via})` : ''}`);
    }
    const env = Array.isArray(p.envLinks) ? p.envLinks : [];
    for (const link of env) {
      lines.push(`- Env \`${link.key}\` = \`${link.value}\``);
    }
    lines.push('');
  }
  if (!anyEp) lines.push('_No hay rutas en manifiestos, proxy, FastAPI/Express, serverless ni app router._', '');

  lines.push('## Flujo (pasos, no diagrama)', '');
  if (f.e2e?.[0]?.steps?.length) {
    f.e2e[0].steps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
  } else if (rels.length) {
    rels.forEach((r, i) => {
      lines.push(`${i + 1}. **${r.from}** → **${r.to}** ${r.endpoint || r.via || ''}`.trim());
    });
  } else {
    lines.push('_Sin flujo encadenado con evidencia._');
  }

  const layers = f.layers || {};
  const layerBits = [
    layers.presentation?.length && `presentación: ${layers.presentation.join(', ')}`,
    layers.api?.length && `api: ${layers.api.join(', ')}`,
    layers.data?.length && `datos: ${layers.data.join(', ')}`,
    layers.cloud?.length && `cloud: ${layers.cloud.join(', ')}`,
  ].filter(Boolean);
  if (layerBits.length) {
    lines.push('', '## Capas', '');
    for (const x of layerBits) lines.push(`- ${x}`);
  }

  lines.push('', '## Cómo se desarrolla local', '');
  const local = how.local || [];
  if (local.length) for (const x of local) lines.push(`- ${x}`);
  else lines.push('- Sin script/puerto evidentes en los manifiestos.');

  lines.push('', '## Cómo se prueba', '');
  for (const x of how.test || []) lines.push(`- ${x}`);

  lines.push('', '## Cómo agregar funcionalidad', '');
  for (const x of how.addFeature || []) lines.push(`- ${x}`);
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
 * Recorte para inyectar al prompt (mismas secciones, sin mermaid).
 * @param {object} flow
 * @param {number} [max]
 */
export function architectureReadmeBrief(flow, max = 1800) {
  const md = workspaceFlowMarkdown(flow);
  const keep = ['# Arquitectura', '## Nombres', '## Quién llama', '## Rutas', '## Flujo', '## Cómo se desarrolla'];
  const parts = md.split(/\n(?=## )/);
  const picked = parts.filter((p, i) => i === 0 || keep.some((k) => p.startsWith(k) || p.startsWith(k.replace('## ', '## '))));
  const text = (picked.length ? picked.join('\n') : md).replace(/\n{3,}/g, '\n\n');
  if (text.length <= max) return text;
  return `${text.slice(0, max - 40).trimEnd()}\n\n_(completo: .afn/diagrams/arquitectura.md)_`;
}
