---
name: skill-cloud-delivery-azure-aws
description: Pipeline cloud-delivery AFN — work tracker Azure DevOps, promoción de ramas, deploy vía .afn/deploy.json (S3 / ssh-static), HITL. Agnóstico al producto.
tags: cloud-delivery, azure, aws, devops, deploy, general, sdd
---

# Cloud delivery — Azure DevOps + AWS (AFN)

## Cuándo usar

- Slash `/cloud-delivery` o agente `agent-cloud-delivery-orchestrator`.
- Work item → SDD → promoción git → deploy según manifiesto del workspace.

## Credenciales (nunca en git público)

Completar **solo en la máquina del usuario** (Ajustes AFN → Cloud Delivery / wizard):

- Work tracker: credencial `azure-devops` (`${AZURE_DEVOPS_ORG}`, `${AZURE_DEVOPS_PROJECT}`, `${AZURE_DEVOPS_PAT}`, …).
- Deploy: credencial `aws-deploy` (`${AWS_S3_BUCKET_QA}`, `${DEPLOY_SSH_*}`, …).

Plantillas de claves (sin valores): pack `pack-azure-aws-dual` en este ecosystem.  
**Prohibido** pedir o pegar secretos en el chat.

## Manifiesto

Leer `.afn/deploy.json` del workspace (lo escribe el IDE/wizard):

- `promotionBranches`, `onMergeBranch`, `onDeployBranches`
- `targets.*.kind`: `s3-static` | `ssh-static` | `lightsail` | …
- `targets.*.when.branches`: filtra qué se despliega según la rama activa

**Ejemplo de flujo dual (plantilla, no hardcode de producto):**

- Rama de QA → target `s3-static`
- Rama de producción (`onMergeBranch`) → target `ssh-static` (SCP + `postCmd`)

Ramas por defecto de la plantilla: `develop` → `qa` → `main` (el proyecto puede cambiarlas).

## HITL (humano)

1. Confirmar work item (Intake).
2. Aprobar spec / design / tasks (wizard SDD).
3. Aprobar PRs de promoción.
4. Confirmar deploy en el panel cuando la política lo exija.

## Tools MCP canónicas

**Work tracker (`afn-mcp-azure-devops`):** list/link WI, PR, branches, pipeline status.  
**Deploy (`afn-mcp-aws-deploy`):** `cloud_delivery_deploy`, `cloud_delivery_healthcheck`.

## CI

Preferí que el IDE genere `azure-pipelines.yml` desde señales del workspace. No asumir stack (Node, Go, .NET, …): inferir de `projects.json` / manifiestos del repo.

## Comandos

- `/cloud-delivery` — panel
- `/cloud-delivery setup` — configuración guiada (UI)
- `/cloud-delivery start` — intake

## Anti-patrones

- No hardcodear nombres de cliente, buckets, IPs ni hosts en prompts o código generado.
- No recomendar editar JSON a mano si existe el wizard / Ajustes.
- No depender de un agente Docker self-hosted en otro repositorio para el deploy del MCP.
