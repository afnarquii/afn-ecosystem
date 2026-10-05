/**
 * Enriquece skills de proceso con ruta, rol del archivo, y flujo de datos.
 * Heurística sobre el código (sin nombres de producto hardcodeados).
 */

export const AFN_PROCESS_FILE_SNIPPET_CHARS = 16000;
export const AFN_PROCESS_ROUTE_SNIPPET_CHARS = 160000;
export const AFN_PROCESS_ROUTE_FILES_MAX = 12;
export const AFN_PROCESS_SNIPPET_FILES_MAX = 72;
export const AFN_PROCESS_INSIGHT_SCREENS_MAX = 8;

const GENERIC_HOOKS = new Set([
  'useState',
  'useEffect',
  'useRef',
  'useCallback',
  'useMemo',
  'useContext',
  'useReducer',
  'useLayoutEffect',
  'useId',
  'useImperativeHandle',
  'useDebugValue',
  'useSyncExternalStore',
  'useDeferredValue',
  'useTransition',
  'useInsertionEffect',
]);

const ROUTE_ELEMENT_SKIP = new Set([
  'Route',
  'Routes',
  'ProtectedElement',
  'ProtectedRoute',
  'Navigate',
  'Suspense',
  'Fragment',
  'Outlet',
  'Provider',
]);

function posix(rel) {
  return String(rel || '').replace(/\\/g, '/');
}

function isPrimarySnippetRel(relPath) {
  const rel = posix(relPath);
  if (/^\.afn\/notes\//i.test(rel)) return true;
  if (/\/ejecutable\//i.test(rel) || /(?:^|\/)dist\//i.test(rel)) return false;
  if (/-[A-Za-z0-9]{8,}\.(js|css)$/.test(fileBase(rel))) return false;
  return /^(src|app)\//i.test(rel);
}

function uniq(list, max = 24) {
  const out = [];
  const seen = new Set();
  for (const raw of list || []) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function fileBase(relPath) {
  return posix(relPath).split('/').pop() || '';
}

function kebabTokens(name) {
  return String(name || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function isLikelyRouteRelPath(relPath) {
  const rel = posix(relPath);
  const base = fileBase(rel);
  if (/^(App|app)\.(jsx?|tsx?)$/.test(base)) return true;
  if (/Rutas?[A-Za-z0-9]*\.(jsx?|tsx?)$/i.test(base)) return true;
  if (/Router[s]?\.(jsx?|tsx?)$/i.test(base)) return true;
  if (/Routes?\.(jsx?|tsx?)$/i.test(base)) return true;
  if (/(^|\/)(pages|app)\/.*layout\.(jsx?|tsx?)$/i.test(rel)) return true;
  if (/Dashboard[A-Za-z0-9]*\.(jsx?|tsx?)$/i.test(base)) return true;
  return false;
}

export function classifyProcessAnchorRole(relPath) {
  const rel = posix(relPath);
  if (/(?:^|\/)\.afn\/notes\//i.test(rel)) return 'nota';
  if (/__tests__|\.test\.|\.spec\.|\/mocks\/|\/(test|tests)\//i.test(rel)) return 'test';
  if (/Slice\.(js|ts)$/i.test(rel)) return 'estado';
  if (/(^|\/)hooks\/use|[\\/]use[A-Z]/.test(rel)) return 'hook';
  if (/\.(css|scss|less)$/i.test(rel)) return 'estilo';
  if (/Component\.(jsx|tsx|js|ts)$/i.test(rel)) return 'pantalla';
  if (/\.(jsx|tsx)$/i.test(rel)) return 'componente';
  return 'archivo';
}

function pathHasProcessId(path, processId) {
  const id = String(processId || '').toLowerCase();
  if (!id) return false;
  const toks = String(path || '')
    .toLowerCase()
    .split(/[/._?&=-]+/)
    .filter(Boolean);
  return toks.includes(id);
}

function elementHasProcessId(name, processId) {
  const id = String(processId || '').toLowerCase();
  if (!id || !name) return false;
  return kebabTokens(name).includes(id);
}

export function extractParentRoutePrefixes(text) {
  const out = [];
  const re = /path\s*=\s*["'](\/[^"'*\s]+)\/\*["']/g;
  let m;
  while ((m = re.exec(String(text || '')))) out.push(m[1]);
  return uniq(out, 8);
}

export function extractRouteBindings(text) {
  const src = String(text || '');
  const out = [];
  const re = /path\s*=\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const path = m[1];
    const after = src.slice(m.index + m[0].length);
    const nextPath = after.search(/\bpath\s*=\s*["']/);
    const span = nextPath >= 0 ? Math.min(nextPath, 220) : 220;
    const tail = src.slice(m.index, m.index + m[0].length + span);
    const names = [...tail.matchAll(/<([A-Za-z][A-Za-z0-9_]*)/g)].map((x) => x[1]);
    const element = names.find((n) => !ROUTE_ELEMENT_SKIP.has(n) && /^[A-Z]/.test(n)) || null;
    const nav = tail.match(/to\s*=\s*["']([^"']+)["']/);
    out.push({ path, element, navigateTo: nav?.[1] || null });
  }
  const navRe = /<Navigate\b[^>]*\bto\s*=\s*["']([^"']+)["']/g;
  while ((m = navRe.exec(src))) {
    out.push({ path: m[1], element: null, navigateTo: m[1] });
  }
  return out;
}

function isAppShellRel(rel) {
  const base = fileBase(rel);
  return /^(App|app)\.(jsx?|tsx?)$/.test(base) || /layout\.(jsx?|tsx?)$/i.test(base);
}

function isUsableParentPrefix(parent) {
  const p = String(parent || '').toLowerCase();
  if (!p.startsWith('/')) return false;
  if (p === '/' || p === '/*') return false;
  if (p.startsWith('/public')) return false;
  return true;
}

function joinParentChild(parent, child) {
  const p = String(parent || '').replace(/\/+$/, '');
  let c = String(child || '').trim();
  if (!c) return p;
  if (!c.startsWith('/')) c = `/${c}`;
  if (c === p || c.startsWith(`${p}/`)) return c;
  return `${p}${c}`;
}

export function collectRoutesForProcess(processId, snippets = {}) {
  const id = String(processId || '').trim().toLowerCase();
  const parents = [];
  const hits = [];
  for (const [rel, text] of Object.entries(snippets || {})) {
    if (!isLikelyRouteRelPath(rel) && !/ruta|router|route|app\.|dashboard/i.test(rel)) {
      continue;
    }
    if (isAppShellRel(rel)) {
      parents.push(...extractParentRoutePrefixes(text).filter(isUsableParentPrefix));
    }
    for (const b of extractRouteBindings(text)) {
      const pathOk = pathHasProcessId(b.path, id) || pathHasProcessId(b.navigateTo || '', id);
      const elOk = elementHasProcessId(b.element, id);
      if (!pathOk && !elOk) continue;
      hits.push({ ...b, pathOk });
    }
  }
  const parentList = uniq(parents, 6).filter((p) => {
    return isUsableParentPrefix(p) && !uniq(parents, 6).some((o) => o !== p && (o.startsWith(`${p}/`) || o.startsWith(`${p}-`)));
  });
  const routes = [];
  for (const h of hits) {
    const child = h.path || '';
    const leaf = String(child).replace(/\\/g, '/').split('/').filter(Boolean).pop() || '';
    const leafIsId = leaf.toLowerCase() === id;
    if (child.startsWith('/')) routes.push(child);
    else if (child) routes.push(`/${child}`);
    if (h.navigateTo && pathHasProcessId(h.navigateTo, id)) routes.push(h.navigateTo);
    if (h.pathOk || leafIsId) {
      for (const p of parentList) {
        if (child) routes.push(joinParentChild(p, child.startsWith('/') ? child : `/${child}`));
      }
    }
  }
  const ranked = uniq(routes, 16).sort((a, b) => {
    const score = (path) => {
      const p = path.toLowerCase();
      const leaf = p.split('/').filter(Boolean).pop() || '';
      const exactLeaf = leaf === id;
      const parentHit = parentList.filter((par) => path === par || path.startsWith(`${par}/`));
      const longest = parentHit.reduce((acc, par) => (par.length > acc.length ? par : acc), '');
      let s = 0;
      if (exactLeaf) s += 150;
      else if (pathHasProcessId(path, id)) s += 40;
      if (longest) s += 20 + longest.length;
      s -= path.split('/').length * 2;
      return s;
    };
    return score(b) - score(a) || a.localeCompare(b);
  });
  const filtered = ranked.filter((r) => pathHasProcessId(r, id)).slice(0, 10);
  return { routes: filtered, parents: parentList, canonical: filtered[0] || '' };
}

function firstJsDoc(text) {
  const src = String(text || '');
  const re = /\/\*\*([\s\S]*?)\*\//g;
  let m;
  while ((m = re.exec(src))) {
    const body = m[1] || '';
    if (/@license|copyright/i.test(body)) continue;
    const lines = body
      .split('\n')
      .map((l) => l.replace(/^\s*\*\s?/, '').trim())
      .filter((l) => l && !l.startsWith('@'));
    const desc = lines.join(' ').replace(/\s+/g, ' ').trim();
    if (desc.length >= 12) return desc.slice(0, 280);
  }
  return '';
}

function firstMdBlurb(text) {
  const src = String(text || '').replace(/^---[\s\S]*?---/, '');
  const h = src.match(/^##?\s+(.+)$/m);
  const hace = src.match(/##\s*Qué hace\s*\n+([^\n#]+)/i);
  const bits = [];
  if (h) bits.push(h[1].trim());
  if (hace) bits.push(hace[1].trim());
  return bits.join(' — ').replace(/\s+/g, ' ').trim().slice(0, 220);
}

function sliceStateKeys(text) {
  const m = String(text || '').match(/const initialState\s*=\s*\{([\s\S]{0,2200})/);
  if (!m) return [];
  return uniq(
    [...m[1].matchAll(/^\s{2}([A-Za-z_][A-Za-z0-9]*)\s*:/gm)].map((x) => x[1]),
    8,
  );
}

export function summarizeProcessFile(relPath, text) {
  const role = classifyProcessAnchorRole(relPath);
  const src = String(text || '');
  if (role === 'nota') return firstMdBlurb(src);
  const jsdoc = firstJsDoc(src);
  if (jsdoc) return jsdoc;
  if (role === 'estado') {
    const keys = sliceStateKeys(src);
    const name = src.match(/createSlice\(\s*\{\s*name:\s*['"]([^"']+)['"]/);
    const bits = [];
    if (name) bits.push(`slice \`${name[1]}\``);
    if (keys.length) bits.push(`estado: ${keys.join(', ')}`);
    return bits.join(' — ');
  }
  return '';
}

function extractPropNames(text) {
  const m = String(text || '').match(
    /(?:function|export\s+default\s+function)\s+[A-Z][A-Za-z0-9_]*\s*\(\s*\{\s*([^}]{1,240})\}/,
  );
  if (!m) return [];
  return uniq(
    m[1]
      .split(',')
      .map((p) => p.replace(/[=:].*$/, '').replace(/\.\.\./, '').trim())
      .filter((p) => /^[A-Za-z_][A-Za-z0-9]*$/.test(p)),
    8,
  );
}

export function extractReceivesFromText(text) {
  const src = String(text || '');
  const out = [];
  const props = extractPropNames(src);
  if (props.length) out.push(`props: ${props.map((p) => `\`${p}\``).join(', ')}`);
  const selectors = uniq(
    [...src.matchAll(/use(?:App)?Selector\(\s*(select[A-Za-z0-9_]+)/g)].map((x) => x[1]),
    10,
  );
  if (selectors.length) out.push(`Redux: ${selectors.map((s) => `\`${s}\``).join(', ')}`);
  if (/\buseParams\s*\(/.test(src)) out.push('URL: `useParams`');
  if (/\buseSearchParams\s*\(/.test(src)) out.push('query: `useSearchParams`');
  const hooks = uniq(
    [...src.matchAll(/\b(use[A-Z][A-Za-z0-9_]*)\s*\(/g)]
      .map((x) => x[1])
      .filter((h) => !GENERIC_HOOKS.has(h) && !/^useAppSelector$|^useSelector$|^useAppDispatch$/.test(h)),
    8,
  );
  if (hooks.length) out.push(`hooks: ${hooks.map((h) => `\`${h}\``).join(', ')}`);
  return out;
}

export function extractSendsFromText(text) {
  const src = String(text || '');
  const out = [];
  const actions = uniq(
    [...src.matchAll(/\bdispatch\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map((x) => x[1]),
    10,
  );
  if (actions.length) out.push(`Redux dispatch: ${actions.map((a) => `\`${a}\``).join(', ')}`);
  else if (/\bdispatch\s*\(/.test(src) && /\buseAppDispatch|useDispatch/.test(src)) {
    out.push('Redux `dispatch` (acciones del slice del proceso)');
  }
  const sps = uniq(
    [...src.matchAll(/\b(?:ejecutarProcedimiento|executeProcedure|callProcedure)\(\s*['"]([A-Za-z0-9_]+)['"]/g)].map(
      (x) => x[1],
    ),
    8,
  );
  if (sps.length) out.push(`API/SP: ${sps.map((s) => `\`${s}\``).join(', ')}`);
  else if (/\bejecutarProcedimiento\s*\(|\bexecuteProcedure\s*\(/.test(src)) {
    out.push('API: `ejecutarProcedimiento` (procedimientos del backend)');
  }
  if (/\baxios\.(post|put|patch|delete)\s*\(/i.test(src) || /\bfetch\s*\([^)]*method:\s*['"]POST/i.test(src)) {
    out.push('HTTP write (`fetch`/`axios`)');
  }
  if (/\benviarMensaje\s*\(|\benviarFactura\s*\(/.test(src)) {
    out.push('mensajería: `enviarMensaje` / `enviarFactura`');
  }
  return out;
}

export function extractProcessSkillInsight(cluster, snippets = {}) {
  const id = String(cluster?.id || '').trim();
  const files = (cluster?.files || []).map(posix);
  const routeInfo = collectRoutesForProcess(id, snippets);
  const screens = [];
  for (const f of files) {
    const role = classifyProcessAnchorRole(f);
    if (!['pantalla', 'estado', 'hook', 'componente'].includes(role)) continue;
    const summary = summarizeProcessFile(f, snippets[f] || '');
    screens.push({ file: f, role, summary });
    if (screens.length >= AFN_PROCESS_INSIGHT_SCREENS_MAX) break;
  }
  const focus = files.filter((f) => {
    const role = classifyProcessAnchorRole(f);
    return role === 'pantalla' || role === 'estado';
  }).slice(0, 2);
  const texts = focus.map((f) => snippets[f] || '').filter(Boolean);
  const receives = uniq(texts.flatMap((t) => extractReceivesFromText(t)), 8);
  const sends = uniq(texts.flatMap((t) => extractSendsFromText(t)), 8);
  return {
    canonical: routeInfo.canonical,
    routes: routeInfo.routes,
    parents: routeInfo.parents,
    screens,
    receives,
    sends,
  };
}

export function formatProcessSkillInsightMarkdown(insight) {
  const ins = insight || {};
  const blocks = [];
  if (ins.routes?.length) {
    const lines = ['## Rutas en la app', ''];
    if (ins.canonical) {
      lines.push(`Ruta canónica: \`${ins.canonical}\`.`);
      lines.push('');
    }
    for (const r of ins.routes) {
      const mark = r === ins.canonical ? ' ← principal' : '';
      lines.push(`- \`${r}\`${mark}`);
    }
    blocks.push(lines.join('\n'));
  }
  const screenLines = (ins.screens || []).filter((s) => s.summary || s.role === 'pantalla' || s.role === 'estado');
  if (screenLines.length) {
    const lines = ['## Qué hace', ''];
    for (const s of screenLines) {
      const hint = s.summary ? ` — ${s.summary}` : '';
      lines.push(`- \`${s.file}\` (${s.role})${hint}`);
    }
    blocks.push(lines.join('\n'));
  }
  if (ins.receives?.length) {
    blocks.push(['## Cómo recibe información', '', ...ins.receives.map((x) => `- ${x}`)].join('\n'));
  }
  if (ins.sends?.length) {
    blocks.push(['## Cómo envía / persiste', '', ...ins.sends.map((x) => `- ${x}`)].join('\n'));
  }
  return blocks.join('\n\n');
}

export function scoreRouteRelPath(relPath) {
  const base = fileBase(relPath);
  if (/^App\.(jsx?|tsx?)$/i.test(base)) return 100;
  if (/Rutas/i.test(base)) return 90;
  if (/Router|Routes/i.test(base)) return 80;
  if (/Dashboard/i.test(base)) return 55;
  if (/layout\.(jsx?|tsx?)$/i.test(base)) return 40;
  return 10;
}

export function selectProcessSkillSnippetRels(relPaths, clusters) {
  const all = (relPaths || []).map(posix).filter(isPrimarySnippetRel);
  const routeCandidates = uniq(all.filter(isLikelyRouteRelPath), 40)
    .sort((a, b) => scoreRouteRelPath(b) - scoreRouteRelPath(a) || a.localeCompare(b));
  const routes = [];
  let dash = 0;
  for (const r of routeCandidates) {
    if (/Dashboard/i.test(fileBase(r))) {
      dash += 1;
      if (dash > 2) continue;
    }
    routes.push(r);
    if (routes.length >= AFN_PROCESS_ROUTE_FILES_MAX) break;
  }
  const roleRank = { pantalla: 0, estado: 1, hook: 2, componente: 3 };
  const anchors = [];
  for (const c of clusters || []) {
    const files = [...(c.files || [])].sort((a, b) => {
      const ra = roleRank[classifyProcessAnchorRole(a)] ?? 9;
      const rb = roleRank[classifyProcessAnchorRole(b)] ?? 9;
      return ra - rb;
    });
    for (const f of files) {
      const role = classifyProcessAnchorRole(f);
      if (['test', 'estilo', 'nota'].includes(role)) continue;
      if (!isPrimarySnippetRel(f)) continue;
      anchors.push(posix(f));
    }
  }
  return uniq([...routes, ...anchors], AFN_PROCESS_SNIPPET_FILES_MAX);
}

export function snippetCharBudget(relPath) {
  if (isLikelyRouteRelPath(relPath)) return AFN_PROCESS_ROUTE_SNIPPET_CHARS;
  if (/Component\.(jsx|tsx|js|ts)$/i.test(relPath) || /Slice\.(js|ts)$/i.test(relPath)) {
    return 28000;
  }
  return AFN_PROCESS_FILE_SNIPPET_CHARS;
}
