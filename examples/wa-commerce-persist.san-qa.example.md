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
```
