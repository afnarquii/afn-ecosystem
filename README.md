# afn-ecosystem

Catálogo público de **skills**, **agentes**, **MCP descriptors** y **Delivery Packs** para AFN IDE (Marketplace).

**Repo canónico (Azure DevOps):**  
https://dev.azure.com/afnarqui/afnarqui-notion-ia/_git/afn-ecosystem  

El proyecto **afnarqui-notion-ia** debe ser **Public** para que el Marketplace descargue `SKILL.md` sin login (Items API).

## Reglas (repo público)

- **Nunca** commits de secretos, PAT, `.pem`, buckets reales, IPs ni hosts de producción.
- Solo plantillas con placeholders `${VAR}` o campos vacíos.
- Los valores reales se cargan en la máquina del usuario vía **Ajustes AFN → Cloud Delivery** / wizard → `.afn/credentials/` (local, gitignored).

## Layout

```text
skills/          → SKILL.md (contentUrl del Marketplace vía Items API)
agents/          → JSON o markdown de agentes
mcps/            → descriptores stdio (npx @afn-ecosystem/mcp-*)
packs/           → Delivery Packs (uiSchema + deploy.template + lista de piezas)
```

## Cloud Delivery (Azure + AWS dual)

| Pieza | Ruta |
|-------|------|
| Pack | [`packs/pack-azure-aws-dual/`](packs/pack-azure-aws-dual/) |
| Skill runbook | [`skills/skill-cloud-delivery-azure-aws/`](skills/skill-cloud-delivery-azure-aws/) |
| Skill setup | [`skills/skill-cloud-delivery-setup/`](skills/skill-cloud-delivery-setup/) |
| Agentes | [`agents/cloud-delivery/`](agents/cloud-delivery/) |
| MCP Azure | [`mcps/azure-devops/`](mcps/azure-devops/) |
| MCP AWS deploy | [`mcps/aws-deploy/`](mcps/aws-deploy/) |

Stubs: [`packs/pack-github-aws/`](packs/pack-github-aws/) · [`packs/pack-gcp-gcs/`](packs/pack-gcp-gcs/)

## Instalación en un proyecto

1. Abrí el repo en **AFN IDE**.
2. Marketplace → instalá el pack / skill / MCP (o `/cloud-delivery setup`).
3. Completá credenciales en Ajustes (nunca en este repo).

Ejemplo de guía de integración (QA→S3 · main→Lightsail):  
en el producto → `docs/README_CLOUD_DELIVERY_INTEGRACION_AFN.md` (san-core-front).

## Otros

| Pieza | Ruta |
|-------|------|
| Go profesional | [`skills/golang-professional/`](skills/golang-professional/) |
| Agente Go | [`agents/agent-golang.md`](agents/agent-golang.md) |
| MCP SQL Server (plantilla) | [`mcps/sql-server/`](mcps/sql-server/) |
