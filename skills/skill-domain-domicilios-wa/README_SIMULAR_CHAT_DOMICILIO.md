# Simular un chat real → domicilio vendido (Croky / WA)

Guía para **ensayar** una conversación como las de mostrador real y cerrar un pedido gestionado (comanda en ERP + pago si aplica).

Scope del workspace: `.afn/wa-company-scope.json` → `companiasId` (hoy **40** CROKY POLLO PARIS).  
Skill: `skill-domain-domicilios-wa` · Agente: `agent-domain-domicilios-wa`.  
Pago ganador (transferencia): **foto/PDF → OCR → Gmail** (no lo desactives).

---

## 0) Antes de simular (checklist)

1. Electron AFN abierto, Bot WhatsApp **ON**, `rootPath` = `C:\projects\san\san-core-front`.
2. Skill + agente domicilios instalados / activos en ese workspace.
3. MCP data-agent conectado a **SanColombia_QA** (Lightsail).
4. Índice local fresco (si cambiaste de compañía: borrá `.afn/mcp-index` o esperá sync).
5. Gmail/IMAP configurado **solo** si vas a probar transferencia + comprobante.
6. Chat de prueba: tu número o un contacto WA de test (no uses `status@broadcast`).

Opcional — limpiar scope de chats viejos:

```text
.afn/wa-chat-company-scope.json → { "version": 1, "chats": {} }
```

---

## 1) Cómo habla el mostrador real (qué imitar)

| Cliente | Mostrador (estilo) |
|---------|-------------------|
| Buenas / quiero domicilio | Hola — ¿qué pedís y la dirección? |
| Pedido + dir + pago en un mensaje | Extrae todo; responde total + ETA |
| ¿Cuánto es? | Solo el número / total |
| Efectivo + vueltos | OK; **sin** pedir foto |
| Transferencia | Cuenta/QR → pide **foto** del comprobante |
| ¿Cuánto demora? | ~30–40 min (o busy si hay cola) |

El bot debe ser **ultra corto** (1–2 frases). Si se pone verboso, el skill no está cargado o el agente viejo sigue activo.

---

## 2) Guion A — Transferencia (cierra con OCR + Gmail)

Objetivo: comanda `estado=G` + payment proof matched.

### Mensajes (pegá en orden, como cliente)

**① Apertura**
```text
Buenas tardes
Para solicitar un domicilio por favor
```

**Esperado bot:** saludo corto + pide pedido/dirección (o “¿qué deseas?”).

**② Pedido compacto (estilo chat real)**
```text
Serian 2 combos con pechuga
Salsa rosada bastantica please
Calle 25a#76-29 apto 201
Segundo piso Casa de la justicia
Te pago por transferencia
```

**Esperado bot:**
- Busca **Combo Pechuga** (composite) en catálogo co=40.
- Anota notas (salsa…) + dirección en `descripcion`.
- Cotiza total (~2 × precio catálogo; no inventar).
- Pide confirmación breve → al confirmar: `persist_order` / `data_run_action`.
- Muestra cuenta (`accountHint`) y/o media QR si hay `channel_media`.
- Pide **foto o PDF** del comprobante.

**③ Confirmación**
```text
Listo
```

**④ Comprobante**  
Enviá una **imagen real** de transferencia Bancolombia (monto ≈ total del pedido).

**Esperado bot/runtime:**
- Entra a `payment_proof` (no catálogo).
- OCR lee monto/ref.
- Cruza Gmail (ventana 3 días).
- Responde corto: validado / abono+saldo / o “revisión humana” si no matchea.

**⑤ ETA**
```text
Cuanto demora mas o menos?
```

**Esperado:** ~30–40 min (hints `wa.commerce.eta.*`).

### Verificar en SQL (Lightsail)

```bash
ssh -i "C:\projects\san\credenciales aws\LightsailDefaultKey-us-east-1.pem" ubuntu@52.0.118.91
```

```bash
sudo docker exec mssql-qa /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$(cat /home/ubuntu/sql-qa/.sa_password)" -C -d SanColombia_QA -W -s"|" \
  -Q "SET NOCOUNT ON; SELECT TOP 5 codigo, companiasId, estado, nombreProducto, valorTotalVenta, LEFT(descripcion,80) AS desc80, fecha FROM comandas WHERE companiasId=40 ORDER BY comandasId DESC"
```

OK si: `companiasId=40`, `estado=G`, `descripcion` con dirección + notas, total coherente.

---

## 3) Guion B — Efectivo + vueltos (sin foto)

**①**
```text
Buenas
Un cuarto de pollo asado con una porción de papas a la francesa
```

**Esperado:** si no dijo presa → pregunta **pechuga, ala, muslo o contramuslo**.

**②**
```text
Pechuga
Calle 25a # 76-29 apto 201 segundo piso
Te pago con un billete de 100
Devuelta de 100
```

**Esperado:**
- Cotiza, confirma, persiste.
- Anota vueltos en notes.
- **No** pide foto de comprobante (`cash.skipPaymentProof`).
- ETA corto.

---

## 4) Guion C — Agregar ítem con pago pendiente

Tras cotizar transferencia (antes o después de pedir foto):

```text
Dame otra porción de papas fritas
Cuanto sería añadiendo la otra porción
```

**Esperado:** recotiza total; con `allowAddItemsWhileAwaiting` **no** diga que falta la foto para sumar ítems (ventana 3 h).

---

## 5) Qué cuenta como “domicilio gestionado y vendido”

| Check | OK |
|-------|-----|
| Catálogo | Productos/combos de **co=40** (no Broster 4) |
| Comanda | Fila en `comandas` con `companiasId=40`, `estado=G`, `domicilio=S` |
| Dirección + notas | En `descripcion` |
| Transferencia | Foto procesada + (ideal) match Gmail / abono en ledger |
| Efectivo | Persist OK sin exigir comprobante |
| Respuestas | Cortas, sin “escribí menú” ni pedir `companiasId` |

Ledger local AFN (pago): tablas cerebro / `brain_wa_payment_*` y dump `afn-wa-payment-gmail-last.json` en userData Electron.

---

## 6) Si algo falla

| Síntoma | Qué mirar |
|---------|-----------|
| Productos de otra empresa | `wa-company-scope.json` + reinicio Electron; limpiar `wa-chat-company-scope` y `.afn/mcp-index` |
| Bot largo / pide menú escrito | Skill/agent viejo; confirmá pack domicilios WA activo |
| “No me llegó la foto” con adjunto | Gate payment; skill payment hints; reinicio |
| OCR OK pero no Gmail | IMAP/OAuth + allowlist `notificacionesbancolombia.com` |
| Persist error FK | `itemDefaults` del skill (cliente/usuario/grupo) vs SQL co=40 |

---

## 7) Referencia chats reales (estilo)

En notions (solo referencia humana, no runtime):

- `chats/Chat57322 2608516.txt`
- `chats/Chat573116292999.txt`
- `chats/Chat573106670320.txt`

Playbook embebido en el skill: sección **«Playbook ventas (aprendido de chats reales)»**.
