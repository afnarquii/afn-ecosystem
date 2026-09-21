export const CONTEXT_TOOLS = [
  {
    name: 'afn_context_snapshot',
    description:
      'Bloque compacto del producto (.afn): proyectos, flujo, hechos y trabajo reciente. Usalo al empezar. No vuelques el repo.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'afn_projects_flow',
    description: 'Proyectos activos y relationships (omite deprecated/ignorePaths).',
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
      'HTML local: inicio, mapa, diagramas (se abren con un clic), memoria y reglas Kiro/Copilot. Por defecto abre el navegador (Kiro no embebe UI).',
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
      'Genera o recrea el diagrama de flujo del workspace (proyectos, nombres, enlaces) en .afn/diagrams, igual que el botón mapa del @ en AFN IDE. No pisa un diagrama existente salvo recreate=true.',
    inputSchema: {
      type: 'object',
      properties: {
        recreate: { type: 'boolean', description: 'Reescribir el IR aunque ya exista' },
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
      'Detecta repos/paquetes del workspace (hermanos, packages/, apps/) SIN LLM y escribe .afn/projects.json. No pisa un mapa rico. force=true reescribe. Rehace mapas pobres (un solo mcp-context).',
    inputSchema: {
      type: 'object',
      properties: {
        force: { type: 'boolean', description: 'Reescribir projects.json conservando ignorePaths' },
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
