---
name: skill-project-process-skills
slash: skills-procesos
description: >-
  Al abrir un proyecto en AFN IDE, generar .afn/skills/process-* leyendo el árbol
  (caja, temas, inventario…). Usar cuando el usuario pide asociar skills, generar
  skills de proceso, /skills-procesos, /caja, o «usa la skill temas».
user-invocable: true
argument-hint: '[--force]'
tags: [process, skills, afn, project-open]
---

# Skills de proceso del proyecto

Esta skill **no** desarrolla una pantalla. Enseña a **descubrir** los procesos del repo y dejar una carpeta de skills invocables.

## Objetivo

1. Leer el proyecto (componentes, notas `.afn/notes`, rutas).
2. Crear `.afn/skills/process-<proceso>/SKILL.md` (ej. `process-caja`, `process-temas`).
3. Cada skill dice **qué puede** y **qué no puede** tocar, **la ruta de la pantalla**, **qué hace** cada ancla y **cómo entra/sale la data**.
4. El usuario dice «usa la skill caja» o `/caja` y la IA trabaja **solo** ese proceso.

## En AFN IDE (notions)

Al abrir el proyecto:

1. Se siembra esta skill en `.afn/skills/skill-project-process-skills/`.
2. Si no hay `process-*`, se generan desde el árbol (`/skills-procesos`).
3. El menú `/` lista `/caja`, `/temas`, etc. (frontmatter `slash`).

Comandos:

- `/skills-procesos` — popover: generar las que falten, o marcar **Forzar refresco** (`--force`) para reescribir las `managed: true`.

## Generador (este repo)

```text
node packages/afn-project-process-skills/generate.mjs --paths-json paths.json --outDir .afn/skills
```

`paths.json` = lista de rutas relativas del proyecto.

## Cuando el usuario ya tiene skills

Si dice «usa la skill caja y deja el botón Pagar fijo»:

1. Abrí `.afn/skills/process-caja/SKILL.md`.
2. Limitá el cambio a las anclas.
3. No toques inventario/temas/compras salvo pedido explícito.

## Qué no hacer

- No inventar procesos que no existan en el árbol.
- No copiar skills de otro producto.
- No meter secretos en SKILL.md.
