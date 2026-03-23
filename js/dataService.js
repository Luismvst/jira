/**
 * @typedef {import('./workItem.js').WorkItem} WorkItem
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
 * }} ProjectDb
 */

/** @type {ProjectDb|null} */
let db = null;

/** @type {FileSystemFileHandle|null} */
let fileHandle = null;

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
  d.version = typeof d.version === "number" ? d.version : 1;
  return d;
}

export function emptyDb() {
  return {
    version: 1,
    catalogs: {
      owners: [],
      statuses: ["Backlog", "En progreso", "En revisión", "Bloqueada", "Completada"],
      priorities: ["Alta", "Media", "Baja"],
      levels: ["EPIC", "TOPIC", "TASK", "SUBTASK"],
      epics: [],
    },
    items: [],
  };
}

/**
 * File System Access API: open JSON file
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
    const data = JSON.parse(text);
    db = normalizeDb(data);
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
  if (fileHandle && w.showSaveFilePicker) {
    const writable = await fileHandle.createWritable();
    await writable.write(text);
    await writable.close();
    return;
  }

  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    await writable.write(text);
    await writable.close();
    return;
  }

  if (w.showSaveFilePicker) {
    const handle = await w.showSaveFilePicker({
      suggestedName: "project-db.json",
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
    return;
  }

  downloadBlob(blob, "project-db.json");
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
}

export function clearFileHandle() {
  fileHandle = null;
}
