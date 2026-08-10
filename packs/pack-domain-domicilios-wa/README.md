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
3. **Cotizar**: precios del MCP (`price` / alias) + IVA si hay `taxRate` u % en la fila; mostrar total.
4. Tras confirmación del cliente → **persistir** con `data_list_actions` + `data_run_action` (ids del manifiesto, p. ej. `persist_order`). **No hardcodear** nombres de procedure en el skill.
5. Devolver al cliente **qué se guardó, total, estado / listo para entrega**.

## Catálogo unificado (Índice Hub MCP)

En el workspace del restaurante: **Hub MCP → Índice** — listá entidades, alias (`title`/`price`/`taxRate`/`stock`/`image`/`address`/`phone`), **role** (`sku`/`composite`/`component_line`/`venue`), **relations** y `behaviorHint`. El bot y este skill leen esa config; no hardcodean tablas.

| Entity | Tabla típica | Ops / nota |
|--------|--------------|------------|
| `product_group` | `gruposProductos` | find |
| `product` | `productos` | find |
| `product_elaborated` | `productosElaborados` | find (ejemplo; role=composite) |
| `product_elaborated_content` | `productosElaboradosContenido` | find (ejemplo) |
| `company` | `companias` | find — Índice: role=`venue`, address→`direccion`, phone→`telefonos` |
| `general_params` | `parametrosGenerales` | find — Índice: role=`venue`, image→`imagen` |
| `delivery_app_order` | `domiciliosAppComandas` | find, **upsert** |
| `delivery_mgmt` | `comandasGestionDomicilios` | find, upsert |
| `order_line` | `comandas` | find (escritura fuerte → action del manifiesto) |

Escritura tipo Caja (procedure ERP): `data_list_actions` → `data_run_action` con el id publicado (p. ej. `persist_order`). El nombre del PA vive solo en el manifiesto del data-agent.

## Workspace del restaurante (no va en ecosystem)

Precios, cuenta bancaria, tono de marca, corpus de chats reales, credenciales y manifiesto con secrets `${VAR}` viven en el proyecto del cliente, no en este pack.
