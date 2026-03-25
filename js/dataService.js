/**
 * @typedef {import('./workItem.js').WorkItem} WorkItem
 * @typedef {{
 *   id: string,
 *   taskId: string,
 *   title: string,
 *   rlse: string,
 *   status: string,
 *   environment: string,
 *   steps: string,
 *   expectedResult: string,
 *   actualResult: string,
 *   evidenceNotes: string,
 *   tester: string,
 *   executedAt: string,
 *   certificationStatus: string,
 *   notes: string,
 * }} TestPlan
 * @typedef {{
 *   columnVisibility?: Record<string, boolean>,
 *   sortKey?: string|null,
 *   sortDir?: 'asc'|'desc',
 *   viewMode?: 'tree'|'flat',
 *   treeExpandedIds?: string[],
 * }} UiConfig
 * @typedef {{
 *   version: number,
 *   catalogs: {
 *     owners: string[],
 *     statuses: string[],
 *     priorities: string[],
 *     levels: string[],
 *     epics: string[],
 *   },
 *   items: WorkItem[],
 *   ui?: UiConfig,
 *   testPlans?: TestPlan[],
 *   meta?: { lastOpenedFileLabel?: string, lastSavedAt?: string },
 * }} ProjectDb
 */

import { migrateProjectDb } from "./migrate.js";
import { STATUS_ORDER } from "./constants.js";

/** @type {ProjectDb|null} */
let db = null;

/** @type {FileSystemFileHandle|null} */
let fileHandle = null;

/** @type {boolean} */
let dirty = false;

/** @returns {ProjectDb|null} */
export function getDb() {
  return db;
}

/** @param {ProjectDb} next */
export function setDb(next) {
  db = next;
}

export function hasFileHandle() {
  return fileHandle != null;
}

export function markDirty() {
  dirty = true;
}

export function clearDirty() {
  dirty = false;
}

export function isDirty() {
  return dirty;
}

/**
 * @returns {Promise<ProjectDb|null>}
 */
export async function tryLoadBundledSeed() {
  try {
    const url = new URL("../data/project-db.json", import.meta.url);
    const res = await fetch(url.href);
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeDb(data);
  } catch {
    return null;
  }
}

/**
 * @param {unknown} data
 * @returns {ProjectDb}
 */
export function normalizeDb(data) {
  if (!data || typeof data !== "object") {
    return emptyDb();
  }
  const d = /** @type {ProjectDb} */ (data);
  if (!d.catalogs) {
    d.catalogs = emptyDb().catalogs;
  }
  if (!Array.isArray(d.items)) d.items = [];
  if (!Array.isArray(d.testPlans)) d.testPlans = [];
  d.version = typeof d.version === "number" ? d.version : 1;
  if (!d.ui) {
    d.ui = {
      viewMode: "tree",
      sortKey: null,
      sortDir: "asc",
      treeExpandedIds: [],
      columnVisibility: {},
    };
  }
  if (!d.meta) d.meta = {};
  migrateProjectDb(d);
  d.catalogs.statuses = [...STATUS_ORDER];
  return d;
}

export function emptyDb() {
  return normalizeDb({
    version: 3,
    catalogs: {
      owners: [],
      statuses: [...STATUS_ORDER],
      priorities: ["Alta", "Media", "Baja"],
      levels: ["EPIC", "TOPIC", "TASK", "SUBTASK"],
      epics: [],
    },
    items: [],
    testPlans: [],
    ui: {
      viewMode: "tree",
      sortKey: null,
      sortDir: "asc",
      treeExpandedIds: [],
      columnVisibility: {},
    },
    meta: {},
  });
}

/**
 * @returns {Promise<ProjectDb|null>}
 */
export async function openDatabaseFile() {
  const w = /** @type {Window & { showOpenFilePicker?: Function }} */ (window);
  if (w.showOpenFilePicker) {
    const [handle] = await w.showOpenFilePicker({
      types: [
        {
          description: "JSON",
          accept: { "application/json": [".json"] },
        },
      ],
      excludeAcceptAllOption: false,
      multiple: false,
    });
    fileHandle = handle;
    const file = await handle.getFile();
    const text = await file.text();
    db = normalizeDb(JSON.parse(text));
    db.meta = db.meta || {};
    db.meta.lastOpenedFileLabel = file.name;
    clearDirty();
    db.meta.lastSavedAt = new Date().toISOString();
    return db;
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) {
        resolve(null);
        return;
      }
      try {
        const text = await f.text();
        db = normalizeDb(JSON.parse(text));
        fileHandle = null;
        db.meta = db.meta || {};
        db.meta.lastOpenedFileLabel = f.name;
        clearDirty();
        db.meta.lastSavedAt = new Date().toISOString();
        resolve(db);
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}

/**
 * @returns {Promise<void>}
 */
export async function saveDatabaseFile() {
  if (!db) throw new Error("No hay datos cargados");
  const text = JSON.stringify(db, null, 2);
  const blob = new Blob([text], { type: "application/json" });

  const w = /** @type {Window & { showSaveFilePicker?: Function }} */ (window);
  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    await writable.write(text);
    await writable.close();
    db.meta = db.meta || {};
    db.meta.lastSavedAt = new Date().toISOString();
    clearDirty();
    return;
  }

  if (w.showSaveFilePicker) {
    const handle = await w.showSaveFilePicker({
      suggestedName: db.meta?.lastOpenedFileLabel || "project-db.json",
      types: [
        {
          description: "JSON",
          accept: { "application/json": [".json"] },
        },
      ],
    });
    fileHandle = handle;
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    db.meta = db.meta || {};
    db.meta.lastOpenedFileLabel = handle.name || db.meta.lastOpenedFileLabel;
    db.meta.lastSavedAt = new Date().toISOString();
    clearDirty();
    return;
  }

  downloadBlob(blob, db.meta?.lastOpenedFileLabel || "project-db.json");
  db.meta = db.meta || {};
  db.meta.lastSavedAt = new Date().toISOString();
  clearDirty();
}

/**
 * @param {Blob} blob
 * @param {string} filename
 */
function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * @param {ProjectDb} data
 */
export function loadFromObject(data) {
  db = normalizeDb(data);
  fileHandle = null;
  markDirty();
}

export function clearFileHandle() {
  fileHandle = null;
}
