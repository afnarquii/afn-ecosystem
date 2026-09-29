/** Cruce en memoria de hasta 3 resultados SQL. No lee archivos ni credenciales. */

function columnsOf(rows) {
  const seen = new Set();
  const out = [];
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row || typeof row !== 'object') return;
    Object.keys(row).forEach((k) => {
      if (!seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    });
  });
  return out;
}

function keyOf(row, fields) {
  return fields.map((f) => String(row?.[f] ?? '')).join('\u0001');
}

/**
 * @param {{ name?: string, rows?: object[] }[]} tabs
 * @param {{ a: number, b: number, aField: string, bField: string }[]} links
 */
export function crossSqlResults(tabs, links) {
  const list = [0, 1, 2].map((i) => ({
    name: String(tabs?.[i]?.name || `Consulta ${i + 1}`),
    rows: Array.isArray(tabs?.[i]?.rows) ? tabs[i].rows : [],
  }));
  const cols = list.map((t) => columnsOf(t.rows));
  const clean = (Array.isArray(links) ? links : []).filter((l) => {
    const a = Number(l?.a);
    const b = Number(l?.b);
    return Number.isInteger(a) && Number.isInteger(b) && a !== b && a >= 0 && a < 3 && b >= 0 && b < 3
      && String(l.aField || '').trim() && String(l.bField || '').trim();
  }).map((l) => ({
    a: Number(l.a),
    b: Number(l.b),
    aField: String(l.aField),
    bField: String(l.bField),
  }));

  function fieldsToward(tab, other) {
    const out = [];
    clean.forEach((l) => {
      if (l.a === tab && l.b === other) out.push(l.aField);
      if (l.b === tab && l.a === other) out.push(l.bField);
    });
    return out;
  }

  const pairKeys = [];
  const seenPair = new Set();
  clean.forEach((l) => {
    const id = [l.a, l.b].sort((x, y) => x - y).join('-');
    if (seenPair.has(id)) return;
    seenPair.add(id);
    pairKeys.push([Math.min(l.a, l.b), Math.max(l.a, l.b)]);
  });

  const matched = [new Set(), new Set(), new Set()];
  const withNames = list.map((t) => t.rows.map(() => []));
  pairKeys.forEach(([a, b]) => {
    const fa = fieldsToward(a, b);
    const fb = fieldsToward(b, a);
    if (!fa.length || !fb.length) return;
    const index = new Map();
    list[b].rows.forEach((row, i) => {
      const k = keyOf(row, fb);
      if (!index.has(k)) index.set(k, []);
      index.get(k).push(i);
    });
    list[a].rows.forEach((row, i) => {
      const hits = index.get(keyOf(row, fa)) || [];
      hits.forEach((j) => {
        matched[a].add(i);
        matched[b].add(j);
        if (!withNames[a][i].includes(list[b].name)) withNames[a][i].push(list[b].name);
        if (!withNames[b][j].includes(list[a].name)) withNames[b][j].push(list[a].name);
      });
    });
  });

  const degree = [0, 0, 0];
  pairKeys.forEach(([a, b]) => {
    degree[a] += 1;
    degree[b] += 1;
  });
  let base = 0;
  degree.forEach((d, i) => {
    if (d > degree[base]) base = i;
  });
  if (!degree[base]) {
    const first = list.findIndex((t) => t.rows.length);
    base = first >= 0 ? first : 0;
  }
  const others = [0, 1, 2].filter((i) => i !== base);
  const indexes = {};
  others.forEach((o) => {
    const otherFields = fieldsToward(o, base);
    const baseFields = fieldsToward(base, o);
    if (!otherFields.length || !baseFields.length) return;
    const map = new Map();
    list[o].rows.forEach((row, i) => {
      const k = keyOf(row, otherFields);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(i);
    });
    indexes[o] = { map, baseFields };
  });

  const used = [new Set(), new Set(), new Set()];
  const filas = [];
  const pushSlot = (slot, cruza) => {
    if (filas.length >= 5000) return;
    filas.push({
      cruza,
      consulta1: slot[0],
      consulta2: slot[1],
      consulta3: slot[2],
    });
  };
  list[base].rows.forEach((row, i) => {
    used[base].add(i);
    others.forEach((o) => {
      const idx = indexes[o];
      if (!idx) return;
      (idx.map.get(keyOf(row, idx.baseFields)) || []).forEach((n) => used[o].add(n));
    });
    const lists = others.map((o) => {
      const idx = indexes[o];
      if (!idx) return [null];
      const hits = idx.map.get(keyOf(row, idx.baseFields)) || [];
      return hits.length ? hits.map((n) => list[o].rows[n]) : [null];
    });
    let acc = [[]];
    lists.forEach((items) => {
      const next = [];
      acc.forEach((prefix) => items.forEach((item) => next.push(prefix.concat([item]))));
      acc = next.slice(0, 40);
    });
    acc.forEach((combo) => {
      const slot = [null, null, null];
      slot[base] = row;
      others.forEach((o, n) => {
        slot[o] = combo[n];
        if (combo[n]) {
          const ri = list[o].rows.indexOf(combo[n]);
          if (ri >= 0) used[o].add(ri);
        }
      });
      const linked = others.filter((o) => indexes[o]);
      const cruza = linked.length > 0 && linked.every((o) => slot[o]);
      pushSlot(slot, cruza);
    });
  });
  others.forEach((o) => {
    list[o].rows.forEach((row, i) => {
      if (used[o].has(i)) return;
      const slot = [null, null, null];
      slot[o] = row;
      pushSlot(slot, false);
    });
  });

  const present = new Map();
  cols.forEach((c, i) => c.forEach((name) => {
    if (!present.has(name)) present.set(name, []);
    present.get(name).push(list[i].name);
  }));
  const enComun = [];
  const solo = {};
  list.forEach((t) => { solo[t.name] = []; });
  present.forEach((who, name) => {
    if (who.length >= 2) enComun.push(name);
    else solo[who[0]].push(name);
  });
  const diferencias = [];
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      if (i === j) continue;
      const falta = cols[i].filter((name) => !cols[j].includes(name));
      if (falta.length) diferencias.push({ de: list[i].name, faltaEn: list[j].name, campos: falta });
    }
  }

  const panes = list.map((t, i) => t.rows.map((row, ri) => ({
    cruza: matched[i].has(ri),
    con: withNames[i][ri],
    fila: row,
  })));

  return {
    nombres: list.map((t) => t.name),
    campos: { enComun, solo, diferencias },
    filas,
    panes,
    recortado: filas.length >= 5000,
  };
}
