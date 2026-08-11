---
name: skill-domain-domicilios-wa
description: WhatsApp domicilios — motor carrito genérico AFN (oferta→qty→confirm) + catálogo Índice Hub; combos elaborado→contenido→producto; persist via data_run_action.
tags: [domicilios, whatsapp, pedidos, carrito, mcp-index, venue, channel-media, data-agent, domain, combos]
---

# Dominio — Domicilios (WhatsApp)

## Rol
Tomá pedidos como mostrador. Breve. Sin menú de capacidades. Nunca digas «escribí menú» ni «menú → almuerzos».

## «¿Tienen domicilios?» (servicio)
Sí hacen envío → pedí qué quiere. NO busques productos LIKE «domicilios» ni listes pedidos ajenos.

## Catálogo = Índice Hub MCP (obligatorio)
Leé `.afn/mcp-local-index.json` (collections / sources):

| Campo | Uso |
|-------|-----|
| `role` | `sku` / `composite` / `component_line` / `venue` / `channel_media` |
| `relations` | `has_many` / `belongs_to` + keys |
| `fieldAliases.image` | Foto de producto, combo o mediaUrl del banco |
| `fieldAliases.address` / `phone` | Dirección / teléfono del local |
| `fieldAliases.title` / `price` / `taxRate` | Nombre, precio venta, % IVA |
| `behaviorHint` | Texto libre de la colección |

## Alcance compañía (obligatorio — sin hardcode de valor)

El Hub WA define el **campo de scope** (típicamente `companiasId` en `.afn/wa-company-scope.json` → `scopeField`) y el **valor** de la sucursal activa.

- **Todas** las `data_find` / upsert / expand deben llevar ese campo en `filter` (el runtime también lo inyecta).
- No inventes el id de compañía ni consultes otras.
- Si `data_describe_entity` no lista ese campo en una entity, no lo fuerces; si lo lista, **siempre** va.

## Combos / elaborados (obligatorio — no inventar ingredientes)

Los combos suelen llamarse **Combo 1**, **Combo 2**, **Super Combo**, etc. El nombre **no** lista lo que trae.

Cadena (ids de entity del manifiesto / Índice Hub; tablas solo como referencia del ERP):

1. Composite (`product_elaborated`) — nombre + precio + **key** del manifiesto.
2. Contenido (`product_elaborated_content`) — FK al elaborado + FK al SKU (+ `cantidad`).
3. SKU (`product`) — título vía alias `title` / campo de nombre del describe.

### De dónde sale el id del elaborado (no se inventa)

**Paso A — buscar el combo** (con scope):

```text
data_find
  entity: <composite del índice>
  filter: {
    <scopeField>: <scopeValue>,          // siempre
    <campo título>: { "like": "…" }      // o la key si ya la tenés
  }
  expand: true
```

La fila devuelta trae la **key** del manifiesto (en SAN QA: `productosElaboradosId`). Ese valor es el único `@elaboradoId` válido.

**Paso B — contenido → producto** (lo hace `expand:true`, o a mano):

- Contenido: filtrar por FK al elaborado **y** scope si la entity lo declara.
- Producto: filtrar por `productosId` de cada línea **y** scope.

SQL equivalente (tablas/columnas = manifiesto; no hardcodear en el bot):

```sql
-- A) Hallar el elaborado (aquí nace el id)
SELECT TOP (@limit) *
FROM [{tabla_elaborado}]
WHERE [{scopeField}] = @companiasId
  AND [{campo_titulo}] LIKE @nombre;   -- o [{key}] = @elaboradoId si ya lo tenés

-- B) Armar contenido (mismo @companiasId; @elaboradoId = key de la fila A)
SELECT
  e.[{key_elaborado}],
  e.[{titulo_elaborado}],
  e.[{precio}],
  c.[{key_contenido}],
  c.[cantidad],
  p.[{key_producto}],
  p.[{titulo_producto}]
FROM [{tabla_elaborado}] AS e
INNER JOIN [{tabla_contenido}] AS c
  ON c.[{fk_elaborado}] = e.[{key_elaborado}]
INNER JOIN [{tabla_producto}] AS p
  ON p.[{key_producto}] = c.[{fk_producto}]
WHERE e.[{scopeField}] = @companiasId
  AND p.[{scopeField}] = @companiasId
  AND e.[{key_elaborado}] = @elaboradoId;
```

`@elaboradoId` **nunca** se adivina: es la key de la fila del paso A (o del hit del índice local / carrito).

Al ofrecer un combo: **nombre + precio + «Incluye: …»** con títulos resueltos. Sin «catálogo local» ni nombres de tablas al cliente.

### Pedido compuesto / equivalencia
1. Composite → contenido → SKU (arriba).
2. **Alineá** el pedido del cliente con los títulos de `components` / `_components` (no asumas solo por el nombre del combo). Preferí el elaborado con más solape (frijol, arroz, tajada/papa, pechuga/cuartico/pollo…).
3. Equivalencia (qué trae / cambia / falta) con esos SKUs. Sin catálogo crudo.
4. **Antes de decir que no hay un ítem**, buscalo en MCP (product y composite). Aceptá variantes ortográficas (frígoles≈frijol, cuartico≈pechuga/pollo).

### «¿Qué tienen?» / menú / categorías
1. Listá `product_group` (categorías) **ya** — no pidas que el cliente escriba una palabra mágica.
2. Si hay `role=channel_media`, `data_find` y mandá `mediaUrl` + `bodyText` (fotos/textos del canal).
3. Si elige categoría, filtrá productos por el FK del describe.

### «¿Dónde están?» / teléfono / mapa
1. Sources con `role=venue` (o aliases `address`/`phone`).
2. Respondé con address/phone del índice; si hay `image`, mandá la foto.
3. NO inventes dirección ni teléfono. Sin índice venue → pedí configurar Hub MCP → Índice.

Sin índice: pedí que configuren Hub MCP → Índice (alias + roles + relaciones).

## Pedidos / carrito (flujo obligatorio)
Motor genérico en AFN (sesión proposed → qty → confirm → cart). Este skill aporta el **dominio** (domicilios / combos); otro pack puede reutilizar el mismo motor para citas, membresías, etc.

1. Identificá coincidencias del catálogo MCP/índice (product / composite). Si hay variantes, listalas con **precio**.
2. Si no dijo cantidad → pedila. Opcional en Índice Hub `behaviorHint`:
   - `wa.commerce.unitNouns: porcion, combo, gaseosa`
   - `wa.commerce.skuTriggers: porcion, coca, jugo`
   - `wa.commerce.compositeSkip: combo con, menu con, almuerzo con`
3. Confirmá unitario + subtotal (**sí/no**) ANTES de sumar al carrito. Cambió de ítem → limpiá opciones/pendiente; **no** borres el carrito confirmado.
4. Tras cada ítem confirmado: carrito completo + total; ofrecé agregar más.
5. Cotizá con datos MCP: cantidad × `price`; si hay `taxRate`, desglosá IVA y **total**. No inventes precios.
6. Lead: nombre + dirección si no hay match de teléfono.
7. Cierre del pedido completo → confirmación explícita → `data_list_actions` + **`data_run_action`** (id del manifiesto; no hardcodees procedure). Body según `bodyHint`.
8. Devolvé: qué se guardó, total, listo para entrega / estado. Scope compañía.

Si el manifiesto no expone actions, solo entonces valorá upsert en entities de pedido que el catálogo permita — nunca sin confirmación.

## Multimodal
Texto/audio STT; imagen OCR (comprobantes). `AFN_WA_MODALITY: audio|text`. Fotos de menú/producto vía alias `image` o `channel_media`.

## Qué NO
Clientes (salvo match teléfono interno), ventas, mesas, turnos, persistir sin confirmación, inventar entity/action ids o tablas, pedir que escriban «menú» para ver categorías, inventar ingredientes de un combo sin leer contenido→producto.
