# Guía AFN context

Un solo servidor MCP (`afn-context`) para el repo del producto. Lee y escribe `.afn/` de **esa** carpeta. Sirve en Kiro, Claude Code, OpenCode o cualquier agente que hable MCP por stdio.

El clon de este repo no es el producto. Los comandos de abajo se corren **desde la carpeta del producto**, apuntando al `index.js` del clon.

```text
AFN = carpeta del clon, por ejemplo C:\projects\afn-ecosystem
PRODUCTO = carpeta del repo de la empresa
```

Node 18 o superior.

## 1. Dejarlo listo una vez

```bash
cd AFN\packages\afn-mcp-context
npm install
```

En cada producto, una sola vez por agente:

```bash
cd PRODUCTO
node AFN\packages\afn-mcp-context\index.js setup kiro
node AFN\packages\afn-mcp-context\index.js setup claude
node AFN\packages\afn-mcp-context\index.js setup cursor
node AFN\packages\afn-mcp-context\index.js setup generic
```

| Comando | Qué escribe | Quién lo lee |
|---|---|---|
| `setup kiro` | `.kiro/settings/mcp.json`, steering y hooks | Kiro, al abrir ese workspace |
| `setup claude` | bloque en `CLAUDE.md` y `~/.claude/mcp.json` | Las instrucciones las lee Claude. El MCP que Claude Code carga está en `.mcp.json` del producto |
| `setup cursor` | `.cursor/mcp.json` y una regla | Cursor |
| `setup generic` | `.mcp.json` y un bloque en `AGENTS.md` | Quien lea `.mcp.json`. OpenCode y otros: copiar el mismo comando a su config |

Después de un `git pull` del clon: volver a correr el `setup` del agente y reconectar el MCP. Las credenciales de `.afn/credentials/` no se borran.

`setup` no registra `npx @afn-ecosystem/mcp-data-agent`. Ese proceso se cierra (MCP 32000). Las consultas van por `afn_sql`.

### OpenCode u otro agente

`setup generic` deja en `PRODUCTO\.mcp.json` algo de esta forma:

```json
{
  "mcpServers": {
    "afn-context": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\ruta\\AFN\\packages\\afn-mcp-context\\index.js"],
      "env": { "AFN_PROJECT_ROOT": "C:\\ruta\\PRODUCTO" }
    }
  }
}
```

Si el agente no lee `.mcp.json`, se pega ese `command`, `args` y `env` en su archivo (en OpenCode, la entrada MCP de `opencode.json`). `AFN_PROJECT_ROOT` tiene que ser la carpeta del producto, no la del clon. Otro repo = otro archivo y otro `.afn/`.

`AGENTS.md` le dice al modelo cuándo usar las tools. Si el agente no lee ese archivo, las tools igual están; hay que pedirlas por nombre.

Los hooks de Kiro (abrir el dashboard al decir «abre dashboard AFN») no existen en los otros agentes. Ahí se pide la tool o se usa el comando de la terminal.

## 2. Init (el mapa, como afn-init)

En AFN IDE el slash es `/afn-init`. Acá el equivalente es el bootstrap: detecta repos hermanos, `packages/` y `apps/`, arma el inventario y el catálogo de orígenes **sin contraseñas**. No pisa el cerebro ni un origen que ya estaba guardado.

En el chat, con el MCP conectado:

- «inicializá AFN» / «hacé el init» → tool `afn_bootstrap`
- Si falta el mapa: `afn_architecture_evidence`, leer los archivos que devuelve, y `afn_architecture_commit` solo con lo que está en disco. No inventar puertos ni flechas.

En la terminal, desde el producto:

```bash
node AFN\packages\afn-mcp-context\index.js bootstrap
```

Queda, entre otras cosas:

- `.afn/db-connections.json` — host, puerto y base, sin password
- `.afn/db-connection.json` — origen activo de la sesión
- `ARQUITECTURA.md` en la raíz, cuando el mapa se cierra

Para dejar un repo fuera del mapa: tool `afn_project_ignore` con la ruta relativa.

Regenerar la arquitectura solo si se pide: tool `afn_diagram_generate` con `recreate`, o

```bash
node AFN\packages\afn-mcp-context\index.js architecture --recreate
```

## 3. Dashboard

http://127.0.0.1:5847

```bash
cd PRODUCTO
node AFN\packages\afn-mcp-context\index.js dashboard
node AFN\packages\afn-mcp-context\index.js dashboard sql
```

La ventana queda abierta. En Kiro también vale «abre dashboard AFN»: el hook lo abre antes del modelo.

Pestañas útiles: Orígenes, SQL, Scripts, Skills, Notas. En SQL la pantalla es la consulta y los resultados. El encabezado tiene origen, límite, ejecutar, favoritos y descargas (Excel, JSON, TXT, CSV).

No abrir `.afn/_tmp/dashboard.html`. La URL es la del servidor local. Tras un `git pull`, cerrar esa ventana y volver a abrirla. La versión se lee en el encabezado.

La tool del agente es `afn_dashboard` (abre el navegador y devuelve `url`).

## 4. Consultar la base

Credenciales, una vez, en `.afn/credentials/data-agent.json` (no va a git):

```json
{ "DB_USER": "sa", "DB_PASSWORD": "TU_PASSWORD" }
```

Varios orígenes: `{ "byId": { "origen_1": { "DB_USER": "sa", "DB_PASSWORD": "TU_PASSWORD" } } }`.

En el chat: «consultá el PA tal» o «traé estas filas». El agente usa `afn_data_sources` si no sabe el origen y `afn_sql` para ejecutar. No hace falta correr el SQL a mano ni pegar el JSON.

```text
afn_sql  sql: "SELECT TOP 20 ..."
afn_sql  sql: "EXEC dbo.NombrePA @param = 1"   connectionId: "origen_1"
```

`connectionId` es el id o el name de `afn_data_sources`. Vacío = la sesión de `.afn/db-connection.json`. Un id que no existe no salta a otra base.

Solo lectura: `SELECT`, `WITH` o `EXEC`/`CALL` de un procedimiento. Están bloqueados `DELETE`, `INSERT`, `UPDATE`, `DROP`, `TRUNCATE`, `ALTER`, `CREATE`, `MERGE`. Un `EXEC` permitido igual puede ejecutar un PA cuyo cuerpo escriba: el filtro ve el nombre, no el cuerpo.

En el dashboard, F5 o Ctrl+Enter ejecutan. Resultados: **Columnas**, **TXT** o el ojito **JSON** (una sola vista, no partida). Descargas: **↓ JSON**, **↓ Texto**, **↓ Excel**, **↓ CSV** (archivo `.csv`). Los nombres de columna salen como vienen de la base.

## 5. Ejecutar un Python o un Node

El script puede vivir fuera del repo, con tokens adentro. AFN guarda solo la ruta en `.afn/script-runners.json`. El agente no recibe la ruta ni el código.

1. Dashboard → Scripts → Elegir archivo → Guardar.
2. Ejecutar abre el cuadro de parámetros. Cada fila es nombre y valor. Si el script tiene tres y solo se llenan dos, se mandan esos dos. **Sin parámetros** lo corre igual.
3. Llegan al proceso como argumentos: Python `sys.argv`, Node `process.argv`. Un valor con nombre llega como `--nombre valor`.
4. El script imprime JSON por stdout. Si falla (token vencido, por ejemplo), el dashboard muestra ese mensaje y, si alcanzó a imprimir filas, también las filas.

En el chat, solo si se nombra el script:

```text
afn_script  action: "list"
afn_script  action: "run"  id: "informe"
afn_script  action: "run"  id: "informe"  params: { "desde": "2024-01-01", "cliente": "acme" }
```

`list` no ejecuta nada y no trae la ruta. `run` sin `args` ni `params` no inventa parámetros. El campo `error` es el mensaje del proceso; `rows` son las filas si hubo JSON.

## 6. Memoria, notas y archivos

| Pedido | Tool | CLI |
|---|---|---|
| Qué hay en el mapa, corto | `afn_context_snapshot` | `node …\index.js snapshot` |
| Qué se trabajó | `afn_mem_context` | `node …\index.js mem-context` |
| Buscar un hecho | `afn_mem_search` | `node …\index.js mem-search texto` |
| Guardar un hecho (no el chat, no secretos) | `afn_mem_save` | |
| Abrir / cerrar sesión de trabajo | `afn_session_start` / `afn_session_summary` | `node …\index.js session-start` |
| Dejar el README de una tarea | `afn_note_save` | `node …\index.js note-save archivo.md` |
| Listar entregas | `afn_note_list` | |
| Marcar draft / listo / aprobado | `afn_note_set_status` | |
| PDF, Excel o imagen a Markdown | `afn_extract_file` | `node …\index.js extract archivo.pdf` |
| Salud de `.afn/` | `afn_doctor` | `node …\index.js doctor` |

Las notas van a `.afn/notes/tareas/`. No reemplazan `ARQUITECTURA.md`.

## 7. Qué no hace

- No borra filas, tablas ni bases por `afn_sql`.
- No le muestra al agente el fuente ni la ruta de un script.
- No guarda cada mensaje del chat.
- No usa el cerebro de otra máquina.
- No arranca un segundo MCP de base de datos.
