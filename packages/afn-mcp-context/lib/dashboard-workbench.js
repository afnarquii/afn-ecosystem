/** UI del workbench Datos (orígenes, esquema, SQL). Sin dependencias. */

export function workbenchSections() {
  return `
    <section data-view="origenes" hidden>
      <h2>Orígenes de datos</h2>
      <p class="lead">Completá host, puerto y base. La contraseña <strong>no</strong> va acá: archivo <code>.afn/credentials/data-agent.json</code>.</p>
      <p id="wb-api-warn" class="muted" hidden style="color:#fbbf24">Esta pestaña no puede guardar: recargá con «abre dashboard AFN» (URL 127.0.0.1 con token).</p>
      <p id="wb-origins-msg" class="muted" role="status"></p>
      <div class="article" id="wb-origins-form" style="max-width:640px">
        <label class="muted" style="display:block;margin:.6rem 0 .25rem">Nombre</label>
        <input id="wb-o-name" type="text" placeholder="Pedidos QA" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid var(--line);background:#0b1016;color:inherit"/>
        <label class="muted" style="display:block;margin:.6rem 0 .25rem">Motor</label>
        <select id="wb-o-engine" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid var(--line);background:#0b1016;color:inherit">
          <option value="sqlserver">SQL Server</option>
          <option value="postgresql">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="mongodb">MongoDB</option>
        </select>
        <label class="muted" style="display:block;margin:.6rem 0 .25rem">Host</label>
        <input id="wb-o-host" type="text" placeholder="localhost o el servidor" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid var(--line);background:#0b1016;color:inherit"/>
        <label class="muted" style="display:block;margin:.6rem 0 .25rem">Puerto</label>
        <input id="wb-o-port" type="number" placeholder="1433 / 5432 / 3306" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid var(--line);background:#0b1016;color:inherit"/>
        <label class="muted" style="display:block;margin:.6rem 0 .25rem">Base / database</label>
        <input id="wb-o-database" type="text" placeholder="nombre de la base" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid var(--line);background:#0b1016;color:inherit"/>
        <div class="toolbar" style="margin-top:1rem">
          <button type="button" class="btn" id="wb-origins-save">Guardar origen</button>
          <button type="button" class="btn" id="wb-origins-reload">Recargar</button>
        </div>
      </div>
      <div class="article" id="wb-cred-box" style="max-width:640px;margin-top:1.25rem">
        <h3>Contraseña — <code>.afn/credentials/data-agent.json</code></h3>
        <p id="wb-cred-status" class="muted" role="status">Host/puerto/base van arriba. Acá solo usuario y password. El archivo no se versiona.</p>
        <p class="muted">Un origen (SQL Server o PostgreSQL):</p>
        <pre class="sql-ed" id="wb-cred-example">{
  "DB_USER": "sa",
  "DB_PASSWORD": "TU_PASSWORD"
}</pre>
        <p class="muted">Varios orígenes (el <code>id</code> es el del JSON de orígenes, p. ej. <code>origen_1</code>):</p>
        <pre class="sql-ed">{
  "byId": {
    "origen_1": { "DB_USER": "sa", "DB_PASSWORD": "TU_PASSWORD" }
  }
}</pre>
        <p class="muted">MongoDB:</p>
        <pre class="sql-ed">{
  "MONGODB_URI": "mongodb://USER:PASSWORD@localhost:27017/db"
}</pre>
      </div>
      <details style="margin-top:1rem">
        <summary class="muted">JSON (varios orígenes)</summary>
        <textarea id="wb-origins-json" spellcheck="false" class="sql-ed" rows="10" placeholder='{ "connections": [] }'></textarea>
      </details>
    </section>
    <section data-view="esquema" hidden>
      <h2>Tablas y procedimientos para la arquitectura</h2>
      <p class="lead">Marcá las 3 tablas o el PA que usa el flujo. El resto queda en la captura completa (<code>datos-live.json</code>) pero no entra a <code>ARQUITECTURA.md</code>.</p>
      <div class="toolbar">
        <input id="wb-schema-q" type="search" placeholder="Filtrar…" style="flex:1;min-width:160px"/>
        <button type="button" class="btn" id="wb-schema-all">Todas</button>
        <button type="button" class="btn" id="wb-schema-none">Ninguna</button>
        <button type="button" class="btn" id="wb-schema-save">Guardar selección</button>
        <span id="wb-schema-msg" class="muted"></span>
      </div>
      <p class="muted" id="wb-schema-count"></p>
      <div id="wb-schema-tables"></div>
      <h3>Procedimientos</h3>
      <div id="wb-schema-procs"></div>
    </section>
    <section data-view="sql" hidden class="sql-ide">
      <h2>Consulta SQL</h2>
      <p class="lead">Editor de solo lectura: <code>SELECT</code>, <code>WITH</code> y <code>EXEC dbo.NombrePA @p = 1</code>. F5 o Ctrl+Enter. Lupa por fila o casillas para varias: previsualizador JSON/Texto (igual que Connect BD).</p>
      <p id="wb-sql-driver" class="muted">Driver: comprobando…</p>
      <div class="sql-ide-toolbar">
        <label>Origen <select id="wb-sql-origin"></select></label>
        <label>Límite <input id="wb-sql-limit" type="number" value="200" min="1" max="2000" style="width:4.8rem"/></label>
        <button type="button" class="btn btn-run" id="wb-sql-run" title="F5">▶ Ejecutar</button>
        <span class="sql-export">
          <button type="button" class="btn" id="wb-sql-xls" title="Excel">Excel</button>
          <button type="button" class="btn" id="wb-sql-json">JSON</button>
          <button type="button" class="btn" id="wb-sql-txt">TXT</button>
          <button type="button" class="btn" id="wb-sql-csv">CSV</button>
        </span>
        <button type="button" class="btn" id="wb-sql-fav">★ Guardar</button>
        <button type="button" class="btn" id="wb-sql-fav-open">Favoritos</button>
      </div>
      <div class="sql-ide-split">
        <div class="sql-editor-wrap" id="wb-sql-editor">
          <div class="sql-pane-bar">
            <span>Consulta</span>
            <span class="sql-inspect-spacer"></span>
            <button type="button" class="btn sql-ico" id="wb-sql-ed-max" title="Maximizar el editor">⛶</button>
            <button type="button" class="btn sql-ico" id="wb-sql-ed-min" title="Minimizar el editor">−</button>
          </div>
          <pre class="sql-gutter" id="wb-sql-gutter">1</pre>
          <textarea id="wb-sql-ed" spellcheck="false" class="sql-ed" wrap="off">-- SELECT o EXEC de un PA de consulta. F5 / Ctrl+Enter.
-- EXEC dbo.NombrePA @param = 1;
SELECT TOP 20 TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY 1, 2;</textarea>
        </div>
        <div class="sql-results" id="wb-sql-results">
          <div class="sql-statusbar">
            <span id="wb-sql-msg">Listo. F5 ejecuta.</span>
            <span id="wb-sql-meta"></span>
          </div>
          <div class="sql-rowbar" id="wb-sql-rowbar">
            <span class="muted" id="wb-sql-sel-count">Sin resultados</span>
            <button type="button" class="btn sql-ico" id="wb-sql-view-json" title="Previsualización JSON/Texto">👁</button>
            <button type="button" class="btn" id="wb-sql-copy-sel">Copiar</button>
            <button type="button" class="btn" id="wb-sql-dl-json">↓ JSON</button>
            <button type="button" class="btn" id="wb-sql-dl-txt">↓ Texto</button>
            <button type="button" class="btn" id="wb-sql-dl-xls">↓ Excel</button>
            <span class="sql-inspect-spacer"></span>
            <button type="button" class="btn sql-ico" id="wb-sql-res-max" title="Maximizar resultados">⛶</button>
            <button type="button" class="btn sql-ico" id="wb-sql-res-min" title="Minimizar resultados">−</button>
          </div>
          <div class="table-wrap sql-grid-wrap"><table class="doc-table" id="wb-sql-grid"><thead></thead><tbody></tbody></table></div>
          <div class="sql-inspect" id="wb-sql-inspect" hidden>
            <div class="sql-inspect-bar">
              <span id="wb-sql-inspect-title">Previsualización</span>
              <button type="button" class="btn" data-inspect-fmt="json">JSON</button>
              <button type="button" class="btn" data-inspect-fmt="txt">Texto</button>
              <span class="sql-inspect-spacer"></span>
              <button type="button" class="btn" id="wb-sql-inspect-copy">Copiar</button>
              <button type="button" class="btn" id="wb-sql-inspect-dl">Descargar</button>
              <button type="button" class="btn sql-ico" id="wb-sql-inspect-fs" title="Pantalla completa">⛶</button>
              <button type="button" class="btn" id="wb-sql-inspect-close">Cerrar</button>
            </div>
            <pre id="wb-sql-inspect-body" class="sql-inspect-body"></pre>
          </div>
        </div>
      </div>
      <div id="wb-sql-fav-modal" class="fav-modal" hidden>
        <div class="fav-sheet" role="dialog" aria-modal="true" aria-labelledby="wb-sql-fav-title">
          <div class="fav-head">
            <div>
              <p class="k">Consultas guardadas</p>
              <h3 id="wb-sql-fav-title">Favoritos</h3>
              <p class="muted">Quedan en <code>.afn/sql-favorites.json</code>. Elegí una para verla y recién después cargala en el editor.</p>
            </div>
            <button type="button" class="btn" id="wb-sql-fav-close">Cerrar</button>
          </div>
          <div class="fav-body">
            <div class="fav-list" id="wb-sql-fav-list"></div>
            <div class="fav-preview">
              <div class="fav-preview-bar">
                <span id="wb-sql-fav-preview-title">Elegí una consulta</span>
                <span class="sql-inspect-spacer"></span>
                <button type="button" class="btn btn-run" id="wb-sql-fav-load" disabled>Cargar en el editor</button>
                <button type="button" class="btn" id="wb-sql-fav-del" disabled>Quitar</button>
              </div>
              <pre id="wb-sql-fav-preview" class="fav-preview-sql">Seleccioná una consulta de la lista para previsualizarla.</pre>
            </div>
          </div>
        </div>
      </div>
    </section>`;
}

export function workbenchNavButtons() {
  return `
      <button type="button" data-go="origenes">Orígenes</button>
      <button type="button" data-go="esquema">Elegir tablas/PAs</button>
      <button type="button" data-go="sql">SQL</button>`;
}

export function workbenchScript() {
  return `
  const api = window.AFN_API;
  const verEl = document.getElementById("wb-ver");
  const ver = document.body.getAttribute("data-afn-version") || "";
  if (verEl) verEl.textContent = api
    ? ("v" + ver + " · 127.0.0.1 — Orígenes, SQL y Skills")
    : ("v" + ver + " · archivo local (sin SQL). Pedí «abre dashboard AFN» otra vez.");
  const warn = document.getElementById("wb-api-warn");
  if (warn && !api) warn.hidden = false;
  async function apiCall(method, path, body) {
    if (!api) throw new Error("Dashboard sin servidor local");
    const r = await fetch(api.base + path, {
      method,
      headers: { "Content-Type": "application/json", "x-afn-token": api.token },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error === "token" ? "Token viejo: cerrá esta pestaña y pedí otra vez «abre dashboard AFN»." : (j.error || r.statusText));
    return j;
  }
  function setMsg(id, t, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = t || "";
    el.style.color = ok === false ? "#fca5a5" : ok === true ? "#34d399" : "";
    el.style.fontWeight = ok === true || ok === false ? "600" : "";
  }
  let originsList = [];
  function fillOriginForm(c) {
    const x = c || {};
    const name = document.getElementById("wb-o-name");
    const engine = document.getElementById("wb-o-engine");
    const host = document.getElementById("wb-o-host");
    const port = document.getElementById("wb-o-port");
    const database = document.getElementById("wb-o-database");
    if (name) name.value = x.name || x.connectionName || "";
    const eng = String(x.engine || x.dbEngine || "sqlserver").toLowerCase();
    if (engine) engine.value = /mongo/.test(eng) ? "mongodb" : /postgres/.test(eng) ? "postgresql" : /mysql/.test(eng) ? "mysql" : "sqlserver";
    if (host) host.value = x.host || x.server || "";
    if (port) port.value = x.port || "";
    if (database) database.value = x.database || "";
  }
  function formToOrigin(prev) {
    const engine = (document.getElementById("wb-o-engine")?.value || "sqlserver").trim();
    const portRaw = document.getElementById("wb-o-port")?.value;
    return {
      ...(prev && typeof prev === "object" ? prev : {}),
      id: prev?.id || "origen_1",
      name: (document.getElementById("wb-o-name")?.value || "").trim() || "origen",
      connectionName: (document.getElementById("wb-o-name")?.value || "").trim() || "origen",
      dbEngine: engine,
      engine,
      host: (document.getElementById("wb-o-host")?.value || "").trim(),
      port: portRaw ? Number(portRaw) : null,
      database: (document.getElementById("wb-o-database")?.value || "").trim(),
      needsCredentials: true,
    };
  }
  function renderCredStatus(c) {
    const el = document.getElementById("wb-cred-status");
    if (!el) return;
    if (!c) {
      el.textContent = "Host/puerto/base van arriba. Acá solo usuario y password.";
      return;
    }
    if (!c.exists) el.textContent = "Falta el archivo. Creá .afn/credentials/data-agent.json con el JSON de ejemplo.";
    else if (!c.validJson) el.textContent = "El archivo existe pero no es JSON válido.";
    else if (c.shape === "empty") el.textContent = "El archivo está vacío. Pegá DB_USER y DB_PASSWORD.";
    else if (!c.hasUser || !c.hasPassword) el.textContent = "El archivo existe pero falta DB_USER o DB_PASSWORD (o MONGODB_URI).";
    else el.textContent = "Credenciales OK (hay usuario y password). No se muestran acá.";
    el.style.color = (!c.exists || !c.validJson || !c.hasUser || !c.hasPassword) ? "#fbbf24" : "#34d399";
  }
  async function loadOrigins() {
    const j = await apiCall("GET", "/api/origins");
    originsList = Array.isArray(j.connections) ? j.connections : [];
    fillOriginForm(originsList[0] || {});
    renderCredStatus(j.credentials);
    const ta = document.getElementById("wb-origins-json");
    if (ta) ta.value = JSON.stringify({ connections: originsList }, null, 2);
    const sel = document.getElementById("wb-sql-origin");
    if (sel) {
      sel.innerHTML = originsList.map((c) => {
        const id = c.id || c.name || "";
        const label = (c.name || c.connectionName || id) + " · " + (c.engine || c.dbEngine || "");
        return "<option value=\\"" + String(id).replace(/"/g,"") + "\\">" + label.replace(/</g,"") + "</option>";
      }).join("");
    }
  }
  document.getElementById("wb-origins-reload")?.addEventListener("click", () => loadOrigins().then(() => setMsg("wb-origins-msg","Recargado",true)).catch((e) => setMsg("wb-origins-msg", e.message, false)));
  document.getElementById("wb-origins-save")?.addEventListener("click", async () => {
    try {
      const first = formToOrigin(originsList[0] || { id: "origen_1" });
      if (!first.host && !first.database) {
        setMsg("wb-origins-msg", "Falta host o database", false);
        return;
      }
      const rest = originsList.slice(1);
      const connections = [first].concat(rest);
      const j = await apiCall("PUT", "/api/origins", { connections });
      setMsg("wb-origins-msg", "Guardado (" + (j.count || connections.length) + "). Password no se guarda acá.", true);
      await loadOrigins();
    } catch (e) { setMsg("wb-origins-msg", e.message, false); }
  });
  let schemaState = { live: { tables: [], procedures: [] }, selection: null, connectionId: "_default" };
  function tableName(t) { return String(t.name || t.fullName || ""); }
  function procName(p) { return String(p.name || ""); }
  function enabledSet(list, fallbackAll) {
    if (!Array.isArray(list)) return null;
    return new Set(list);
  }
  function renderSchema() {
    const q = (document.getElementById("wb-schema-q")?.value || "").toLowerCase();
    const sel = schemaState.selection || {};
    const tSet = enabledSet(sel.enabledTables);
    const pSet = enabledSet(sel.enabledProcedures);
    const tables = schemaState.live.tables || [];
    const procs = schemaState.live.procedures || [];
    const tHtml = tables.filter((t) => tableName(t).toLowerCase().includes(q)).map((t) => {
      const n = tableName(t);
      const on = tSet ? tSet.has(n) : true;
      return "<label class=\\"chk\\"><input type=checkbox data-kind=t data-name=\\"" + n.replace(/"/g,"") + "\\" " + (on ? "checked" : "") + "> <code>" + n.replace(/</g,"") + "</code></label>";
    }).join("") || "<p class=muted>No hay captura. En Kiro: listá las tablas y guardalas en la arquitectura.</p>";
    const pHtml = procs.filter((p) => procName(p).toLowerCase().includes(q)).map((p) => {
      const n = procName(p);
      const on = pSet ? pSet.has(n) : true;
      return "<label class=\\"chk\\"><input type=checkbox data-kind=p data-name=\\"" + n.replace(/"/g,"") + "\\" " + (on ? "checked" : "") + "> <code>" + n.replace(/</g,"") + "</code></label>";
    }).join("") || "<p class=muted>Sin procedimientos en la captura.</p>";
    document.getElementById("wb-schema-tables").innerHTML = tHtml;
    document.getElementById("wb-schema-procs").innerHTML = pHtml;
    const tOn = tables.filter((t) => (tSet ? tSet.has(tableName(t)) : true)).length;
    const pOn = procs.filter((p) => (pSet ? pSet.has(procName(p)) : true)).length;
    document.getElementById("wb-schema-count").textContent = tOn + "/" + tables.length + " tablas · " + pOn + "/" + procs.length + " PAs en la arquitectura";
  }
  async function loadSchema() {
    const j = await apiCall("GET", "/api/schema");
    schemaState = j;
    if (!schemaState.selection) schemaState.selection = {};
    renderSchema();
  }
  document.getElementById("wb-schema-q")?.addEventListener("input", renderSchema);
  document.getElementById("wb-schema-all")?.addEventListener("click", () => {
    schemaState.selection = {
      enabledTables: (schemaState.live.tables || []).map(tableName),
      enabledProcedures: (schemaState.live.procedures || []).map(procName),
    };
    renderSchema();
  });
  document.getElementById("wb-schema-none")?.addEventListener("click", () => {
    schemaState.selection = { enabledTables: [], enabledProcedures: [] };
    renderSchema();
  });
  document.getElementById("wb-schema-save")?.addEventListener("click", async () => {
    try {
      const t = [...document.querySelectorAll("#wb-schema-tables input[data-kind=t]:checked")].map((i) => i.getAttribute("data-name"));
      const p = [...document.querySelectorAll("#wb-schema-procs input[data-kind=p]:checked")].map((i) => i.getAttribute("data-name"));
      await apiCall("PUT", "/api/schema", { connectionId: schemaState.connectionId, enabledTables: t, enabledProcedures: p });
      setMsg("wb-schema-msg", "Guardado. ARQUITECTURA.md §6b usa esta selección.", true);
      await loadSchema();
    } catch (e) { setMsg("wb-schema-msg", e.message, false); }
  });
  let lastRows = [];
  let lastCols = [];
  let selected = new Set();
  let lastClickRi = 0;
  let inspectRi = -1;
  let inspectFmt = "json";
  let previewRows = [];
  let previewOpen = false;
  function cellEsc(v) {
    return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
  }
  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2,"0");
    return d.getFullYear() + p(d.getMonth()+1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
  }
  function downloadBlob(name, mime, text) {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  function syncGutter() {
    const ta = document.getElementById("wb-sql-ed");
    const g = document.getElementById("wb-sql-gutter");
    if (!ta || !g) return;
    const n = Math.max(1, String(ta.value || "").split("\\n").length);
    g.textContent = Array.from({ length: n }, (_, i) => i + 1).join("\\n");
    g.scrollTop = ta.scrollTop;
  }
  function pickRows() {
    if (selected.size) return [...selected].sort((a,b) => a - b).map((i) => lastRows[i]).filter(Boolean);
    return lastRows;
  }
  function rowsJson(rows) {
    return JSON.stringify(rows || [], null, 2);
  }
  function rowsTxt(rows) {
    const data = rows || [];
    const head = lastCols.join("\\t");
    const body = data.map((r) => lastCols.map((c) => {
      const v = r[c];
      if (v === null || v === undefined || v === "") return "NULL";
      return String(v).replace(/\\t/g," ").replace(/\\n/g," ");
    }).join("\\t"));
    return [head].concat(body).join("\\n");
  }
  function previewContent() {
    return inspectFmt === "txt" ? rowsTxt(previewRows) : rowsJson(previewRows);
  }
  function paintPreview() {
    const box = document.getElementById("wb-sql-inspect");
    const body = document.getElementById("wb-sql-inspect-body");
    const title = document.getElementById("wb-sql-inspect-title");
    const eye = document.getElementById("wb-sql-view-json");
    if (!box || !body) return;
    if (!previewOpen || !previewRows.length) {
      box.hidden = true;
      box.classList.remove("fs");
      if (eye) eye.classList.remove("on");
      return;
    }
    box.hidden = false;
    const n = previewRows.length;
    if (title) title.textContent = "Previsualización (" + n + " fila" + (n === 1 ? "" : "s") + ")";
    body.textContent = previewContent();
    document.querySelectorAll("[data-inspect-fmt]").forEach((b) => b.classList.toggle("on", b.getAttribute("data-inspect-fmt") === inspectFmt));
    if (eye) eye.classList.add("on");
  }
  function openPreview(rows) {
    previewRows = (rows || []).filter(Boolean);
    previewOpen = previewRows.length > 0;
    paintPreview();
  }
  function closePreview() {
    previewOpen = false;
    previewRows = [];
    paintPreview();
  }
  function syncSelUi(opts) {
    const n = selected.size;
    const el = document.getElementById("wb-sql-sel-count");
    if (el) el.textContent = lastRows.length
      ? (n ? (lastRows.length + " filas · " + n + " seleccionada" + (n === 1 ? "" : "s")) : (lastRows.length + " filas"))
      : "Sin resultados";
    document.querySelectorAll("#wb-sql-grid tbody tr").forEach((tr) => {
      const i = Number(tr.getAttribute("data-ri"));
      const on = selected.has(i);
      tr.classList.toggle("on", on);
      const ck = tr.querySelector("input[type=checkbox]");
      if (ck) ck.checked = on;
    });
    const all = document.getElementById("wb-sql-sel-all");
    if (all) all.checked = lastRows.length > 0 && selected.size === lastRows.length;
    if (opts?.autoPreview !== false) {
      if (selected.size) openPreview(pickRows());
      else closePreview();
    }
  }
  const LUPA = "<svg viewBox=\\"0 0 24 24\\" width=\\"14\\" height=\\"14\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2.2\\"><circle cx=\\"11\\" cy=\\"11\\" r=\\"6.5\\"/><path d=\\"M20 20l-3.5-3.5\\"/></svg>";
  function renderGrid(cols, rows) {
    lastCols = cols || [];
    lastRows = rows || [];
    selected = new Set();
    inspectRi = -1;
    closePreview();
    const thead = document.querySelector("#wb-sql-grid thead");
    const tbody = document.querySelector("#wb-sql-grid tbody");
    if (!lastCols.length) {
      thead.innerHTML = "";
      tbody.innerHTML = "";
      syncSelUi({ autoPreview: false });
      return;
    }
    thead.innerHTML = "<tr><th class=sql-ck><input type=checkbox id=wb-sql-sel-all title=Todas></th><th class=sql-lupa title=Previsualizar></th>" + lastCols.map((c) => "<th>" + cellEsc(c) + "</th>").join("") + "</tr>";
    tbody.innerHTML = lastRows.map((row, ri) => {
      const cells = lastCols.map((c) => {
        const raw = row[c] ?? "";
        return "<td class=sql-val title=\\"" + cellEsc(raw) + "\\" data-ri=\\"" + ri + "\\" data-c=\\"" + cellEsc(c) + "\\">" + cellEsc(String(raw).slice(0,240)) + "</td>";
      }).join("");
      return "<tr data-ri=\\"" + ri + "\\"><td class=sql-ck><input type=checkbox data-ri=\\"" + ri + "\\"></td><td class=sql-lupa><button type=button class=sql-lupa-btn data-lupa=\\"" + ri + "\\" title=\\"Previsualizar fila\\">" + LUPA + "</button></td>" + cells + "</tr>";
    }).join("");
    const meta = document.getElementById("wb-sql-meta");
    if (meta) meta.textContent = lastCols.length + " columnas · lupa o clic = preview · casilla = varias · clic valor copia";
    syncSelUi({ autoPreview: false });
  }
  function previewOne(ri) {
    if (!lastRows[ri]) return;
    selected.add(ri);
    lastClickRi = ri;
    syncSelUi({ autoPreview: false });
    openPreview([lastRows[ri]]);
  }
  async function runSql() {
    try {
      setMsg("wb-sql-msg", "Ejecutando…");
      const j = await apiCall("POST", "/api/sql", {
        sql: document.getElementById("wb-sql-ed").value,
        connectionId: document.getElementById("wb-sql-origin").value,
        limit: Number(document.getElementById("wb-sql-limit").value || 200),
      });
      renderGrid(j.columns, j.rows);
      const n = (j.rows || []).length;
      setMsg("wb-sql-msg", n + " filas" + (j.truncated ? " (recorte)" : "") + (j.kind === "exec" ? " · EXEC" : ""), true);
    } catch (e) {
      renderGrid([], []);
      setMsg("wb-sql-msg", e.message, false);
    }
  }
  document.getElementById("wb-sql-run")?.addEventListener("click", runSql);
  const sqlEd = document.getElementById("wb-sql-ed");
  sqlEd?.addEventListener("input", syncGutter);
  sqlEd?.addEventListener("scroll", () => {
    const g = document.getElementById("wb-sql-gutter");
    if (g) g.scrollTop = sqlEd.scrollTop;
  });
  sqlEd?.addEventListener("keydown", (e) => {
    if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key === "Enter")) { e.preventDefault(); runSql(); }
    if (e.key === "Tab") {
      e.preventDefault();
      const a = sqlEd.selectionStart, b = sqlEd.selectionEnd;
      sqlEd.value = sqlEd.value.slice(0, a) + "  " + sqlEd.value.slice(b);
      sqlEd.selectionStart = sqlEd.selectionEnd = a + 2;
      syncGutter();
    }
  });
  window.addEventListener("keydown", (e) => {
    if (e.key !== "F5") return;
    const on = document.querySelector("nav button.on")?.dataset.go;
    if (on === "sql") { e.preventDefault(); runSql(); }
  });
  document.getElementById("wb-sql-grid")?.addEventListener("change", (e) => {
    if (e.target.id === "wb-sql-sel-all") {
      selected = e.target.checked ? new Set(lastRows.map((_, i) => i)) : new Set();
      syncSelUi();
      return;
    }
    const ck = e.target.closest("tbody input[type=checkbox]");
    if (!ck) return;
    const ri = Number(ck.getAttribute("data-ri"));
    if (!Number.isFinite(ri)) return;
    if (ck.checked) selected.add(ri); else selected.delete(ri);
    lastClickRi = ri;
    syncSelUi();
  });
  document.getElementById("wb-sql-grid")?.addEventListener("click", (e) => {
    if (e.target.closest("input[type=checkbox]") || e.target.closest("th")) return;
    const lupa = e.target.closest("[data-lupa]");
    if (lupa) {
      e.preventDefault();
      e.stopPropagation();
      previewOne(Number(lupa.getAttribute("data-lupa")));
      return;
    }
    const tr = e.target.closest("tbody tr");
    if (!tr || !lastCols.length) return;
    const ri = Number(tr.getAttribute("data-ri"));
    if (!Number.isFinite(ri)) return;
    const td = e.target.closest("td.sql-val");
    if (td) {
      const c = td.getAttribute("data-c");
      const val = lastRows[ri] ? String(lastRows[ri][c] ?? "") : "";
      navigator.clipboard?.writeText(val).then(() => setMsg("wb-sql-msg", "Copiado", true)).catch(() => {});
      return;
    }
    previewOne(ri);
  });
  function needRows() {
    if (!pickRows().length) { setMsg("wb-sql-msg", "No hay resultados para exportar", false); return false; }
    return true;
  }
  function fileTag() {
    const n = selected.size;
    return n ? ("-" + n + "filas") : "";
  }
  function csvText(rows) {
    const data = rows || pickRows();
    return lastCols.map((c) => JSON.stringify(c ?? "")).join(",") + "\\n" + data.map((r) => lastCols.map((c) => JSON.stringify(r[c] ?? "")).join(",")).join("\\n");
  }
  function xlsHtml(rows) {
    const data = rows || pickRows();
    const head = lastCols.map((c) => "<th>" + cellEsc(c) + "</th>").join("");
    const body = data.map((r) => "<tr>" + lastCols.map((c) => "<td>" + cellEsc(r[c]) + "</td>").join("") + "</tr>").join("");
    return "<html xmlns:o=\\"urn:schemas-microsoft-com:office:office\\" xmlns:x=\\"urn:schemas-microsoft-com:office:excel\\"><head><meta charset=\\"utf-8\\"/></head><body><table><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table></body></html>";
  }
  function dlJson() {
    if (!needRows()) return;
    downloadBlob("consulta" + fileTag() + "-" + stamp() + ".json", "application/json", rowsJson(pickRows()));
  }
  function dlTxt() {
    if (!needRows()) return;
    downloadBlob("consulta" + fileTag() + "-" + stamp() + ".txt", "text/plain;charset=utf-8", rowsTxt(pickRows()));
  }
  function dlXls() {
    if (!needRows()) return;
    downloadBlob("consulta" + fileTag() + "-" + stamp() + ".xls", "application/vnd.ms-excel", xlsHtml());
  }
  document.getElementById("wb-sql-csv")?.addEventListener("click", () => {
    if (!needRows()) return;
    downloadBlob("consulta" + fileTag() + "-" + stamp() + ".csv", "text/csv;charset=utf-8", "\\uFEFF" + csvText());
  });
  document.getElementById("wb-sql-json")?.addEventListener("click", dlJson);
  document.getElementById("wb-sql-txt")?.addEventListener("click", dlTxt);
  document.getElementById("wb-sql-xls")?.addEventListener("click", dlXls);
  document.getElementById("wb-sql-dl-json")?.addEventListener("click", dlJson);
  document.getElementById("wb-sql-dl-txt")?.addEventListener("click", dlTxt);
  document.getElementById("wb-sql-dl-xls")?.addEventListener("click", dlXls);
  document.getElementById("wb-sql-view-json")?.addEventListener("click", () => {
    if (previewOpen) { closePreview(); return; }
    if (!lastRows.length) { setMsg("wb-sql-msg", "No hay resultados", false); return; }
    openPreview(selected.size ? pickRows() : lastRows);
  });
  document.getElementById("wb-sql-copy-sel")?.addEventListener("click", () => {
    const t = previewOpen ? previewContent() : (needRows() ? (inspectFmt === "txt" ? rowsTxt(pickRows()) : rowsJson(pickRows())) : "");
    if (!t) return;
    navigator.clipboard?.writeText(t).then(() => setMsg("wb-sql-msg", "Copiado", true)).catch(() => {});
  });
  document.querySelectorAll("[data-inspect-fmt]").forEach((b) => b.addEventListener("click", () => {
    inspectFmt = b.getAttribute("data-inspect-fmt") || "json";
    paintPreview();
  }));
  document.getElementById("wb-sql-inspect-copy")?.addEventListener("click", () => {
    navigator.clipboard?.writeText(previewContent()).then(() => setMsg("wb-sql-msg", "Copiado", true)).catch(() => {});
  });
  document.getElementById("wb-sql-inspect-dl")?.addEventListener("click", () => {
    if (!previewRows.length) return;
    const ext = inspectFmt === "txt" ? "txt" : "json";
    downloadBlob("consulta-preview-" + stamp() + "." + ext, ext === "json" ? "application/json" : "text/plain;charset=utf-8", previewContent());
  });
  document.getElementById("wb-sql-inspect-fs")?.addEventListener("click", () => {
    document.getElementById("wb-sql-inspect")?.classList.toggle("fs");
  });
  document.getElementById("wb-sql-inspect-close")?.addEventListener("click", closePreview);
  function setSqlPane(id, full) {
    const editor = document.getElementById("wb-sql-editor");
    const results = document.getElementById("wb-sql-results");
    [editor, results].forEach((pane) => {
      if (!pane) return;
      pane.classList.toggle("fs", full && pane.id === id);
    });
    syncGutter();
  }
  document.getElementById("wb-sql-ed-max")?.addEventListener("click", () => setSqlPane("wb-sql-editor", true));
  document.getElementById("wb-sql-ed-min")?.addEventListener("click", () => setSqlPane("wb-sql-editor", false));
  document.getElementById("wb-sql-res-max")?.addEventListener("click", () => setSqlPane("wb-sql-results", true));
  document.getElementById("wb-sql-res-min")?.addEventListener("click", () => setSqlPane("wb-sql-results", false));
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const editor = document.getElementById("wb-sql-editor");
    const results = document.getElementById("wb-sql-results");
    if (editor?.classList.contains("fs") || results?.classList.contains("fs")) {
      setSqlPane("", false);
      e.preventDefault();
      return;
    }
    const box = document.getElementById("wb-sql-inspect");
    if (box?.classList.contains("fs")) { box.classList.remove("fs"); e.preventDefault(); }
    else if (previewOpen) closePreview();
  });
  syncGutter();
  let favSelected = "";
  function favTitle(sql) {
    return (String(sql || "").split("\\n").find((l) => l.trim() && !l.trim().startsWith("--")) || "consulta").trim().slice(0, 60);
  }
  function favEsc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }
  function paintFavModal() {
    const list = window.__afnFavs || [];
    const box = document.getElementById("wb-sql-fav-list");
    const pre = document.getElementById("wb-sql-fav-preview");
    const titleEl = document.getElementById("wb-sql-fav-preview-title");
    const loadBtn = document.getElementById("wb-sql-fav-load");
    const delBtn = document.getElementById("wb-sql-fav-del");
    const openBtn = document.getElementById("wb-sql-fav-open");
    if (openBtn) openBtn.textContent = list.length ? ("Favoritos (" + list.length + ")") : "Favoritos";
    if (!box) return;
    if (!list.length) {
      favSelected = "";
      box.innerHTML = "<p class=muted>Todavía no hay consultas guardadas. ★ Guardar deja la del editor en .afn/sql-favorites.json.</p>";
      if (pre) pre.textContent = "Cuando guardes una, la vas a ver acá antes de cargarla.";
      if (titleEl) titleEl.textContent = "Sin favoritos";
      if (loadBtn) loadBtn.disabled = true;
      if (delBtn) delBtn.disabled = true;
      return;
    }
    if (!list.some((f) => f.id === favSelected)) favSelected = list[0].id;
    const hit = list.find((f) => f.id === favSelected) || list[0];
    box.innerHTML = list.map((f) => {
      const on = f.id === hit.id ? " on" : "";
      const line = String(f.sql || "").replace(/\\s+/g, " ").trim().slice(0, 72);
      return "<button type=button class=\\"fav-item" + on + "\\" data-fav-pick=\\"" + favEsc(f.id) + "\\"><strong>" + favEsc(f.title || "consulta") + "</strong><small>" + favEsc(line) + "</small></button>";
    }).join("");
    box.querySelectorAll("[data-fav-pick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        favSelected = btn.getAttribute("data-fav-pick") || "";
        paintFavModal();
      });
    });
    if (pre) pre.textContent = hit.sql || "";
    if (titleEl) titleEl.textContent = hit.title || "consulta";
    if (loadBtn) loadBtn.disabled = false;
    if (delBtn) delBtn.disabled = false;
  }
  function openFavModal() {
    const modal = document.getElementById("wb-sql-fav-modal");
    if (!modal) return;
    paintFavModal();
    modal.hidden = false;
  }
  function closeFavModal() {
    const modal = document.getElementById("wb-sql-fav-modal");
    if (modal) modal.hidden = true;
  }
  async function loadFavs() {
    if (!api) return;
    const j = await apiCall("GET", "/api/sql/favorites");
    window.__afnFavs = j.favorites || [];
    paintFavModal();
  }
  document.getElementById("wb-sql-fav-open")?.addEventListener("click", () => { loadFavs().then(openFavModal).catch((e) => setMsg("wb-sql-msg", e.message, false)); });
  document.getElementById("wb-sql-fav-close")?.addEventListener("click", closeFavModal);
  document.getElementById("wb-sql-fav-modal")?.addEventListener("click", (e) => {
    if (e.target && e.target.id === "wb-sql-fav-modal") closeFavModal();
  });
  document.getElementById("wb-sql-fav-load")?.addEventListener("click", () => {
    const hit = (window.__afnFavs || []).find((f) => f.id === favSelected);
    if (!hit) return;
    document.getElementById("wb-sql-ed").value = hit.sql;
    syncGutter();
    closeFavModal();
    setMsg("wb-sql-msg", "Consulta cargada. F5 para ejecutar.", true);
  });
  document.getElementById("wb-sql-fav-del")?.addEventListener("click", async () => {
    const hit = (window.__afnFavs || []).find((f) => f.id === favSelected);
    if (!hit) return;
    if (!confirm("Quitar «" + (hit.title || "consulta") + "» de los favoritos?")) return;
    try {
      const favorites = (window.__afnFavs || []).filter((f) => f.id !== hit.id);
      await apiCall("PUT", "/api/sql/favorites", { favorites });
      favSelected = "";
      setMsg("wb-sql-msg", "Favorito quitado", true);
      await loadFavs();
    } catch (e) { setMsg("wb-sql-msg", e.message, false); }
  });
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const modal = document.getElementById("wb-sql-fav-modal");
    if (modal && !modal.hidden) { closeFavModal(); e.preventDefault(); }
  });
  document.getElementById("wb-sql-fav")?.addEventListener("click", async () => {
    try {
      const sql = String(document.getElementById("wb-sql-ed").value || "").trim();
      if (!sql) { setMsg("wb-sql-msg", "No hay consulta para guardar", false); return; }
      const title = favTitle(sql);
      const prev = window.__afnFavs || [];
      const same = prev.find((f) => String(f.sql || "").trim() === sql);
      const favorites = same
        ? prev.map((f) => f.id === same.id ? { id: f.id, title: title, sql: sql } : f)
        : prev.concat([{ id: "fav_" + Date.now(), title: title, sql: sql }]);
      await apiCall("PUT", "/api/sql/favorites", { favorites });
      setMsg("wb-sql-msg", same ? "Favorito actualizado" : "Guardada en .afn/sql-favorites.json", true);
      await loadFavs();
      openFavModal();
    } catch (e) { setMsg("wb-sql-msg", e.message, false); }
  });
  if (api) {
    loadOrigins().catch((e) => setMsg("wb-origins-msg", e.message, false));
    loadSchema().catch(() => {});
    loadFavs().catch(() => {});
    apiCall("GET", "/api/health").then((j) => {
      const el = document.getElementById("wb-sql-driver");
      if (!el) return;
      const d = j.driver || {};
      const mssql = d.mssql === "ready" ? "SQL Server listo" : "SQL Server: npm install en packages/afn-mcp-context";
      const pg = d.pg === "ready" ? " · PostgreSQL listo" : "";
      el.textContent = "Driver: " + mssql + pg + ". require.resolve del pack, sin npx. No instales paquetes en el producto.";
    }).catch(() => {});
  }
`;
}
