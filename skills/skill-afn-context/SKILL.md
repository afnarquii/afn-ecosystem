---
name: skill-afn-context
description: Mapa, cerebro y dashboard AFN (.afn) vía MCP afn-context. Kiro, Cursor, Claude Code. Hechos de trabajo + flujo de producto. Engram opcional.
tags: [afn, context, memory, kiro, mcp]
---

# Skill — AFN Context

## Objetivo

Usar el MCP **afn-context** para no reexplorar el repo. Fuente: `.afn/projects.json` + `.afn/memory/cerebro.json` + `.afn/MEMORY.md`.

## Flujo

1. Si no hay `.afn/` **o** el snapshot dice ARQUITECTURA PENDIENTE / un solo `mcp-context` → `afn_bootstrap`, luego `afn_architecture_evidence`, **leer** `filesToRead`, `afn_architecture_commit` solo con lo verificado. **No inventes** puertos, `/api`, flechas ni BDs.
   Si el mapa **ya está verificado** (`llmReviewed`), no lo regeneres. Si el usuario pide “regenerá la arquitectura”: `afn_diagram_generate` `recreate=true` y el mismo ciclo evidencia → leer → commit. No borra observaciones ni `MEMORY.md`.
2. Al empezar → `afn_context_snapshot` + `afn_mem_context`. Si alcanza, **no** listés el árbol.
3. Trabajo nuevo → `afn_session_start` (goal).
4. Flujo entre paquetes → `afn_projects_flow`.
5. ¿Ya lo decidimos? → `afn_mem_search`.
6. Decisión / bugfix / hallazgo → `afn_mem_save` (title, type, What/Why/Where/Learned).
7. Ver mapa, diagramas y cerebro → `afn_dashboard` (buscador en la página). Los diagramas se **abren ahí**.
8. Paquete muerto → `afn_project_ignore`.
9. Cierre → `afn_session_summary`.

## Tokens

- Snapshot ≤ ~3200 caracteres.
- No pegar chats, specs enteras ni `context.json` crudo (secretos).
- No instalar ni depender de Engram.
- No inventar arquitectura: si no está en disco, omitir.

## Fuera de alcance

No ejecuta `/sdd-new` ni el IDE AFN. No es el Cerebro global `userData` de otra PC.
