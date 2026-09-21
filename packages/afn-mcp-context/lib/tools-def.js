export const CONTEXT_TOOLS = [
  {
    name: 'afn_context_snapshot',
    description:
      'Bloque compacto: nombres, rutas, quién llama a quién, hechos. El documento completo es .afn/diagrams/arquitectura.md.',
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
    name: 'afn_dashboard',
    description:
      'HTML: README de arquitectura (nombres, rutas, flujo), vista gráfica opcional, memoria. Abre el navegador.',
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
      'Regenera el inventario de arquitectura (disco, sin inventar). No borra el cerebro. Después el LLM debe leer filesToRead y llamar afn_architecture_commit. Solo si el usuario lo pidió o es la primera vez.',
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
      'Guarda el mapa que el LLM verificó en archivos reales. Rechaza paths o nodos que no existan. No borra observaciones.',
    inputSchema: {
      type: 'object',
      properties: {
        projects: { type: 'array', items: { type: 'object' } },
        relationships: { type: 'array', items: { type: 'object' } },
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
    name: 'afn_doctor',
    description: 'Comprueba .afn/ (projects.json, MEMORY.md, cerebro).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'afn_bootstrap',
    description:
      'Crea .afn/ e inventario de repos (disco). No inventa flechas. Si falta el mapa, el LLM completa con afn_architecture_evidence + commit. refresh/force no pisan el cerebro.',
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
