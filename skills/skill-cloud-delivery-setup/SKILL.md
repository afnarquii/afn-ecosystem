---
name: skill-cloud-delivery-setup
description: Guía para configurar Cloud Delivery en AFN IDE sin editar .afn a mano — wizard, Marketplace packs, placeholders ${VAR}.
tags: cloud-delivery, setup, marketplace, aws, azure, gcp, github, general
---

# Setup Cloud Delivery (AFN) — sin JSON a mano

## Mensaje al usuario

Configurá la entrega cloud desde **Ajustes → Features → Cloud Delivery** o **`/cloud-delivery setup`**.  
El IDE escribe `.afn/deploy.json`, credentials y MCP. **No** indiques copiar `*.example` salvo fallback power-user explícito.

## Qué es manual de verdad

Solo datos que el IDE no puede inventar:

- Nombre de bucket / proyecto cloud
- PAT o token del work tracker
- Ruta local a clave SSH (`.pem`) — el archivo no se sube a git
- Host SSH / URL de health (opcionales)

## Packs (Marketplace / afn-ecosystem)

| Pack | Uso |
|------|-----|
| `pack-azure-aws-dual` | Azure WI + QA S3 + prod ssh-static |
| `pack-github-aws` | GitHub Issues/PR + deploy AWS (stub extensible) |
| `pack-gcp-gcs` | Stub GCP (instalar MCP deploy cuando exista) |

Instalar pack → skills + agentes + descriptores MCP con `${VAR}`. Luego completar variables en Ajustes.

## Tras Guardar

1. `/mcp-list` — verificar MCP cloud-delivery
2. `/cloud-delivery` — flujo HITL
3. Build local según el `build` del manifiesto antes de confirmar deploy

## Extender a otro cloud

Sin rebuild del ejecutable: publicar un **Delivery Pack** en afn-ecosystem (MCP + skill + `pack.json` con `uiSchema` + `manifestTemplate`) y registrarlo en el Marketplace AFN.
