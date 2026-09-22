# `@afn-ecosystem/mcp-context`

Servidor MCP **stdio** (Node ≥18) que lee y escribe `.afn/` del **workspace del producto**.

Detecta repos hermanos / `packages/` / `apps/` (como `/afn-init`). No trata el paquete `afn-mcp-context` como el producto.

Cerebro: `.afn/memory/cerebro.json`. Arquitectura: **`ARQUITECTURA.md` en la raíz del workspace**. Dashboard v1.4.20: SQL con lupa por fila, selección múltiple y previsualizador JSON/Texto (como Connect BD). **No** registra `npx @afn-ecosystem/mcp-data-agent` (eso cierra el MCP con error 32000). En Kiro, *abre dashboard AFN* / *guarda el readme …* los intercepta el hook **antes del LLM**. También: `node index.js dashboard` (puerto 5847).

Origen de datos: el init escribe `.afn/db-connections.json` (host/puerto/base, sin passwords) y `.afn/db-connection.json` (sesión activa). Credenciales en `.afn/credentials/data-agent.json` (gitignored):

```json
{ "DB_USER": "sa", "DB_PASSWORD": "TU_PASSWORD" }
```

Varios orígenes: `{ "byId": { "origen_1": { "DB_USER": "sa", "DB_PASSWORD": "TU_PASSWORD" } } }`. Mongo: `{ "MONGODB_URI": "mongodb://USER:PASSWORD@host:27017/db" }`.

Guía de integración (Kiro / Cursor / Claude / genérico):  
[`packs/pack-afn-context/README.md`](../../packs/pack-afn-context/README.md)

```bash
npm install
node --test test/context.unit.test.mjs
# desde el workspace del producto (varios repos), no desde este paquete:
node index.js setup kiro
# sin tokens de Kiro:
node index.js dashboard          # deja la ventana abierta (http://127.0.0.1:5847)
node index.js dashboard sql
node index.js note-save hu_102030_fondos.md
node index.js mem-search fondos
```
