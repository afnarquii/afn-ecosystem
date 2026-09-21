# `@afn-ecosystem/mcp-context`

Servidor MCP **stdio** (Node ≥18, cero deps) que lee y escribe `.afn/` del **workspace del producto**.

Detecta repos hermanos / `packages/` / `apps/` (como `/afn-init`). No trata el paquete `afn-mcp-context` como el producto.

Cerebro: `.afn/memory/cerebro.json`. Arquitectura: README C4/arc42 `.afn/diagrams/arquitectura.md` (contexto, contenedores 1 o N repos, comunicación, E2E, rutas, esquemas). Puertos y tablas solo con evidencia. Dashboard: README primero.

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
