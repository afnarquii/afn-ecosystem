export const CONTEXT_TOOLS = [
  {
    name: 'afn_context_snapshot',
    description:
      'Bloque compacto: nombres, rutas, quién llama a quién, hechos. El documento completo es ARQUITECTURA.md en la raíz del workspace.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'afn_projects_flow',
    description: 'Mapa cross-project: rol, framework, BD, puerto, prefix, skills, capas, quién llama qué, cómo desarrollar y probar.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'afn_mem_context',
    description:
      'Qué se ha trabajado: sesiones y observaciones recientes del cerebro .afn/memory/cerebro.json. Al empezar o tras compactar contexto.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
  },
  {
    name: 'afn_mem_search',
    description: 'Busca en el cerebro (observaciones) y MEMORY.md. No es el historial de chat.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        type: { type: 'string', description: 'decision|architecture|bugfix|pattern|config|discovery|learning' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'afn_mem_save',
    description:
      'Guarda UN hecho en el cerebro (What/Why/Where/Learned, type, title). No transcripts. No secretos.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        title: { type: 'string' },
        type: { type: 'string' },
        what: { type: 'string' },
        why: { type: 'string' },
        where: { type: 'string' },
        learned: { type: 'string' },
        sessionId: { type: 'string' },
      },
    },
  },
  {
    name: 'afn_session_start',
    description: 'Abre una sesión de trabajo en el cerebro (qué estamos haciendo ahora).',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string' },
        id: { type: 'string' },
      },
    },
  },
  {
    name: 'afn_session_summary',
    description: 'Cierra la sesión: objetivo, hecho, siguiente, archivos. Queda en el cerebro.',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string' },
        done: { type: 'string' },
        next: { type: 'string' },
        files: { type: 'string' },
        sessionId: { type: 'string' },
      },
    },
  },
  {
    name: 'afn_note_save',
    description:
      'Guarda un README/entrega de UNA tarea en .afn/notes/tareas/<slug>/ (varios .md por tarea). No es ARQUITECTURA.md ni el cerebro. Solo si el usuario pidió dejarlo listo.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Slug o nombre de la tarea' },
        title: { type: 'string' },
        filename: { type: 'string', description: 'readme.md, e2e.md, decision.md…' },
        markdown: { type: 'string' },
        status: { type: 'string', description: 'draft | listo | aprobado' },
      },
      required: ['markdown'],
    },
  },
  {
    name: 'afn_note_list',
    description: 'Lista las entregas/wiki de tareas en .afn/notes/tareas/.',
    inputSchema: {
      type: 'object',
      properties: { task: { type: 'string' } },
    },
  },
  {
    name: 'afn_note_set_status',
    description:
      'Marca una tarea de la wiki: draft, listo (el autor la da por hecha) o aprobado (revisión funcional). El dashboard solo lee; este tool escribe.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string' },
        status: { type: 'string', description: 'draft | listo | aprobado' },
      },
      required: ['task', 'status'],
    },
  },
  {
    name: 'afn_dashboard',
    description:
      'Abre http://127.0.0.1 (campo url). NUNCA abras .afn/_tmp/dashboard.html. Versión en el HTML. Orígenes, elegir tablas/PAs, SQL SELECT. No regenera arquitectura.',
    inputSchema: {
      type: 'object',
      properties: {
        open: { type: 'boolean', description: 'Abrir el navegador (default true)' },
        slug: { type: 'string', description: 'Abrir un diagrama concreto (#d-slug)' },
      },
    },
  },
  {
    name: 'afn_diagram_generate',
    description:
      'Regenera el inventario de arquitectura. SOLO si el usuario pidió «regenerá la arquitectura» o hay cambio estructural confirmado. No al abrir el proyecto ni el dashboard. Devuelve un resumen (el JSON vive en disco).',
    inputSchema: {
      type: 'object',
      properties: {
        recreate: { type: 'boolean', description: 'Reescribir el IR aunque ya exista' },
      },
    },
  },
  {
    name: 'afn_architecture_evidence',
    description:
      'Evidencia de disco para armar el mapa: proyectos reales, flechas solo si hay proxy/compose, archivos a leer. El LLM no debe inventar lo que acá figura como unknown.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'afn_architecture_commit',
    description:
      'Guarda el mapa verificado. Rechaza paths/nodos inventados. Devuelve un resumen, no el flujo completo. No borra observaciones. Solo tras regenerate pedido por el usuario.',
    inputSchema: {
      type: 'object',
      properties: {
        projects: { type: 'array', items: { type: 'object' } },
        relationships: { type: 'array', items: { type: 'object' } },
      },
    },
  },
  {
    name: 'afn_data_sources',
    description:
      'Lista orígenes en .afn/db-connections.json (sin secretos, sin conectar). Si hay origen, la consulta va por afn_sql de este mismo MCP. No pidas al usuario que ejecute SQL ni que pegue el resultado.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'afn_sql',
    description:
      'Ejecuta una consulta de lectura en un origen de .afn/db-connections.json y devuelve las filas. Si hay varios, pasá connectionId (id o name de afn_data_sources). Sin connectionId usa la sesión activa. No consultes otro origen si el id no existe. No pidas que corran el SQL ni que peguen el resultado. No arranques npx afn-mcp-data-agent. Solo SELECT, WITH o EXEC/CALL de lectura.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SELECT, WITH o EXEC nombrePA (lectura)' },
        connectionId: { type: 'string', description: 'id o name en .afn/db-connections.json. Vacío = sesión activa.' },
        limit: { type: 'number', description: 'Máximo de filas (default 80, tope 200)' },
      },
      required: ['sql'],
    },
  },
  {
    name: 'afn_script',
    description:
      'Catálogo de scripts Python/Node que la persona registró en .afn/script-runners.json. action=list no ejecuta nada. action=run solo si el usuario pidió explícitamente ejecutar ese script o consultar la data que genera, con id o title. No lo uses por tu cuenta. No inventes rutas ni pases código.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'list (default) o run' },
        id: { type: 'string', description: 'id o título registrado. Obligatorio si action=run' },
        limit: { type: 'number', description: 'Máximo de filas al ejecutar (default 80, tope 200)' },
      },
    },
  },
  {
    name: 'afn_schema_commit',
    description:
      'Guarda esquema vivo (tablas, PAs, quién llama qué, ejemplo corto) en .afn/diagrams/datos.md y ARQUITECTURA.md §6b. Solo lo que el MCP de datos devolvió. No inventes columnas. No al abrir el proyecto.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'afn-session-db | afn-mcp-data-agent' },
        engine: { type: 'string' },
        connectionName: { type: 'string' },
        tables: { type: 'array', items: { type: 'object' } },
        procedures: { type: 'array', items: { type: 'object' } },
        calls: { type: 'array', items: { type: 'object' } },
      },
    },
  },
  {
    name: 'afn_agent_assets',
    description:
      'Escanea steering/skills de Kiro, instrucciones y skills de Copilot (.github), Cursor y AGENTS.md, y las asocia a un proyecto del mapa si el nombre coincide.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'afn_extract_file',
    description:
      'Convierte un PDF, Excel o imagen del disco a Markdown en .afn/extract/ sin visión del modelo. Usar cuando pidan ver, leer o extraer una imagen/PDF/Excel por ruta. No pedir que adjunten el archivo. No decir que no se pueden leer imágenes.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Ruta absoluta del PDF, xlsx o imagen' },
      },
      required: ['path'],
    },
  },
  {
    name: 'afn_doctor',
    description: 'Comprueba .afn/ (projects.json, MEMORY.md, cerebro).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'afn_bootstrap',
    description:
      'Crea .afn/, inventario de repos (disco) y el catálogo de orígenes .afn/db-connections.json (compose/env por repo, sin passwords). No inventa flechas ni el host. Si falta el mapa, el LLM completa con afn_architecture_evidence + commit. refresh/force no pisan el cerebro ni perfiles de origen ya guardados.',
    inputSchema: {
      type: 'object',
      properties: {
        force: { type: 'boolean', description: 'Reescribir projects.json conservando ignorePaths' },
        refresh: { type: 'boolean', description: 'Redibujar gráficas aunque la arquitectura esté cerrada' },
        lock: { type: 'boolean', description: 'Cerrar arquitectura (dejar de regenerar al entrar)' },
        unlock: { type: 'boolean', description: 'Volver a regenerar al entrar (etapa de cambios)' },
      },
    },
  },
  {
    name: 'afn_project_ignore',
    description:
      'Marca un path como deprecado/ignorado para que bootstrap, snapshot e init no lo incluyan.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Ruta relativa, p. ej. ./legacy-app' },
        reason: { type: 'string', description: 'deprecated | ignored' },
      },
      required: ['path'],
    },
  },
];
