/**
 * @typedef {import('./dataService.js').ProjectDb} ProjectDb
 * @typedef {import('./workItem.js').WorkItem} WorkItem
 */
import { BOARD_COLUMNS, STATUS, getOwnerColor, statusLabel } from "./constants.js";
import { addLogEntry } from "./activityLog.js";
import {
  completeItem,
  directChildren,
  filterBoardTasks,
  isCompleted,
} from "./workItem.js";
import { rowMatchesGlobalSearch } from "./filters.js";

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {WorkItem[]} items
 * @param {string} taskId
 */
function subtaskCount(items, taskId) {
  return directChildren(items, taskId).filter((c) => c.level === "SUBTASK").length;
}

/**
 * @param {WorkItem} it
 * @param {ProjectDb} db
 * @param {string} color
 */
function cardHtml(it, db, color) {
  const n = subtaskCount(db.items, it.id);
  const epic = String(it.epic || "").trim() || "—";
  const owner = String(it.owner || "").trim() || "Sin asignar";
  return `
    <div class="board-card" draggable="true" data-task-id="${escapeHtml(it.id)}" style="--owner-color:${color}">
      <div class="board-card-top">
        <span class="board-card-id">${escapeHtml(it.id)}</span>
        <span class="board-card-epic">${escapeHtml(epic)}</span>
      </div>
      <div class="board-card-title">${escapeHtml(it.title)}</div>
      <div class="board-card-foot">
        <span class="board-card-owner"><span class="owner-dot"></span>${escapeHtml(owner)}</span>
        <span class="board-card-subs" title="Subtareas">${n} sub</span>
      </div>
    </div>`;
}

/**
 * @param {{
 *   getDb: () => ProjectDb|null,
 *   onDataChange: () => void,
 *   toast: (msg: string) => void,
 *   openDetail: (id: string) => void,
 *   refreshAll?: () => void,
 * }} api
 */
export function mountBoard(api) {
  const { getDb, onDataChange, openDetail, refreshAll } = api;

  const root = document.getElementById("board-root");
  const filterText = /** @type {HTMLInputElement|null} */ (document.getElementById("filter-text-b"));
  const filterOwner = /** @type {HTMLSelectElement|null} */ (document.getElementById("filter-owner-b"));
  const filterEpic = /** @type {HTMLSelectElement|null} */ (document.getElementById("filter-epic-b"));
  const modeStatus = /** @type {HTMLInputElement|null} */ (document.getElementById("board-mode-status"));
  const modeAssignee = /** @type {HTMLInputElement|null} */ (document.getElementById("board-mode-assignee"));

  /** @type {string|null} */
  let dragId = null;

  function boardFilterState() {
    return {
      q: filterText?.value.trim() || "",
      owner: filterOwner?.value || "",
      epic: filterEpic?.value || "",
    };
  }

  /**
   * @param {WorkItem} it
   * @param {{ q: string, owner: string, epic: string }} f
   */
  function passesBoardFilters(it, f) {
    if (f.owner && it.owner !== f.owner) return false;
    if (f.epic && it.epic !== f.epic) return false;
    if (!rowMatchesGlobalSearch(it, f.q)) return false;
    return true;
  }

  /**
   * @param {WorkItem} it
   * @param {ProjectDb} db
   */
  function ownerColor(it, db) {
    const owners = db.catalogs?.owners || [];
    return getOwnerColor(it.owner || "", owners);
  }

  function renderBoard() {
    const db = getDb();
    if (!root || !db) return;
    const f = boardFilterState();
    let tasks = filterBoardTasks(db.items).filter((it) => passesBoardFilters(it, f));

    const byStatus = {};
    for (const st of BOARD_COLUMNS) byStatus[st] = [];
    for (const it of tasks) {
      const st = String(it.status || "").trim();
      if (byStatus[st]) byStatus[st].push(it);
      else {
        if (!byStatus[STATUS.PENDING]) continue;
        byStatus[STATUS.PENDING].push(it);
      }
    }

    const modeAssigneeOn = modeAssignee?.checked;

    if (!tasks.length) {
      root.innerHTML =
        '<p class="board-empty">No hay tareas activas en la pizarra. Activa tareas TASK desde la lista general.</p>';
      return;
    }

    if (!modeAssigneeOn) {
      const cols = BOARD_COLUMNS.map((st) => {
        const list = byStatus[st] || [];
        const cards = list
          .map((it) => cardHtml(it, db, ownerColor(it, db)))
          .join("");
        return `
          <div class="board-column" data-drop-status="${escapeHtml(st)}">
            <header class="board-col-head">${escapeHtml(statusLabel(st))} <span class="board-col-count">${list.length}</span></header>
            <div class="board-col-body">
              ${cards || '<p class="board-col-empty">Sin tareas</p>'}
            </div>
          </div>`;
      }).join("");
      root.innerHTML = `<div class="board-columns">${cols}</div>`;
    } else {
      const ownerKeys = Array.from(new Set(tasks.map((it) => String(it.owner || "").trim()))).sort(
        (a, b) => {
          if (!a && b) return 1;
          if (a && !b) return -1;
          return a.localeCompare(b);
        }
      );

      const laneRows = ownerKeys
        .map((ownerKey) => {
          const label = ownerKey || "Sin asignar";
          const arr = tasks.filter((it) => String(it.owner || "").trim() === ownerKey);
          const miniCols = BOARD_COLUMNS.map((st) => {
            const list = arr.filter((it) => String(it.status || "").trim() === st);
            const cards = list
              .map((it) => cardHtml(it, db, ownerColor(it, db)))
              .join("");
            return `
              <div class="board-column board-column-mini" data-drop-status="${escapeHtml(st)}" data-drop-owner="${escapeHtml(ownerKey)}">
                <header class="board-col-head board-col-head-sm">${escapeHtml(statusLabel(st))} <span class="board-col-count">${list.length}</span></header>
                <div class="board-col-body">
                  ${cards || '<p class="board-col-empty">—</p>'}
                </div>
              </div>`;
          }).join("");
          return `
            <div class="board-swimlane">
              <div class="board-swimlane-label">${escapeHtml(label)}</div>
              <div class="board-swimlane-cols">${miniCols}</div>
            </div>`;
        })
        .join("");
      root.innerHTML = `<div class="board-swimlanes">${laneRows}</div>`;
    }

    wireDnD();
    root.querySelectorAll(".board-card").forEach((el) => {
      el.addEventListener("dblclick", () => {
        const id = el.getAttribute("data-task-id");
        if (id) openDetail(id);
      });
    });
  }

  function wireDnD() {
    if (!root) return;
    root.querySelectorAll(".board-card").forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        const id = card.getAttribute("data-task-id");
        dragId = id;
        card.classList.add("dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", id || "");
        }
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
        dragId = null;
        root.querySelectorAll(".board-column.drag-over").forEach((c) => c.classList.remove("drag-over"));
      });
    });

    root.querySelectorAll(".board-column").forEach((col) => {
      col.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        col.classList.add("drag-over");
      });
      col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
      col.addEventListener("drop", (e) => {
        e.preventDefault();
        col.classList.remove("drag-over");
        const db = getDb();
        if (!db || !dragId) return;
        const it = db.items.find((i) => i.id === dragId);
        if (!it || it.level !== "TASK") return;
        const newStatus = col.getAttribute("data-drop-status");
        const newOwnerRaw = col.getAttribute("data-drop-owner");
        let changed = false;
        if (newStatus && newStatus !== String(it.status || "").trim()) {
          const old = String(it.status || "");
          if (newStatus === STATUS.DONE && !isCompleted(it)) {
            completeItem(db.items, it.id);
            changed = true;
          } else if (newStatus === STATUS.DONE && isCompleted(it)) {
            /* already done */
          } else {
            if (isCompleted(it)) {
              it.completedAt = "";
            }
            it.status = newStatus;
            it.blocked = newStatus === STATUS.BLOCKED;
            addLogEntry(it, { action: "status_changed", field: "status", from: old, to: newStatus });
            changed = true;
          }
        }
        if (modeAssignee?.checked && newOwnerRaw !== null) {
          const want = String(newOwnerRaw || "").trim();
          const cur = String(it.owner || "").trim();
          if (want !== cur) {
            const prev = it.owner;
            it.owner = want;
            addLogEntry(it, { action: "owner_changed", field: "owner", from: prev || "", to: want || "" });
            if (want && !db.catalogs.owners.includes(want)) db.catalogs.owners.push(want);
            changed = true;
          }
        }
        if (changed) {
          onDataChange();
          refreshAll?.();
        }
      });
    });
  }

  filterText?.addEventListener("input", () => renderBoard());
  filterOwner?.addEventListener("change", () => renderBoard());
  filterEpic?.addEventListener("change", () => renderBoard());
  modeStatus?.addEventListener("change", () => renderBoard());
  modeAssignee?.addEventListener("change", () => renderBoard());

  return { renderBoard };
}
