# Seguridad — afn-ecosystem (público)

Este repositorio es **público**.

## Permitido

- Skills, agentes, descriptores MCP y packs con placeholders `${VAR}` o strings vacíos.
- Documentación de flujo e infraestructura genérica.

## Prohibido

- PAT, API keys, `.pem`, passwords
- Buckets, hosts, IPs o URLs de un cliente real
- `.afn/credentials/*` con valores, `.env`, `deploy.json` materializado

Los secretos viven solo en la máquina del usuario (Ajustes AFN / gitignore del proyecto).
