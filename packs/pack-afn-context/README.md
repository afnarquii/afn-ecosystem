# Pack AFN Context

Mapa y memoria de **`.afn/`** para cualquier agente con MCP. **Kiro es el ejemplo de la empresa**; el mismo servidor sirve en Cursor, Claude Code, VS Code Copilot, etc.

- **No** requiere Engram.
- **No** requiere AFN IDE.
- **No** graba todo el chat: solo hechos que el agente guarda.
- Prioridad: **bajar tokens** (snapshot chico, no reexplorar el monorepo).

Paquete: [`packages/afn-mcp-context`](../../packages/afn-mcp-context/)  
Skill: [`skills/skill-afn-context/SKILL.md`](../../skills/skill-afn-context/SKILL.md)  
MCP descriptor: [`mcps/context/afn-mcp-context.json`](../../mcps/context/afn-mcp-context.json)

Repo: https://github.com/afnarquii/afn-ecosystem

---

## Qué instala

| Pieza | Rol |
|-------|-----|
| MCP `afn-context` | Tools: snapshot, flujo, save/search, bootstrap, ignore, doctor |
| Steering / skill / AGENTS.md | El modelo **usa** las tools (sin esto el MCP no se llama) |
| Hooks Kiro (opcional) | `SessionStart` = bootstrap sin LLM; `PromptSubmit` = snapshot; `AgentStop` = recordatorio de save |

SQLite: **solo** `.afn/memory/` en el repo (local, gitignored). No es el Cerebro global de AFN IDE.

---

## Instalación (todas las superficies)

```bash
git clone https://github.com/afnarquii/afn-ecosystem.git
cd afn-ecosystem/packages/afn-mcp-context
node --test test/context.unit.test.mjs
```

Definí el cwd al **repo de producto** (el de la empresa), no al catálogo:

```bash
cd C:\proyectos\mi-producto
node C:\projects\afn-ecosystem\packages\afn-mcp-context\index.js setup kiro
```

`setup` escribe rutas **absolutas** a `index.js` (Windows/macOS/Linux). Engram, si existía en `mcp.json`, **se deja**.

El bootstrap (hook SessionStart, tool `afn_bootstrap` y el propio `setup`) detecta **repos hermanos**, `packages/` / `apps/` y repos solo-git — el mismo espíritu que `/afn-init`. Arma el **flujo cross-project**: rol, framework, BD, puerto, prefix, proxy, lambda, capas, quién llama qué, cómo desarrollar y probar. **No** toma `packages/afn-mcp-context` ni el clone de este catálogo como el producto. Si ya había un `projects.json` con un solo nodo `mcp-context`, lo reescribe.

Si Kiro arranca el MCP con cwd del paquete, `AFN_PROJECT_ROOT` queda anclado al workspace donde corriste `setup`.

Otros hosts:

```bash
node …/index.js setup cursor
node …/index.js setup claude
node …/index.js setup generic
```

---

## Ejemplo completo — Kiro (empresa)

Política: solo Kiro. Compañeros **sin** Engram.

### 1. Una vez por máquina

```bash
git clone https://github.com/afnarquii/afn-ecosystem.git C:\tools\afn-ecosystem
```

### 2. En el repo de trabajo

```bash
cd C:\work\mi-monorepo
node C:\tools\afn-ecosystem\packages\afn-mcp-context\index.js setup kiro
```

Eso crea/mezcla:

- `%USERPROFILE%\.kiro\settings\mcp.json` → server `afn-context`
- `%USERPROFILE%\.kiro\steering\afn-context.md`
- `.kiro\hooks\afn-session-start.json` (bootstrap)
- `.kiro\hooks\afn-prompt-submit.json` (snapshot a stdout)
- `.kiro\hooks\afn-agent-stop.json` (pide `afn_mem_save` si hubo decisión)

### 3. Activar MCP en Kiro

Settings → MCP support ON. Command Palette → **Kiro: Open user MCP config** y comprobá `afn-context`. Recargá. Pestaña MCP = connected.

Ejemplo de `mcp.json` (el setup ya lo escribe con tu `node.exe` y path real):

```json
{
  "mcpServers": {
    "afn-context": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\tools\\afn-ecosystem\\packages\\afn-mcp-context\\index.js"],
      "env": {
        "AFN_PROJECT_ROOT": "C:\\work\\mi-monorepo"
      },
      "disabled": false,
      "autoApprove": [
        "afn_context_snapshot",
        "afn_projects_flow",
        "afn_mem_search",
        "afn_bootstrap",
        "afn_doctor"
      ]
    }
  }
}
```

Si también usás Engram, **no lo borres**; conviven dos servers.

### 4. Abrir el proyecto

Al iniciar sesión, el hook corre `bootstrap` (y `setup` ya lo corre una vez):

- Sin `.afn/projects.json` → detecta repos del workspace (`web/` + `api/`, hermanos, `packages/`) y escribe el mapa **sin gastar tokens del LLM**.
- Mapa pobre (un solo `mcp-context`) → lo reescribe.
- JSON rico ya en git → no pisa (`force` para rehacer).
- Si falta el diagrama de flujo → genera **cuatro** mapas en `.afn/diagrams` (flujo, capas, endpoints, E2E) más `workspace-flow.md` (cómo agregar, local, tests). **No pisa** un diagrama ya versionado.
- Escanea steering/skills de Kiro, Copilot (`.github/copilot-instructions.md`, `.github/skills`) y Cursor, y los asocia a un proyecto si el nombre coincide.

El primer prompt recibe el snapshot (proyectos, `web → api`, trabajo reciente). Si ves un solo proyecto genérico, pedí `afn_bootstrap` con `force=true`.

Para **ver** el mapa, los diagramas y el cerebro: en Kiro pedí “abrí el dashboard AFN” (tool `afn_dashboard`) o:

```bash
node C:\tools\afn-ecosystem\packages\afn-mcp-context\index.js dashboard
```

Kiro no tiene webview nuestro: se abre el navegador con un HTML local (`.afn/_tmp/dashboard.html`). **Inicio** resume el workspace; **Diagramas** abre cada mapa en esa misma página (clic en la tarjeta). Recrear el flujo: “generá el diagrama AFN” (`afn_diagram_generate` `recreate=true`).

### 5. Hechos

Decís: “`old-admin` ya no se usa”. El agente debe:

1. `afn_project_ignore` path `./old-admin`
2. `afn_mem_save` What/Why/Where

Eso actualiza `projects.json` (`ignorePaths` + `status: deprecated`) y `.afn/MEMORY.md`. Mañana el snapshot **no** incluye ese paquete.

Un “¿cómo está el login?” **no** se guarda salvo que llamen `afn_mem_save`.

### 6. Git de equipo

Commiteá `.afn/projects.json` y `.afn/MEMORY.md` (el bootstrap añade allowlist en `.gitignore`). `facts.json` / sqlite quedan locales.

---

## Ejemplo — Cursor

```bash
cd C:\work\mi-monorepo
node C:\tools\afn-ecosystem\packages\afn-mcp-context\index.js setup cursor
```

Escribe `.cursor/mcp.json` + `.cursor/rules/afn-context.mdc`. Reiniciá Cursor. No hay hooks de Kiro: el steering obliga a `afn_context_snapshot` al empezar.

## Ejemplo — Claude Code

```bash
node …/index.js setup claude
```

`~/.claude/mcp.json` + bloque en `CLAUDE.md` del repo.

## Ejemplo — otro LLM / IDE con MCP

```bash
node …/index.js setup generic
```

`.mcp.json` + `AGENTS.md`. Pegá el mismo `mcpServers.afn-context` en la config del host.

---

## Tools

| Tool | Para qué |
|------|----------|
| `afn_bootstrap` | Detectar repos del workspace (como `/afn-init`) y escribir `.afn/`. También genera el diagrama si falta y escanea reglas Kiro/Copilot. `force` reescribe el mapa. |
| `afn_context_snapshot` | Bloque ≤3200 chars (mapa + trabajo reciente) |
| `afn_projects_flow` | Activos + relationships |
| `afn_mem_context` | Qué se trabajó (sesiones + observaciones) |
| `afn_mem_search` / `afn_mem_save` | Buscar / guardar en el cerebro `.afn/memory/cerebro.json` |
| `afn_session_start` / `afn_session_summary` | Abrir / cerrar sesión de trabajo |
| `afn_dashboard` | HTML: inicio, mapa, diagramas (se abren con un clic), memoria, reglas. Abre el navegador. |
| `afn_diagram_generate` | Recrear el flujo (componentes, nombres, enlaces) en `.afn/diagrams`. No pisa salvo `recreate`. |
| `afn_agent_assets` | Listar/asociar steering, skills, Copilot, Cursor al mapa. |
| `afn_project_ignore` | Deprecados |
| `afn_doctor` | Salud de `.afn/` |

## CLI (hooks)

```bash
node index.js snapshot     # stdout markdown
node index.js bootstrap [--force]
node index.js session-start
node index.js dashboard [--no-open]
node index.js diagram [--recreate]
node index.js doctor
```

`AFN_PROJECT_ROOT` = workspace del producto (lo fija `setup`). El detector sube al padre si hay varios repos.

---

## Qué no hace

- `/sdd-new` ni slash de AFN IDE.
- Cerebro SQLite de `APPDATA` (otra PC).
- Recordar cada mensaje del chat.
- Vendorear Engram.
