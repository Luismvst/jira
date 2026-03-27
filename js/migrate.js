/** @typedef {import('./dataService.js').ProjectDb} ProjectDb */
import { STATUS, DEFAULT_STATUS, STATUS_ORDER, isBoardVisibleLevel, DEFAULT_EPIC_COLORS } from "./constants.js";
import { migrateLegacyTestPlansIntoRuns } from "./testPlans.js";

/** Mapa desde valores legacy (español / mezcla / v2) a STATUS v3 */
const LEGACY_STATUS_MAP = {
  backlog: STATUS.BACKLOG,
  Backlog: STATUS.BACKLOG,
  BACKLOG: STATUS.BACKLOG,
  lista: STATUS.PENDING,
  Lista: STATUS.PENDING,
  READY: STATUS.PENDING,
  Ready: STATUS.PENDING,
  PENDING: STATUS.PENDING,
  Pendiente: STATUS.PENDING,
  "en progreso": STATUS.IN_PROGRESS,
  "En progreso": STATUS.IN_PROGRESS,
  IN_PROGRESS: STATUS.IN_PROGRESS,
  "en revisión": STATUS.CERTIFICATION,
  "En revisión": STATUS.CERTIFICATION,
  IN_REVIEW: STATUS.CERTIFICATION,
  CERTIFICATION: STATUS.CERTIFICATION,
  Certificación: STATUS.CERTIFICATION,
  bloqueada: STATUS.BLOCKED,
  Bloqueada: STATUS.BLOCKED,
  BLOCKED: STATUS.BLOCKED,
  completada: STATUS.DONE,
  Completada: STATUS.DONE,
  COMPLETED: STATUS.DONE,
  DONE: STATUS.DONE,
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
 * @param {import('./workItem.js').WorkItem} it
 */
export function migrateWorkItem(it) {
  it.status = migrateItemStatus(it.status);
  if (it.rlse === undefined) it.rlse = "";
  if (!Array.isArray(it.activityLog)) it.activityLog = [];
  if (!Array.isArray(it.comments)) it.comments = [];
  if (it.type === undefined || it.type === "") it.type = "task";
  if (it.status === STATUS.BLOCKED) {
    it.blocked = true;
  }
  if (it.blocked && it.status !== STATUS.DONE && it.status !== STATUS.BLOCKED) {
    it.status = STATUS.BLOCKED;
  }
}

/**
 * @param {ProjectDb} d
 */
export function migrateProjectDb(d) {
  const fromVersion = typeof d.version === "number" ? d.version : 1;

  for (const it of d.items) {
    migrateWorkItem(it);
    if (it.inTracking && !isBoardVisibleLevel(it.level)) {
      it.inTracking = false;
    }
  }

  migrateLegacyTestPlansIntoRuns(d);

  if (!d.catalogs.epicColors || typeof d.catalogs.epicColors !== "object") {
    d.catalogs.epicColors = { ...DEFAULT_EPIC_COLORS };
  }

  d.version = Math.max(d.version || 1, 4);
}
