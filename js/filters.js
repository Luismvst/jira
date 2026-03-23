/**
 * @typedef {import('./workItem.js').WorkItem} WorkItem
 */
import { statusLabel } from "./constants.js";
import { isBlockedState } from "./workItem.js";

/**
 * Búsqueda global sobre campos relevantes de la fila (case-insensitive).
 * @param {WorkItem} it
 * @param {string} q
 */
export function rowMatchesGlobalSearch(it, q) {
  if (!q || !String(q).trim()) return true;
  const t = String(q).trim().toLowerCase();
  const st = String(it.status || "").trim();
  const parts = [
    it.id,
    it.title,
    it.summary,
    it.epic,
    it.topic,
    it.task,
    it.subtask,
    it.owner,
    it.priority,
    st,
    statusLabel(st),
    it.notes,
    it.rlse,
    it.releaseTarget,
    it.preVersion,
    it.proVersion,
    it.dependencies,
    it.targetDate,
    it.startDate,
    it.completedAt,
    it.inTracking ? "seguimiento" : "",
    it.blocked ? "bloqueada" : "",
    it.definitionOk ? "definición" : "",
  ];
  const hay = parts.map((p) => String(p ?? "").toLowerCase()).join(" ");
  return hay.includes(t);
}

/**
 * Filtros de barra para la vista Seguimiento (combinables).
 * @param {WorkItem} it
 * @param {{
 *   owner?: string,
 *   epic?: string,
 *   status?: string,
 *   rlse?: string,
 *   blocked?: string,
 * }} f
 */
export function passesTrackingToolbarFilters(it, f) {
  if (f.owner && it.owner !== f.owner) return false;
  if (f.epic && it.epic !== f.epic) return false;
  if (f.status && String(it.status || "") !== f.status) return false;
  const rl = String(f.rlse || "").trim().toLowerCase();
  if (rl && !String(it.rlse || "").toLowerCase().includes(rl)) return false;
  if (f.blocked === "1" && !isBlockedState(it)) return false;
  if (f.blocked === "0" && isBlockedState(it)) return false;
  return true;
}
