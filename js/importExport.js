/**
 * @typedef {import('./workItem.js').WorkItem} WorkItem
 * @typedef {import('./dataService.js').ProjectDb} ProjectDb
 */
import { normalizeDb } from "./dataService.js";
import { createWorkItemFromForm } from "./workItem.js";

const CSV_HEADERS = [
  "level",
  "parentId",
  "epic",
  "topic",
  "task",
  "subtask",
  "title",
  "summary",
  "owner",
  "priority",
  "targetDate",
  "definitionOk",
  "releaseTarget",
  "notes",
];

/**
 * @param {ProjectDb} db
 * @returns {string}
 */
export function exportJsonString(db) {
  return JSON.stringify(db, null, 2);
}

/**
 * @param {ProjectDb} db
 * @returns {string}
 */
export function exportCsv(db) {
  const rows = [CSV_HEADERS.join(",")];
  for (const it of db.items) {
    const line = CSV_HEADERS.map((h) => csvEscape(/** @type {*} */ (it)[h])).join(",");
    rows.push(line);
  }
  return rows.join("\r\n");
}

/**
 * @param {unknown} v
 */
function csvEscape(v) {
  if (v == null) return '""';
  const s = String(v);
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Parse simple CSV (supports quoted fields)
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let i = 0;
  let inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(cur);
      cur = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  row.push(cur);
  if (row.some((x) => x.length > 0)) rows.push(row);
  return rows;
}

/**
 * @param {ProjectDb} db
 * @param {string} text
 * @returns {{ inserted: number, errors: { line: number, message: string }[] }}
 */
export function importCsvIntoDb(db, text) {
  const rows = parseCsv(text.trim());
  if (rows.length === 0) return { inserted: 0, errors: [{ line: 0, message: "CSV vacío" }] };

  const firstCell = (rows[0][0] || "").trim().toLowerCase();
  let headers = CSV_HEADERS.map((h) => h.toLowerCase());
  let dataRows = rows;
  let lineNum = 1;
  if (firstCell === "level") {
    headers = rows[0].map((h) => h.trim().toLowerCase());
    dataRows = rows.slice(1);
    lineNum = 2;
  }

  const col = (name) => {
    const i = headers.indexOf(name.toLowerCase());
    return i >= 0 ? i : -1;
  };

  const errors = [];
  let inserted = 0;

  for (const cells of dataRows) {
    if (cells.every((c) => !String(c).trim())) {
      lineNum++;
      continue;
    }
    const get = (name) => {
      const idx = col(name);
      if (idx < 0 || idx >= cells.length) return "";
      return String(cells[idx] ?? "").trim();
    };

    const level = get("level") || "TASK";
    const title = get("title");
    if (!title) {
      errors.push({ line: lineNum, message: "Falta title" });
      lineNum++;
      continue;
    }

    const raw = {
      level,
      parentId: get("parentid") || null,
      epic: get("epic"),
      topic: get("topic"),
      task: get("task"),
      subtask: get("subtask"),
      title,
      summary: get("summary"),
      owner: get("owner"),
      priority: get("priority"),
      targetDate: get("targetdate") || get("targetDate"),
      definitionOk: /^(1|true|sí|si|yes)$/i.test(get("definitionok") || get("definitionOk")),
      releaseTarget: get("releasetarget") || get("releaseTarget"),
      notes: get("notes"),
      status: "Backlog",
    };

    if (raw.parentId === "") raw.parentId = null;

    try {
      const item = createWorkItemFromForm(raw, db.items);
      db.items.push(item);
      inserted++;
    } catch (e) {
      errors.push({ line: lineNum, message: String(e) });
    }
    lineNum++;
  }

  return { inserted, errors };
}

/**
 * @param {ProjectDb} db
 * @param {string} filename
 */
export function exportXlsxSnapshot(db, filename = "project-snapshot.xlsx") {
  const w = /** @type {Window & { XLSX?: any }} */ (window);
  const XLSX = w.XLSX;
  if (!XLSX || !XLSX.utils) {
    throw new Error("SheetJS no cargado; no se puede exportar XLSX");
  }

  const headers = [
    "id",
    "parentId",
    "level",
    "title",
    "epic",
    "topic",
    "task",
    "subtask",
    "owner",
    "priority",
    "status",
    "inTracking",
    "definitionOk",
    "releaseTarget",
    "preVersion",
    "proVersion",
    "createdAt",
    "completedAt",
    "notes",
  ];

  const aoa = [headers];
  for (const it of db.items) {
    aoa.push(headers.map((h) => /** @type {*} */ (it)[h] ?? ""));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Backlog");
  XLSX.writeFile(wb, filename);
}

/**
 * @param {string} jsonText
 * @returns {ProjectDb}
 */
export function parseProjectJson(jsonText) {
  const data = JSON.parse(jsonText);
  return normalizeDb(data);
}
