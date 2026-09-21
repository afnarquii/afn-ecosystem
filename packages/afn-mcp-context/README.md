# `@afn-ecosystem/mcp-context`

Servidor MCP **stdio** (Node ≥18, cero deps) que lee y escribe `.afn/` del **workspace del producto**.

Detecta repos hermanos / `packages/` / `apps/` (como `/afn-init`). No trata el paquete `afn-mcp-context` como el producto.

Cerebro: `.afn/memory/cerebro.json`. Mapa: rol, framework, BD, puerto, prefix, proxy/lambda, capas, E2E y cómo desarrollar/probar (`.afn/diagrams/workspace-flow.*`). Vista: `node index.js dashboard`.

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
