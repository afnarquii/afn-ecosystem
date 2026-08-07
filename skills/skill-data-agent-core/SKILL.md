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
3. `data_find` — leer con filtros exactos.
4. `data_upsert` — crear/actualizar (siempre incluir la key).
5. `data_delete` — solo si el manifiesto lo permite.
6. `data_run_action` — solo acciones listadas (adaptador http-api).

## Reglas

- Si una op falla con `entity_not_allowed` u `op_not_allowed`, **no** reintentar con otro nombre inventado.
- Confirmá con el usuario antes de `data_delete` o escrituras masivas.
- No pidas ni expongas connection strings; las credenciales las gestiona AFN.
- El dominio concreto (pedidos, canal WhatsApp, etc.) lo aportan **otras skills** de dominio — en canal WA no ofrezcas ventas/mesas/turnos ni listados de clientes.
