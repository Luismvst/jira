import {
  DEFAULT_STATUS,
  LEVEL_PREFIX,
  STATUS_COMPLETED,
  TRACKING_CLEANUP_DAYS,
} from "./constants.js";

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
 * @property {string} [preVersion]
 * @property {string} [proVersion]
 * @property {string} [createdAt]
 * @property {string} [targetDate]
 * @property {string} [startDate]
 * @property {string} [completedAt]
 * @property {boolean} [blocked]
 * @property {string} [dependencies]
 * @property {string} [notes]
 */

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
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function validateForTracking(item) {
  const missing = [];
  if (!String(item.id || "").trim()) missing.push("ID");
  if (!String(item.level || "").trim()) missing.push("Nivel");
  if (!String(item.epic || "").trim()) missing.push("Épica");
  if (!String(item.title || "").trim()) missing.push("Resumen/título");
  if (!String(item.owner || "").trim()) missing.push("Responsable");
  if (!String(item.priority || "").trim()) missing.push("Prioridad");
  if (!String(item.status || "").trim()) missing.push("Estado");
  if (!item.definitionOk) missing.push("Definición OK");
  return { ok: missing.length === 0, missing };
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
 * @param {WorkItem} item
 * @returns {boolean}
 */
export function isCompleted(item) {
  return String(item.status || "").trim() === STATUS_COMPLETED;
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
    updated++;
  }
  return { updated, errors };
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
  it.inTracking = false;
  return true;
}

/**
 * Quita seguimiento en completadas antiguas (> N días).
 * @param {WorkItem[]} items
 * @param {number} [days]
 * @returns {number} número de ítems ajustados
 */
export function cleanupOldTracking(items, days = TRACKING_CLEANUP_DAYS) {
  const now = new Date();
  let n = 0;
  for (const it of items) {
    if (!isCompleted(it) || !it.inTracking) continue;
    if (!it.completedAt) continue;
    const d = new Date(it.completedAt);
    if (Number.isNaN(d.getTime())) continue;
    const diff = (now - d) / (86400000);
    if (diff > days) {
      it.inTracking = false;
      n++;
    }
  }
  return n;
}

/**
 * Vista backlog: no completados (opcional: todos)
 * @param {WorkItem[]} items
 * @returns {WorkItem[]}
 */
export function filterBacklog(items) {
  return items.filter((i) => !isCompleted(i));
}

/**
 * @param {WorkItem[]} items
 * @returns {WorkItem[]}
 */
export function filterTracking(items) {
  return items.filter((i) => i.inTracking && !isCompleted(i));
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
    status: String(raw.status || DEFAULT_STATUS).trim() || DEFAULT_STATUS,
    inTracking: false,
    definitionOk: Boolean(raw.definitionOk),
    releaseTarget: String(raw.releaseTarget || "").trim(),
    preVersion: String(raw.preVersion || "").trim(),
    proVersion: String(raw.proVersion || "").trim(),
    createdAt: now,
    targetDate: String(raw.targetDate || "").trim(),
    startDate: String(raw.startDate || "").trim(),
    completedAt: "",
    blocked: Boolean(raw.blocked),
    dependencies: String(raw.dependencies || "").trim(),
    notes: String(raw.notes || "").trim(),
  };
}

export { STATUS_COMPLETED, DEFAULT_STATUS, TRACKING_CLEANUP_DAYS };
