# Pack: Azure + AWS dual

Infraestructura pública para AFN Cloud Delivery:

- **QA** → `s3-static` (rama `qa`)
- **Prod** → `ssh-static` (rama `main`)

## Archivos

| Archivo | Rol |
|---------|-----|
| `pack.json` | Manifiesto del pack + uiSchema del wizard |
| `deploy.template.json` | Plantilla `.afn/deploy.json` con `${VAR}` |
| `credentials.keys.example.json` | Nombres de claves (valores vacíos) |

## Seguridad

Este directorio es **público**. No incluyas PAT, `.pem`, buckets reales ni IPs.

## Uso

1. Marketplace AFN → instalar piezas del pack (o `/cloud-delivery setup`).
2. Completar variables en Ajustes (máquina local).
3. `/cloud-delivery` → HITL DeployQa (S3) y Deploy (SSH).
