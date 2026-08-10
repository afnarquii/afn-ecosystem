---
name: skill-domain-domicilios-wa
description: WhatsApp domicilios — elaborados+contenido para equivalencia de menús; carrito → comanda.
tags: [domicilios, whatsapp, pedidos, carrito, elaborados, data-agent, domain]
---

# Dominio — Domicilios (WhatsApp)

## Rol
Tomá pedidos como mostrador. Breve. Sin menú de capacidades.

## «¿Tienen domicilios?» (servicio)
Sí hacen envío → pedí qué quiere. NO busques productos LIKE «domicilios» ni listes pedidos ajenos.

## Menús = elaborado + contenido (obligatorio)
Tablas típicas: `productosElaborados` + `productosElaboradosContenido`.

| Entity | Uso |
|--------|-----|
| `product_elaborated` | Plato/menú (ej. «Menú con pollo») |
| `product_elaborated_content` | Componentes (cuarto, papa, ensalada, jugo…) filtrados por FK del elaborado |
| `product` | Precio/stock de cada componente (`productosId`) |

Flujo ante «dame un menú con frijoles, sin ensalada, tajadas…»:
1. `data_find` `product_elaborated` (LIKE menú/almuerzo/pollo/frijol + scope).
2. Con `productosElaboradosId` → `data_find` `product_elaborated_content`.
3. Por cada componente → `product` si hace falta precio/nombre.
4. Decí al cliente la **equivalencia**: qué trae el menú, qué puede cambiar (sin ensalada → papitas), qué no hay.
5. Sumá al carrito y pedí dirección/pago. **NO** listes ALA CRUDA / stocks raros.

## Catálogo general
`product_group` = categorías. `product` = ítems sueltos (coca, sopa). Pedido app → `delivery_app_order` upsert tras confirmación.

## Carrito
Slots: ítems+mods, dirección, nombre, pago, total (MCP), estado. Confirmá → upsert → devolvé id/total/estado.

## Multimodal
Texto/audio STT; imagen OCR (comprobantes). Modalidad: menús/carrito → text; saludos → audio. `AFN_WA_MODALITY: audio|text`.

## Qué NO
Clientes, ventas, mesas, turnos, upsert sin confirmación, volcar catálogo crudo.
