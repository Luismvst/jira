import {
  DEFAULT_STATUS,
  isBoardVisibleLevel,
  LEVEL_PREFIX,
  STATUS,
  STATUS_COMPLETED,
  TRACKING_CLEANUP_DAYS,
} from "./constants.js";
import { migrateItemStatus } from "./migrate.js";
import { addLogEntry } from "./activityLog.js";

/**
 * @typedef {Object} ActivityLogEntry
 * @property {string} ts ISO
 * @property {string} action
 * @property {string} [field]
 * @property {string} [from]
 * @property {string} [to]
 * @property {string} [user]
 * @property {string} [detail]
 */

/**
 * @typedef {Object} TaskComment
 * @property {string} id
 * @property {string} author
 * @property {string} text
 * @property {string} createdAt ISO
 */

/**
 * @typedef {Object} WorkItem
 * @property {string} id
 * @property {string|null} parentId
 * @property {string} level
 * @property {number} [order]
 * @property {string} title
 * @property {string} [summary]
 * @property {string} [epic]
 * @property {string} [topic]
 * @property {string} [task]
 * @property {string} [subtask]
 * @property {string} [owner]
 * @property {string} [priority]
 * @property {string} [status]
 * @property {boolean} [inTracking]
 * @property {boolean} [definitionOk]
 * @property {string} [releaseTarget]
 * @property {string} [rlse]
 * @property {string} [preVersion]
 * @property {string} [proVersion]
 * @property {string} [createdAt]
 * @property {string} [targetDate]
 * @property {string} [startDate]
 * @property {string} [completedAt]
 * @property {boolean} [blocked]
 * @property {string} [dependencies]
 * @property {string} [notes]
 * @property {string} [testPlanId]
 * @property {string} [type] task | bug | feature
 * @property {ActivityLogEntry[]} [activityLog]
 * @property {TaskComment[]} [comments]
 */

/**
 * Definición mínima razonable: título + (resumen con algo de texto o Def. OK).
 * @param {WorkItem} item
 * @returns {boolean}
 */
export function hasMinimalDefinition(item) {
  const titleTrim = String(item.title || "").trim();
  const titleOk = titleTrim.length >= 2;
  if (!titleOk) return false;
  if (item.definitionOk) return true;
  const sum = String(item.summary || "").trim();
  if (sum.length >= 8) return true;
  if (titleTrim.length >= 15) return true;
  return false;
}

/**
 * @param {WorkItem} item
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function validateForTracking(item) {
  const missing = [];
  if (!String(item.id || "").trim()) missing.push("ID");
  if (!String(item.level || "").trim()) missing.push("Nivel");
  if (!String(item.title || "").trim()) missing.push("Título");
  if (!String(item.owner || "").trim()) missing.push("Responsable");
  if (!hasMinimalDefinition(item))
    missing.push("Definición mínima (resumen ≥8 caracteres, Def. OK o título ≥15 caracteres)");
  if (isBlockedState(item)) missing.push("Desbloquear antes de seguimiento");
  if (isCompleted(item)) missing.push("Ya completada");
  return { ok: missing.length === 0, missing };
}

/**
 * @param {WorkItem[]} items
 * @param {string} level
 * @returns {string}
 */
export function generateId(items, level) {
  const prefix = `${LEVEL_PREFIX[level] || "ST"}-`;
  let max = 0;
  for (const it of items) {
    const raw = String(it.id || "").trim();
    if (raw.startsWith(prefix)) {
      const n = parseInt(raw.slice(prefix.length), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/**
 * @param {WorkItem} item
 * @returns {boolean}
 */
export function isCompleted(item) {
  const s = String(item.status || "").trim();
  return s === STATUS_COMPLETED || s === "Completada" || s === "COMPLETED";
}

/**
 * @param {WorkItem} item
 * @returns {boolean}
 */
export function isBlockedState(item) {
  return Boolean(item.blocked) || String(item.status || "").trim() === STATUS.BLOCKED;
}

/**
 * @param {WorkItem[]} items
 * @param {string} parentId
 * @returns {WorkItem[]}
 */
export function directChildren(items, parentId) {
  return items.filter((i) => i.parentId === parentId);
}

/**
 * @param {WorkItem[]} items
 * @param {string} id
 * @returns {WorkItem[]}
 */
export function getDescendantsDepthFirst(items, id) {
  const out = [];
  const walk = (pid) => {
    for (const ch of directChildren(items, pid)) {
      out.push(ch);
      walk(ch.id);
    }
  };
  walk(id);
  return out;
}

/**
 * @param {WorkItem[]} items
 * @param {string} rootId
 * @param {boolean} includeRoot
 * @returns {WorkItem[]}
 */
export function collectDescendantsForTracking(items, rootId, includeRoot) {
  const root = items.find((i) => i.id === rootId);
  if (!root) return [];
  const list = includeRoot ? [root] : [];
  list.push(...getDescendantsDepthFirst(items, rootId));
  return list;
}

/**
 * @param {WorkItem[]} items
 * @param {string} itemId
 * @param {boolean} includeDescendants
 * @returns {{ updated: number, errors: string[] }}
 */
export function sendToTracking(items, itemId, includeDescendants) {
  const errors = [];
  const root = items.find((i) => i.id === itemId);
  if (!root) return { updated: 0, errors: ["Ítem no encontrado"] };

  const toMark = includeDescendants
    ? collectDescendantsForTracking(items, itemId, true)
    : [root];

  let updated = 0;
  for (const it of toMark) {
    if (isCompleted(it)) continue;
    const v = validateForTracking(it);
    if (!v.ok) {
      errors.push(`${it.id}: falta ${v.missing.join(", ")}`);
      continue;
    }
    it.inTracking = true;
    if (it.status === STATUS.BACKLOG) {
      it.status = STATUS.PENDING;
    }
    addLogEntry(it, { action: "activated", detail: "En seguimiento / pizarra" });
    updated++;
  }
  return { updated, errors };
}

/**
 * Estados de pizarra que al quitar seguimiento vuelven a backlog.
 * @param {string} st
 */
function isBoardWorkflowStatus(st) {
  const s = String(st || "").trim();
  return (
    s === STATUS.PENDING ||
    s === STATUS.IN_PROGRESS ||
    s === STATUS.BLOCKED ||
    s === STATUS.CERTIFICATION
  );
}

/**
 * @param {WorkItem[]} items
 * @param {string} itemId
 * @returns {boolean}
 */
export function removeFromTracking(items, itemId) {
  const it = items.find((i) => i.id === itemId);
  if (!it) return false;
  it.inTracking = false;
  if (isBoardWorkflowStatus(it.status) && !isCompleted(it)) {
    it.status = STATUS.BACKLOG;
  }
  addLogEntry(it, { action: "deactivated", detail: "Quitada de pizarra / seguimiento" });
  return true;
}

/**
 * @param {WorkItem[]} items
 * @param {string} itemId
 * @returns {boolean}
 */
export function toggleBlocked(items, itemId) {
  const it = items.find((i) => i.id === itemId);
  if (!it || isCompleted(it)) return false;
  if (isBlockedState(it)) {
    it.blocked = false;
    if (it.status === STATUS.BLOCKED) it.status = STATUS.BACKLOG;
    addLogEntry(it, { action: "unblocked" });
  } else {
    it.blocked = true;
    it.status = STATUS.BLOCKED;
    it.inTracking = false;
    addLogEntry(it, { action: "blocked" });
  }
  return true;
}

/**
 * @param {WorkItem[]} items
 * @param {string} itemId
 * @returns {boolean}
 */
export function completeItem(items, itemId) {
  const it = items.find((i) => i.id === itemId);
  if (!it) return false;
  it.status = STATUS_COMPLETED;
  it.completedAt = new Date().toISOString().slice(0, 10);
  it.inTracking = true;
  it.blocked = false;
  addLogEntry(it, { action: "completed", to: STATUS_COMPLETED });
  return true;
}

/**
 * @param {WorkItem[]} items
 * @param {string} itemId
 * @returns {boolean}
 */
export function reopenItem(items, itemId) {
  const it = items.find((i) => i.id === itemId);
  if (!it || !isCompleted(it)) return false;
  it.status = STATUS.BACKLOG;
  it.completedAt = "";
  it.inTracking = false;
  addLogEntry(it, { action: "reopened", detail: "Reabierta desde Completada" });
  return true;
}

/**
 * @param {WorkItem[]} items
 * @param {number} [days]
 * @returns {number}
 */
export function cleanupOldTracking(items, days = TRACKING_CLEANUP_DAYS) {
  const now = new Date();
  let n = 0;
  for (const it of items) {
    if (!isCompleted(it) || !it.inTracking) continue;
    if (!it.completedAt) continue;
    const d = new Date(it.completedAt);
    if (Number.isNaN(d.getTime())) continue;
    const diff = (now - d) / 86400000;
    if (diff > days) {
      it.inTracking = false;
      n++;
    }
  }
  return n;
}

/**
 * @param {WorkItem[]} items
 * @returns {WorkItem[]}
 */
export function filterBacklog(items) {
  return items.filter((i) => !isCompleted(i));
}

/**
 * Tareas en seguimiento operativo (tabla legacy / KPI): no completadas.
 * @param {WorkItem[]} items
 * @returns {WorkItem[]}
 */
export function filterTracking(items) {
  return items.filter((i) => i.inTracking && !isCompleted(i));
}

/**
 * Ítems para la pizarra: TASK o TOPIC con inTracking (incluye DONE en board).
 * @param {WorkItem[]} items
 * @returns {WorkItem[]}
 */
export function filterBoardTasks(items) {
  return items.filter((i) => i.inTracking && isBoardVisibleLevel(i.level));
}

/**
 * @param {WorkItem[]} items
 * @returns {WorkItem[]}
 */
export function filterCompleted(items) {
  return items.filter((i) => isCompleted(i));
}

/**
 * @param {Partial<WorkItem>} raw
 * @param {WorkItem[]} existing
 * @returns {WorkItem}
 */
export function createWorkItemFromForm(raw, existing) {
  const level = raw.level || "TASK";
  const id = generateId(existing, level);
  const now = new Date().toISOString();
  let pid = raw.parentId;
  if (pid === "" || pid === undefined || pid === "null") pid = null;
  let st = migrateItemStatus(String(raw.status || DEFAULT_STATUS).trim() || DEFAULT_STATUS);
  const typ = String(raw.type || "task").trim() || "task";
  return {
    id,
    parentId: pid,
    level,
    order: Number(raw.order) || 0,
    title: String(raw.title || "").trim(),
    summary: String(raw.summary || "").trim(),
    epic: String(raw.epic || "").trim(),
    topic: String(raw.topic || "").trim(),
    task: String(raw.task || "").trim(),
    subtask: String(raw.subtask || "").trim(),
    owner: String(raw.owner || "").trim(),
    priority: String(raw.priority || "").trim(),
    status: st,
    type: typ,
    inTracking: false,
    definitionOk: Boolean(raw.definitionOk),
    releaseTarget: String(raw.releaseTarget || "").trim(),
    rlse: String(raw.rlse || "").trim(),
    preVersion: String(raw.preVersion || "").trim(),
    proVersion: String(raw.proVersion || "").trim(),
    createdAt: now,
    targetDate: String(raw.targetDate || "").trim(),
    startDate: String(raw.startDate || "").trim(),
    completedAt: "",
    blocked: Boolean(raw.blocked) || st === STATUS.BLOCKED,
    dependencies: String(raw.dependencies || "").trim(),
    notes: String(raw.notes || "").trim(),
    activityLog: [],
    comments: [],
  };
}

/**
 * Valida coherencia básica EPIC→TOPIC→TASK→SUBTASK.
 * @param {WorkItem} it
 * @param {WorkItem[]} all
 * @returns {{ ok: boolean, message?: string }}
 */
export function validateHierarchy(it, all) {
  if (!it.parentId) {
    if (it.level !== "EPIC") return { ok: false, message: "Solo EPIC sin padre" };
    return { ok: true };
  }
  const p = all.find((x) => x.id === it.parentId);
  if (!p) return { ok: false, message: "Parent no encontrado" };
  const order = ["EPIC", "TOPIC", "TASK", "SUBTASK"];
  const pi = order.indexOf(p.level);
  const ci = order.indexOf(it.level);
  if (ci !== pi + 1) return { ok: false, message: `Nivel ${it.level} debe colgarse de ${order[ci - 1] || "?"}` };
  return { ok: true };
}

export { STATUS_COMPLETED, DEFAULT_STATUS, TRACKING_CLEANUP_DAYS, STATUS };
