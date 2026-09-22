# `@afn-ecosystem/mcp-context`

Servidor MCP **stdio** (Node ≥18, cero deps) que lee y escribe `.afn/` del **workspace del producto**.

Detecta repos hermanos / `packages/` / `apps/` (como `/afn-init`). No trata el paquete `afn-mcp-context` como el producto.

Cerebro: `.afn/memory/cerebro.json`. Arquitectura: **`ARQUITECTURA.md` en la raíz del workspace** (copia en `.afn/ARQUITECTURA.md`). Dashboard: README primero; en `http://127.0.0.1` (v1.4.11+) la pestaña Orígenes es un formulario (host/puerto/base, sin password). También Elegir tablas/PAs y SQL (solo SELECT).

Origen de datos: el init (`setup kiro` / `bootstrap`, equivalente a `/afn-init`) escribe `.afn/db-connections.json` (varios orígenes si hay varios repos/compose) y `.afn/db-connection.json` (sesión activa). No adivina el host. Las credenciales no van a git.

Guía de integración (Kiro / Cursor / Claude / genérico):  
[`packs/pack-afn-context/README.md`](../../packs/pack-afn-context/README.md)

```bash
node --test test/context.unit.test.mjs
# desde el workspace del producto (varios repos), no desde este paquete:
node index.js setup kiro
node index.js bootstrap --force
node index.js diagram --recreate
node index.js dashboard
```
