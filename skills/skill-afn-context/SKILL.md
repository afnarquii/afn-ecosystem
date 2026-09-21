---
name: skill-afn-context
description: Mapa y memoria AFN (.afn) vía MCP afn-context. Cualquier agente MCP (Kiro, Cursor, Claude Code…). Ahorro de tokens; no transcripts; Engram opcional.
tags: [afn, context, memory, kiro, mcp]
---

# Skill — AFN Context

## Objetivo

Usar el MCP **afn-context** para no reexplorar el repo. Fuente: `.afn/projects.json` + `.afn/MEMORY.md`.

## Flujo

1. Si no hay `.afn/` **o** el snapshot muestra un solo proyecto genérico (`mcp-context`) → `afn_bootstrap` con `force=true` (sin LLM). El mapa debe listar los repos del workspace (hermanos, `packages/`, `apps/`), no el paquete MCP.
2. Al empezar → `afn_context_snapshot`. Si alcanza, **no** listés el árbol.
3. Flujo entre paquetes → `afn_projects_flow`.
4. ¿Ya lo decidimos? → `afn_mem_search`.
5. Decisión durable → `afn_mem_save` (What / Why / Where / Learned). Un párrafo.
6. Paquete muerto → `afn_project_ignore` con path `./legacy`.
7. Cierre → `afn_session_summary`.

## Tokens

- Snapshot ≤ ~3200 caracteres.
- No pegar chats, specs enteras ni `context.json` crudo (secretos).
- No instalar ni depender de Engram.

## Fuera de alcance

No ejecuta `/sdd-new` ni el IDE AFN. No es el Cerebro global de otra máquina.
