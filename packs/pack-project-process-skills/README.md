# Pack — Skills de proceso del proyecto

Al abrir un proyecto en **AFN IDE**, se crea `.afn/skills/process-<nombre>/` con una skill por dominio detectado (caja, temas, inventario…).

Luego en el chat:

- `/skills-procesos` — generar/actualizar
- `/caja` o «usa la skill caja y crea…»
- `/temas` — componentes/estilos de ese proceso

## Piezas

| Pieza | Ruta |
|-------|------|
| Skill | `skills/skill-project-process-skills/` |
| Generador | `packages/afn-project-process-skills/generate.mjs` |

## Instalación

Marketplace AFN → pack **Skills de proceso del proyecto**, o abrir el repo (siembra automática de la skill generadora).
