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
    <section data-view="sql" hidden>
      <h2>Consulta SQL</h2>
      <p class="lead">No es un HTML estático: Node en <code>127.0.0.1</code> ejecuta el SELECT. <code>mssql</code> es dependencia de este pack (<code>require.resolve('mssql')</code>, sin npx). En el clone: <code>cd packages/afn-mcp-context && npm install</code>. <strong>No</strong> instales paquetes en el repo del producto.</p>
      <p id="wb-sql-driver" class="muted">Driver: comprobando…</p>
      <div class="toolbar">
        <label class="muted">Origen <select id="wb-sql-origin"></select></label>
        <label class="muted">Límite <input id="wb-sql-limit" type="number" value="100" min="1" max="500" style="width:4.5rem"/></label>
        <button type="button" class="btn" id="wb-sql-run">Ejecutar</button>
        <button type="button" class="btn" id="wb-sql-csv">CSV</button>
        <button type="button" class="btn" id="wb-sql-fav">A favoritos</button>
        <span id="wb-sql-msg" class="muted"></span>
      </div>
      <textarea id="wb-sql-ed" spellcheck="false" class="sql-ed" rows="10">-- Solo SELECT. Ctrl+Enter ejecuta.
SELECT TOP 20 TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY 1, 2;</textarea>
      <div id="wb-sql-favs" class="toolbar"></div>
      <div class="table-wrap"><table class="doc-table" id="wb-sql-grid"><thead></thead><tbody></tbody></table></div>
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
    ? ("v" + ver + " · 127.0.0.1 — Orígenes / Elegir tablas / SQL")
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
  function renderGrid(cols, rows) {
    lastCols = cols || [];
    lastRows = rows || [];
    const thead = document.querySelector("#wb-sql-grid thead");
    const tbody = document.querySelector("#wb-sql-grid tbody");
    thead.innerHTML = lastCols.length ? "<tr>" + lastCols.map((c) => "<th>" + String(c).replace(/</g,"") + "</th>").join("") + "</tr>" : "";
    tbody.innerHTML = lastRows.map((row) => "<tr>" + lastCols.map((c) => "<td>" + String(row[c] ?? "").replace(/</g,"").slice(0,200) + "</td>").join("") + "</tr>").join("");
  }
  async function runSql() {
    try {
      setMsg("wb-sql-msg", "Ejecutando…");
      const j = await apiCall("POST", "/api/sql", {
        sql: document.getElementById("wb-sql-ed").value,
        connectionId: document.getElementById("wb-sql-origin").value,
        limit: Number(document.getElementById("wb-sql-limit").value || 100),
      });
      renderGrid(j.columns, j.rows);
      setMsg("wb-sql-msg", (j.rows || []).length + " filas" + (j.truncated ? " (recorte)" : ""), true);
    } catch (e) {
      renderGrid([], []);
      setMsg("wb-sql-msg", e.message, false);
    }
  }
  document.getElementById("wb-sql-run")?.addEventListener("click", runSql);
  document.getElementById("wb-sql-ed")?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runSql(); }
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.target;
      const a = el.selectionStart, b = el.selectionEnd;
      el.value = el.value.slice(0, a) + "  " + el.value.slice(b);
      el.selectionStart = el.selectionEnd = a + 2;
    }
  });
  document.getElementById("wb-sql-csv")?.addEventListener("click", () => {
    if (!lastCols.length) return;
    const lines = [lastCols.join(",")].concat(lastRows.map((r) => lastCols.map((c) => JSON.stringify(r[c] ?? "")).join(",")));
    const blob = new Blob([lines.join("\\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "consulta.csv";
    a.click();
  });
  async function loadFavs() {
    if (!api) return;
    const j = await apiCall("GET", "/api/sql/favorites");
    const box = document.getElementById("wb-sql-favs");
    box.innerHTML = (j.favorites || []).map((f) => "<button type=button class=btn data-fav=\\"" + String(f.id).replace(/"/g,"") + "\\">" + String(f.title || "fav").replace(/</g,"") + "</button>").join("");
    box.querySelectorAll("[data-fav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const hit = (j.favorites || []).find((x) => x.id === btn.getAttribute("data-fav"));
        if (hit) document.getElementById("wb-sql-ed").value = hit.sql;
      });
    });
    window.__afnFavs = j.favorites || [];
  }
  document.getElementById("wb-sql-fav")?.addEventListener("click", async () => {
    try {
      const sql = document.getElementById("wb-sql-ed").value;
      const title = (sql.split("\\n").find((l) => l.trim() && !l.trim().startsWith("--")) || "consulta").slice(0, 60);
      const favorites = (window.__afnFavs || []).concat([{ id: "fav_" + Date.now(), title, sql }]);
      await apiCall("PUT", "/api/sql/favorites", { favorites });
      setMsg("wb-sql-msg", "Favorito guardado", true);
      await loadFavs();
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
