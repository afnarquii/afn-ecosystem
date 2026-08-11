---
name: skill-data-agent-core
description: Cómo usar el MCP data-agent genérico (entities, find, upsert, delete, actions) con seguridad.
tags: [data-agent, mcp, core, afn]
---

# Data Agent — skill core

## Objetivo

Usar solo las tools del MCP `afn-mcp-data-agent` / remoto. **No** inventar SQL ni nombres de tablas fuera del manifiesto.

## Flujo

1. `data_list_entities` — ver qué hay permitido.
2. `data_describe_entity` — campos y ops.
3. `data_find` — leer con filtros exactos; opcional `expand: true` (o `["components"]`) si la entity declara `relations` has_many (+ resolve belongs_to) en el manifiesto.
4. `data_upsert` — crear/actualizar (siempre incluir la key).
5. `data_delete` — solo si el manifiesto lo permite.
6. `data_run_action` — solo acciones listadas por `data_list_actions` (procedure/HTTP del manifiesto).

## Reglas

- Si una op falla con `entity_not_allowed` u `op_not_allowed`, **no** reintentar con otro nombre inventado.
- Confirmá con el usuario antes de `data_delete`, `data_run_action` (pedidos) o escrituras masivas.
- No pidas ni expongas connection strings; las credenciales las gestiona AFN.
- `data_find` admite filtro exacto o LIKE: `{ "campo": { "like": "texto" } }` / `{ "contains": "texto" }` (parcial).
- `data_find` + `expand`: adjunta hijos (`components`, etc.) y resuelve títulos vía belongs_to. El expand **propaga** los filtros exactos del padre (p. ej. el `scopeField` de compañía del Hub) a contenido y producto si esas entities declaran el campo.
- En canal multi-compañía: **siempre** incluí el campo de scope del Hub en `filter` (el runtime WA también lo inyecta). No hardcodees el valor: sale de la sucursal activa.
- `data_describe_entity` puede listar `relations`.
- El dominio concreto (pedidos, canal WhatsApp, etc.) lo aportan **otras skills** de dominio — en canal WA no ofrezcas ventas/mesas/turnos ni listados de clientes.
