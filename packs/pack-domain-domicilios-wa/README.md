# Pack dominio — Domicilios WhatsApp

Perfil de dominio sobre **data-agent** (sin hardcode de restaurante en el MCP).

## Instalación

1. Instalá `pack-data-agent-core` (Marketplace AFN o clone de [afn-ecosystem](https://github.com/afnarquii/afn-ecosystem)).
2. Configurá manifiesto + DB o URL remota Lightsail (`afn-mcp-data-agent` / `-remote`).
3. Instalá este pack → escribe `skill-domain-domicilios-wa` + `agent-domain-domicilios-wa` en `.afn/`.
4. En el bot autónomo WA: agente `agent-domain-domicilios-wa`, MCP data-agent, `rootPath` del workspace del restaurante.
5. Opcional: `.afn/wa-company-scope.json` para multi-sucursal.

## Objetivo del skill

1. Entender **texto, audio (STT) e imágenes** (comprobantes vía visión del runtime).
2. Ir armando un **carrito** en el hilo del chat.
3. Tras confirmación del cliente → **persistir** (`delivery_app_order` / `delivery_mgmt` / action `crear_domicilio` / `comandas` si el manifiesto permite upsert).
4. Devolver al cliente **id, total, estado, dirección**.

## Manifiesto sugerido (MSSQL / patrón ERP)

Ver `examples/domain-manifest.domicilios.mssql.example.json` en este pack.

| Entity | Tabla típica | Ops |
|--------|--------------|-----|
| `product_group` | `gruposProductos` | find |
| `product` | `productos` | find |
| `product_elaborated` | `productosElaborados` | find |
| `product_elaborated_content` | `productosElaboradosContenido` | find (componentes del menú) |
| `delivery_app_order` | `domiciliosAppComandas` | find, **upsert** |
| `delivery_mgmt` | `comandasGestionDomicilios` | find, upsert |
| `order_line` | `comandas` | find (upsert solo si el ERP lo habilita) |

Escritura a `comandas` “clásicas” suele ir por procedure ERP → preferí `data_run_action` `crear_domicilio` o upsert en `domiciliosAppComandas`.

## Workspace del restaurante (no va en ecosystem)

Precios, cuenta bancaria, tono de marca, corpus de chats reales, credenciales y manifiesto con secrets `${VAR}` viven en el proyecto del cliente, no en este pack.
