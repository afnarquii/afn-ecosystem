# Fragmento skill â€” persist comandas SAN QA (pegar en SKILL.md del agente)

Solo para workspaces cuyo ERP usa este modelo. **No** lo copies a un restaurante con otro esquema.

Alineado a Caja (`useCajaComandas` / `useCajaCarrito`): `productosId` + `tipoProducto` P/E;
tambiÃ©n `gruposProductosId`, `centroDeCostosId`, `usuariosId` (y gestiÃ³n si aplica).

```text
wa.commerce.persist.itemDefaults: domicilio=S,numeromesa=200,estado=G,clientesId=11,usuariosId=10,turno=10,formaDePago=O,incluirServicio=N,imprimirProducto=1,imprimirGeneral=1,totalPagado=0,valorTotalDevolver=0,esUnTurnoGuardado=N,color=#425D42,gruposProductosId=48,centroDeCostosId=14,centroDeCostosGestionId=550
wa.commerce.persist.bodyDefaults: domicilio=S,numeromesa=200,estado=G
wa.commerce.persist.skuIdField: productosId
wa.commerce.persist.titleField: nombreProducto
wa.commerce.persist.priceField: valorVenta
wa.commerce.persist.qtyField: cantidad
wa.commerce.persist.typeField: tipoProducto
wa.commerce.persist.typeSku: P
wa.commerce.persist.typeComposite: E
wa.commerce.persist.compositeEntitySubstr: elaborat
wa.commerce.persist.lineTotalField: valorTotalVenta
wa.commerce.persist.basePriceField: valorProducto
wa.commerce.persist.taxField: valorImpuesto
wa.commerce.persist.uuidField: Uuid
wa.commerce.persist.fechaField: fecha
wa.commerce.persist.groupIdField: gruposProductosId
wa.commerce.persist.costCenterIdField: centroDeCostosId
wa.commerce.persist.costCenterGestionIdField: centroDeCostosGestionId
wa.commerce.persist.userIdField: usuariosId
wa.commerce.persist.addressField: descripcion
wa.commerce.persist.addressMaxLen: 240
```

La direcciÃ³n de entrega va en `comandas.descripcion` (no hay columna `direccion` en comandas).

## Notas de producto â†’ mismo `descripcion`

```text
wa.commerce.notes.enabled: true
wa.commerce.notes.field: descripcion
wa.commerce.notes.separator: | 
wa.commerce.notes.triggers: sin,con,extra,azucar,azÃºcar,hielo,alquima,ensalada,tinto,poco,mucho,solo
wa.commerce.notes.maxNoteLen: 120
wa.commerce.notes.maxTotalLen: 240
```

## Pago / comprobante (Gmail + OCR)

```text
wa.commerce.payment.enabled: true
wa.commerce.payment.methods: bancolombia,nequi
wa.commerce.payment.askAfterPersist: true
wa.commerce.payment.emailMaxMessages: 5
wa.commerce.payment.emailWindowMinutes: 4320
wa.commerce.payment.matchTimeoutMinutes: 4320
wa.commerce.payment.senderAllowlist: bancolombia.com,nequi.com
wa.commerce.payment.amountTolerance: 1
wa.commerce.payment.partialEnabled: true
wa.commerce.payment.minAbono: 100
wa.commerce.payment.allowOverpay: false
wa.commerce.payment.gmailQueryExtra: newer_than:3d
```

Tras persist: pedir foto o PDF (galería/cámara/captura/reenvío). Ventana vía hints (SAN QA: 3 días). Con `partialEnabled`: abono parcial ? saldo (no «pagado»). Ledger SQLite: `brain_wa_payment_proofs` + `brain_wa_payment_abonos` (ref + monto + fecha; dedupe si reenvían la misma).

## Abonos parciales

Foto/PDF + mail por monto menor al total ? abono + saldo pendiente. Resto en otra transferencia o efectivo.
Misma ref/monto/fecha ? «ya registrado»; no sumar dos veces.

Caption («parte del pago» / «Valida» / «Abono») + media: el runtime **bloquea catálogo MCP** (sin `data_find`/`local_index`), OCR/Gmail.
**PROHIBIDO** preguntar «¿cuánto abonaste?», buscar la imagen en el workspace, o decir «no me llegó la foto» si hay adjunto / trail «Mirando la imagen».
Si se perdió `payment.status` pero hay `orderCodigo` + foto de comprobante ? soft awaiting (reabre validación). Sin hardcode de banco/vertical: solo hints `wa.commerce.payment.*`.
**Imagen/PDF sola (sin texto)** también dispara payment_proof.
## Reanudar pedido (SQLite â†’ ERP)

```text
wa.commerce.resume.enabled: true
wa.commerce.resume.activeEstados: G
wa.commerce.resume.entity: order_line
wa.commerce.resume.codigoField: codigo
wa.commerce.resume.estadoField: estado
wa.commerce.resume.titleField: nombreProducto
wa.commerce.resume.totalField: valorTotalVenta
wa.commerce.resume.proposeOnce: true
```

Solo reutilizar pedido si `estado` âˆˆ `activeEstados` (`G` en SAN QA). Si no â†’ pedido nuevo desde cero.

## Timeout LLM

```text
wa.commerce.timeout.resumeEnabled: true
wa.commerce.timeout.maxAttempts: 3
```

No ï¿½Tardï¿½ demasiadoï¿½: retomar sesiï¿½n; tras 3 fallos limpiar.
