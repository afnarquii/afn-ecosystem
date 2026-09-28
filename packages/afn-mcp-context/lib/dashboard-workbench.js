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
      <header class="sql-head">
        <strong class="sql-head-title">SQL</strong>
        <label>Origen <select id="wb-sql-origin"></select></label>
        <label>Límite <input id="wb-sql-limit" type="number" value="200" min="1" max="2000"/></label>
        <button type="button" class="btn btn-run" id="wb-sql-run" title="F5 o Ctrl+Enter">▶ Ejecutar</button>
        <button type="button" class="btn" id="wb-sql-fav" title="Guardar la consulta">★</button>
        <button type="button" class="btn" id="wb-sql-fav-open">Favoritos</button>
        <span class="sql-export">
          <button type="button" class="btn" id="wb-sql-xls" title="Descargar Excel">Excel</button>
          <button type="button" class="btn" id="wb-sql-json" title="Ver el resultado como JSON">JSON</button>
          <button type="button" class="btn" id="wb-sql-txt" title="Descargar texto">TXT</button>
          <button type="button" class="btn" id="wb-sql-csv" title="Descargar CSV">CSV</button>
        </span>
        <span class="sql-inspect-spacer"></span>
        <span id="wb-sql-driver" class="muted">Driver: comprobando…</span>
      </header>
      <div class="sql-ide-split">
        <div class="sql-editor-wrap" id="wb-sql-editor">
          <div class="sql-pane-bar">
            <span>Consulta</span>
            <span id="wb-sql-pos" class="sql-pos">Línea 1, col 1</span>
            <span class="sql-inspect-spacer"></span>
            <button type="button" class="btn" id="wb-sql-find-open" title="Buscar en la consulta (Ctrl+F)">Buscar</button>
            <button type="button" class="btn sql-ico" id="wb-sql-ed-max" title="Maximizar el editor">⛶</button>
            <button type="button" class="btn sql-ico" id="wb-sql-ed-min" title="Minimizar el editor">−</button>
          </div>
          <div class="sql-findbar" id="wb-sql-findbar" hidden>
            <input id="wb-sql-find" type="search" placeholder="Buscar en la consulta" autocomplete="off"/>
            <button type="button" class="btn" id="wb-sql-find-case" title="Coincidir mayúsculas y minúsculas">Aa</button>
            <button type="button" class="btn" id="wb-sql-find-sel" title="Buscar solo en lo seleccionado. Apagado: busca en toda la consulta.">En selección</button>
            <button type="button" class="btn" id="wb-sql-find-prev">Anterior</button>
            <button type="button" class="btn" id="wb-sql-find-next">Siguiente</button>
            <span id="wb-sql-find-n" class="muted"></span>
            <button type="button" class="btn" id="wb-sql-find-close">Cerrar</button>
          </div>
          <div class="sql-code">
            <pre class="sql-gutter" id="wb-sql-gutter">1</pre>
            <div class="sql-stage">
              <div class="sql-caretline" id="wb-sql-caretline"></div>
              <div class="sql-marks" id="wb-sql-marks" aria-hidden="true"></div>
              <pre class="sql-hl" id="wb-sql-hl" aria-hidden="true"></pre>
              <textarea id="wb-sql-ed" spellcheck="false" class="sql-ed" wrap="off" autocomplete="off" autocorrect="off" autocapitalize="off">-- SELECT o EXEC de un PA de consulta. F5 / Ctrl+Enter.
-- EXEC dbo.NombrePA @param = 1;
SELECT TOP 20 TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY 1, 2;</textarea>
              <div class="sql-ac" id="wb-sql-ac" hidden></div>
            </div>
          </div>
        </div>
        <div class="sql-split-grip" id="wb-sql-split" role="separator" aria-orientation="horizontal" aria-label="Arrastra para cambiar el alto de la consulta y de los resultados. Doble clic vuelve a 55 y 45." title="Arrastra para ampliar la consulta o los resultados. Doble clic: 55% / 45%."></div>
        <div class="sql-results" id="wb-sql-results">
          <div class="sql-statusbar">
            <span id="wb-sql-msg">Listo. F5 ejecuta.</span>
            <span id="wb-sql-meta"></span>
          </div>
          <pre id="wb-run-error" class="script-error" hidden></pre>
          <div class="sql-rowbar" id="wb-sql-rowbar">
            <span class="muted" id="wb-sql-sel-count">Sin resultados</span>
            <button type="button" class="btn on" id="wb-sql-view-grid" title="Ver filas y columnas">Columnas</button>
            <button type="button" class="btn" id="wb-sql-view-txt" title="Ver como texto">TXT</button>
            <button type="button" class="btn sql-ico" id="wb-sql-view-json" title="Ver como JSON">👁</button>
            <button type="button" class="btn" id="wb-sql-copy-sel">Copiar</button>
            <button type="button" class="btn" id="wb-sql-dl-json" title="Descargar JSON">↓ JSON</button>
            <button type="button" class="btn" id="wb-sql-dl-txt">↓ Texto</button>
            <button type="button" class="btn" id="wb-sql-dl-xls">↓ Excel</button>
            <button type="button" class="btn" id="wb-sql-dl-csv" title="Descargar CSV">↓ CSV</button>
            <span class="sql-inspect-spacer"></span>
            <button type="button" class="btn sql-ico" id="wb-sql-res-max" title="Maximizar resultados">⛶</button>
            <button type="button" class="btn sql-ico" id="wb-sql-res-min" title="Minimizar resultados">−</button>
          </div>
          <div class="table-wrap sql-grid-wrap" id="wb-sql-grid-wrap"><table class="doc-table" id="wb-sql-grid"><thead></thead><tbody></tbody></table></div>
          <div id="wb-sql-json-pane" class="sql-json-pane" hidden>
            <div class="sql-json-find">
              <input id="wb-sql-json-find" type="search" placeholder="Buscar en el JSON" autocomplete="off"/>
              <button type="button" class="btn" id="wb-sql-json-prev">Anterior</button>
              <button type="button" class="btn" id="wb-sql-json-next">Siguiente</button>
              <span id="wb-sql-json-find-n" class="muted"></span>
            </div>
            <pre id="wb-sql-json-body" class="sql-json-body"></pre>
          </div>
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
              <p class="muted">Quedan en <code>.afn/sql-favorites.json</code>, solo en esta pestaña. No entran al contexto del agente.</p>
            </div>
            <button type="button" class="btn" id="wb-sql-fav-close">Cerrar</button>
          </div>
          <div class="fav-tools">
            <input id="wb-sql-fav-q" type="search" placeholder="Buscar favorito por título o SQL" autocomplete="off"/>
            <span id="wb-sql-fav-count" class="muted"></span>
          </div>
          <div class="fav-body">
            <div class="fav-list" id="wb-sql-fav-list"></div>
            <div class="fav-preview">
              <div class="fav-preview-bar">
                <span id="wb-sql-fav-preview-title">Elegí una consulta</span>
                <span id="wb-sql-fav-lines" class="muted"></span>
                <span class="sql-inspect-spacer"></span>
                <button type="button" class="btn" id="wb-sql-fav-find-open" title="Buscar en el favorito (Ctrl+F)">Buscar</button>
                <button type="button" class="btn btn-run" id="wb-sql-fav-load" disabled>Cargar en el editor</button>
                <button type="button" class="btn" id="wb-sql-fav-del" disabled>Quitar</button>
              </div>
              <div class="sql-findbar" id="wb-sql-fav-findbar" hidden>
                <input id="wb-sql-fav-find" type="search" placeholder="Buscar en el favorito" autocomplete="off"/>
                <button type="button" class="btn" id="wb-sql-fav-find-case" title="Coincidir mayúsculas y minúsculas">Aa</button>
                <button type="button" class="btn" id="wb-sql-fav-find-sel" title="Buscar solo en lo seleccionado. Apagado: busca en todo el favorito.">En selección</button>
                <button type="button" class="btn" id="wb-sql-fav-find-prev">Anterior</button>
                <button type="button" class="btn" id="wb-sql-fav-find-next">Siguiente</button>
                <span id="wb-sql-fav-find-n" class="muted"></span>
                <button type="button" class="btn" id="wb-sql-fav-find-close">Cerrar</button>
              </div>
              <div class="fav-code" id="wb-sql-fav-code">
                <pre class="sql-gutter" id="wb-sql-fav-gutter"><span class="ln">1</span></pre>
                <div class="sql-stage">
                  <div class="sql-caretline" id="wb-sql-fav-caret"></div>
                  <div class="sql-marks" id="wb-sql-fav-marks" aria-hidden="true"></div>
                  <pre class="sql-hl" id="wb-sql-fav-preview">Seleccioná una consulta de la lista para previsualizarla.</pre>
                  <textarea id="wb-sql-fav-ed" class="sql-ed" readonly spellcheck="false" wrap="off" autocomplete="off"></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section data-view="scripts" hidden>
      <h2>Scripts</h2>
      <p class="lead">Elegí el archivo en el explorador. Si tiene claves, que esté fuera del repo. Al ejecutar podés mandar parámetros o dejarlo vacío. AFN guarda la ruta y Kiro solo ve el JSON cuando se lo pedís.</p>
      <div class="script-panel">
        <div class="afn-pick" id="wb-script-pick">
          <div class="afn-pick-ico" aria-hidden="true">📄</div>
          <div class="afn-pick-copy">
            <strong id="wb-script-file-name">Ningún archivo elegido</strong>
            <p id="wb-script-file-path" class="muted">Python o Node. El explorador devuelve la ruta; no hace falta pegarla.</p>
          </div>
          <button type="button" class="btn" id="wb-script-browse">Elegir archivo</button>
        </div>
        <div class="script-form">
          <label>Nombre<input id="wb-script-title" placeholder="Informe de pedidos"/></label>
          <label>Lenguaje
            <select id="wb-script-lang">
              <option value="node">Node.js</option>
              <option value="python">Python</option>
            </select>
          </label>
          <button type="button" class="btn afn-pick-go" id="wb-script-add" disabled>Guardar</button>
          <button type="button" class="btn" id="wb-script-new">Crear plantilla vacía</button>
        </div>
        <input id="wb-script-path" type="hidden" value=""/>
        <p id="wb-script-msg" class="muted"></p>
      </div>
      <h3>Guardados</h3>
      <div id="wb-script-list" class="script-grid"></div>
      <div id="wb-script-args-modal" class="fav-modal" hidden>
        <div class="fav-sheet script-args-sheet">
          <div class="fav-head">
            <div>
              <p class="k">Parámetros opcionales</p>
              <h3 id="wb-script-args-title">Ejecutar</h3>
              <p class="muted">Cada fila es un nombre y su valor. Si el script tiene tres y solo llenás dos, se mandan esos dos. El valor vacío no se envía. El nombre queda para la próxima vez.</p>
            </div>
            <button type="button" class="btn" id="wb-script-args-close">Cerrar</button>
          </div>
          <div class="script-args-body">
            <div id="wb-script-param-list" class="script-param-list"></div>
            <button type="button" class="btn" id="wb-script-param-add">Agregar parámetro</button>
            <div class="script-actions">
              <button type="button" class="btn afn-pick-go" id="wb-script-args-go">Ejecutar</button>
              <button type="button" class="btn" id="wb-script-args-plain">Sin parámetros</button>
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
      <button type="button" data-go="sql">SQL</button>
      <button type="button" data-go="comparar">Comparar</button>
      <button type="button" data-go="scripts">Scripts</button>`;
}

export function workbenchScript() {
  return `
  const api = window.AFN_API;
  const verEl = document.getElementById("wb-ver");
  const ver = document.body.getAttribute("data-afn-version") || "";
  if (verEl) verEl.textContent = api
    ? ("v" + ver + " · 127.0.0.1 — Orígenes, SQL, Comparar, Scripts y Skills")
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
  const SQL_KW = ["SELECT","FROM","WHERE","AND","OR","NOT","IN","EXISTS","JOIN","LEFT","RIGHT","INNER","OUTER","FULL","CROSS","ON","GROUP","BY","ORDER","HAVING","INSERT","UPDATE","DELETE","INTO","VALUES","EXEC","EXECUTE","DECLARE","SET","AS","TOP","DISTINCT","CASE","WHEN","THEN","ELSE","END","UNION","ALL","WITH","NOLOCK","BEGIN","COMMIT","ROLLBACK","CREATE","ALTER","DROP","TABLE","PROCEDURE","FUNCTION","VIEW","INDEX","NULL","IS","LIKE","BETWEEN","ASC","DESC","OFFSET","FETCH","NEXT","ROWS","ONLY","APPLY","OVER","PARTITION","GO","USE","IF","WHILE","RETURN","OUTPUT","TRY","CATCH","THROW","MERGE","USING","MATCHED","PIVOT"];
  const SQL_FN = ["COUNT","SUM","AVG","MIN","MAX","CAST","CONVERT","ISNULL","COALESCE","LEN","SUBSTRING","REPLACE","GETDATE","DATEADD","DATEDIFF","UPPER","LOWER","LTRIM","RTRIM","NULLIF","ROW_NUMBER","RANK","DENSE_RANK"];
  function sqlEsc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  function highlightSql(src) {
    const text = String(src || "");
    let i = 0;
    let html = "";
    while (i < text.length) {
      const ch = text[i];
      const nxt = text[i + 1] || "";
      if (ch === "-" && nxt === "-") {
        let j = text.indexOf("\\n", i);
        j = j < 0 ? text.length : j;
        html += "<span class=sql-cmt>" + sqlEsc(text.slice(i, j)) + "</span>";
        i = j;
        continue;
      }
      if (ch === "/" && nxt === "*") {
        let j = text.indexOf("*/", i + 2);
        j = j < 0 ? text.length : j + 2;
        html += "<span class=sql-cmt>" + sqlEsc(text.slice(i, j)) + "</span>";
        i = j;
        continue;
      }
      if (ch === "'" || (ch === "N" && nxt === "'")) {
        const start = ch === "N" ? i + 1 : i;
        let j = start + 1;
        while (j < text.length) {
          if (text[j] === "'" && text[j + 1] === "'") { j += 2; continue; }
          if (text[j] === "'") { j += 1; break; }
          j += 1;
        }
        html += "<span class=sql-str>" + sqlEsc(text.slice(ch === "N" ? i : start, j)) + "</span>";
        i = j;
        continue;
      }
      if (ch === "[") {
        let j = text.indexOf("]", i + 1);
        j = j < 0 ? i + 1 : j + 1;
        html += "<span class=sql-id>" + sqlEsc(text.slice(i, j)) + "</span>";
        i = j;
        continue;
      }
      if (/[0-9]/.test(ch) && (i === 0 || !/[A-Za-z0-9_]/.test(text[i - 1]))) {
        let j = i + 1;
        while (j < text.length && /[0-9.]/.test(text[j])) j += 1;
        html += "<span class=sql-num>" + sqlEsc(text.slice(i, j)) + "</span>";
        i = j;
        continue;
      }
      if (/[A-Za-z_@#]/.test(ch)) {
        let j = i + 1;
        while (j < text.length && /[A-Za-z0-9_@#$]/.test(text[j])) j += 1;
        const word = text.slice(i, j);
        const up = word.toUpperCase();
        const cls = SQL_KW.indexOf(up) >= 0 ? "sql-kw" : (SQL_FN.indexOf(up) >= 0 ? "sql-fn" : "");
        html += cls ? ("<span class=" + cls + ">" + sqlEsc(word) + "</span>") : sqlEsc(word);
        i = j;
        continue;
      }
      html += sqlEsc(ch);
      i += 1;
    }
    return html;
  }
  function caretPos(ta) {
    const v = String(ta.value || "");
    const at = ta.selectionStart || 0;
    const parts = v.slice(0, at).split("\\n");
    return { line: parts.length, col: parts[parts.length - 1].length + 1, total: Math.max(1, v.split("\\n").length) };
  }
  function syncSqlScroll() {
    const ta = document.getElementById("wb-sql-ed");
    const g = document.getElementById("wb-sql-gutter");
    const hl = document.getElementById("wb-sql-hl");
    const bar = document.getElementById("wb-sql-caretline");
    if (!ta) return;
    if (g) g.scrollTop = ta.scrollTop;
    if (hl) { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; }
    if (bar) {
      const info = caretPos(ta);
      const lh = 21;
      const pad = parseFloat(getComputedStyle(ta).paddingTop) || 0;
      bar.style.height = lh + "px";
      bar.style.top = ((info.line - 1) * lh + pad - ta.scrollTop) + "px";
    }
    paintMarks();
  }
  function paintSqlEditor() {
    const ta = document.getElementById("wb-sql-ed");
    const g = document.getElementById("wb-sql-gutter");
    const hl = document.getElementById("wb-sql-hl");
    const pos = document.getElementById("wb-sql-pos");
    if (!ta || !g || !hl) return;
    const info = caretPos(ta);
    g.innerHTML = Array.from({ length: info.total }, (_, i) => "<span class=\\"ln" + (i + 1 === info.line ? " on" : "") + "\\">" + (i + 1) + "</span>").join("");
    hl.innerHTML = highlightSql(ta.value);
    if (pos) pos.textContent = "Línea " + info.line + ", col " + info.col + " · " + info.total + (info.total === 1 ? " línea" : " líneas");
    syncSqlScroll();
  }
  function syncGutter() { paintSqlEditor(); }
  let acItems = [];
  let acIndex = 0;
  let acFrom = 0;
  function hideAc() {
    const box = document.getElementById("wb-sql-ac");
    if (box) { box.hidden = true; box.innerHTML = ""; }
    acItems = [];
  }
  function paintAc() {
    const box = document.getElementById("wb-sql-ac");
    if (!box) return;
    box.innerHTML = acItems.map((name, i) => "<button type=button data-ac=\\"" + i + "\\" class=\\"" + (i === acIndex ? "on" : "") + "\\">" + sqlEsc(name) + "</button>").join("");
    box.querySelector(".on")?.scrollIntoView({ block: "nearest" });
  }
  function wordAtCaret(ta) {
    const v = ta.value;
    const i = ta.selectionStart || 0;
    let a = i;
    while (a > 0 && /[A-Za-z0-9_@#.]/.test(v[a - 1])) a -= 1;
    return { start: a, end: i, word: v.slice(a, i) };
  }
  function showAc(force) {
    const ta = document.getElementById("wb-sql-ed");
    const box = document.getElementById("wb-sql-ac");
    if (!ta || !box) return;
    const w = wordAtCaret(ta);
    if (!force && w.word.length < 2) { hideAc(); return; }
    const p = w.word.toLowerCase();
    const names = [];
    (schemaState.live.tables || []).forEach((t) => { const n = tableName(t); if (n) names.push(n); });
    (schemaState.live.procedures || []).forEach((pr) => { const n = procName(pr); if (n) names.push(n); });
    const seen = new Set();
    acItems = SQL_KW.concat(SQL_FN).concat(names).filter((name) => {
      const k = String(name).toLowerCase();
      if (!k || seen.has(k) || k === p) return false;
      if (p && k.indexOf(p) !== 0 && k.indexOf(p) < 0) return false;
      seen.add(k);
      return true;
    }).slice(0, 14);
    if (!acItems.length) { hideAc(); return; }
    acIndex = 0;
    acFrom = w.start;
    box.hidden = false;
    paintAc();
  }
  function acceptAc(i) {
    const ta = document.getElementById("wb-sql-ed");
    const name = acItems[i];
    if (!ta || !name) return;
    const end = ta.selectionStart || 0;
    ta.value = ta.value.slice(0, acFrom) + name + ta.value.slice(end);
    const next = acFrom + name.length;
    ta.selectionStart = ta.selectionEnd = next;
    hideAc();
    paintSqlEditor();
    ta.focus();
  }
  let sqlFindAt = 0;
  let sqlFindInSel = false;
  let sqlFindScope = null;
  let sqlFindCase = false;
  let sqlCw = 0;
  function sqlCharWidth() {
    if (sqlCw) return sqlCw;
    const c = document.createElement("canvas");
    const ctx = c.getContext && c.getContext("2d");
    if (!ctx) return 8.1;
    ctx.font = "13.5px Consolas, Cascadia Mono, monospace";
    sqlCw = ctx.measureText("0000000000").width / 10;
    return sqlCw || 8.1;
  }
  function sqlLineAt(text, pos) {
    let n = 0;
    const stop = Math.min(pos, text.length);
    for (let i = 0; i < stop; i += 1) if (text[i] === "\\n") n += 1;
    return n;
  }
  function sqlColAt(text, pos) {
    const cut = text.slice(0, pos);
    const i = cut.lastIndexOf("\\n");
    return pos - (i + 1);
  }
  function sqlBoxes(text, start, end, ta) {
    const a = Math.max(0, Math.min(start, end));
    const b = Math.min(text.length, Math.max(start, end));
    if (b <= a) return [];
    const cs = getComputedStyle(ta);
    const padX = parseFloat(cs.paddingLeft) || 0;
    const padY = parseFloat(cs.paddingTop) || 0;
    const lh = 21;
    const cw = sqlCharWidth();
    const lines = text.split("\\n");
    const lineA = sqlLineAt(text, a);
    const lineB = sqlLineAt(text, b);
    const out = [];
    for (let line = lineA; line <= lineB; line += 1) {
      const colA = line === lineA ? sqlColAt(text, a) : 0;
      const colB = line === lineB ? sqlColAt(text, b) : (lines[line] || "").length;
      out.push({
        top: padY + line * lh - ta.scrollTop,
        left: padX + colA * cw - ta.scrollLeft,
        width: Math.max((colB - colA) * cw, 2),
        height: lh,
      });
    }
    return out;
  }
  function paintFindToggles() {
    document.getElementById("wb-sql-find-sel")?.classList.toggle("on", sqlFindInSel);
    document.getElementById("wb-sql-find-case")?.classList.toggle("on", sqlFindCase);
  }
  function sqlFindHits() {
    const ta = document.getElementById("wb-sql-ed");
    const q = String(document.getElementById("wb-sql-find")?.value || "");
    if (!ta || !q) return [];
    const text = ta.value;
    const hay = sqlFindCase ? text : text.toLowerCase();
    const needle = sqlFindCase ? q : q.toLowerCase();
    const lo = sqlFindInSel && sqlFindScope ? sqlFindScope.start : 0;
    const hi = sqlFindInSel && sqlFindScope ? sqlFindScope.end : text.length;
    const hits = [];
    let from = lo;
    while (from < hi) {
      const at = hay.indexOf(needle, from);
      if (at < 0 || at >= hi || at + needle.length > hi) break;
      hits.push(at);
      from = at + Math.max(needle.length, 1);
    }
    return hits;
  }
  const sqlOcc = { ranges: [], seed: "" };
  const favOcc = { ranges: [], seed: "" };
  let multiLock = false;
  function wordBounds(text, pos) {
    let a = pos;
    let b = pos;
    const ok = (ch) => /[A-Za-z0-9_@#$.]/.test(ch || "");
    while (a > 0 && ok(text[a - 1])) a -= 1;
    while (b < text.length && ok(text[b])) b += 1;
    if (a === b) return null;
    return { start: a, end: b };
  }
  function nextSameAt(text, seed, ranges) {
    if (!seed) return -1;
    const taken = {};
    ranges.forEach((r) => { taken[r.start] = true; });
    let from = ranges.length ? ranges[ranges.length - 1].end : 0;
    for (let pass = 0; pass < 2; pass += 1) {
      let at = text.indexOf(seed, from);
      while (at >= 0) {
        if (!taken[at]) return at;
        at = text.indexOf(seed, at + Math.max(seed.length, 1));
      }
      from = 0;
    }
    return -1;
  }
  function selectNextSame(ta, bag, paint) {
    if (!ta) return;
    const text = ta.value || "";
    const had = bag.ranges.length > 0;
    if (!had) {
      let start = ta.selectionStart || 0;
      let end = ta.selectionEnd || 0;
      const empty = start === end;
      if (empty) {
        const w = wordBounds(text, start);
        if (!w) return;
        start = w.start;
        end = w.end;
      }
      bag.seed = text.slice(start, end);
      if (!bag.seed) return;
      bag.ranges = [{ start: start, end: end }];
      if (empty) {
        multiLock = true;
        ta.setSelectionRange(start, end);
        paint();
        setTimeout(() => { multiLock = false; }, 0);
        setMsg("wb-sql-msg", "1 seleccionada. Ctrl+D agrega la siguiente igual.", true);
        return;
      }
    }
    const at = nextSameAt(text, bag.seed, bag.ranges);
    if (at >= 0) bag.ranges.push({ start: at, end: at + bag.seed.length });
    const last = bag.ranges[bag.ranges.length - 1];
    multiLock = true;
    ta.setSelectionRange(last.start, last.end);
    const line = text.slice(0, last.start).split("\\n").length;
    ta.scrollTop = Math.max(0, (line - 4) * 21);
    paint();
    setTimeout(() => { multiLock = false; }, 0);
    setMsg("wb-sql-msg", at < 0
      ? ("Ya están todas (" + bag.ranges.length + ")")
      : (bag.ranges.length + " seleccionadas iguales. Ctrl+D suma la siguiente."), true);
  }
  function paintMarks() {
    const ta = document.getElementById("wb-sql-ed");
    const box = document.getElementById("wb-sql-marks");
    if (!ta || !box) return;
    const text = ta.value || "";
    const q = String(document.getElementById("wb-sql-find")?.value || "");
    const bar = document.getElementById("wb-sql-findbar");
    const finding = Boolean(bar && !bar.hidden && q);
    const hits = finding ? sqlFindHits() : [];
    const cur = finding && hits.length ? hits[(sqlFindAt % hits.length + hits.length) % hits.length] : -1;
    let html = "";
    function add(ranges, cls) {
      ranges.forEach((r) => {
        html += "<i class=\\"sql-mark " + cls + "\\" style=\\"top:" + r.top + "px;left:" + r.left + "px;width:" + r.width + "px;height:" + r.height + "px\\"></i>";
      });
    }
    if (sqlFindInSel && sqlFindScope) add(sqlBoxes(text, sqlFindScope.start, sqlFindScope.end, ta), "scope");
    hits.forEach((at) => {
      if (at === cur) return;
      add(sqlBoxes(text, at, at + q.length, ta), "hit");
    });
    const ss = ta.selectionStart || 0;
    const se = ta.selectionEnd || 0;
    const selIsHit = cur >= 0 && ss === cur && se === cur + q.length;
    if (sqlOcc.ranges.length) sqlOcc.ranges.forEach((r) => add(sqlBoxes(text, r.start, r.end, ta), "sel"));
    else if (ss !== se && !selIsHit) add(sqlBoxes(text, ss, se, ta), "sel");
    if (cur >= 0) add(sqlBoxes(text, cur, cur + q.length, ta), "hit on");
    box.innerHTML = html;
  }
  function jumpSqlFind(dir) {
    const ta = document.getElementById("wb-sql-ed");
    const q = String(document.getElementById("wb-sql-find")?.value || "");
    const nEl = document.getElementById("wb-sql-find-n");
    const hits = sqlFindHits();
    if (!ta || !q || !hits.length) {
      if (nEl) nEl.textContent = q ? "Sin coincidencias" : "";
      sqlFindAt = 0;
      paintMarks();
      return;
    }
    if (dir === "next") sqlFindAt = (sqlFindAt + 1) % hits.length;
    else if (dir === "prev") sqlFindAt = (sqlFindAt - 1 + hits.length) % hits.length;
    else {
      const cur = sqlFindInSel && sqlFindScope ? sqlFindScope.start : (ta.selectionStart || 0);
      let idx = 0;
      for (let h = 0; h < hits.length; h += 1) if (hits[h] >= cur) { idx = h; break; }
      sqlFindAt = idx;
    }
    const at = hits[sqlFindAt];
    ta.setSelectionRange(at, at + q.length);
    const line = ta.value.slice(0, at).split("\\n").length;
    ta.scrollTop = Math.max(0, (line - 4) * 21);
    if (nEl) nEl.textContent = (sqlFindAt + 1) + " / " + hits.length + (sqlFindInSel ? " en la selección" : "");
    paintSqlEditor();
  }
  function closeSqlFind() {
    const bar = document.getElementById("wb-sql-findbar");
    if (bar) bar.hidden = true;
    sqlFindInSel = false;
    sqlFindScope = null;
    paintFindToggles();
    document.getElementById("wb-sql-ed")?.focus();
    paintMarks();
  }
  function toggleFindSel() {
    const ta = document.getElementById("wb-sql-ed");
    const hasSel = ta && ta.selectionStart !== ta.selectionEnd;
    const same = hasSel && sqlFindScope && ta.selectionStart === sqlFindScope.start && ta.selectionEnd === sqlFindScope.end;
    if (sqlFindInSel && (!hasSel || same)) {
      sqlFindInSel = false;
      sqlFindScope = null;
    } else if (hasSel) {
      sqlFindInSel = true;
      sqlFindScope = { start: ta.selectionStart, end: ta.selectionEnd };
    } else {
      setMsg("wb-sql-msg", "Seleccioná un trozo de la consulta para buscar ahí.", false);
      return;
    }
    paintFindToggles();
    sqlFindAt = -1;
    jumpSqlFind("reset");
  }
  function openSqlFind() {
    const bar = document.getElementById("wb-sql-findbar");
    const input = document.getElementById("wb-sql-find");
    const ta = document.getElementById("wb-sql-ed");
    if (!bar) return;
    bar.hidden = false;
    if (ta && ta.selectionStart !== ta.selectionEnd) {
      const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (sel.indexOf("\\n") >= 0) {
        sqlFindInSel = true;
        sqlFindScope = { start: ta.selectionStart, end: ta.selectionEnd };
      } else if (sel && input) {
        input.value = sel.slice(0, 200);
        sqlFindInSel = false;
        sqlFindScope = null;
      }
    }
    paintFindToggles();
    input?.focus();
    input?.select();
    sqlFindAt = -1;
    jumpSqlFind("reset");
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
    if (opts?.autoPreview !== false && resultView !== "grid") paintJson("reset");
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
    if (resultView === "json") paintJson("reset");
  }
  function previewOne(ri) {
    if (!lastRows[ri]) return;
    selected = new Set([ri]);
    lastClickRi = ri;
    syncSelUi({ autoPreview: false });
    showResultView(resultView === "txt" ? "txt" : "json");
  }
  async function runSql() {
    try {
      showRunError("");
      setMsg("wb-sql-msg", "Ejecutando…");
      const taRun = document.getElementById("wb-sql-ed");
      const selectedSql = taRun && taRun.selectionStart !== taRun.selectionEnd;
      const j = await apiCall("POST", "/api/sql", {
        sql: selectedSql ? taRun.value.slice(taRun.selectionStart, taRun.selectionEnd) : taRun.value,
        connectionId: document.getElementById("wb-sql-origin").value,
        limit: Number(document.getElementById("wb-sql-limit").value || 200),
      });
      renderGrid(j.columns, j.rows);
      const n = (j.rows || []).length;
      setMsg("wb-sql-msg", n + " filas" + (j.truncated ? " (recorte)" : "") + (j.kind === "exec" ? " · EXEC" : "") + (selectedSql ? " · selección" : ""), true);
    } catch (e) {
      renderGrid([], []);
      showRunError(e.message);
      setMsg("wb-sql-msg", "Error de la consulta", false);
    }
  }
  document.getElementById("wb-sql-run")?.addEventListener("click", runSql);
  const sqlEd = document.getElementById("wb-sql-ed");
  sqlEd?.addEventListener("input", () => { sqlOcc.ranges = []; sqlOcc.seed = ""; paintSqlEditor(); showAc(false); });
  sqlEd?.addEventListener("scroll", syncSqlScroll);
  sqlEd?.addEventListener("click", paintSqlEditor);
  sqlEd?.addEventListener("keyup", paintSqlEditor);
  document.addEventListener("selectionchange", () => {
    const id = document.activeElement && document.activeElement.id;
    if (!multiLock && id === "wb-sql-ed") { sqlOcc.ranges = []; sqlOcc.seed = ""; }
    if (!multiLock && id === "wb-sql-fav-ed") { favOcc.ranges = []; favOcc.seed = ""; }
    if (id === "wb-sql-ed") paintSqlEditor();
    if (id === "wb-sql-fav-ed") paintFavChrome();
  });
  sqlEd?.addEventListener("keydown", (e) => {
    const acBox = document.getElementById("wb-sql-ac");
    const acOpen = acBox && !acBox.hidden;
    if (acOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      acIndex = e.key === "ArrowDown" ? (acIndex + 1) % acItems.length : (acIndex - 1 + acItems.length) % acItems.length;
      paintAc();
      return;
    }
    if (acOpen && (e.key === "Enter" || e.key === "Tab")) { e.preventDefault(); acceptAc(acIndex); return; }
    if (acOpen && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); hideAc(); return; }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "d") { e.preventDefault(); e.stopPropagation(); selectNextSame(sqlEd, sqlOcc, paintSqlEditor); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") { e.preventDefault(); e.stopPropagation(); openSqlFind(); return; }
    if (e.altKey && e.key.toLowerCase() === "l") { e.preventDefault(); toggleFindSel(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === " " || e.code === "Space")) { e.preventDefault(); showAc(true); return; }
    if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key === "Enter")) { e.preventDefault(); runSql(); return; }
    if (e.key === "Tab") {
      e.preventDefault();
      const a = sqlEd.selectionStart, b = sqlEd.selectionEnd;
      sqlEd.value = sqlEd.value.slice(0, a) + "  " + sqlEd.value.slice(b);
      sqlEd.selectionStart = sqlEd.selectionEnd = a + 2;
      paintSqlEditor();
    }
  });
  document.getElementById("wb-sql-ac")?.addEventListener("mousedown", (e) => {
    const btn = e.target.closest && e.target.closest("[data-ac]");
    if (!btn) return;
    e.preventDefault();
    acceptAc(Number(btn.getAttribute("data-ac")));
  });
  document.getElementById("wb-sql-find-open")?.addEventListener("click", openSqlFind);
  document.getElementById("wb-sql-find-close")?.addEventListener("click", closeSqlFind);
  document.getElementById("wb-sql-find-sel")?.addEventListener("click", toggleFindSel);
  document.getElementById("wb-sql-find-case")?.addEventListener("click", () => {
    sqlFindCase = !sqlFindCase;
    paintFindToggles();
    sqlFindAt = -1;
    jumpSqlFind("reset");
  });
  document.getElementById("wb-sql-find")?.addEventListener("input", () => { sqlFindAt = -1; jumpSqlFind("reset"); });
  document.getElementById("wb-sql-find-next")?.addEventListener("click", () => jumpSqlFind("next"));
  document.getElementById("wb-sql-find-prev")?.addEventListener("click", () => jumpSqlFind("prev"));
  document.getElementById("wb-sql-find")?.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "l") { e.preventDefault(); toggleFindSel(); return; }
    if (e.key === "Escape") {
      e.preventDefault();
      closeSqlFind();
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    jumpSqlFind(e.shiftKey ? "prev" : "next");
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
  let resultView = "grid";
  let jsonHit = 0;
  function showResultView(mode) {
    resultView = mode === "txt" ? "txt" : mode === "json" ? "json" : "grid";
    const grid = document.getElementById("wb-sql-grid-wrap");
    const pane = document.getElementById("wb-sql-json-pane");
    const inspect = document.getElementById("wb-sql-inspect");
    if (inspect) { inspect.hidden = true; inspect.classList.remove("fs"); }
    previewOpen = false;
    if (grid) grid.hidden = resultView !== "grid";
    if (pane) pane.hidden = resultView === "grid";
    document.getElementById("wb-sql-view-grid")?.classList.toggle("on", resultView === "grid");
    document.getElementById("wb-sql-view-json")?.classList.toggle("on", resultView === "json");
    document.getElementById("wb-sql-view-txt")?.classList.toggle("on", resultView === "txt");
    document.getElementById("wb-sql-json")?.classList.toggle("on", resultView === "json");
    if (resultView !== "grid") {
      const side = document.getElementById("q");
      const find = document.getElementById("wb-sql-json-find");
      if (find) find.placeholder = resultView === "txt" ? "Buscar en el texto" : "Buscar en el JSON";
      if (find && side && side.value && !find.value) find.value = side.value;
      paintJson("reset");
    }
  }
  function paintJson(jump) {
    const body = document.getElementById("wb-sql-json-body");
    const nEl = document.getElementById("wb-sql-json-find-n");
    if (!body) return;
    const rows = selected.size ? pickRows() : lastRows;
    const text = rows.length ? (resultView === "txt" ? rowsTxt(rows) : rowsJson(rows)) : "";
    const q = String(document.getElementById("wb-sql-json-find")?.value || "").trim();
    if (!text) {
      body.textContent = "Sin resultados";
      if (nEl) nEl.textContent = "";
      return;
    }
    if (!q) {
      body.textContent = text;
      jsonHit = 0;
      if (nEl) nEl.textContent = "";
      return;
    }
    const low = text.toLowerCase();
    const needle = q.toLowerCase();
    const hits = [];
    let from = 0;
    while (from < text.length) {
      const at = low.indexOf(needle, from);
      if (at < 0) break;
      hits.push(at);
      from = at + Math.max(needle.length, 1);
    }
    if (!hits.length) {
      body.textContent = text;
      jsonHit = 0;
      if (nEl) nEl.textContent = "Sin coincidencias";
      return;
    }
    if (jump === "next") jsonHit = (jsonHit + 1) % hits.length;
    else if (jump === "prev") jsonHit = (jsonHit - 1 + hits.length) % hits.length;
    else jsonHit = 0;
    let html = "";
    let cursor = 0;
    hits.forEach((at, i) => {
      html += cellEsc(text.slice(cursor, at));
      html += "<mark class=\\"sql-hit" + (i === jsonHit ? " on" : "") + "\\">" + cellEsc(text.slice(at, at + q.length)) + "</mark>";
      cursor = at + q.length;
    });
    html += cellEsc(text.slice(cursor));
    body.innerHTML = html;
    if (nEl) nEl.textContent = (jsonHit + 1) + " / " + hits.length;
    body.querySelector("mark.sql-hit.on")?.scrollIntoView({ block: "center", inline: "nearest" });
  }
  window.afnSqlFindNext = (dir) => {
    if (resultView !== "json") return;
    paintJson(dir === "prev" ? "prev" : "next");
  };
  window.afnSqlFind = (raw) => {
    if (resultView !== "json") return;
    const find = document.getElementById("wb-sql-json-find");
    const next = String(raw || "");
    if (find && find.value !== next) find.value = next;
    paintJson("reset");
  };
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
  function dlCsv() {
    if (!needRows()) return;
    downloadBlob("consulta" + fileTag() + "-" + stamp() + ".csv", "text/csv;charset=utf-8", "\\uFEFF" + csvText());
  }
  document.getElementById("wb-sql-csv")?.addEventListener("click", dlCsv);
  document.getElementById("wb-sql-dl-csv")?.addEventListener("click", dlCsv);
  document.getElementById("wb-sql-json")?.addEventListener("click", () => showResultView("json"));
  document.getElementById("wb-sql-view-grid")?.addEventListener("click", () => showResultView("grid"));
  document.getElementById("wb-sql-view-txt")?.addEventListener("click", () => showResultView("txt"));
  document.getElementById("wb-sql-json-find")?.addEventListener("input", () => paintJson("reset"));
  document.getElementById("wb-sql-json-next")?.addEventListener("click", () => paintJson("next"));
  document.getElementById("wb-sql-json-prev")?.addEventListener("click", () => paintJson("prev"));
  document.getElementById("wb-sql-json-find")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    paintJson(e.shiftKey ? "prev" : "next");
  });
  document.getElementById("wb-sql-txt")?.addEventListener("click", dlTxt);
  document.getElementById("wb-sql-xls")?.addEventListener("click", dlXls);
  document.getElementById("wb-sql-dl-json")?.addEventListener("click", dlJson);
  document.getElementById("wb-sql-dl-txt")?.addEventListener("click", dlTxt);
  document.getElementById("wb-sql-dl-xls")?.addEventListener("click", dlXls);
  document.getElementById("wb-sql-view-json")?.addEventListener("click", () => {
    if (!lastRows.length) { setMsg("wb-sql-msg", "No hay resultados", false); return; }
    showResultView("json");
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
  function applySqlSplit(pct) {
    const n = Math.max(18, Math.min(82, Number(pct) || 55));
    const split = document.querySelector(".sql-ide-split");
    if (!split) return n;
    split.style.gridTemplateRows = "minmax(120px," + n + "fr) 8px minmax(90px," + (100 - n) + "fr)";
    try { sessionStorage.setItem("afn-sql-split", String(Math.round(n))); } catch (err) {}
    return n;
  }
  try { applySqlSplit(Number(sessionStorage.getItem("afn-sql-split")) || 55); } catch (err) { applySqlSplit(55); }
  const sqlSplit = document.getElementById("wb-sql-split");
  if (sqlSplit) {
    sqlSplit.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      sqlSplit.classList.add("on");
      sqlSplit.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const box = sqlSplit.parentElement;
        if (!box) return;
        const rect = box.getBoundingClientRect();
        if (!rect.height) return;
        applySqlSplit(((ev.clientY - rect.top) / rect.height) * 100);
        syncGutter();
      };
      const up = () => {
        sqlSplit.classList.remove("on");
        sqlSplit.removeEventListener("pointermove", move);
        sqlSplit.removeEventListener("pointerup", up);
        sqlSplit.removeEventListener("pointercancel", up);
      };
      sqlSplit.addEventListener("pointermove", move);
      sqlSplit.addEventListener("pointerup", up);
      sqlSplit.addEventListener("pointercancel", up);
    });
    sqlSplit.addEventListener("dblclick", () => { applySqlSplit(55); syncGutter(); });
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
  let favQuery = "";
  let favFindAt = 0;
  let favFindInSel = false;
  let favFindScope = null;
  let favFindCase = false;
  function paintFavFindToggles() {
    document.getElementById("wb-sql-fav-find-sel")?.classList.toggle("on", favFindInSel);
    document.getElementById("wb-sql-fav-find-case")?.classList.toggle("on", favFindCase);
  }
  function favFindHits() {
    const ta = document.getElementById("wb-sql-fav-ed");
    const q = String(document.getElementById("wb-sql-fav-find")?.value || "");
    if (!ta || !q) return [];
    const text = ta.value;
    const hay = favFindCase ? text : text.toLowerCase();
    const needle = favFindCase ? q : q.toLowerCase();
    const lo = favFindInSel && favFindScope ? favFindScope.start : 0;
    const hi = favFindInSel && favFindScope ? favFindScope.end : text.length;
    const hits = [];
    let from = lo;
    while (from < hi) {
      const at = hay.indexOf(needle, from);
      if (at < 0 || at >= hi || at + needle.length > hi) break;
      hits.push(at);
      from = at + Math.max(needle.length, 1);
    }
    return hits;
  }
  function paintFavMarks() {
    const ta = document.getElementById("wb-sql-fav-ed");
    const box = document.getElementById("wb-sql-fav-marks");
    if (!ta || !box) return;
    const text = ta.value || "";
    const q = String(document.getElementById("wb-sql-fav-find")?.value || "");
    const bar = document.getElementById("wb-sql-fav-findbar");
    const finding = Boolean(bar && !bar.hidden && q);
    const hits = finding ? favFindHits() : [];
    const cur = finding && hits.length ? hits[(favFindAt % hits.length + hits.length) % hits.length] : -1;
    let html = "";
    function add(ranges, cls) {
      ranges.forEach((r) => {
        html += "<i class=\\"sql-mark " + cls + "\\" style=\\"top:" + r.top + "px;left:" + r.left + "px;width:" + r.width + "px;height:" + r.height + "px\\"></i>";
      });
    }
    if (favFindInSel && favFindScope) add(sqlBoxes(text, favFindScope.start, favFindScope.end, ta), "scope");
    hits.forEach((at) => {
      if (at === cur) return;
      add(sqlBoxes(text, at, at + q.length, ta), "hit");
    });
    const ss = ta.selectionStart || 0;
    const se = ta.selectionEnd || 0;
    const selIsHit = cur >= 0 && ss === cur && se === cur + q.length;
    if (favOcc.ranges.length) favOcc.ranges.forEach((r) => add(sqlBoxes(text, r.start, r.end, ta), "sel"));
    else if (ss !== se && !selIsHit) add(sqlBoxes(text, ss, se, ta), "sel");
    if (cur >= 0) add(sqlBoxes(text, cur, cur + q.length, ta), "hit on");
    box.innerHTML = html;
  }
  function paintFavChrome() {
    const ta = document.getElementById("wb-sql-fav-ed");
    const g = document.getElementById("wb-sql-fav-gutter");
    const bar = document.getElementById("wb-sql-fav-caret");
    const hl = document.getElementById("wb-sql-fav-preview");
    if (!ta || !g) return;
    const text = ta.value || "";
    const info = caretPos(ta);
    const n = Math.max(1, text ? text.split("\\n").length : 1);
    g.innerHTML = Array.from({ length: n }, (_, i) => "<span class=\\"ln" + (i + 1 === info.line ? " on" : "") + "\\">" + (i + 1) + "</span>").join("");
    g.scrollTop = ta.scrollTop;
    if (hl) { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; }
    if (bar) {
      const lh = 21;
      const pad = parseFloat(getComputedStyle(ta).paddingTop) || 0;
      bar.style.height = lh + "px";
      bar.style.top = ((info.line - 1) * lh + pad - ta.scrollTop) + "px";
    }
    paintFavMarks();
  }
  function jumpFavFind(dir) {
    const ta = document.getElementById("wb-sql-fav-ed");
    const q = String(document.getElementById("wb-sql-fav-find")?.value || "");
    const nEl = document.getElementById("wb-sql-fav-find-n");
    const hits = favFindHits();
    if (!ta || !q || !hits.length) {
      if (nEl) nEl.textContent = q ? "Sin coincidencias" : "";
      favFindAt = 0;
      paintFavMarks();
      return;
    }
    if (dir === "next") favFindAt = (favFindAt + 1) % hits.length;
    else if (dir === "prev") favFindAt = (favFindAt - 1 + hits.length) % hits.length;
    else {
      const cur = favFindInSel && favFindScope ? favFindScope.start : (ta.selectionStart || 0);
      let idx = 0;
      for (let h = 0; h < hits.length; h += 1) if (hits[h] >= cur) { idx = h; break; }
      favFindAt = idx;
    }
    const at = hits[favFindAt];
    ta.setSelectionRange(at, at + q.length);
    const line = ta.value.slice(0, at).split("\\n").length;
    ta.scrollTop = Math.max(0, (line - 4) * 21);
    if (nEl) nEl.textContent = (favFindAt + 1) + " / " + hits.length + (favFindInSel ? " en la selección" : "");
    paintFavChrome();
  }
  function closeFavFind() {
    const bar = document.getElementById("wb-sql-fav-findbar");
    if (bar) bar.hidden = true;
    favFindInSel = false;
    favFindScope = null;
    paintFavFindToggles();
    document.getElementById("wb-sql-fav-ed")?.focus();
    paintFavMarks();
  }
  function toggleFavFindSel() {
    const ta = document.getElementById("wb-sql-fav-ed");
    const hasSel = ta && ta.selectionStart !== ta.selectionEnd;
    const same = hasSel && favFindScope && ta.selectionStart === favFindScope.start && ta.selectionEnd === favFindScope.end;
    if (favFindInSel && (!hasSel || same)) {
      favFindInSel = false;
      favFindScope = null;
    } else if (hasSel) {
      favFindInSel = true;
      favFindScope = { start: ta.selectionStart, end: ta.selectionEnd };
    } else {
      setMsg("wb-sql-msg", "Seleccioná un trozo del favorito para buscar ahí.", false);
      return;
    }
    paintFavFindToggles();
    favFindAt = -1;
    jumpFavFind("reset");
  }
  function openFavFind() {
    const bar = document.getElementById("wb-sql-fav-findbar");
    const input = document.getElementById("wb-sql-fav-find");
    const ta = document.getElementById("wb-sql-fav-ed");
    if (!bar) return;
    bar.hidden = false;
    if (ta && ta.selectionStart !== ta.selectionEnd) {
      const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (sel.indexOf("\\n") >= 0) {
        favFindInSel = true;
        favFindScope = { start: ta.selectionStart, end: ta.selectionEnd };
      } else if (sel && input) {
        input.value = sel.slice(0, 200);
        favFindInSel = false;
        favFindScope = null;
      }
    }
    paintFavFindToggles();
    input?.focus();
    input?.select();
    favFindAt = -1;
    jumpFavFind("reset");
  }
  function paintFavSql(sql, emptyMsg) {
    const pre = document.getElementById("wb-sql-fav-preview");
    const ta = document.getElementById("wb-sql-fav-ed");
    const linesEl = document.getElementById("wb-sql-fav-lines");
    const text = String(sql || "");
    const n = Math.max(1, text ? text.split("\\n").length : 1);
    let changed = false;
    if (ta && ta.value !== text) {
      ta.value = text;
      changed = true;
      favFindInSel = false;
      favFindScope = null;
      paintFavFindToggles();
    }
    if (pre) {
      if (!text) pre.textContent = emptyMsg || "Seleccioná una consulta de la lista para previsualizarla.";
      else pre.innerHTML = highlightSql(text);
    }
    if (linesEl) linesEl.textContent = text ? (n + (n === 1 ? " línea" : " líneas")) : "";
    paintFavChrome();
    const bar = document.getElementById("wb-sql-fav-findbar");
    if (changed && bar && !bar.hidden) jumpFavFind("reset");
  }
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
    const countEl = document.getElementById("wb-sql-fav-count");
    const q = favQuery.trim().toLowerCase();
    const shown = q ? list.filter((f) => (String(f.title || "") + " " + String(f.sql || "")).toLowerCase().indexOf(q) >= 0) : list;
    if (openBtn) openBtn.textContent = list.length ? ("Favoritos (" + list.length + ")") : "Favoritos";
    if (countEl) countEl.textContent = list.length ? (shown.length + " de " + list.length) : "";
    if (!box) return;
    if (!list.length) {
      favSelected = "";
      box.innerHTML = "<p class=muted>Todavía no hay consultas guardadas. ★ Guardar deja la del editor en .afn/sql-favorites.json.</p>";
      paintFavSql("", "Cuando guardes una, la vas a ver acá antes de cargarla.");
      if (titleEl) titleEl.textContent = "Sin favoritos";
      if (loadBtn) loadBtn.disabled = true;
      if (delBtn) delBtn.disabled = true;
      return;
    }
    if (!shown.length) {
      box.innerHTML = "<p class=muted>Ningún favorito coincide con la búsqueda.</p>";
      paintFavSql("", "Ningún favorito coincide con la búsqueda.");
      if (titleEl) titleEl.textContent = "Sin coincidencias";
      if (loadBtn) loadBtn.disabled = true;
      if (delBtn) delBtn.disabled = true;
      return;
    }
    if (!shown.some((f) => f.id === favSelected)) favSelected = shown[0].id;
    const hit = shown.find((f) => f.id === favSelected) || shown[0];
    box.innerHTML = shown.map((f) => {
      const on = f.id === hit.id ? " on" : "";
      const n = String(f.sql || "").split("\\n").length;
      const line = String(f.sql || "").replace(/\\s+/g, " ").trim().slice(0, 72);
      return "<button type=button class=\\"fav-item" + on + "\\" data-fav-pick=\\"" + favEsc(f.id) + "\\"><strong>" + favEsc(f.title || "consulta") + "</strong><small>" + n + (n === 1 ? " línea · " : " líneas · ") + favEsc(line) + "</small></button>";
    }).join("");
    box.querySelectorAll("[data-fav-pick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        favSelected = btn.getAttribute("data-fav-pick") || "";
        paintFavModal();
      });
    });
    paintFavSql(hit.sql || "");
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
  document.getElementById("wb-sql-fav-q")?.addEventListener("input", (e) => {
    favQuery = e.target.value || "";
    paintFavModal();
  });
  const favEd = document.getElementById("wb-sql-fav-ed");
  favEd?.addEventListener("scroll", paintFavChrome);
  favEd?.addEventListener("keyup", paintFavChrome);
  favEd?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "d") { e.preventDefault(); e.stopPropagation(); selectNextSame(favEd, favOcc, paintFavChrome); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") { e.preventDefault(); e.stopPropagation(); openFavFind(); return; }
    if (e.altKey && e.key.toLowerCase() === "l") { e.preventDefault(); toggleFavFindSel(); return; }
  });
  document.getElementById("wb-sql-fav-find-open")?.addEventListener("click", openFavFind);
  document.getElementById("wb-sql-fav-find-close")?.addEventListener("click", closeFavFind);
  document.getElementById("wb-sql-fav-find-sel")?.addEventListener("click", toggleFavFindSel);
  document.getElementById("wb-sql-fav-find-case")?.addEventListener("click", () => {
    favFindCase = !favFindCase;
    paintFavFindToggles();
    favFindAt = -1;
    jumpFavFind("reset");
  });
  document.getElementById("wb-sql-fav-find")?.addEventListener("input", () => { favFindAt = -1; jumpFavFind("reset"); });
  document.getElementById("wb-sql-fav-find-next")?.addEventListener("click", () => jumpFavFind("next"));
  document.getElementById("wb-sql-fav-find-prev")?.addEventListener("click", () => jumpFavFind("prev"));
  document.getElementById("wb-sql-fav-find")?.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "l") { e.preventDefault(); toggleFavFindSel(); return; }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeFavFind(); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();
    jumpFavFind(e.shiftKey ? "prev" : "next");
  });
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "d") {
      const id = document.activeElement && document.activeElement.id;
      if (id !== "wb-sql-ed" && id !== "wb-sql-fav-ed") return;
      e.preventDefault();
      e.stopPropagation();
      if (id === "wb-sql-ed") selectNextSame(document.getElementById("wb-sql-ed"), sqlOcc, paintSqlEditor);
      else selectNextSame(document.getElementById("wb-sql-fav-ed"), favOcc, paintFavChrome);
      return;
    }
    const modal = document.getElementById("wb-sql-fav-modal");
    if (!modal || modal.hidden) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      e.stopPropagation();
      openFavFind();
    }
  }, true);
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
  function scriptBase(p) {
    const s = String(p || "").replace(/\\\\/g, "/");
    const i = s.lastIndexOf("/");
    return i >= 0 ? s.slice(i + 1) : s;
  }
  function langFromPath(p) {
    return /\\.py$/i.test(String(p || "")) ? "python" : "node";
  }
  function showPickedFile(filePath) {
    const pathEl = document.getElementById("wb-script-path");
    const nameEl = document.getElementById("wb-script-file-name");
    const hintEl = document.getElementById("wb-script-file-path");
    const pick = document.getElementById("wb-script-pick");
    const add = document.getElementById("wb-script-add");
    const title = document.getElementById("wb-script-title");
    const lang = document.getElementById("wb-script-lang");
    if (pathEl) pathEl.value = filePath || "";
    const base = scriptBase(filePath);
    if (nameEl) nameEl.textContent = base || "Ningún archivo elegido";
    if (hintEl) hintEl.textContent = filePath || "Python o Node. El explorador devuelve la ruta; no hace falta pegarla.";
    if (pick) pick.classList.toggle("on", Boolean(filePath));
    if (add) add.disabled = !filePath;
    if (lang && filePath) lang.value = langFromPath(filePath);
    if (title && filePath && !title.value.trim()) title.value = base.replace(/\\.(py|js|mjs|cjs)$/i, "");
  }
  let scriptCatalog = [];
  function paintScripts(list) {
    scriptCatalog = list || [];
    const box = document.getElementById("wb-script-list");
    if (!box) return;
    if (!list.length) {
      box.innerHTML = "<p class=empty>Todavía no hay scripts. Elegí un archivo y guardalo.</p>";
      return;
    }
    box.innerHTML = list.map((r) => {
      const base = scriptBase(r.path);
      return "<article class=script-item data-q=\\"" + favEsc(r.title) + "\\"><span class=k>" + favEsc(r.lang) + "</span><strong>" + favEsc(r.title) + "</strong><p class=muted>" + favEsc(base) + "</p><div class=script-actions><button type=button class=\\"btn afn-pick-go\\" data-script-run=\\"" + favEsc(r.id) + "\\" data-script-title=\\"" + favEsc(r.title) + "\\">Ejecutar</button><button type=button class=btn data-script-del=\\"" + favEsc(r.id) + "\\">Quitar</button></div></article>";
    }).join("");
    box.querySelectorAll("[data-script-run]").forEach((btn) => btn.addEventListener("click", () => openScriptArgs(btn.getAttribute("data-script-run"), btn.getAttribute("data-script-title"))));
    box.querySelectorAll("[data-script-del]").forEach((btn) => btn.addEventListener("click", () => dropScript(btn.getAttribute("data-script-del"))));
  }
  async function loadScripts() {
    if (!api) return;
    const j = await apiCall("GET", "/api/scripts");
    paintScripts(j.runners || []);
  }
  function showRunError(text) {
    const box = document.getElementById("wb-run-error");
    const msg = String(text || "").trim();
    if (!box) return;
    box.hidden = !msg;
    box.textContent = msg;
  }
  let pendingScriptId = "";
  function closeScriptArgs() {
    const modal = document.getElementById("wb-script-args-modal");
    if (modal) modal.hidden = true;
  }
  function readParamRows() {
    const box = document.getElementById("wb-script-param-list");
    if (!box) return [];
    return [...box.querySelectorAll(".script-param-row")].map((row) => ({
      name: row.querySelector("[data-param-name]")?.value || "",
      value: row.querySelector("[data-param-value]")?.value || "",
    }));
  }
  function paintParamRows(rows) {
    const box = document.getElementById("wb-script-param-list");
    if (!box) return;
    const list = rows && rows.length ? rows : [{ name: "", value: "" }];
    box.innerHTML = list.map((row) => "<div class=script-param-row><input data-param-name placeholder=\\"Nombre\\" value=\\"" + favEsc(row.name) + "\\"><input data-param-value placeholder=\\"Valor\\" value=\\"" + favEsc(row.value) + "\\"><button type=button class=btn data-param-del>Quitar</button></div>").join("");
    box.querySelectorAll("[data-param-del]").forEach((btn) => btn.addEventListener("click", () => {
      const current = readParamRows();
      const row = btn.closest(".script-param-row");
      const idx = [...box.querySelectorAll(".script-param-row")].indexOf(row);
      current.splice(idx, 1);
      paintParamRows(current);
    }));
  }
  function scriptParamsFromRows() {
    const params = {};
    const names = [];
    for (const row of readParamRows()) {
      const name = String(row.name || "").trim().replace(/^-+/, "");
      const value = String(row.value || "").trim();
      if (!name && !value) continue;
      if (!name) throw new Error("Cada valor necesita el nombre del parámetro");
      if (!names.includes(name)) names.push(name);
      if (value) params[name] = value;
    }
    return { params: params, names: names };
  }
  async function rememberParamNames(names) {
    const runner = scriptCatalog.find((r) => r.id === pendingScriptId);
    if (!runner || !api) return;
    try {
      await apiCall("POST", "/api/scripts", {
        id: runner.id,
        title: runner.title,
        lang: runner.lang,
        path: runner.path,
        params: names,
      });
      runner.params = names;
    } catch (e) {}
  }
  function openScriptArgs(id, title) {
    pendingScriptId = id || "";
    const modal = document.getElementById("wb-script-args-modal");
    const heading = document.getElementById("wb-script-args-title");
    if (heading) heading.textContent = title || id || "Ejecutar";
    const runner = scriptCatalog.find((r) => r.id === id);
    const names = runner && Array.isArray(runner.params) ? runner.params : [];
    paintParamRows(names.length ? names.map((name) => ({ name: name, value: "" })) : [{ name: "", value: "" }]);
    if (modal) modal.hidden = false;
    document.querySelector("#wb-script-param-list [data-param-value]")?.focus();
  }
  async function runScript(id, extra) {
    try {
      closeScriptArgs();
      setMsg("wb-script-msg", "Ejecutando…", true);
      showRunError("");
      const body = Object.assign({ id: id }, extra || {});
      const j = await apiCall("POST", "/api/scripts/run", body);
      const rows = j.rows || [];
      document.querySelector("[data-go=sql]")?.click();
      renderGrid(j.columns || [], rows);
      if (j.ok === false || j.error) {
        const err = j.error || "El script falló";
        showRunError(err);
        setMsg("wb-sql-msg", rows.length ? ("Error · " + rows.length + " filas") : "Error del script", false);
        setMsg("wb-script-msg", err, false);
        return;
      }
      showRunError("");
      const argsNote = j.argCount ? (" · " + j.argCount + " parámetros") : " · sin parámetros";
      setMsg("wb-sql-msg", "Script " + ((j.runner && j.runner.title) || id) + " · " + (j.rowCount || rows.length) + " filas" + argsNote, true);
      setMsg("wb-script-msg", "Listo", true);
    } catch (e) {
      showRunError(e.message);
      setMsg("wb-script-msg", e.message, false);
    }
  }
  async function dropScript(id) {
    if (!confirm("Quitar el script del catálogo? El archivo no se borra.")) return;
    try {
      await apiCall("DELETE", "/api/scripts", { id: id });
      setMsg("wb-script-msg", "Quitado del catálogo", true);
      await loadScripts();
    } catch (e) { setMsg("wb-script-msg", e.message, false); }
  }
  document.getElementById("wb-script-browse")?.addEventListener("click", async () => {
    try {
      setMsg("wb-script-msg", "Abriendo el explorador…", true);
      const j = await apiCall("POST", "/api/pick-file", {});
      showPickedFile(j.path || "");
      setMsg("wb-script-msg", "Archivo elegido. Guardá para dejarlo en el catálogo.", true);
    } catch (e) {
      if (/cancelled/i.test(e.message || "")) setMsg("wb-script-msg", "No elegiste archivo", false);
      else setMsg("wb-script-msg", e.message, false);
    }
  });
  document.getElementById("wb-script-add")?.addEventListener("click", async () => {
    try {
      await apiCall("POST", "/api/scripts", {
        title: document.getElementById("wb-script-title").value,
        lang: document.getElementById("wb-script-lang").value,
        path: document.getElementById("wb-script-path").value,
      });
      setMsg("wb-script-msg", "Agregado a .afn/script-runners.json", true);
      await loadScripts();
    } catch (e) { setMsg("wb-script-msg", e.message, false); }
  });
  document.getElementById("wb-script-new")?.addEventListener("click", async () => {
    try {
      const j = await apiCall("POST", "/api/scripts", {
        create: true,
        title: document.getElementById("wb-script-title").value,
        lang: document.getElementById("wb-script-lang").value,
      });
      setMsg("wb-script-msg", "Creado " + (j.runner && j.runner.path), true);
      await loadScripts();
    } catch (e) { setMsg("wb-script-msg", e.message, false); }
  });
  document.getElementById("wb-script-param-add")?.addEventListener("click", () => {
    const rows = readParamRows();
    rows.push({ name: "", value: "" });
    paintParamRows(rows);
    const inputs = document.querySelectorAll("#wb-script-param-list [data-param-name]");
    inputs[inputs.length - 1]?.focus();
  });
  document.getElementById("wb-script-args-go")?.addEventListener("click", async () => {
    try {
      const built = scriptParamsFromRows();
      await rememberParamNames(built.names);
      const extra = Object.keys(built.params).length ? { params: built.params } : {};
      runScript(pendingScriptId, extra);
    } catch (e) { setMsg("wb-script-msg", e.message, false); }
  });
  document.getElementById("wb-script-args-plain")?.addEventListener("click", () => runScript(pendingScriptId, {}));
  document.getElementById("wb-script-args-close")?.addEventListener("click", closeScriptArgs);
  document.getElementById("wb-script-args-modal")?.addEventListener("click", (e) => {
    if (e.target && e.target.id === "wb-script-args-modal") closeScriptArgs();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const modal = document.getElementById("wb-script-args-modal");
    if (modal && !modal.hidden) { closeScriptArgs(); e.preventDefault(); }
  });
  if (api) {
    loadOrigins().catch((e) => setMsg("wb-origins-msg", e.message, false));
    loadScripts().catch(() => {});
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
