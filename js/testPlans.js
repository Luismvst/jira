/**
 * @typedef {import('./dataService.js').ProjectDb} ProjectDb
 * @typedef {import('./dataService.js').TestPlan} TestPlan
 */
import { STATUS } from "./constants.js";

/**
 * @param {ProjectDb} db
 * @returns {string}
 */
function nextTestPlanId(db) {
  let max = 0;
  for (const tp of db.testPlans || []) {
    const m = /^TPN-(\d+)$/.exec(tp.id || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `TPN-${String(max + 1).padStart(4, "0")}`;
}

/**
 * @param {ProjectDb} db
 * @param {string} taskId
 * @returns {TestPlan|null}
 */
export function findTestPlanByTaskId(db, taskId) {
  return (db.testPlans || []).find((t) => t.taskId === taskId) || null;
}

/**
 * Crea borrador de plan de pruebas para una tarea completada.
 * @param {ProjectDb} db
 * @param {string} taskId
 * @returns {TestPlan|null}
 */
export function ensureDraftTestPlan(db, taskId) {
  const it = db.items.find((i) => i.id === taskId);
  if (!it || String(it.status).trim() !== STATUS.COMPLETED) return null;
  const existing = findTestPlanByTaskId(db, taskId);
  if (existing) {
    if (!it.testPlanId) it.testPlanId = existing.id;
    return existing;
  }
  const tp = /** @type {TestPlan} */ ({
    id: nextTestPlanId(db),
    taskId,
    title: it.title || "",
    rlse: String(it.rlse || "").trim(),
    status: "BORRADOR",
    environment: "PRE",
    steps: "",
    expectedResult: "",
    actualResult: "",
    evidenceNotes: "",
    tester: it.owner || "",
    executedAt: "",
    certificationStatus: "PENDIENTE",
    notes: "",
  });
  if (!db.testPlans) db.testPlans = [];
  db.testPlans.push(tp);
  it.testPlanId = tp.id;
  return tp;
}

/**
 * Elimina un plan de pruebas y limpia la referencia en la tarea vinculada.
 * @param {ProjectDb} db
 * @param {string} planId
 * @returns {boolean}
 */
export function deleteTestPlanById(db, planId) {
  const plans = db.testPlans || [];
  const idx = plans.findIndex((p) => p.id === planId);
  if (idx < 0) return false;
  const tp = plans[idx];
  const task = db.items.find((i) => i.id === tp.taskId);
  if (task && task.testPlanId === planId) delete task.testPlanId;
  plans.splice(idx, 1);
  return true;
}

/**
 * @param {ProjectDb} db
 * @param {string} rlse
 */
export function filterTestPlansByRlse(db, rlse) {
  const q = String(rlse || "").trim().toLowerCase();
  return (db.testPlans || []).filter((t) => {
    if (!q) return true;
    return String(t.rlse || "")
      .toLowerCase()
      .includes(q);
  });
}
