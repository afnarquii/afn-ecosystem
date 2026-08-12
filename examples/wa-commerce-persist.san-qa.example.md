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
wa.commerce.payment.emailMaxMessages: 5
wa.commerce.payment.emailWindowMinutes: 60
wa.commerce.payment.matchTimeoutMinutes: 60
wa.commerce.payment.senderAllowlist: bancolombia.com,nequi.com
wa.commerce.payment.amountTolerance: 1
wa.commerce.payment.gmailQueryExtra: newer_than:1d
```

QA: ventana y timeout de match = 60 min (vía skill). Ver también `examples/mcp-gmail.descriptor.example.json`.

## Reanudar pedido (SQLite → ERP)

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

Si SQLite tiene `orderCodigo`: `data_find` por código. Solo reutilizar si `estado` ∈ `activeEstados`. Otro estado / sin fila → pedido nuevo. Activo → proponer comprobante y/o más productos.
