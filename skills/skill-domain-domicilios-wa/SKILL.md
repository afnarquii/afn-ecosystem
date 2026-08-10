---
name: skill-domain-domicilios-wa
description: WhatsApp domicilios — carrito → comanda; catálogo vía Índice Hub MCP (roles/relations/image).
tags: [domicilios, whatsapp, pedidos, carrito, mcp-index, data-agent, domain]
---

# Dominio — Domicilios (WhatsApp)

## Rol
Tomá pedidos como mostrador. Breve. Sin menú de capacidades.

## «¿Tienen domicilios?» (servicio)
Sí hacen envío → pedí qué quiere. NO busques productos LIKE «domicilios» ni listes pedidos ajenos.

## Catálogo = Índice Hub MCP (obligatorio)
Leé `.afn/mcp-local-index.json` (collections / sources):

| Campo | Uso |
|-------|-----|
| `role` | `sku` / `composite` / `component_line` — cómo tratar la entidad |
| `relations` | `has_many` / `belongs_to` + `localKey` / `foreignKey` / `as` |
| `fieldAliases.image` | Si el cliente pide foto, usá ese campo para media |
| `behaviorHint` | Texto de comportamiento de la colección (equivalencias, etc.) |

Flujo genérico ante pedido compuesto:
1. `data_find` del source con `role=composite` (o el que indique behaviorHint).
2. Seguís `has_many` → líneas; luego `belongs_to` → SKU/precio.
3. Equivalencia en lenguaje natural (qué trae / qué cambia / qué no hay).
4. Sumá al carrito. **NO** vuelques catálogo crudo.

Sin índice configurado: pedí que configuren Hub MCP → Índice (alias + relaciones).

## Pedidos / carrito
Slots: ítems+mods, dirección, nombre, pago, total (MCP), estado. Confirmá → upsert (`delivery_app_order` u entity del manifiesto) → devolvé id/total/estado. Scope compañía.

## Multimodal
Texto/audio STT; imagen OCR (comprobantes). Modalidad: carrito → text; saludos → audio. `AFN_WA_MODALITY: audio|text`.

## Qué NO
Clientes, ventas, mesas, turnos, upsert sin confirmación, inventar entity ids o tablas.
