# `@afn-ecosystem/mcp-context`

Servidor MCP **stdio** (Node ≥18) que lee y escribe `.afn/` del **workspace del producto**.

Detecta repos hermanos / `packages/` / `apps/` (como `/afn-init`). No trata el paquete `afn-mcp-context` como el producto.

Cerebro: `.afn/memory/cerebro.json`. Arquitectura: **`ARQUITECTURA.md` en la raíz del workspace**. Dashboard v1.4.72: el README de Notas recupera el estilo de Visual Studio Code y el panel de archivos se puede ocultar. v1.4.71: el menú del dashboard vuelve a responder; un error de script lo dejaba quieto. v1.4.70: al reabrir el dashboard después de git pull no se queda pegado el servidor viejo. v1.4.69: en Notas el árbol de carpetas dentro de la tarea se ve al lado del README, no solo el archivo principal. v1.4.68: un script de Node o Python guardado en una nota se asocia a Scripts y se ejecuta con parámetros o sin ellos. v1.4.67: en Notas se ven las imágenes, los PDF y los demás archivos que el LLM guardó en la carpeta, también las fotos del README. v1.4.66: la vista del README pinta los bloques ```sql y ```python como código. v1.4.65: la vista del README en Notas usa los colores del tema oscuro de Visual Studio Code. v1.4.64: en Notas se descarga el archivo abierto, sea README, HTML o PDF. v1.4.63: en Notas el proyecto y los botones quedan en el pie; el archivo abierto ocupa la pantalla. v1.4.62: el editor de Notas tiene números de línea, selección, Ctrl+D y Ctrl+F; la vista del README sigue el estilo de Visual Studio Code. v1.4.61: en Notas un Markdown se edita con vista previa y un HTML se abre como página; Guardar escribe el mismo archivo. v1.4.60: Notas lista cualquier carpeta de `.afn/notes/tareas` (mayúsculas, espacios o `_`) y el README aunque esté en una subcarpeta, en HTML; Actualizar relee el disco. v1.4.59: Descubrir escribe ARQUITECTURA.md de punta a punta y une carpetas si el código llama a localhost de otra. v1.4.58: Elegir carpeta abre el explorador de Windows. v1.4.57: el documento de arquitectura se llama Inicio; el tablero de accesos se llama Resumen. v1.4.56: Carpetas es el primer ítem del menú y ahí están Guardar mapa y Descubrir. v1.4.55: en Mapa se eligen las carpetas (JavaScript, TypeScript, Python, Go, .NET, Gradle) y Descubrir arma el mapa y los skills de proceso solo si se pide. v1.4.54: SQL tiene 3 consultas y las cruza por los campos elegidos, con JSON en verde y rojo. v1.4.53: el editor y Comparar buscan en textos de miles de líneas sin trabar la página. v1.4.52: pestaña Editor con números de línea, búsqueda y cursor; Comparar usa el mismo editor en cada lado. v1.4.51: Comparar deja pegar texto en cada lado, o abrir un archivo, y ver las diferencias. v1.4.50: Guardar origen deja el SQL Server y, si cargás usuario o contraseña, los escribe en credentials. v1.4.49: Orígenes admite hasta 10 SQL Server; en SQL se elige cuál usar. v1.4.48: en SQL la consulta ocupa el 55% y los resultados el 45%; la barra del medio deja ampliar cualquiera de los dos. v1.4.47: Ctrl+D en SQL y en favoritos selecciona la siguiente coincidencia igual, sin abrir el marcador del navegador. v1.4.46: un favorito SQL guarda el PA entero (antes se cortaba cerca de las 128 líneas). v1.4.45: en SQL y en el favorito la selección queda visible y la búsqueda marca todas las coincidencias; «En selección» limita la búsqueda al trozo marcado o la suelta para buscar en todo el texto. v1.4.44: Comparar abre dos archivos (JSON u otro texto) lado a lado, con búsqueda y resaltado, y ese texto no entra al agente. El editor SQL tiene color, búsqueda, cursor, autocompletado y números de línea; Favoritos ocupa toda la pantalla, se puede buscar y muestra las líneas. Esas consultas quedan en `.afn/sql-favorites.json` y no van al contexto. v1.4.43: Si un script falla (por ejemplo un token vencido) el dashboard muestra el mensaje del proceso y, si alcanzó a imprimir JSON, también las filas. Kiro recibe ese error con `afn_script`, sin la ruta ni el código. Los scripts pueden recibir parámetros opcionales (`args` o `params`); si no se mandan, corren igual. En el dashboard cada uno tiene nombre y valor: si hay tres y solo llenás dos, se mandan esos dos. **Abrir espacio** recarga todo el menú con la carpeta elegida. El explorador intenta quedar delante del navegador. **No** registra `npx @afn-ecosystem/mcp-data-agent` (eso cierra el MCP con error 32000). En Kiro, los datos del origen configurado salen por la tool **`afn_sql`** del MCP `afn-context` (no hay que pedirle al usuario que corra el SQL). Scripts Python/Node: la ruta (aunque esté fuera del repo y tenga claves) queda solo en `.afn/script-runners.json`. Kiro recibe el JSON con **`afn_script`**, nunca el archivo ni la ruta, y solo si se lo pedís. *abre dashboard AFN* / *guarda el readme …* los intercepta el hook **antes del LLM**. También: `node index.js dashboard` (puerto 5847).

Origen de datos: el init escribe `.afn/db-connections.json` (host/puerto/base, sin passwords) y `.afn/db-connection.json` (sesión activa). Credenciales en `.afn/credentials/data-agent.json` (gitignored):

```json
{ "DB_USER": "sa", "DB_PASSWORD": "TU_PASSWORD" }
```

Varios orígenes: `{ "byId": { "origen_1": { "DB_USER": "sa", "DB_PASSWORD": "TU_PASSWORD" } } }`. Mongo: `{ "MONGODB_URI": "mongodb://USER:PASSWORD@host:27017/db" }`.

Guía de uso (init, dashboard, SQL, scripts Python/Node, Kiro y cualquier otro agente):  
[`GUIA.md`](GUIA.md)

Detalle de instalación del pack:  
[`packs/pack-afn-context/README.md`](../../packs/pack-afn-context/README.md)

```bash
npm install
node --test test/context.unit.test.mjs
# desde el workspace del producto (varios repos), no desde este paquete:
node index.js setup kiro
# sin tokens de Kiro:
node index.js dashboard          # deja la ventana abierta (http://127.0.0.1:5847)
node index.js dashboard mapa
node index.js discover ./web ./api
node index.js note-save hu_102030_fondos.md
node index.js mem-search fondos
```

Los comandos de terminal y los del dashboard (mapa, Descubrir, SQL, scripts) están en [`GUIA.md`](GUIA.md). `discover` no corre al abrir el dashboard: solo si se pide.
