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
- `.kiro\hooks\afn-session-start.json` (bootstrap **al entrar**)
- `.kiro\hooks\afn-prompt-submit.json` (snapshot a stdout)
- `.kiro\hooks\afn-agent-stop.json` (pide `afn_mem_save` si hubo decisión)

`setup kiro` **no es** “regenerar el mapa cada vez”. Es instalar MCP + hooks. El mapa se genera:

| Cuándo | Qué corre | Regenera gráficas |
|--------|-----------|-------------------|
| Primera vez / no hay `.afn/` | `setup` y SessionStart → `bootstrap` | Sí |
| Abrís Kiro de nuevo | SessionStart → `bootstrap` | **Sí**, mientras `architectureLocked` sea false (etapa de cambios del pack/flujo). **No**, cuando la arquitectura ya está cerrada (`--lock`). |
| Arquitectura lista | `bootstrap --lock` o en el chat “cerrá la arquitectura AFN” | Deja de regenerar al entrar |
| Querés redibujar ya (aunque esté locked) | `bootstrap --refresh` | Sí |
| Querés redetectar repos | `bootstrap --force` | Sí, reescribe el listado de proyectos |

Actualizar en la empresa:

```bash
cd C:\tools\afn-ecosystem
git pull
cd C:\work\mi-monorepo
node C:\tools\afn-ecosystem\packages\afn-mcp-context\index.js setup kiro
```

El `git pull` actualiza el código que Kiro ya ejecuta. El `setup` refresca steering/hooks. **Al volver a abrir Kiro**, si la arquitectura **no** está locked, bootstrap **redibuja**. Cuando el flujo ya está como debe estar: `bootstrap --lock` (o “cerrá la arquitectura AFN”). A partir de ahí no regenera solo.

Si Kiro ya estaba abierto, recargá MCP o cerrá/abrí la sesión.

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

- Sin `.afn/projects.json` → detecta repos y escribe el mapa **sin LLM**.
- Mapa pobre (un solo `mcp-context`) → lo reescribe.
- JSON rico ya en git → **no pisa los nombres de repo** (`--force` para redetectar).
- Si el **pack es más nuevo** que `.afn/diagrams/workspace-flow.json` (después de `git pull`) → **regenera las gráficas** (capas, endpoints, E2E). No hace falta pedir recreate.
- `--refresh` redibuja ya, aunque la versión sea la misma.

Para **ver** el mapa: en Kiro “abrí el dashboard AFN” o `node …/index.js dashboard`.

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
| `afn_bootstrap` | Detectar repos. Sin lock: al entrar redibuja. `lock` cierra arquitectura. `unlock` / `refresh` / `force` según la etapa. |
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
node index.js bootstrap [--force|--refresh|--lock|--unlock]
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
