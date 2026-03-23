/** @typedef {import('./dataService.js').ProjectDb} ProjectDb */
import { STATUS, DEFAULT_STATUS, STATUS_ORDER } from "./constants.js";

/** Mapa desde valores legacy (español / mezcla) a STATUS */
const LEGACY_STATUS_MAP = {
  backlog: STATUS.BACKLOG,
  Backlog: STATUS.BACKLOG,
  BACKLOG: STATUS.BACKLOG,
  lista: STATUS.READY,
  Lista: STATUS.READY,
  READY: STATUS.READY,
  Ready: STATUS.READY,
  "en progreso": STATUS.IN_PROGRESS,
  "En progreso": STATUS.IN_PROGRESS,
  IN_PROGRESS: STATUS.IN_PROGRESS,
  "en revisión": STATUS.IN_REVIEW,
  "En revisión": STATUS.IN_REVIEW,
  IN_REVIEW: STATUS.IN_REVIEW,
  bloqueada: STATUS.BLOCKED,
  Bloqueada: STATUS.BLOCKED,
  BLOCKED: STATUS.BLOCKED,
  completada: STATUS.COMPLETED,
  Completada: STATUS.COMPLETED,
  COMPLETED: STATUS.COMPLETED,
};

/**
 * @param {string|undefined} raw
 * @returns {string}
 */
export function migrateItemStatus(raw) {
  if (raw == null || String(raw).trim() === "") return DEFAULT_STATUS;
  const s = String(raw).trim();
  if (LEGACY_STATUS_MAP[s] !== undefined) return LEGACY_STATUS_MAP[s];
  const lower = s.toLowerCase();
  if (LEGACY_STATUS_MAP[lower] !== undefined) return LEGACY_STATUS_MAP[lower];
  if (STATUS_ORDER.includes(s)) return s;
  return DEFAULT_STATUS;
}

/**
 * @param {WorkItem} it
 */
export function migrateWorkItem(it) {
  it.status = migrateItemStatus(it.status);
  if (it.rlse === undefined) it.rlse = "";
  if (it.status === STATUS.BLOCKED) {
    it.blocked = true;
  }
  if (it.blocked && it.status !== STATUS.COMPLETED && it.status !== STATUS.BLOCKED) {
    it.status = STATUS.BLOCKED;
  }
}

/**
 * @param {ProjectDb} d
 */
export function migrateProjectDb(d) {
  for (const it of d.items) {
    migrateWorkItem(it);
  }
  d.version = Math.max(d.version || 1, 2);
}
