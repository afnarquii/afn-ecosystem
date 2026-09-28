/** Editor de texto del dashboard. El contenido no sale del navegador. */

export function textEditorHtml(prefix, title, placeholder) {
  const ph = placeholder || 'Pegá o escribí. Ctrl+F busca. Ctrl+D selecciona la siguiente igual.';
  return `
    <div class="te-wrap" id="${prefix}-wrap">
      <div class="sql-pane-bar">
        <span>${title}</span>
        <span id="${prefix}-pos" class="sql-pos">Línea 1, col 1</span>
        <span class="sql-inspect-spacer"></span>
        <button type="button" class="btn" id="${prefix}-find-open" title="Buscar (Ctrl+F)">Buscar</button>
      </div>
      <div class="sql-findbar" id="${prefix}-findbar" hidden>
        <input id="${prefix}-find" type="search" placeholder="Buscar" autocomplete="off"/>
        <button type="button" class="btn" id="${prefix}-find-case" title="Coincidir mayúsculas">Aa</button>
        <button type="button" class="btn" id="${prefix}-find-sel" title="Buscar solo en lo seleccionado">En selección</button>
        <button type="button" class="btn" id="${prefix}-find-prev">Anterior</button>
        <button type="button" class="btn" id="${prefix}-find-next">Siguiente</button>
        <span id="${prefix}-find-n" class="muted"></span>
        <button type="button" class="btn" id="${prefix}-find-close">Cerrar</button>
      </div>
      <div class="sql-code">
        <pre class="sql-gutter" id="${prefix}-gutter">1</pre>
        <div class="sql-stage">
          <div class="sql-caretline" id="${prefix}-caret"></div>
          <div class="sql-marks" id="${prefix}-marks" aria-hidden="true"></div>
          <pre class="sql-hl" id="${prefix}-hl" aria-hidden="true"></pre>
          <textarea id="${prefix}-ed" class="sql-ed te-ed" spellcheck="false" wrap="off" autocomplete="off" autocorrect="off" autocapitalize="off" placeholder="${ph}"></textarea>
        </div>
      </div>
    </div>`;
}

export function textEditorSection() {
  return `
    <section data-view="editor" hidden class="te-ide">
      <header class="cmp-head">
        <strong>Editor</strong>
        <input id="te-file" type="file" hidden/>
        <button type="button" class="btn" id="te-open">Abrir archivo</button>
        <span id="te-name" class="cmp-name">sin archivo</span>
        <span class="sql-inspect-spacer"></span>
        <span class="muted">Ctrl+F busca · Ctrl+D la siguiente igual · el texto no sale de esta pestaña</span>
      </header>
      ${textEditorHtml('te', 'Texto', 'Pegá o escribí. Números de línea, búsqueda y cursor como en el editor.')}
    </section>`;
}

export function textEditorCss() {
  return `
  section[data-view="editor"].te-ide:not([hidden]) { max-width:none; min-width:0; flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden; gap:.4rem; }
  .te-wrap { display:flex; flex-direction:column; min-width:0; min-height:0; flex:1; height:100%; border:1px solid var(--line); border-radius:12px; overflow:hidden; background:#0b1016; }
  .te-ed.sql-ed { position:absolute; inset:0; z-index:2; min-height:0; width:100%; height:100%; border:0; border-radius:0; resize:none; overflow:auto; padding:.75rem .9rem; font:13.5px/21px Consolas,"Cascadia Mono",ui-monospace,monospace; color:transparent; caret-color:#f8fafc; background:transparent; outline:none; white-space:pre; tab-size:2; font-variant-ligatures:none; }
  .te-ed.sql-ed::selection { background:rgba(37,99,235,.55); color:transparent; }
  .te-ed.sql-ed::placeholder { color:#64748b; }
  `;
}

export function textEditorScript() {
  return `
  (function () {
    const paints = {};
    window.afnEditorPaint = function (id) { if (paints[id]) paints[id](); };
    let cw = 0;
    function charWidth() {
      if (cw) return cw;
      const c = document.createElement("canvas");
      const ctx = c.getContext && c.getContext("2d");
      if (!ctx) return 8.1;
      ctx.font = "13.5px Consolas, Cascadia Mono, monospace";
      cw = ctx.measureText("0000000000").width / 10;
      return cw || 8.1;
    }
    function esc(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    function lineAt(text, pos) {
      let n = 0;
      const stop = Math.min(pos, text.length);
      for (let i = 0; i < stop; i += 1) if (text[i] === "\\n") n += 1;
      return n;
    }
    function colAt(text, pos) {
      const cut = text.slice(0, pos);
      const i = cut.lastIndexOf("\\n");
      return pos - (i + 1);
    }
    function boxes(text, start, end, ta) {
      const a = Math.max(0, Math.min(start, end));
      const b = Math.min(text.length, Math.max(start, end));
      if (b <= a) return [];
      const cs = getComputedStyle(ta);
      const padX = parseFloat(cs.paddingLeft) || 0;
      const padY = parseFloat(cs.paddingTop) || 0;
      const lh = 21;
      const wch = charWidth();
      const lines = text.split("\\n");
      const lineA = lineAt(text, a);
      const lineB = lineAt(text, b);
      const out = [];
      for (let line = lineA; line <= lineB; line += 1) {
        const ca = line === lineA ? colAt(text, a) : 0;
        const cb = line === lineB ? colAt(text, b) : (lines[line] || "").length;
        out.push({
          top: padY + line * lh - ta.scrollTop,
          left: padX + ca * wch - ta.scrollLeft,
          width: Math.max((cb - ca) * wch, 2),
          height: lh,
        });
      }
      return out;
    }
    function bindAfnEditor(prefix) {
      const ta = document.getElementById(prefix + "-ed");
      const gutter = document.getElementById(prefix + "-gutter");
      const hl = document.getElementById(prefix + "-hl");
      const caret = document.getElementById(prefix + "-caret");
      const marks = document.getElementById(prefix + "-marks");
      const pos = document.getElementById(prefix + "-pos");
      const bar = document.getElementById(prefix + "-findbar");
      const find = document.getElementById(prefix + "-find");
      if (!ta || !gutter || !hl) return;
      const st = { at: 0, inSel: false, scope: null, matchCase: false, ranges: [], seed: "", lock: false, note: "" };
      function caretInfo() {
        const v = String(ta.value || "");
        const at = ta.selectionStart || 0;
        const parts = v.slice(0, at).split("\\n");
        return { line: parts.length, col: parts[parts.length - 1].length + 1, total: Math.max(1, v ? v.split("\\n").length : 1) };
      }
      function hits() {
        const q = String(find?.value || "");
        if (!q) return [];
        const text = ta.value || "";
        const hay = st.matchCase ? text : text.toLowerCase();
        const needle = st.matchCase ? q : q.toLowerCase();
        const from = st.inSel && st.scope ? st.scope.start : 0;
        const to = st.inSel && st.scope ? st.scope.end : text.length;
        const out = [];
        let at = hay.indexOf(needle, from);
        while (at >= 0 && at < to) {
          if (at + needle.length <= to) out.push(at);
          at = hay.indexOf(needle, at + Math.max(needle.length, 1));
          if (out.length > 4000) break;
        }
        return out;
      }
      function paint() {
        const text = ta.value || "";
        const info = caretInfo();
        gutter.innerHTML = Array.from({ length: info.total }, (_, i) => "<span class=\\"ln" + (i + 1 === info.line ? " on" : "") + "\\">" + (i + 1) + "</span>").join("");
        hl.textContent = text;
        gutter.scrollTop = ta.scrollTop;
        hl.scrollTop = ta.scrollTop;
        hl.scrollLeft = ta.scrollLeft;
        if (caret) {
          const pad = parseFloat(getComputedStyle(ta).paddingTop) || 0;
          caret.style.height = "21px";
          caret.style.top = ((info.line - 1) * 21 + pad - ta.scrollTop) + "px";
        }
        if (pos) {
          pos.textContent = "Línea " + info.line + ", col " + info.col + " · " + info.total + (info.total === 1 ? " línea" : " líneas") + (st.note ? " · " + st.note : "");
        }
        const q = String(find?.value || "");
        const list = bar && !bar.hidden ? hits() : [];
        const cur = list.length ? list[Math.min(st.at, list.length - 1)] : -1;
        let html = "";
        function add(ranges, cls) {
          ranges.forEach((r) => {
            html += "<i class=\\"sql-mark " + cls + "\\" style=\\"top:" + r.top + "px;left:" + r.left + "px;width:" + r.width + "px;height:" + r.height + "px\\"></i>";
          });
        }
        if (st.inSel && st.scope) add(boxes(text, st.scope.start, st.scope.end, ta), "scope");
        list.forEach((at) => { if (at !== cur) add(boxes(text, at, at + q.length, ta), "hit"); });
        const ss = ta.selectionStart || 0;
        const se = ta.selectionEnd || 0;
        const selIsHit = cur >= 0 && ss === cur && se === cur + q.length;
        if (st.ranges.length) st.ranges.forEach((r) => add(boxes(text, r.start, r.end, ta), "sel"));
        else if (ss !== se && !selIsHit) add(boxes(text, ss, se, ta), "sel");
        if (cur >= 0) add(boxes(text, cur, cur + q.length, ta), "hit on");
        if (marks) marks.innerHTML = html;
        const nEl = document.getElementById(prefix + "-find-n");
        if (nEl) nEl.textContent = !q || (bar && bar.hidden) ? "" : (list.length ? ((Math.min(st.at, list.length - 1) + 1) + " / " + list.length) : "Sin coincidencias");
        document.getElementById(prefix + "-find-case")?.classList.toggle("on", st.matchCase);
        document.getElementById(prefix + "-find-sel")?.classList.toggle("on", st.inSel);
      }
      paints[prefix + "-ed"] = paint;
      function jump(dir) {
        const list = hits();
        if (!list.length) { paint(); return; }
        if (dir === "prev") st.at = (st.at - 1 + list.length) % list.length;
        else st.at = (st.at + 1) % list.length;
        const at = list[st.at];
        const q = String(find?.value || "");
        st.lock = true;
        ta.setSelectionRange(at, at + q.length);
        const line = (ta.value || "").slice(0, at).split("\\n").length;
        ta.scrollTop = Math.max(0, (line - 4) * 21);
        paint();
        setTimeout(() => { st.lock = false; }, 0);
      }
      function openFind() {
        const start = ta.selectionStart || 0;
        const end = ta.selectionEnd || 0;
        const sel = (ta.value || "").slice(start, end);
        if (sel && sel.indexOf("\\n") < 0) {
          if (find) find.value = sel;
          st.inSel = false;
          st.scope = null;
        } else if (start !== end) {
          st.inSel = true;
          st.scope = { start: start, end: end };
        }
        st.at = 0;
        if (bar) bar.hidden = false;
        find?.focus();
        find?.select();
        const list = hits();
        if (list.length) {
          st.lock = true;
          ta.setSelectionRange(list[0], list[0] + String(find?.value || "").length);
          setTimeout(() => { st.lock = false; }, 0);
        }
        paint();
      }
      function wordBounds(text, at) {
        let a = at;
        let b = at;
        const ok = (ch) => /[A-Za-z0-9_@#$.]/.test(ch || "");
        while (a > 0 && ok(text[a - 1])) a -= 1;
        while (b < text.length && ok(text[b])) b += 1;
        if (a === b) return null;
        return { start: a, end: b };
      }
      function selectNext() {
        const text = ta.value || "";
        if (!st.ranges.length) {
          let start = ta.selectionStart || 0;
          let end = ta.selectionEnd || 0;
          if (start === end) {
            const w = wordBounds(text, start);
            if (!w) return;
            start = w.start;
            end = w.end;
            st.seed = text.slice(start, end);
            st.ranges = [{ start: start, end: end }];
            st.lock = true;
            ta.setSelectionRange(start, end);
            st.note = "1 seleccionada. Ctrl+D suma la siguiente.";
            paint();
            setTimeout(() => { st.lock = false; }, 0);
            return;
          }
          st.seed = text.slice(start, end);
          st.ranges = [{ start: start, end: end }];
        }
        if (!st.seed) return;
        const taken = {};
        st.ranges.forEach((r) => { taken[r.start] = true; });
        let from = st.ranges[st.ranges.length - 1].end;
        let found = -1;
        for (let pass = 0; pass < 2 && found < 0; pass += 1) {
          let at = text.indexOf(st.seed, from);
          while (at >= 0) {
            if (!taken[at]) { found = at; break; }
            at = text.indexOf(st.seed, at + Math.max(st.seed.length, 1));
          }
          from = 0;
        }
        if (found >= 0) st.ranges.push({ start: found, end: found + st.seed.length });
        const last = st.ranges[st.ranges.length - 1];
        st.lock = true;
        ta.setSelectionRange(last.start, last.end);
        ta.scrollTop = Math.max(0, ((text.slice(0, last.start).split("\\n").length) - 4) * 21);
        st.note = found < 0 ? ("Ya están todas (" + st.ranges.length + ")") : (st.ranges.length + " seleccionadas iguales");
        paint();
        setTimeout(() => { st.lock = false; }, 0);
      }
      ta.addEventListener("input", () => { st.ranges = []; st.seed = ""; st.note = ""; paint(); });
      ta.addEventListener("scroll", paint);
      ta.addEventListener("keyup", paint);
      ta.addEventListener("click", paint);
      ta.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "d") {
          e.preventDefault();
          e.stopPropagation();
          selectNext();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
          e.preventDefault();
          e.stopPropagation();
          openFind();
          return;
        }
        if (e.key === "Escape" && bar && !bar.hidden) {
          e.preventDefault();
          e.stopPropagation();
          bar.hidden = true;
          st.inSel = false;
          st.scope = null;
          ta.focus();
          paint();
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          const a = ta.selectionStart || 0;
          const b = ta.selectionEnd || 0;
          ta.setRangeText("  ", a, b, "end");
          st.ranges = [];
          paint();
        }
      });
      document.getElementById(prefix + "-find-open")?.addEventListener("click", openFind);
      document.getElementById(prefix + "-find-close")?.addEventListener("click", () => {
        if (bar) bar.hidden = true;
        st.inSel = false;
        st.scope = null;
        ta.focus();
        paint();
      });
      find?.addEventListener("input", () => { st.at = 0; paint(); });
      find?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); jump(e.shiftKey ? "prev" : "next"); }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          if (bar) bar.hidden = true;
          ta.focus();
          paint();
        }
      });
      document.getElementById(prefix + "-find-next")?.addEventListener("click", () => jump("next"));
      document.getElementById(prefix + "-find-prev")?.addEventListener("click", () => jump("prev"));
      document.getElementById(prefix + "-find-case")?.addEventListener("click", () => { st.matchCase = !st.matchCase; st.at = 0; paint(); });
      document.getElementById(prefix + "-find-sel")?.addEventListener("click", () => {
        st.inSel = !st.inSel;
        if (st.inSel && !st.scope) {
          const a = ta.selectionStart || 0;
          const b = ta.selectionEnd || 0;
          if (a !== b) st.scope = { start: a, end: b };
          else st.inSel = false;
        }
        st.at = 0;
        paint();
      });
      document.addEventListener("selectionchange", () => {
        if (document.activeElement !== ta) return;
        if (!st.lock) { st.ranges = []; st.seed = ""; if (!st.note || st.note.indexOf("seleccion") >= 0) st.note = ""; }
        paint();
      });
      paint();
    }
    bindAfnEditor("te");
    bindAfnEditor("cmp-l");
    bindAfnEditor("cmp-r");
    document.getElementById("te-open")?.addEventListener("click", () => document.getElementById("te-file")?.click());
    document.getElementById("te-file")?.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const ed = document.getElementById("te-ed");
        if (ed) ed.value = String(reader.result || "");
        const name = document.getElementById("te-name");
        if (name) name.textContent = file.name || "archivo";
        window.afnEditorPaint("te-ed");
      };
      reader.readAsText(file);
    });
  })();
  `;
}
