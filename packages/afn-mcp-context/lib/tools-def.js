export const CONTEXT_TOOLS = [
  {
    name: 'afn_context_snapshot',
    description:
      'Bloque compacto del producto (.afn): proyectos activos, flujo, hechos. Usalo al empezar. No vuelques el repo.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'afn_projects_flow',
    description: 'Proyectos activos y relationships (omite deprecated/ignorePaths).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'afn_mem_search',
    description: 'Busca hechos durables en MEMORY.md / facts.json. No es el historial de chat.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'afn_mem_save',
    description:
      'Guarda UN hecho durable (What/Why/Where/Learned). No transcripts. No secretos.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        what: { type: 'string' },
        why: { type: 'string' },
        where: { type: 'string' },
        learned: { type: 'string' },
      },
    },
  },
  {
    name: 'afn_session_summary',
    description: 'Handoff de sesión: objetivo, hecho, siguiente, archivos. Un hecho, no el chat.',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string' },
        done: { type: 'string' },
        next: { type: 'string' },
        files: { type: 'string' },
      },
    },
  },
  {
    name: 'afn_doctor',
    description: 'Comprueba .afn/ (projects.json, MEMORY.md).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'afn_bootstrap',
    description:
      'Si falta .afn/projects.json, detecta paquetes SIN LLM y escribe el mapa. No pisa un JSON existente.',
    inputSchema: { type: 'object', properties: {} },
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
