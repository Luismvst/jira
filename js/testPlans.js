/**
 * @typedef {import('./dataService.js').ProjectDb} ProjectDb
 * @typedef {{
 *   id: string,
 *   taskId: string,
 *   name: string,
 *   outcome: string,
 *   executedAt: string,
 *   tester: string,
 *   environment: string,
 *   notes: string,
 *   rlse: string,
 * }} TestRun
 */

/**
 * Migra `testPlans` legacy (un documento por tarea) a `testRuns` (varias entradas por tarea).
 * Idempotente: si no hay planes legacy, no hace nada.
 * @param {ProjectDb} db
 */
export function migrateLegacyTestPlansIntoRuns(db) {
  if (!Array.isArray(db.testRuns)) db.testRuns = [];
  const legacy = db.testPlans;
  if (!Array.isArray(legacy) || legacy.length === 0) return;

  for (const tp of legacy) {
    db.testRuns.push(legacyTestPlanToRun(db, tp));
  }
  db.testPlans = [];
  for (const it of db.items) {
    if (it.testPlanId) delete it.testPlanId;
  }
}

/**
 * @param {ProjectDb} db
 * @returns {string}
 */
function nextTestRunId(db) {
  let max = 0;
  for (const r of db.testRuns || []) {
    const m = /^TRN-(\d+)$/.exec(r.id || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `TRN-${String(max + 1).padStart(4, "0")}`;
}

/**
 * @param {ProjectDb} db
 * @param {*} tp
 * @returns {TestRun}
 */
function legacyTestPlanToRun(db, tp) {
  const cs = String(tp.certificationStatus || "").toUpperCase();
  const st = String(tp.status || "").toUpperCase();
  /** @type {string} */
  let outcome = "PENDIENTE";
  if (st === "BORRADOR" || !st) outcome = "PENDIENTE";
  if (cs.includes("OK") || cs.includes("APROB") || cs === "OK") outcome = "OK";
  if (cs.includes("KO") || cs.includes("RECH") || cs.includes("FALL")) outcome = "KO";
  if (outcome === "PENDIENTE" && String(tp.actualResult || "").trim().length > 2) outcome = "OK";

  const bits = [
    tp.notes && String(tp.notes),
    tp.steps && `Pasos: ${tp.steps}`,
    tp.expectedResult && `Esperado: ${tp.expectedResult}`,
    tp.actualResult && `Real: ${tp.actualResult}`,
    tp.evidenceNotes && `Evidencias: ${tp.evidenceNotes}`,
  ].filter(Boolean);

  const id = String(tp.id || "").trim() || nextTestRunId(db);
  return {
    id,
    taskId: String(tp.taskId || ""),
    name: String(tp.title || "Registro de prueba").trim() || "Registro de prueba",
    outcome,
    executedAt: String(tp.executedAt || ""),
    tester: String(tp.tester || ""),
    environment: String(tp.environment || "PRE"),
    notes: bits.join("\n\n"),
    rlse: String(tp.rlse || ""),
  };
}

/**
 * @param {ProjectDb} db
 * @param {string} taskId
 * @returns {TestRun[]}
 */
export function listTestRunsForTask(db, taskId) {
  const q = String(taskId || "").trim();
  return (db.testRuns || [])
    .filter((r) => r.taskId === q)
    .sort((a, b) => {
      const da = String(b.executedAt || "").localeCompare(String(a.executedAt || ""));
      if (da !== 0) return da;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });
}

/**
 * @param {ProjectDb} db
 * @param {string} taskId
 * @returns {number}
 */
export function countTestRunsForTask(db, taskId) {
  return listTestRunsForTask(db, taskId).length;
}

/**
 * @param {ProjectDb} db
 * @param {string} runId
 * @returns {TestRun|null}
 */
export function findTestRunById(db, runId) {
  return (db.testRuns || []).find((r) => r.id === runId) || null;
}

/**
 * @param {ProjectDb} db
 * @param {string} taskId
 * @param {Partial<TestRun>} fields
 * @returns {string} id creado
 */
export function addTestRun(db, taskId, fields) {
  if (!db.testRuns) db.testRuns = [];
  const id = nextTestRunId(db);
  const it = db.items.find((i) => i.id === taskId);
  const rlse = String(fields.rlse ?? it?.rlse ?? "").trim();
  db.testRuns.push({
    id,
    taskId: String(taskId || ""),
    name: String(fields.name || "Prueba").trim() || "Prueba",
    outcome: String(fields.outcome || "PENDIENTE").trim() || "PENDIENTE",
    executedAt: String(fields.executedAt || "").trim(),
    tester: String(fields.tester ?? it?.owner ?? "").trim(),
    environment: String(fields.environment || "PRE").trim(),
    notes: String(fields.notes || "").trim(),
    rlse,
  });
  return id;
}

/**
 * @param {ProjectDb} db
 * @param {string} runId
 * @param {Partial<TestRun>} patch
 * @returns {boolean}
 */
export function updateTestRun(db, runId, patch) {
  const r = findTestRunById(db, runId);
  if (!r) return false;
  if (patch.name != null) r.name = String(patch.name).trim() || r.name;
  if (patch.outcome != null) r.outcome = String(patch.outcome).trim();
  if (patch.executedAt != null) r.executedAt = String(patch.executedAt).trim();
  if (patch.tester != null) r.tester = String(patch.tester).trim();
  if (patch.environment != null) r.environment = String(patch.environment).trim();
  if (patch.notes != null) r.notes = String(patch.notes).trim();
  if (patch.rlse != null) r.rlse = String(patch.rlse).trim();
  return true;
}

/**
 * @param {ProjectDb} db
 * @param {string} runId
 * @returns {boolean}
 */
export function deleteTestRunById(db, runId) {
  const arr = db.testRuns || [];
  const idx = arr.findIndex((r) => r.id === runId);
  if (idx < 0) return false;
  arr.splice(idx, 1);
  return true;
}

/**
 * @param {ProjectDb} db
 * @param {string} rlse
 * @returns {TestRun[]}
 */
export function filterTestRunsByRlse(db, rlse) {
  const q = String(rlse || "").trim().toLowerCase();
  return (db.testRuns || []).filter((t) => {
    if (!q) return true;
    return String(t.rlse || "")
      .toLowerCase()
      .includes(q);
  });
}
