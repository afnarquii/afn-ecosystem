---
name: Go profesional (afn-ecosystem)
description: Buenas prácticas Go 1.21+ — módulos, layout, errores, context, HTTP, concurrencia, tests y seguridad. Para APIs y servicios en producción.
tags: golang, go, backend, api, general, develop, plan
---

# Go profesional — guía para el agente

Usá esta skill cuando generés o revisés código **Go** (APIs REST, workers, CLIs, librerías). Priorizá código **idiomático**, **mantenible** y **seguro**. Referencia oficial: [go.dev/doc/effective_go](https://go.dev/doc/effective_go), [go.dev/doc/comment](https://go.dev/doc/comment), [pkg.go.dev/std](https://pkg.go.dev/std).

## Módulos y versionado

- Un módulo por servicio o librería coherente: `go mod init ejemplo.com/mi-api` (ruta de módulo única, no tiene que ser un dominio real pero debe ser estable).
- Versiones explícitas en `go.mod`; ejecutá `go mod tidy` tras cambios de imports.
- No commitees `vendor/` salvo política explícita del repo; preferí sumas verificables (`go.sum`).
- Compatible mínimo: indicá `go 1.21` o superior en `go.mod` si usás APIs recientes (`min`, `clear`, iteradores, etc.).

## Estructura de proyecto (orientativa)

- `cmd/<nombre>/main.go` — puntos de entrada (solo `main` delgado: config, `run`, `log.Fatal` si aplica).
- `internal/` — paquetes no importables desde fuera del módulo (API privada del binario).
- `pkg/` — solo si exponés librería reutilizable con contrato estable.
- Handlers HTTP delgados; lógica en servicios/ casos de uso en paquetes `internal/service`, `internal/http`, etc.

## Errores

- Devolvé `error` en lugar de `panic` en flujo normal.
- Envolvé errores con `%w` y `errors.Is` / `errors.As` para inspección; mensajes claros hacia arriba.
- Errores de dominio: tipos sentinel o structs que implementen `Error()` cuando ayuden al caller.
- No ocultes el error original sin contexto (`fmt.Errorf("falló X: %w", err)`).

## Context

- Toda I/O y HTTP deben aceptar `context.Context` en la primera posición cuando aplique (`Do(ctx, ...)`, handlers que usen `r.Context()`).
- Respetá cancelación y deadlines; no bloquees ignorando `ctx.Done()`.

## HTTP / API REST

- Usá `net/http` estándar o un router mínimo (**chi**, **gin**, **echo** — uno consistente en el proyecto).
- Middleware: recuperación de panic → 500, timeouts, request ID, logging.
- JSON: `encoding/json` con structs tipados; validá entrada (tags `json` + validación explícita o librería acordada).
- CORS y cabeceras de seguridad si hay front; no hardcodees orígenes en producción sin config.
- Health: `GET /health` o `/live` + `/ready` si hay dependencias (BD, colas).

## Concurrencia

- Goroutines con ciclo de vida claro; usá `sync.WaitGroup`, `errgroup` o canales para no filtrar goroutines.
- Mutex vs channels: preferí el estilo más simple de leer; documentá invariantes de memoria compartida.
- Evitá compartir `map` sin sincronización.

## Logging y observabilidad

- Preferí **`log/slog`** (stdlib) o un logger estructurado único en el proyecto.
- Niveles: info en operación normal, warn/error con contexto (request id, ruta, error envuelto).
- No loguees secretos, tokens ni PII completa.

## Seguridad

- Secretos solo por **variables de entorno** o secret manager; nunca en código ni en repos.
- SQL: siempre consultas parametrizadas; nunca concatenar input del usuario.
- Validá y limitá tamaño de body, timeouts de lectura, rate limiting si es API pública.
- Dependencias: `go list -json -m all` / govulncheck cuando el proyecto lo permita.

## Testing

- Archivos `*_test.go` junto al código; tabla de casos (`t.Run`) para ramas.
- `t.Helper()` en helpers de test; mocks/interfaces en el paquete consumidor cuando simplifique.
- Tests de integración opcionales con `testing.Short()` para saltear en CI rápido.
- Benchmarks (`Benchmark*`) solo donde el rendimiento sea crítico.

## Estilo y herramientas

- `gofmt` / `goimports` implícitos en el flujo del desarrollador.
- Comentarios exportados: frase completa que empiece con el nombre del símbolo ([documentación Go](https://go.dev/doc/comment)).
- Interfaces **pequeñas** en el consumidor (“accept interfaces, return structs”).
- Evitá abusar de `interface{}` / `any`; preferí genéricos cuando aporten claridad (Go 1.18+).

## Entrega de código al usuario (Afn)

- Generá archivos completos cuando el flujo lo pida (`writeFile`); mantené `go.mod` alineado con los imports.
- Tras añadir paquetes: indicá `go mod tidy` en terminal si hace falta.
- README del servicio: cómo correr (`go run ./cmd/...`), variables de entorno y puerto.

## Anti-patrones a evitar

- `panic` en librerías y en manejadores salvo programación defensiva muy acotada.
- Ignorar errores con `_ = ...` sin justificación.
- Copiar `*http.Request` o `Body` sin entender consumo único del body.
- Tests que dependan del orden global o del reloj sin control.

---

**Repo:** [github.com/afnarquii/afn-ecosystem](https://github.com/afnarquii/afn-ecosystem) — skill mantenida ahí para el marketplace Afn.
