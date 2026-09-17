# afn-project-process-skills

Genera `.afn/skills/process-<proceso>/SKILL.md` a partir del árbol del repo (sin nombres de producto hardcodeados).

```text
node generate.mjs --paths-json paths.json --outDir .afn/skills
```

En AFN IDE: al abrir el proyecto se siembra `skill-project-process-skills` y, si no hay `process-*`, se generan. Slash: `/skills-procesos`, `/caja`, `/temas`.
