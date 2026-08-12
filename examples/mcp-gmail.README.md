# MCP Gmail — descriptor para workspaces AFN

1. Copiá [`mcp-gmail.descriptor.example.json`](./mcp-gmail.descriptor.example.json) a `.afn/mcps/mcp-gmail.json` del workspace (o instalá desde Marketplace WA → pack Gmail).
2. Completá OAuth del paquete `@gongrzhe/server-gmail-autoauth-mcp` la primera vez (stdio).
3. Secretos: panel WA MCP / `userData/afn-wa-mcp-secrets.json` (nunca en git).

El bot de domicilios valida comprobantes con **Gmail nativo AFN** si ya hay tokens OAuth; el MCP queda disponible para otros flujos y para workspaces que prefieran solo MCP.

Hints de pago: `wa.commerce.payment.*` en skill / `behaviorHint` (ver `skill-domain-domicilios-wa` y `wa-commerce-persist.san-qa.example.md`).
