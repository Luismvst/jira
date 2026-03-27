/** @typedef {'EPIC'|'TOPIC'|'TASK'|'SUBTASK'} Level */

/** Estados normalizados (inglés, mayúsculas) — workflow fijo; configurable vía WORKFLOW_CONFIG en el futuro */
export const STATUS = {
  BACKLOG: "BACKLOG",
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  CERTIFICATION: "CERTIFICATION",
  DONE: "DONE",
};

/** Orden global para selects y migraciones */
export const STATUS_ORDER = [
  STATUS.BACKLOG,
  STATUS.PENDING,
  STATUS.IN_PROGRESS,
  STATUS.BLOCKED,
  STATUS.CERTIFICATION,
  STATUS.DONE,
];

/** Columnas de la pizarra operativa (sin BACKLOG) */
export const BOARD_COLUMNS = [
  STATUS.PENDING,
  STATUS.IN_PROGRESS,
  STATUS.BLOCKED,
  STATUS.CERTIFICATION,
  STATUS.DONE,
];

/**
 * Definición de workflow para futura configuración desde settings.
 * @type {{ id: string, labelKey: string, board: boolean }[]}
 */
export const WORKFLOW_CONFIG = [
  { id: STATUS.BACKLOG, labelKey: "backlog", board: false },
  { id: STATUS.PENDING, labelKey: "pending", board: true },
  { id: STATUS.IN_PROGRESS, labelKey: "in_progress", board: true },
  { id: STATUS.BLOCKED, labelKey: "blocked", board: true },
  { id: STATUS.CERTIFICATION, labelKey: "certification", board: true },
  { id: STATUS.DONE, labelKey: "done", board: true },
];

/** Etiquetas UI (español) */
export const STATUS_LABEL = {
  [STATUS.BACKLOG]: "Backlog",
  [STATUS.PENDING]: "Pendiente",
  [STATUS.IN_PROGRESS]: "En progreso",
  [STATUS.BLOCKED]: "Bloqueada",
  [STATUS.CERTIFICATION]: "Certificación",
  [STATUS.DONE]: "Completada",
};

export const STATUS_COMPLETED = STATUS.DONE;
export const DEFAULT_STATUS = STATUS.BACKLOG;

/** Paleta determinista para responsables (índice en catalogs.owners) */
export const OWNER_COLORS = [
  "#0052cc",
  "#00875a",
  "#6554c0",
  "#ff5630",
  "#00a3bf",
  "#5243aa",
  "#ff8b00",
  "#006644",
  "#de350b",
  "#0747a6",
  "#36b37e",
  "#ffab00",
];

/**
 * @param {string} ownerName
 * @param {string[]} ownersCatalog
 * @returns {string} color hex
 */
export function getOwnerColor(ownerName, ownersCatalog) {
  const name = String(ownerName || "").trim();
  if (!name) return "#5e6c84";
  const idx = Math.max(0, ownersCatalog.indexOf(name));
  return OWNER_COLORS[idx % OWNER_COLORS.length];
}

/**
 * @param {string} code
 */
export function statusLabel(code) {
  return STATUS_LABEL[code] || code;
}

export const TRACKING_CLEANUP_DAYS = 30;

/** @type {Record<string, string>} */
export const LEVEL_PREFIX = {
  EPIC: "EP",
  TOPIC: "TP",
  TASK: "TK",
  SUBTASK: "ST",
};

/** Solo TASK ejecuta flujo Kanban en pizarra (con `inTracking`). */
export const BOARD_VISIBLE_LEVELS = new Set(["TASK"]);

/**
 * @param {string} [level]
 * @returns {boolean}
 */
export function isBoardVisibleLevel(level) {
  return BOARD_VISIBLE_LEVELS.has(String(level || "").trim());
}

/**
 * Único nivel que puede activarse para entrar en la pizarra.
 * @param {string} [level]
 * @returns {boolean}
 */
export function isKanbanActivatableLevel(level) {
  return String(level || "").trim() === "TASK";
}

/** Etiquetas UI para niveles (español) */
export const LEVEL_LABEL = {
  EPIC: "Épica",
  TOPIC: "Topic",
  TASK: "Tarea",
  SUBTASK: "Subtarea",
};

/** @param {string} [level] @returns {string} */
export function levelLabel(level) {
  return LEVEL_LABEL[String(level || "").trim()] || level || "";
}

/** EPIC / TOPIC — niveles de clasificación/agrupación, no operativos. @param {string} [level] @returns {boolean} */
export function isClassificationLevel(level) {
  const l = String(level || "").trim();
  return l === "EPIC" || l === "TOPIC";
}

/** @param {string} [level] @returns {boolean} */
export function isSubtaskLevel(level) {
  return String(level || "").trim() === "SUBTASK";
}

/** TASK y SUBTASK pueden completarse/bloquearse; EPIC/TOPIC no. @param {string} [level] @returns {boolean} */
export function canCompleteOrBlock(level) {
  const l = String(level || "").trim();
  return l === "TASK" || l === "SUBTASK";
}

/** Colores por defecto para épicas @type {Record<string, string>} */
export const DEFAULT_EPIC_COLORS = {
  Exportadores: "#0052cc",
  "Envíos": "#ff8b00",
  Ajustes: "#6554c0",
  "Ingestas externas": "#00a3bf",
  Queries: "#00b8d9",
  Fixes: "#ff5630",
  LMCore: "#00875a",
  Releases: "#ff69b4",
  Otros: "#8993a4",
};

/**
 * @param {string} epicName
 * @param {{ epicColors?: Record<string, string> }} [catalogs]
 * @returns {string}
 */
export function getEpicColor(epicName, catalogs) {
  const name = String(epicName || "").trim();
  if (!name) return "#8993a4";
  const colors = catalogs?.epicColors || {};
  return colors[name] || DEFAULT_EPIC_COLORS[name] || "#8993a4";
}
