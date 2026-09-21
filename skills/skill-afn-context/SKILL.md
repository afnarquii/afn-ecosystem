---
name: skill-afn-context
description: Mapa, cerebro y dashboard AFN (.afn) vía MCP afn-context. Kiro, Cursor, Claude Code. Hechos de trabajo + flujo de producto. Engram opcional.
tags: [afn, context, memory, kiro, mcp]
---

# Skill — AFN Context

## Objetivo

Usar el MCP **afn-context** para no reexplorar el repo. Fuente: `.afn/projects.json` + `.afn/memory/cerebro.json` + `.afn/MEMORY.md`.

## Flujo

1. Si no hay `.afn/` **o** el snapshot muestra un solo proyecto genérico (`mcp-context`) → `afn_bootstrap` con `force=true`.
   Tras `git pull` del pack, al entrar (SessionStart) bootstrap **regenera las gráficas** mientras la arquitectura no esté locked. Cuando el flujo ya está: `lock=true`. `unlock` vuelve a iterar.
2. Al empezar → `afn_context_snapshot` + `afn_mem_context`. Si alcanza, **no** listés el árbol.
3. Trabajo nuevo → `afn_session_start` (goal).
4. Flujo entre paquetes → `afn_projects_flow` (rol, framework, BD, prefix, capas, E2E, cómo desarrollar). Recrear los mapas visuales → `afn_diagram_generate` `recreate=true`.
5. ¿Ya lo decidimos? → `afn_mem_search`.
6. Decisión / bugfix / hallazgo → `afn_mem_save` (title, type, What/Why/Where/Learned).
7. Ver mapa, diagramas y cerebro → `afn_dashboard`. Los diagramas se **abren en esa página**.
8. Paquete muerto → `afn_project_ignore`.
9. Cierre → `afn_session_summary`.

## Tokens

- Snapshot ≤ ~3200 caracteres.
- No pegar chats, specs enteras ni `context.json` crudo (secretos).
- No instalar ni depender de Engram.

## Fuera de alcance

No ejecuta `/sdd-new` ni el IDE AFN. No es el Cerebro global `userData` de otra PC.
