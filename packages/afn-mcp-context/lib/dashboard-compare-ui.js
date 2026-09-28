/** Pestaña Comparar: diff lado a lado en el navegador. El texto no sale de esta pestaña. */
import { alignDiff, prettyJson } from './text-diff.js';

export function compareSection() {
  return `
    <section data-view="comparar" hidden class="cmp-ide">
      <header class="cmp-head">
        <strong>Comparar</strong>
        <label class="cmp-pick">
          <input id="cmp-file-l" type="file" hidden/>
          <button type="button" class="btn" id="cmp-open-l">Abrir izquierda</button>
          <span id="cmp-name-l" class="cmp-name">sin archivo</span>
        </label>
        <button type="button" class="btn sql-ico" id="cmp-swap" title="Intercambiar lados">⇄</button>
        <label class="cmp-pick">
          <input id="cmp-file-r" type="file" hidden/>
          <button type="button" class="btn" id="cmp-open-r">Abrir derecha</button>
          <span id="cmp-name-r" class="cmp-name">sin archivo</span>
        </label>
        <label class="cmp-check"><input id="cmp-json" type="checkbox" checked/> Formatear JSON</label>
        <label class="cmp-check"><input id="cmp-only" type="checkbox"/> Solo cambios</label>
        <button type="button" class="btn" id="cmp-mode">En línea</button>
        <button type="button" class="btn" id="cmp-run">Ver diferencias</button>
        <button type="button" class="btn" id="cmp-edit">Editar texto</button>
      </header>
      <div class="cmp-find">
        <input id="cmp-q" type="search" placeholder="Buscar en la comparación" autocomplete="off"/>
        <button type="button" class="btn" id="cmp-prev">Anterior</button>
        <button type="button" class="btn" id="cmp-next">Siguiente</button>
        <span id="cmp-find-n" class="muted"></span>
        <span class="sql-inspect-spacer"></span>
        <span id="cmp-stats" class="muted"></span>
      </div>
      <p class="cmp-note">Pegá texto o abrí un archivo. Se lee acá, en el navegador. No se guarda y no entra al contexto del agente.</p>
      <div class="cmp-editors" id="cmp-editors">
        <textarea id="cmp-ed-l" spellcheck="false" wrap="off" placeholder="Pegá o escribí el texto de la izquierda. También podés abrir un archivo."></textarea>
        <textarea id="cmp-ed-r" spellcheck="false" wrap="off" placeholder="Pegá o escribí el texto de la derecha. También podés abrir un archivo."></textarea>
      </div>
      <div class="cmp-scroll" id="cmp-scroll"></div>
    </section>`;
}

export function compareCss() {
  return `
  section[data-view="comparar"].cmp-ide:not([hidden]) { max-width:none; min-width:0; flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden; }
  .cmp-head { display:flex; flex-wrap:wrap; gap:.4rem; align-items:center; margin:0 0 .35rem; flex-shrink:0; }
  .cmp-head .btn { padding:.32rem .6rem; }
  .cmp-pick { display:flex; align-items:center; gap:.4rem; min-width:0; }
  .cmp-name { font-size:.75rem; color:var(--muted); max-width:16rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .cmp-check { display:flex; align-items:center; gap:.3rem; font-size:.75rem; color:var(--muted); }
  .cmp-find { display:flex; gap:.35rem; align-items:center; padding:.35rem .5rem; border:1px solid var(--line); border-bottom:0; border-radius:12px 12px 0 0; background:#121a24; }
  .cmp-find input { flex:1; min-width:8rem; background:#0c1118; color:var(--ink); border:1px solid var(--line); border-radius:8px; padding:.35rem .55rem; font:13px Consolas,ui-monospace,monospace; }
  .cmp-note { margin:0; padding:.28rem .7rem; font-size:.72rem; color:var(--muted); background:#101820; border-left:1px solid var(--line); border-right:1px solid var(--line); }
  .cmp-editors { flex:1; min-height:0; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:.45rem; }
  .cmp-editors textarea { width:100%; height:100%; min-height:0; resize:none; border:1px solid var(--line); border-radius:12px; background:#0b1016; color:var(--ink); padding:.65rem .7rem; font:13.5px/21px Consolas,"Cascadia Mono",ui-monospace,monospace; }
  .cmp-ide.cmp-diffing .cmp-editors { display:none; }
  .cmp-ide:not(.cmp-diffing) .cmp-scroll { display:none; }
  .cmp-scroll { flex:1; min-height:0; overflow:auto; border:1px solid var(--line); border-radius:0 0 12px 12px; background:#0b1016; scrollbar-width:thin; scrollbar-color:#5b6b7e #0e141c; }
  .cmp-scroll::-webkit-scrollbar { width:12px; height:12px; }
  .cmp-scroll::-webkit-scrollbar-thumb { background:#3d5166; border-radius:8px; }
  .cmp-empty { padding:1.4rem 1.2rem; color:var(--muted); max-width:46rem; }
  .cmp-cols, .cmp-row { display:grid; grid-template-columns:3.1rem minmax(0,1fr) 3.1rem minmax(0,1fr); }
  .cmp-scroll.inline .cmp-cols, .cmp-scroll.inline .cmp-row { grid-template-columns:3.1rem 1.1rem minmax(0,1fr); }
  .cmp-cols { position:sticky; top:0; z-index:2; background:#15202c; border-bottom:1px solid var(--line); font-size:.72rem; color:#93c5fd; }
  .cmp-cols span { padding:.35rem .55rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .cmp-row { font:13px/21px Consolas,"Cascadia Mono",ui-monospace,monospace; min-width:0; }
  .cmp-ln { color:#5b6b7e; text-align:right; padding:0 .4rem; user-select:none; background:#0e1620; }
  .cmp-code { margin:0; padding:0 .55rem; white-space:pre; overflow:hidden; min-width:0; }
  .cmp-g { text-align:center; color:#94a3b8; user-select:none; }
  .cmp-row.eq .cmp-code { color:#d6e4f0; }
  .cmp-row.del { background:#3f1d1d; }
  .cmp-row.del .cmp-code { color:#fecaca; }
  .cmp-row.add { background:#14301c; }
  .cmp-row.add .cmp-code { color:#bbf7d0; }
  .cmp-row.change { background:#3a2a12; }
  .cmp-row.change .cmp-code { color:#fde68a; }
  .cmp-code .cmp-ch { background:#7f1d1d; color:#fff; border-radius:2px; }
  .cmp-side-r .cmp-ch { background:#166534; color:#ecfdf5; }
  .cmp-hit { background:#854d0e; color:#fef9c3; border-radius:2px; }
  .cmp-hit.on { background:#f59e0b; color:#111827; }
  .cmp-gap { grid-column:1 / -1; padding:.2rem .7rem; color:#64748b; background:#101820; cursor:pointer; font-size:.75rem; border-top:1px solid #1e293b; border-bottom:1px solid #1e293b; }
  .cmp-gap:hover { color:#e2e8f0; }
  `;
}

export function compareScript() {
  return `
  ${alignDiff.toString()}
  ${prettyJson.toString()}
  (function () {
    const cmp = { left: "", right: "", leftName: "Izquierda", rightName: "Derecha", rows: [], hit: 0 };
    const openEq = new Set();
    function esc(s) {
      return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    function pieceHtml(text, changed, q) {
      const raw = String(text ?? "");
      const cls = changed ? "cmp-ch" : "";
      if (!q) return "<span class=\\"" + cls + "\\">" + esc(raw) + "</span>";
      const low = raw.toLowerCase();
      const needle = q.toLowerCase();
      let html = "";
      let from = 0;
      while (from < raw.length) {
        const at = low.indexOf(needle, from);
        if (at < 0) break;
        html += esc(raw.slice(from, at));
        html += "<mark class=cmp-hit>" + esc(raw.slice(at, at + q.length)) + "</mark>";
        from = at + Math.max(q.length, 1);
      }
      html += esc(raw.slice(from));
      return "<span class=\\"" + cls + "\\">" + html + "</span>";
    }
    function cellHtml(text, parts, q) {
      if (text == null && !parts) return "";
      if (parts && parts.length) return parts.map((p) => pieceHtml(p.text, p.changed, q)).join("");
      return pieceHtml(text == null ? "" : text, false, q);
    }
    function sources() {
      const pretty = document.getElementById("cmp-json")?.checked !== false;
      const L = pretty ? prettyJson(cmp.left) : { ok: false, text: cmp.left };
      const R = pretty ? prettyJson(cmp.right) : { ok: false, text: cmp.right };
      return {
        left: pretty && L.ok ? L.text : cmp.left,
        right: pretty && R.ok ? R.text : cmp.right,
        leftJson: L.ok,
        rightJson: R.ok,
        pretty: pretty,
      };
    }
    function paintStats(src) {
      const el = document.getElementById("cmp-stats");
      if (!el) return;
      let add = 0, del = 0, ch = 0;
      cmp.rows.forEach((r) => {
        if (r.kind === "add") add += 1;
        else if (r.kind === "del") del += 1;
        else if (r.kind === "change") ch += 1;
      });
      const bits = ["+" + add + "  −" + del + "  ~" + ch];
      if (src.pretty && cmp.left && !src.leftJson) bits.push("izquierda no es JSON");
      if (src.pretty && cmp.right && !src.rightJson) bits.push("derecha no es JSON");
      el.textContent = bits.join(" · ");
    }
    function runDiff() {
      const src = sources();
      cmp.rows = (!cmp.left && !cmp.right) ? [] : alignDiff(src.left, src.right);
      cmp.hit = 0;
      paintStats(src);
      paintCmp("reset");
    }
    function blocks() {
      const only = document.getElementById("cmp-only")?.checked;
      if (!only) return cmp.rows.map((r, i) => ({ r: r, i: i }));
      const out = [];
      let eqStart = -1;
      let eqCount = 0;
      function flush() {
        if (eqCount <= 0) return;
        if (openEq.has(eqStart)) {
          for (let k = 0; k < eqCount; k += 1) out.push({ r: cmp.rows[eqStart + k], i: eqStart + k });
        } else out.push({ gap: true, at: eqStart, count: eqCount });
        eqCount = 0;
        eqStart = -1;
      }
      cmp.rows.forEach((r, i) => {
        if (r.kind === "eq") {
          if (eqStart < 0) eqStart = i;
          eqCount += 1;
        } else {
          flush();
          out.push({ r: r, i: i });
        }
      });
      flush();
      return out;
    }
    function paintCmp(jump) {
      const box = document.getElementById("cmp-scroll");
      const nEl = document.getElementById("cmp-find-n");
      if (!box) return;
      const inline = box.classList.contains("inline");
      const q = String(document.getElementById("cmp-q")?.value || "").trim();
      if (!cmp.rows.length) {
        box.innerHTML = "<div class=cmp-empty><p>Pegá un texto en cada lado, o abrí un archivo, y tocá Ver diferencias.</p><p>Si son JSON, se formatean para alinear claves. Buscar resalta y salta a la coincidencia. Solo cambios oculta las líneas iguales.</p></div>";
        if (nEl) nEl.textContent = "";
        return;
      }
      const view = blocks();
      const leftTitle = esc(cmp.leftName || "Izquierda");
      const rightTitle = esc(cmp.rightName || "Derecha");
      let html = inline
        ? "<div class=cmp-cols><span></span><span></span><span>Comparación</span></div>"
        : "<div class=cmp-cols><span></span><span>" + leftTitle + "</span><span></span><span>" + rightTitle + "</span></div>";
      view.forEach((item) => {
        if (item.gap) {
          html += "<button type=button class=cmp-gap data-gap=\\"" + item.at + "\\">⋯ " + item.count + " líneas iguales</button>";
          return;
        }
        const r = item.r;
        const left = cellHtml(r.left, r.leftParts, q);
        const right = cellHtml(r.right, r.rightParts, q);
        if (inline) {
          if (r.kind === "del" || r.kind === "change") {
            html += "<div class=\\"cmp-row del\\"><span class=cmp-ln>" + (r.leftNo || "") + "</span><span class=cmp-g>−</span><pre class=cmp-code>" + left + "</pre></div>";
          }
          if (r.kind === "add" || r.kind === "change") {
            html += "<div class=\\"cmp-row add\\"><span class=cmp-ln>" + (r.rightNo || "") + "</span><span class=cmp-g>+</span><pre class=\\"cmp-code cmp-side-r\\">" + right + "</pre></div>";
          }
          if (r.kind === "eq") {
            html += "<div class=\\"cmp-row eq\\"><span class=cmp-ln>" + (r.leftNo || "") + "</span><span class=cmp-g> </span><pre class=cmp-code>" + left + "</pre></div>";
          }
          return;
        }
        const markR = r.kind === "add" || r.kind === "change";
        html += "<div class=\\"cmp-row " + r.kind + "\\">";
        html += "<span class=cmp-ln>" + (r.leftNo || "") + "</span><pre class=cmp-code>" + (r.left == null ? "" : left) + "</pre>";
        html += "<span class=cmp-ln>" + (r.rightNo || "") + "</span><pre class=\\"cmp-code" + (markR ? " cmp-side-r" : "") + "\\">" + (r.right == null ? "" : right) + "</pre>";
        html += "</div>";
      });
      box.innerHTML = html;
      const marks = [...box.querySelectorAll("mark.cmp-hit")];
      if (!marks.length) {
        if (nEl) nEl.textContent = q ? "Sin coincidencias" : "";
        return;
      }
      if (jump === "next") cmp.hit = (cmp.hit + 1) % marks.length;
      else if (jump === "prev") cmp.hit = (cmp.hit - 1 + marks.length) % marks.length;
      else if (jump !== "stay") cmp.hit = 0;
      if (cmp.hit >= marks.length) cmp.hit = 0;
      marks.forEach((m, i) => m.classList.toggle("on", i === cmp.hit));
      if (jump !== "stay") marks[cmp.hit]?.scrollIntoView({ block: "center", inline: "nearest" });
      if (nEl) nEl.textContent = (cmp.hit + 1) + " / " + marks.length;
    }
    function cmpSection() {
      return document.querySelector("section[data-view=comparar]");
    }
    function showEditors(on) {
      cmpSection()?.classList.toggle("cmp-diffing", !on);
    }
    function pullEditors() {
      const l = document.getElementById("cmp-ed-l");
      const r = document.getElementById("cmp-ed-r");
      if (l) l.value = cmp.left;
      if (r) r.value = cmp.right;
    }
    function pushEditors() {
      const l = document.getElementById("cmp-ed-l");
      const r = document.getElementById("cmp-ed-r");
      if (l) cmp.left = l.value || "";
      if (r) cmp.right = r.value || "";
    }
    function markPasted(side) {
      const isL = side === "l";
      const key = isL ? "leftName" : "rightName";
      const plain = isL ? "Texto izquierdo" : "Texto derecho";
      const current = cmp[key];
      if (!current || current === "Izquierda" || current === "Derecha" || current === "sin archivo") cmp[key] = plain;
      const el = document.getElementById(isL ? "cmp-name-l" : "cmp-name-r");
      if (el && cmp[key] === plain) el.textContent = plain;
    }
    function readFile(file, side) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || "");
        if (side === "l") { cmp.left = text; cmp.leftName = file.name || "Izquierda"; }
        else { cmp.right = text; cmp.rightName = file.name || "Derecha"; }
        const name = document.getElementById(side === "l" ? "cmp-name-l" : "cmp-name-r");
        if (name) name.textContent = file.name || "archivo";
        pullEditors();
        showEditors(false);
        runDiff();
      };
      reader.readAsText(file);
    }
    function bindDrop(el, side) {
      if (!el) return;
      el.addEventListener("dragover", (e) => { e.preventDefault(); });
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (!file) return;
        readFile(file, side);
      });
    }
    document.getElementById("cmp-open-l")?.addEventListener("click", () => document.getElementById("cmp-file-l")?.click());
    document.getElementById("cmp-open-r")?.addEventListener("click", () => document.getElementById("cmp-file-r")?.click());
    document.getElementById("cmp-file-l")?.addEventListener("change", (e) => readFile(e.target.files && e.target.files[0], "l"));
    document.getElementById("cmp-file-r")?.addEventListener("change", (e) => readFile(e.target.files && e.target.files[0], "r"));
    document.getElementById("cmp-swap")?.addEventListener("click", () => {
      pushEditors();
      const L = cmp.left; cmp.left = cmp.right; cmp.right = L;
      const N = cmp.leftName; cmp.leftName = cmp.rightName; cmp.rightName = N;
      const nl = document.getElementById("cmp-name-l");
      const nr = document.getElementById("cmp-name-r");
      if (nl) nl.textContent = cmp.left ? cmp.leftName : "sin archivo";
      if (nr) nr.textContent = cmp.right ? cmp.rightName : "sin archivo";
      pullEditors();
      if (cmpSection()?.classList.contains("cmp-diffing")) runDiff();
    });
    function compareNow() {
      pushEditors();
      showEditors(false);
      runDiff();
    }
    function onEditorKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        compareNow();
      }
    }
    document.getElementById("cmp-ed-l")?.addEventListener("input", () => markPasted("l"));
    document.getElementById("cmp-ed-r")?.addEventListener("input", () => markPasted("r"));
    document.getElementById("cmp-ed-l")?.addEventListener("keydown", onEditorKey);
    document.getElementById("cmp-ed-r")?.addEventListener("keydown", onEditorKey);
    document.getElementById("cmp-run")?.addEventListener("click", compareNow);
    document.getElementById("cmp-edit")?.addEventListener("click", () => {
      pullEditors();
      showEditors(true);
      document.getElementById("cmp-ed-l")?.focus();
    });
    bindDrop(document.getElementById("cmp-ed-l"), "l");
    bindDrop(document.getElementById("cmp-ed-r"), "r");
    document.getElementById("cmp-json")?.addEventListener("change", runDiff);
    document.getElementById("cmp-only")?.addEventListener("change", () => paintCmp("reset"));
    document.getElementById("cmp-mode")?.addEventListener("click", () => {
      const box = document.getElementById("cmp-scroll");
      const btn = document.getElementById("cmp-mode");
      if (!box) return;
      const inline = box.classList.toggle("inline");
      if (btn) btn.textContent = inline ? "Lado a lado" : "En línea";
      paintCmp("stay");
    });
    document.getElementById("cmp-q")?.addEventListener("input", () => paintCmp("reset"));
    document.getElementById("cmp-next")?.addEventListener("click", () => paintCmp("next"));
    document.getElementById("cmp-prev")?.addEventListener("click", () => paintCmp("prev"));
    document.getElementById("cmp-q")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      paintCmp(e.shiftKey ? "prev" : "next");
    });
    const scroll = document.getElementById("cmp-scroll");
    scroll?.addEventListener("click", (e) => {
      const btn = e.target.closest && e.target.closest("[data-gap]");
      if (!btn) return;
      const at = Number(btn.getAttribute("data-gap"));
      if (openEq.has(at)) openEq.delete(at); else openEq.add(at);
      paintCmp("stay");
    });
    scroll?.addEventListener("dragover", (e) => { e.preventDefault(); });
    scroll?.addEventListener("drop", (e) => {
      e.preventDefault();
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      const rect = scroll.getBoundingClientRect();
      const side = (e.clientX - rect.left) < rect.width / 2 ? "l" : "r";
      readFile(file, side);
    });
    window.addEventListener("keydown", (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "f") return;
      if (document.querySelector("nav button.on")?.dataset.go !== "comparar") return;
      e.preventDefault();
      const q = document.getElementById("cmp-q");
      q?.focus();
      q?.select();
    });
    runDiff();
  })();
  `;
}
