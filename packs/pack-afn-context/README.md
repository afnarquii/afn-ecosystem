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
npm install
node --test test/context.unit.test.mjs
```

Definí el cwd al **repo de producto** (el de la empresa), no al catálogo:

```bash
cd C:\proyectos\mi-producto
node C:\projects\afn-ecosystem\packages\afn-mcp-context\index.js setup kiro
```

`setup` escribe rutas **absolutas** a `index.js` (Windows/macOS/Linux). Engram, si existía en `mcp.json`, **se deja**.

El bootstrap (hook SessionStart, tool `afn_bootstrap` y el propio `setup`) detecta **repos hermanos**, `packages/` / `apps/` y repos solo-git — el mismo espíritu que `/afn-init`. Arma el **flujo cross-project**: rol, framework, BD, puerto, prefix, proxy, lambda, capas, quién llama qué, cómo desarrollar y probar. **También escribe** `.afn/db-connections.json` (varios orígenes: un compose, un repo o un `.env.example` pueden ser fuentes distintas; **sin passwords**; no pisa perfiles ya guardados) y `.afn/db-connection.json` como sesión activa. `setup kiro` **no** registra `npx @afn-ecosystem/mcp-data-agent` (ese proceso se cae: MCP 32000). SQL va por el dashboard. **No** toma `packages/afn-mcp-context` ni el clone de este catálogo como el producto. Si ya había un `projects.json` con un solo nodo `mcp-context`, lo reescribe.

Si Kiro arranca el MCP con cwd del paquete, `AFN_PROJECT_ROOT` queda anclado **en ese workspace** (`.kiro/settings/mcp.json` del producto). Cada producto tiene el suyo; no se comparte la ruta del usuario.

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
cd C:\tools\afn-ecosystem\packages\afn-mcp-context
npm install
```

### 2. En el repo de trabajo

```bash
cd C:\work\mi-monorepo
node C:\tools\afn-ecosystem\packages\afn-mcp-context\index.js setup kiro
```

Eso crea/mezcla **en ese producto**:

- `{workspace}/.kiro/settings/mcp.json` → server `afn-context` con `AFN_PROJECT_ROOT` de **este** repo
- `{workspace}/.kiro/steering/afn-context.md`
- `{workspace}/.kiro/hooks/…` (bootstrap, snapshot, save)

Si había `afn-context` en `%USERPROFILE%\.kiro\settings\mcp.json`, **lo saca** (deja Engram y el resto). Si no, al abrir otro repo Kiro seguiría usando la ruta vieja.

Un producto distinto = otro `cd` + `setup kiro`. No hace falta que estén en la misma carpeta padre.

`setup kiro` **no es** “regenerar el mapa cada vez”. Es instalar MCP + hooks. El mapa se genera:

| Cuándo | Qué corre | Qué sale |
|--------|-----------|----------|
| Primera vez | SessionStart → bootstrap (inventario de disco) + el **LLM** lee evidencia y `afn_architecture_commit` | Mapa **sin inventar** |
| Mapa ya verificado (`llmReviewed`) | SessionStart → bootstrap | **No** regenera |
| Pedís “regenerá la arquitectura” | inventario de disco + LLM evidencia → commit | Redibuja solo lo verificado |
| Redetectar repos | `bootstrap --force` | Inventario; el LLM completa flechas |

El disco **no** inventa `localhost:4000/api` ni flechas front→back. El README sigue C4/arc42: contexto, contenedores (1 repo o varios), comunicación, flujo E2E, rutas, esquemas (prisma/SQL/OpenAPI). Un puerto o una tabla solo si está en disco.

Actualizar en la empresa:

```bash
cd C:\tools\afn-ecosystem
git pull
cd C:\tools\afn-ecosystem\packages\afn-mcp-context
npm install
cd C:\work\mi-monorepo
node C:\tools\afn-ecosystem\packages\afn-mcp-context\index.js setup kiro
```

`setup kiro` actualiza el hook PromptSubmit: frases como *abre dashboard AFN* o *guarda el readme hu102030* se ejecutan **en local y no van al modelo** (exit 2). El resto del chat sí usa el LLM, con una pista corta.

```bash
cd C:\work\mi-monorepo
.afn\_tmp\afn-dashboard.cmd
.afn\_tmp\afn-note-save.cmd hu_102030_fondos.md
.afn\_tmp\afn-mem-search.cmd fondos
```

Regenerar a mano (sin chat):

```bash
node C:\tools\afn-ecosystem\packages\afn-mcp-context\index.js architecture --recreate
```

### 3. Activar MCP en Kiro

Settings → MCP support ON. Command Palette → **Kiro: Open workspace MCP config** y comprobá `afn-context` en `.kiro/settings/mcp.json` **de este repo**. Recargá. Pestaña MCP = connected.

Ejemplo (el setup ya lo escribe con tu `node.exe`, el pack y la raíz de **este** producto):

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

Para **ver** el mapa: en Kiro “abrí el dashboard AFN” o abrí **`ARQUITECTURA.md` en la raíz del workspace** (también `.afn/ARQUITECTURA.md`). No regenera nada.

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
| `afn_bootstrap` | Crea `.afn/` si falta. Si la arquitectura existe, no la toca. |
| `afn_context_snapshot` | README compacto: nombres, rutas, quién llama a quién, hechos |
| `afn_projects_flow` | Activos + relationships + `.afn/diagrams/arquitectura.md` |
| `afn_mem_context` | Qué se trabajó (sesiones + observaciones) |
| `afn_mem_search` / `afn_mem_save` | Buscar / guardar en el cerebro `.afn/memory/cerebro.json` |
| `afn_session_start` / `afn_session_summary` | Abrir / cerrar sesión de trabajo |
| `afn_dashboard` | README de arquitectura + vista gráfica opcional |
| `afn_diagram_generate` | Inventario de disco (sin inventar puertos). Luego evidence → commit. |
| `afn_architecture_evidence` | Archivos reales a leer (Makefile, compose, serverless, uvicorn, env.example). |
| `afn_architecture_commit` | Guarda solo nodos/flechas/puertos verificados. Rechaza inventos. |
| `afn_agent_assets` | Listar/asociar steering, skills, Copilot, Cursor al mapa. |
| `afn_project_ignore` | Deprecados |
| `afn_doctor` | Salud de `.afn/` |

## CLI (hooks)

```bash
node index.js snapshot     # stdout markdown
node index.js bootstrap [--force|--refresh]
node index.js architecture [--recreate]
node index.js session-start
node index.js dashboard [--no-open]
node index.js diagram [--recreate]
node index.js doctor
```

`AFN_PROJECT_ROOT` = raíz de **ese** producto (`.kiro/settings/mcp.json` del workspace). Otro repo → otro `setup kiro`.

---

## Qué no hace

- `/sdd-new` ni slash de AFN IDE.
- Cerebro SQLite de `APPDATA` (otra PC).
- Recordar cada mensaje del chat.
- Vendorear Engram.
