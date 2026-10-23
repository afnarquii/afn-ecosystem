/**
 * nota-flujo: este turno escribe la nota de la tarea. El producto no se edita.
 * El modelo llena el markdown y lo guarda con afn_note_save (flow: true).
 */

export const TASK_NOTE_FLOW_WORD = 'nota-flujo';

export const TASK_NOTE_SECTIONS = [
  'Veredicto',
  'Por qué',
  'Qué hay hoy',
  'Qué cambia',
  'Código propuesto',
  'Pruebas propuestas',
  'Qué no se toca',
];

function fold(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * El mensaje pide el contrato completo. La palabra gana aunque también diga «implementá».
 * @param {string} text
 */
export function isTaskNoteFlowAsk(text) {
  return new RegExp(`\\b${TASK_NOTE_FLOW_WORD}\\b`, 'i').test(fold(text));
}

/**
 * Segundo turno: pasar al repo lo que la nota ya dejó listo.
 * @param {string} text
 */
export function isTaskNoteImplementAsk(text) {
  if (isTaskNoteFlowAsk(text)) return false;
  const n = fold(text);
  if (/\bimplement\w*\b/.test(n) && /\bnota\b/.test(n)) return true;
  if (/\b(tira|pasar|pasa|ejecuta|aplica)\w*\b/.test(n) && /\bnota\b/.test(n) && /\b(codigo|cambio)\b/.test(n)) return true;
  return false;
}

/**
 * @param {string} markdown
 * @returns {string[]}
 */
export function missingTaskNoteSections(markdown) {
  const n = fold(markdown);
  return TASK_NOTE_SECTIONS.filter((title) => !n.includes(fold(`## ${title}`)));
}

/**
 * @param {string} markdown
 */
export function noteFollowsTaskContract(markdown) {
  return missingTaskNoteSections(markdown).length === 0;
}

/** Texto que ve el agente en las reglas y en la pista del prompt-gate. */
export function taskNoteFlowSteeringBullet() {
  const heads = TASK_NOTE_SECTIONS.map((t) => `\`## ${t}\``).join(', ');
  return [
    `- Si el mensaje trae la palabra **${TASK_NOTE_FLOW_WORD}**: este turno es solo la nota de la tarea. Leé el código que haga falta. Llamá **una** vez \`afn_note_save\` con \`flow: true\` y un markdown que tenga ${heads}.`,
    '  El código y las pruebas viven en esa nota. No edites archivos del producto, no corras tests, no abras el dashboard ni regeneres la arquitectura.',
    '  Otro mensaje («implementá la nota») hace el cambio en el repo, siguiendo lo que la nota dejó listo. Si el veredicto no deja construir, no construyas.',
  ].join('\n');
}
