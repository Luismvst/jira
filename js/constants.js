/** @typedef {'EPIC'|'TOPIC'|'TASK'|'SUBTASK'} Level */

/** Estados normalizados (inglés, mayúsculas) */
export const STATUS = {
  BACKLOG: "BACKLOG",
  READY: "READY",
  IN_PROGRESS: "IN_PROGRESS",
  IN_REVIEW: "IN_REVIEW",
  BLOCKED: "BLOCKED",
  COMPLETED: "COMPLETED",
};

/** @type {string[]} */
export const STATUS_ORDER = [
  STATUS.BACKLOG,
  STATUS.READY,
  STATUS.IN_PROGRESS,
  STATUS.IN_REVIEW,
  STATUS.BLOCKED,
  STATUS.COMPLETED,
];

/** Etiquetas UI (español) */
export const STATUS_LABEL = {
  [STATUS.BACKLOG]: "Backlog",
  [STATUS.READY]: "Lista",
  [STATUS.IN_PROGRESS]: "En progreso",
  [STATUS.IN_REVIEW]: "En revisión",
  [STATUS.BLOCKED]: "Bloqueada",
  [STATUS.COMPLETED]: "Completada",
};

export const STATUS_COMPLETED = STATUS.COMPLETED;
export const DEFAULT_STATUS = STATUS.BACKLOG;

/** @type {Record<string, string>} */
export const LEVEL_PREFIX = {
  EPIC: "EP",
  TOPIC: "TP",
  TASK: "TK",
  SUBTASK: "ST",
};

export const TRACKING_CLEANUP_DAYS = 30;

/**
 * @param {string} code
 */
export function statusLabel(code) {
  return STATUS_LABEL[code] || code;
}
