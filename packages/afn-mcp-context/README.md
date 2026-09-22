# `@afn-ecosystem/mcp-context`

Servidor MCP **stdio** (Node ≥18) que lee y escribe `.afn/` del **workspace del producto**.

Detecta repos hermanos / `packages/` / `apps/` (como `/afn-init`). No trata el paquete `afn-mcp-context` como el producto.

Cerebro: `.afn/memory/cerebro.json`. Arquitectura: **`ARQUITECTURA.md` en la raíz del workspace** (copia en `.afn/ARQUITECTURA.md`). Dashboard: README primero; en `http://127.0.0.1` (v1.4.14+) Orígenes (formulario + formato de credenciales) y SQL en el servidor Node. `mssql` es **dependencia directa** de este pack (`require.resolve('mssql')`, pin 11.x, sin `npx -p mssql` en runtime). Tras clonar: `cd packages/afn-mcp-context && npm install`. El producto **no** necesita `npm i mssql`.

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
node index.js bootstrap --force
node index.js diagram --recreate
node index.js dashboard
```
