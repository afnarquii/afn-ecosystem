/**
 * Diff de texto para la pestaña Comparar. Corre en el dashboard (toString)
 * y en tests. No persiste ni entra al contexto del agente.
 */

export function prettyJson(text) {
  const raw = String(text ?? '');
  const t = raw.trim();
  if (!t) return { ok: false, text: raw };
  try {
    return { ok: true, text: JSON.stringify(JSON.parse(t), null, 2) };
  } catch {
    return { ok: false, text: raw };
  }
}

function normLines(text) {
  const s = String(text ?? '').replace(/\r\n/g, '\n');
  if (!s) return [];
  const lines = s.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function tokens(line) {
  const out = [];
  const re = /\s+|[^\s]+/g;
  const str = String(line ?? '');
  let m = re.exec(str);
  while (m) {
    out.push(m[0]);
    m = re.exec(str);
  }
  if (!out.length) out.push('');
  return out;
}

function lcsOps(a, b, eq) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      ops.push({ t: 'eq', left: a[i], right: b[j] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ t: 'del', left: a[i], right: null });
      i += 1;
    } else {
      ops.push({ t: 'add', left: null, right: b[j] });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ t: 'del', left: a[i], right: null });
    i += 1;
  }
  while (j < m) {
    ops.push({ t: 'add', left: null, right: b[j] });
    j += 1;
  }
  return ops;
}

function windowAlign(a, b) {
  const ops = [];
  let i = 0;
  let j = 0;
  const W = 60;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ t: 'eq', left: a[i], right: b[j] });
      i += 1;
      j += 1;
      continue;
    }
    let foundR = -1;
    for (let k = 1; k <= W && j + k < b.length; k += 1) {
      if (a[i] === b[j + k]) { foundR = k; break; }
    }
    let foundL = -1;
    for (let k = 1; k <= W && i + k < a.length; k += 1) {
      if (b[j] === a[i + k]) { foundL = k; break; }
    }
    if (foundR >= 0 && (foundL < 0 || foundR <= foundL)) {
      for (let k = 0; k < foundR; k += 1) ops.push({ t: 'add', left: null, right: b[j + k] });
      j += foundR;
    } else if (foundL >= 0) {
      for (let k = 0; k < foundL; k += 1) ops.push({ t: 'del', left: a[i + k], right: null });
      i += foundL;
    } else {
      ops.push({ t: 'del', left: a[i], right: null });
      ops.push({ t: 'add', left: null, right: b[j] });
      i += 1;
      j += 1;
    }
  }
  while (i < a.length) {
    ops.push({ t: 'del', left: a[i], right: null });
    i += 1;
  }
  while (j < b.length) {
    ops.push({ t: 'add', left: null, right: b[j] });
    j += 1;
  }
  return ops;
}

function wordDiff(left, right) {
  const A = tokens(left);
  const B = tokens(right);
  if (A.length * B.length > 20000) {
    return {
      left: [{ text: String(left ?? ''), changed: true }],
      right: [{ text: String(right ?? ''), changed: true }],
    };
  }
  const ops = lcsOps(A, B, (x, y) => x === y);
  const lp = [];
  const rp = [];
  ops.forEach((op) => {
    if (op.t === 'eq') {
      lp.push({ text: op.left, changed: false });
      rp.push({ text: op.right, changed: false });
    } else if (op.t === 'del') lp.push({ text: op.left, changed: true });
    else rp.push({ text: op.right, changed: true });
  });
  return { left: lp, right: rp };
}

function fold(ops) {
  const rows = [];
  let li = 1;
  let ri = 1;
  let p = 0;
  while (p < ops.length) {
    if (ops[p].t === 'eq') {
      rows.push({
        kind: 'eq',
        left: ops[p].left,
        right: ops[p].right,
        leftNo: li,
        rightNo: ri,
        leftParts: null,
        rightParts: null,
      });
      li += 1;
      ri += 1;
      p += 1;
      continue;
    }
    const dels = [];
    const adds = [];
    while (p < ops.length && ops[p].t !== 'eq') {
      if (ops[p].t === 'del') dels.push(ops[p].left);
      else adds.push(ops[p].right);
      p += 1;
    }
    const n = Math.max(dels.length, adds.length);
    for (let k = 0; k < n; k += 1) {
      const L = k < dels.length ? dels[k] : null;
      const R = k < adds.length ? adds[k] : null;
      let kind = 'change';
      if (L == null) kind = 'add';
      else if (R == null) kind = 'del';
      const parts = kind === 'change' ? wordDiff(L, R) : null;
      rows.push({
        kind,
        left: L,
        right: R,
        leftNo: L == null ? null : li,
        rightNo: R == null ? null : ri,
        leftParts: parts ? parts.left : null,
        rightParts: parts ? parts.right : null,
      });
      if (L != null) li += 1;
      if (R != null) ri += 1;
    }
  }
  return rows;
}

export function alignDiff(leftText, rightText) {
  const A = normLines(leftText);
  const B = normLines(rightText);
  let start = 0;
  while (start < A.length && start < B.length && A[start] === B[start]) start += 1;
  let endA = A.length - 1;
  let endB = B.length - 1;
  while (endA >= start && endB >= start && A[endA] === B[endB]) {
    endA -= 1;
    endB -= 1;
  }
  const midA = A.slice(start, endA + 1);
  const midB = B.slice(start, endB + 1);
  const midOps = (midA.length * midB.length > 800000)
    ? windowAlign(midA, midB)
    : lcsOps(midA, midB, (x, y) => x === y);
  const ops = [];
  for (let i = 0; i < start; i += 1) ops.push({ t: 'eq', left: A[i], right: B[i] });
  midOps.forEach((op) => ops.push(op));
  for (let i = endA + 1, j = endB + 1; i < A.length && j < B.length; i += 1, j += 1) {
    ops.push({ t: 'eq', left: A[i], right: B[j] });
  }
  return fold(ops);
}
