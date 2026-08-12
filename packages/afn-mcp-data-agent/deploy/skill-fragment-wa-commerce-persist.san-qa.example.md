# Fragmento skill — persist comandas SAN QA (pegar en SKILL.md del agente)

Solo para workspaces cuyo ERP usa este modelo. **No** lo copies a un restaurante con otro esquema.

Alineado a Caja (`useCajaComandas` / `useCajaCarrito`): `productosId` + `tipoProducto` P/E;
también `gruposProductosId`, `centroDeCostosId`, `usuariosId` (y gestión si aplica).

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

La dirección de entrega va en `comandas.descripcion` (no hay columna `direccion` en comandas).

## Notas de producto → mismo `descripcion`

```text
wa.commerce.notes.enabled: true
wa.commerce.notes.field: descripcion
wa.commerce.notes.separator: | 
wa.commerce.notes.triggers: sin,con,extra,azucar,azúcar,hielo,alquima,ensalada,tinto,poco,mucho,solo
wa.commerce.notes.maxNoteLen: 120
wa.commerce.notes.maxTotalLen: 240
```

## Pago / comprobante (Gmail + OCR)

```text
wa.commerce.payment.enabled: true
wa.commerce.payment.methods: bancolombia,nequi
wa.commerce.payment.askAfterPersist: true
wa.commerce.payment.emailMaxMessages: 10
wa.commerce.payment.emailWindowMinutes: 4320
wa.commerce.payment.matchTimeoutMinutes: 4320
wa.commerce.payment.senderAllowlist: bancolombia.com,nequi.com,notificacionesbancolombia.com
wa.commerce.payment.amountTolerance: 1
wa.commerce.payment.partialEnabled: true
wa.commerce.payment.minAbono: 100
wa.commerce.payment.allowOverpay: false
wa.commerce.payment.gmailQueryExtra: newer_than:3d
```

Tras persist: pedir foto o PDF (galer�a/c�mara/captura/reenv�o). Ventana v�a hints (SAN QA: 3 d�as). Con `partialEnabled`: abono parcial ? saldo (no �pagado�). Ledger SQLite: `brain_wa_payment_proofs` + `brain_wa_payment_abonos` (ref + monto + fecha; dedupe si reenv�an la misma).

## Abonos parciales

Con partialEnabled: true: monto menor = *abono* (NO «monto no encaja»).
Mensaje al cliente: corto y único — validó imagen, cruzó o no con correo, abono sí/no y saldo (sin skill/ventana/efectivo).
Misma ref/monto/fecha → «ya registrado».

