/**
 * @typedef {import('./workItem.js').WorkItem} WorkItem
 * @typedef {import('./dataService.js').ProjectDb} ProjectDb
 */
import {
  completeItem,
  createWorkItemFromForm,
  directChildren,
  filterBacklog,
  filterCompleted,
  filterTracking,
  isBlockedState,
  isCompleted,
  removeFromTracking,
  reopenItem,
  sendToTracking,
  toggleBlocked,
  validateForTracking,
} from "./workItem.js";
import {
  STATUS,
  STATUS_COMPLETED,
  STATUS_ORDER,
  canCompleteOrBlock,
  getEpicColor,
  isClassificationLevel,
  isBoardVisibleLevel,
  isKanbanActivatableLevel,
  isSubtaskLevel,
  levelLabel,
  statusLabel,
} from "./constants.js";
import {
  addTestRun,
  countTestRunsForTask,
  deleteTestRunById,
  findTestRunById,
  listTestRunsForTask,
} from "./testPlans.js";
import { rowMatchesGlobalSearch } from "./filters.js";
import { addLogEntry, logFieldChange } from "./activityLog.js";
import { addComment } from "./comments.js";
import { mountBoard } from "./board.js";

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
 * @param {string|null} parentId
 */
function sortedChildren(items, parentId) {
  return items
    .filter((i) => i.parentId === parentId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * @param {WorkItem} it
 * @param {WorkItem[]} all
 */
function hasChildren(it, all) {
  return all.some((x) => x.parentId === it.id);
}

/**
 * @param {WorkItem} it
 */
function rowClass(it) {
  let c = `row-level-${String(it.level || "task").toLowerCase()}`;
  if (it.inTracking) c += " row-tracking";
  if (isCompleted(it)) c += " row-done";
  if (isBlockedState(it)) c += " row-blocked";
  return c;
}

/**
 * @param {WorkItem} it
 */
function statusBadge(it) {
  const label = statusLabel(String(it.status || ""));
  const extra = isBlockedState(it) ? ' <span class="badge badge-blocked">Bloq.</span>' : "";
  const cls = String(it.status || "")
    .toLowerCase()
    .replace(/_/g, "-");
  return `<span class="badge badge-status-${cls}">${escapeHtml(label)}</span>${extra}`;
}

/**
 * @param {object} api
 * @param {() => ProjectDb|null} api.getDb
 * @param {() => void} api.onDataChange
 * @param {(msg: string) => void} api.toast
 * @param {() => void} api.refreshToolbar
 */
export function mount(api) {
  const getDb = api.getDb;
  const toast = api.toast;
  const onDataChange = api.onDataChange;
  const refreshToolbar = api.refreshToolbar;

  /** @type {WorkItem|null} */
  let editingItem = null;
  /** @type {boolean} */
  let createMode = false;
  /** @type {boolean} */
  let delegationDone = false;

  const tbodyBacklog = /** @type {HTMLTableSectionElement} */ (
    document.getElementById("tbody-backlog")
  );
  const tbodyDone = /** @type {HTMLTableSectionElement} */ (document.getElementById("tbody-done"));
  const tbodyTestPlans = /** @type {HTMLTableSectionElement} */ (
    document.getElementById("tbody-testplans")
  );
  const panelKpis = document.getElementById("panel-kpis");
  const filterText = /** @type {HTMLInputElement} */ (document.getElementById("filter-text"));
  const filterOwner = /** @type {HTMLSelectElement} */ (document.getElementById("filter-owner"));
  const filterEpic = /** @type {HTMLSelectElement} */ (document.getElementById("filter-epic"));
  const filterTopic = /** @type {HTMLSelectElement} */ (document.getElementById("filter-topic"));
  const filterStatusBl = /** @type {HTMLSelectElement} */ (document.getElementById("filter-status-bl"));
  const filterPriorityBl = /** @type {HTMLSelectElement} */ (document.getElementById("filter-priority-bl"));
  const tableBacklog = document.getElementById("table-backlog");
  const filterTextD = /** @type {HTMLInputElement} */ (document.getElementById("filter-text-d"));
  const filterOwnerD = /** @type {HTMLSelectElement} */ (document.getElementById("filter-owner-d"));
  const filterEpicD = /** @type {HTMLSelectElement} */ (document.getElementById("filter-epic-d"));
  const filterTp = /** @type {HTMLInputElement} */ (document.getElementById("filter-text-tp"));
  const modalOverlay = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalClose = document.getElementById("modal-close");
  const modalSave = document.getElementById("modal-save");

  /** @type {() => void} */
  let renderBoardView = () => {};

  /**
   * @param {WorkItem} a
   * @param {WorkItem} b
   * @param {string} key
   * @param {'asc'|'desc'} dir
   */
  function compareBacklogSort(a, b, key, dir) {
    const mult = dir === "desc" ? -1 : 1;
    const av =
      key === "type"
        ? String(a.type || "task")
        : /** @type {*} */ (a)[key] != null
          ? String(/** @type {*} */ (a)[key])
          : "";
    const bv =
      key === "type"
        ? String(b.type || "task")
        : /** @type {*} */ (b)[key] != null
          ? String(/** @type {*} */ (b)[key])
          : "";
    return mult * av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
  }

  /**
   * @param {WorkItem[]} list
   * @param {ProjectDb} db
   */
  function sortBacklogFlat(list, db) {
    const key = db.ui?.sortKey || "id";
    const dir = db.ui?.sortDir === "desc" ? "desc" : "asc";
    list.sort((a, b) => compareBacklogSort(a, b, key, dir));
  }

  /**
   * @param {ProjectDb} db
   */
  function updateBacklogSortHeaders(db) {
    if (!tableBacklog) return;
    const sk = db.ui?.sortKey || "id";
    const sd = db.ui?.sortDir === "desc" ? "desc" : "asc";
    tableBacklog.querySelectorAll(".th-sort").forEach((btn) => {
      const k = btn.getAttribute("data-sort");
      btn.classList.toggle("th-sort-active", k === sk);
      btn.setAttribute("aria-sort", k === sk ? (sd === "asc" ? "ascending" : "descending") : "none");
    });
  }

  /**
   * @param {ProjectDb} db
   */
  function expandedSet(db) {
    const ids = db.ui?.treeExpandedIds;
    return new Set(Array.isArray(ids) ? ids : []);
  }

  /**
   * @param {ProjectDb} db
   * @param {string} id
   */
  function toggleExpanded(db, id) {
    if (!db.ui) db.ui = { treeExpandedIds: [] };
    if (!db.ui.treeExpandedIds) db.ui.treeExpandedIds = [];
    const arr = db.ui.treeExpandedIds;
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(id);
    onDataChange();
  }

  /**
   * @param {WorkItem} node
   */
  function typeLabel(node) {
    const t = String(node.type || "task").toLowerCase();
    if (t === "bug") return "Bug";
    if (t === "feature") return "Feat";
    return "Task";
  }

  /**
   * @param {WorkItem} node
   */
  function trackingCell(node) {
    if (!node.inTracking) return '<span class="badge badge-inactive" title="No en pizarra">—</span>';
    return '<span class="badge badge-tracking-on" title="En pizarra / seguimiento">●</span>';
  }

  function renderBacklog() {
    const db = getDb();
    if (!db || !tbodyBacklog) return;
    const items = db.items;
    const exp = expandedSet(db);
    const backlog = filterBacklog(items);
    const q = filterText?.value.trim() || "";
    const ow = filterOwner?.value || "";
    const ep = filterEpic?.value || "";
    const tp = filterTopic?.value || "";
    const stf = filterStatusBl?.value || "";
    const prf = filterPriorityBl?.value || "";

    const filtered = backlog.filter((it) => {
      if (ow && it.owner !== ow) return false;
      if (ep && it.epic !== ep) return false;
      if (tp && (it.topic || "") !== tp) return false;
      if (stf && String(it.status || "") !== stf) return false;
      if (prf && String(it.priority || "") !== prf) return false;
      if (!rowMatchesGlobalSearch(it, q)) return false;
      return true;
    });

    const hasFilter = Boolean(q || ow || ep || tp || stf || prf);
    const viewFlat = (db.ui?.viewMode || "flat") === "flat" || hasFilter;
    const rowsHtml = [];

    const rowActions = (node) => {
      const parts = [];
      if (isKanbanActivatableLevel(node.level)) {
        if (node.inTracking) {
          parts.push(`<button type="button" class="btn btn-sm btn-deactivate" data-action="untrack" data-id="${escapeHtml(node.id)}" title="Quitar de la pizarra">Desactivar</button>`);
        } else if (!isCompleted(node)) {
          parts.push(`<button type="button" class="btn btn-sm btn-activate" data-action="track" data-id="${escapeHtml(node.id)}">Activar</button>`);
        }
      }
      if (canCompleteOrBlock(node.level) && !isCompleted(node)) {
        parts.push(`<button type="button" class="btn btn-sm" data-action="done" data-id="${escapeHtml(node.id)}" title="Completar">✓</button>`);
        parts.push(`<button type="button" class="btn btn-sm" data-action="block" data-id="${escapeHtml(node.id)}" title="Bloquear / desbloquear">Bloq.</button>`);
      }
      parts.push(`<button type="button" class="btn btn-sm" data-action="edit" data-id="${escapeHtml(node.id)}">Editar</button>`);
      return `<div class="cell-actions">${parts.join("")}</div>`;
    };

    const rowCells = (node, pad, toggle) => {
      const epicColor = getEpicColor(node.epic, db.catalogs);
      const lvl = String(node.level || "").toLowerCase();
      const notesHint = String(node.notes || "").trim() ? `<span class="cell-notes-dot" title="${escapeHtml(node.notes)}">📝</span>` : "";
      return `<tr class="${rowClass(node)}" data-id="${escapeHtml(node.id)}">
        <td style="padding-left:${pad}px">${toggle}</td>
        <td><button type="button" class="btn btn-ghost link-open" data-open="${escapeHtml(node.id)}">${escapeHtml(node.id)}</button></td>
        <td><span class="badge badge-level-${lvl}">${escapeHtml(levelLabel(node.level))}</span></td>
        <td><span class="epic-chip" style="--epic-color:${epicColor}">${escapeHtml(node.epic)}</span></td>
        <td>${escapeHtml(node.topic || "")}</td>
        <td class="cell-title">${escapeHtml(node.title)}${notesHint}</td>
        <td>${escapeHtml(node.owner)}</td>
        <td>${escapeHtml(node.priority)}</td>
        <td>${statusBadge(node)}</td>
        <td>${escapeHtml(node.targetDate || "")}</td>
        <td class="cell-tracking">${trackingCell(node)}</td>
        <td>${rowActions(node)}</td>
      </tr>`;
    };

    if (viewFlat) {
      const flat = [...filtered];
      sortBacklogFlat(flat, db);
      for (const node of flat) {
        rowsHtml.push(rowCells(node, 0, '<span class="tree-toggle"></span>'));
      }
      tbodyBacklog.innerHTML = rowsHtml.join("") || '<tr><td colspan="12">Sin resultados</td></tr>';
      updateBacklogSortHeaders(db);
      updateViewModeButtons(db);
      return;
    }

    const roots = sortedChildren(filtered, null);
    sortBacklogFlat(roots, db);

    function walk(node, depth) {
      const kids = sortedChildren(filtered, node.id);
      const isExp = exp.has(node.id);
      const hc = hasChildren(node, filtered);
      const pad = depth * 18;
      let toggle = "";
      if (hc) {
        toggle = `<button type="button" class="tree-toggle" data-toggle="${escapeHtml(node.id)}" aria-expanded="${isExp}">${isExp ? "▼" : "▶"}</button>`;
      } else {
        toggle = '<span class="tree-toggle"></span>';
      }

      rowsHtml.push(rowCells(node, pad, toggle));

      if (hc && isExp) {
        const chSorted = [...kids];
        sortBacklogFlat(chSorted, db);
        for (const ch of chSorted) walk(ch, depth + 1);
      }
    }

    for (const r of roots) walk(r, 0);

    tbodyBacklog.innerHTML = rowsHtml.join("") || '<tr><td colspan="12">Sin datos</td></tr>';
    updateBacklogSortHeaders(db);
    updateViewModeButtons(db);
  }

  const btnViewFlat = document.getElementById("btn-view-flat");
  const btnViewTree = document.getElementById("btn-view-tree");

  /**
   * @param {ProjectDb} db
   */
  function updateViewModeButtons(db) {
    const flat = (db.ui?.viewMode || "flat") === "flat";
    btnViewFlat?.classList.toggle("btn-active", flat);
    btnViewTree?.classList.toggle("btn-active", !flat);
  }

  btnViewFlat?.addEventListener("click", () => {
    const d = getDb();
    if (!d) return;
    if (!d.ui) d.ui = {};
    d.ui.viewMode = "flat";
    onDataChange();
    renderBacklog();
  });
  btnViewTree?.addEventListener("click", () => {
    const d = getDb();
    if (!d) return;
    if (!d.ui) d.ui = {};
    d.ui.viewMode = "tree";
    onDataChange();
    renderBacklog();
  });

  function addSubtaskQuick(parentId) {
    const db = getDb();
    if (!db) return;
    const parent = db.items.find((i) => i.id === parentId);
    if (!parent) return;
    const title = window.prompt("Título de la subtarea");
    if (!title || !String(title).trim()) return;
    const item = createWorkItemFromForm(
      /** @type {*} */ ({
        level: "SUBTASK",
        parentId,
        title: title.trim(),
        epic: parent.epic,
        topic: parent.topic || "",
        task: parent.task || "",
        owner: parent.owner,
        priority: parent.priority || "Media",
        status: STATUS.BACKLOG,
        summary: "",
        definitionOk: false,
        type: parent.type || "task",
      }),
      db.items
    );
    db.items.push(item);
    addLogEntry(parent, { action: "subtask_added", detail: item.id });
    onDataChange();
    openDetail(parentId);
    toast(`Subtarea ${item.id} creada.`);
  }

  function setupTableDelegation() {
    if (delegationDone) return;
    delegationDone = true;

    tbodyBacklog?.addEventListener("click", (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      const db = getDb();
      if (!db) return;
      const toggleBtn = t.closest("[data-toggle]");
      if (toggleBtn) {
        const id = toggleBtn.getAttribute("data-toggle");
        if (id) toggleExpanded(db, id);
        renderAll();
        return;
      }
      const openBtn = t.closest("[data-open]");
      if (openBtn) {
        openDetail(openBtn.getAttribute("data-open"));
        return;
      }
      const actBtn = t.closest("[data-action]");
      if (actBtn) {
        const id = actBtn.getAttribute("data-id");
        const action = actBtn.getAttribute("data-action");
        if (!id || !action) return;
        if (action === "track") doSendTracking(id);
        if (action === "untrack") doUntrack(id);
        if (action === "done") doComplete(id);
        if (action === "block") doToggleBlock(id);
        if (action === "edit") openDetail(id);
      }
    });

    tableBacklog?.addEventListener("click", (e) => {
      const btn = /** @type {HTMLElement} */ (e.target).closest(".th-sort");
      if (!btn) return;
      const key = btn.getAttribute("data-sort");
      const db = getDb();
      if (!db || !key) return;
      if (!db.ui) db.ui = {};
      if (db.ui.sortKey === key) {
        db.ui.sortDir = db.ui.sortDir === "desc" ? "asc" : "desc";
      } else {
        db.ui.sortKey = key;
        db.ui.sortDir = "asc";
      }
      onDataChange();
      renderBacklog();
    });

    tbodyDone?.addEventListener("click", (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      const openBtn = t.closest("[data-open]");
      if (openBtn) {
        openDetail(openBtn.getAttribute("data-open"));
        return;
      }
      const actBtn = t.closest("[data-action]");
      if (!actBtn) return;
      const id = actBtn.getAttribute("data-id");
      const action = actBtn.getAttribute("data-action");
      if (!id) return;
      if (action === "reopen") doReopen(id);
      if (action === "edit") openDetail(id);
      if (action === "testplan") openTestRunsForTask(id);
    });

    tbodyTestPlans?.addEventListener("click", (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      const delBtn = t.closest("[data-delete-tr]");
      if (delBtn) {
        const rid = delBtn.getAttribute("data-delete-tr");
        if (rid) doDeleteTestRun(rid);
        return;
      }
      const openBtn = t.closest("[data-open-tr]");
      if (openBtn) {
        openSingleTestRunModal(openBtn.getAttribute("data-open-tr"));
      }
    });

    modalBody?.addEventListener("click", (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      const openTrInModal = t.closest("[data-open-tr]");
      if (openTrInModal && modalBody?.contains(openTrInModal)) {
        const rid = openTrInModal.getAttribute("data-open-tr");
        if (rid) openSingleTestRunModal(rid);
        return;
      }
      const openRuns = t.closest("[data-open-test-runs]");
      if (openRuns) {
        const tid = openRuns.getAttribute("data-open-test-runs");
        if (tid) openTestRunsForTask(tid);
        return;
      }
      const addRunBtn = t.closest("[data-add-test-run]");
      if (addRunBtn) {
        const panel = t.closest(".test-runs-panel");
        const tid = panel?.getAttribute("data-task-id");
        const db = getDb();
        if (!tid || !db || !modalBody) return;
        const nameEl = modalBody.querySelector("[data-tr-name]");
        const outEl = modalBody.querySelector("[data-tr-outcome]");
        const dateEl = modalBody.querySelector("[data-tr-date]");
        const testerEl = modalBody.querySelector("[data-tr-tester]");
        const envEl = modalBody.querySelector("[data-tr-env]");
        const notesEl = modalBody.querySelector("[data-tr-notes]");
        const name = nameEl instanceof HTMLInputElement ? nameEl.value.trim() : "";
        if (!name) {
          toast("Indica un nombre o título para la prueba.");
          return;
        }
        addTestRun(db, tid, {
          name,
          outcome: outEl instanceof HTMLSelectElement ? outEl.value : "PENDIENTE",
          executedAt: dateEl instanceof HTMLInputElement ? dateEl.value : "",
          tester: testerEl instanceof HTMLInputElement ? testerEl.value : "",
          environment: envEl instanceof HTMLSelectElement ? envEl.value : "PRE",
          notes: notesEl instanceof HTMLTextAreaElement ? notesEl.value : "",
        });
        onDataChange();
        modalBody.innerHTML = buildTestRunsPanel(db, tid);
        renderAll();
        toast("Prueba registrada.");
        return;
      }
      const delBtn = t.closest("[data-delete-tr]");
      if (delBtn) {
        const rid = delBtn.getAttribute("data-delete-tr");
        if (rid) doDeleteTestRun(rid);
        return;
      }
      const delBtnLegacy = t.closest("[data-delete-tp]");
      if (delBtnLegacy) {
        const rid = delBtnLegacy.getAttribute("data-delete-tp");
        if (rid) doDeleteTestRun(rid);
        return;
      }
      const openL = t.closest("[data-open]");
      if (openL && modalBody?.contains(openL)) {
        const oid = openL.getAttribute("data-open");
        if (oid) {
          openDetail(oid);
          return;
        }
      }
      const tabBtn = t.closest("[data-modal-tab]");
      if (tabBtn && modalBody) {
        const name = tabBtn.getAttribute("data-modal-tab");
        modalBody.querySelectorAll(".modal-tab-panel").forEach((p) => {
          p.classList.toggle("hidden", p.getAttribute("data-panel") !== name);
        });
        modalBody.querySelectorAll(".modal-tab-btn").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-modal-tab") === name);
        });
        return;
      }
      const addSub = t.closest("[data-add-subtask]");
      if (addSub) {
        const pid = addSub.getAttribute("data-add-subtask");
        if (pid) addSubtaskQuick(pid);
        return;
      }
      const addCom = t.closest("[data-add-comment]");
      if (addCom) {
        const id = addCom.getAttribute("data-add-comment");
        const db = getDb();
        const textEl = modalBody?.querySelector("[data-comment-text]");
        const authEl = modalBody?.querySelector("[data-comment-author]");
        const text = textEl instanceof HTMLTextAreaElement ? textEl.value : "";
        const author = authEl instanceof HTMLInputElement ? authEl.value : "";
        const item = id && db ? db.items.find((x) => x.id === id) : null;
        if (item && addComment(item, { author, text })) {
          onDataChange();
          openDetail(id);
          toast("Comentario añadido.");
        } else {
          toast("Comentario vacío o error.");
        }
      }
    });
  }

  function restoreDefaultModalFooter() {
    if (modalSave) {
      modalSave.textContent = "Guardar";
      modalSave.onclick = () => saveModal();
    }
  }

  /**
   * @param {string} runId
   */
  function doDeleteTestRun(runId) {
    const db = getDb();
    if (!db) return;
    if (!confirm("¿Eliminar este registro de prueba?")) return;
    const r = findTestRunById(db, runId);
    if (!deleteTestRunById(db, runId)) {
      toast("No se encontró el registro.");
      return;
    }
    onDataChange();
    renderAll();
    toast("Registro eliminado.");
    if (modalOverlay && !modalOverlay.classList.contains("hidden") && r?.taskId) {
      const panel = modalBody?.querySelector(".test-runs-panel");
      if (panel && panel.getAttribute("data-task-id") === r.taskId) {
        if (modalBody) modalBody.innerHTML = buildTestRunsPanel(db, r.taskId);
      } else if (modalBody?.querySelector("[data-tr-edit-id]")) {
        closeModal();
      }
    }
  }

  /**
   * @param {ProjectDb} db
   * @param {string} taskId
   */
  function buildTestRunsPanel(db, taskId) {
    const task = db.items.find((i) => i.id === taskId);
    const runs = listTestRunsForTask(db, taskId);
    const rows = runs
      .map(
        (r) => `<li class="test-run-row">
        <button type="button" class="btn btn-ghost btn-sm" data-open-tr="${escapeHtml(r.id)}">${escapeHtml(r.name)}</button>
        <span class="test-run-meta">${escapeHtml(r.outcome)} · ${escapeHtml((r.executedAt || "").slice(0, 10) || "—")}</span>
        <button type="button" class="btn btn-sm btn-ghost" data-delete-tr="${escapeHtml(r.id)}">Eliminar</button>
      </li>`
      )
      .join("");
    const opts = ["PENDIENTE", "OK", "KO", "N/A"].map(
      (o) => `<option value="${o}">${o}</option>`
    ).join("");
    return `<div class="test-runs-panel" data-task-id="${escapeHtml(taskId)}">
      <p class="hint">${task ? escapeHtml(task.id + " — " + task.title) : ""}</p>
      <ul class="test-run-list">${rows || "<li class='hint'>Sin pruebas registradas aún.</li>"}</ul>
      <div class="test-run-add card">
        <h4 class="test-run-add-title">Añadir prueba</h4>
        <div class="form-grid form-grid-tight">
          <label>Nombre</label><input data-tr-name type="text" placeholder="Ej. Login, regresión checkout…" />
          <label>Resultado</label><select data-tr-outcome>${opts}</select>
          <label>Fecha</label><input data-tr-date type="date" />
          <label>Tester</label><input data-tr-tester type="text" value="${escapeHtml(task?.owner || "")}" />
          <label>Entorno</label><select data-tr-env>${["PRE", "PRO", "DEV"].map((env) => `<option value="${env}">${env}</option>`).join("")}</select>
          <label>Notas</label><textarea data-tr-notes rows="2" placeholder="Opcional"></textarea>
        </div>
        <button type="button" class="btn btn-primary btn-sm" data-add-test-run>Registrar prueba</button>
      </div>
    </div>`;
  }

  function openTestRunsForTask(taskId) {
    const db = getDb();
    if (!db) return;
    const task = db.items.find((i) => i.id === taskId);
    if (!task || !isCompleted(task)) {
      toast("Las pruebas se registran sobre tareas completadas.");
      return;
    }
    createMode = false;
    editingItem = null;
    modalTitle.textContent = `Pruebas — ${taskId}`;
    modalBody.innerHTML = buildTestRunsPanel(db, taskId);
    modalOverlay?.classList.remove("hidden");
    if (modalSave) {
      modalSave.textContent = "Cerrar";
      modalSave.onclick = () => {
        closeModal();
      };
    }
  }

  /**
   * @param {string|null} runId
   */
  function openSingleTestRunModal(runId) {
    const db = getDb();
    if (!db || !runId) return;
    const r = findTestRunById(db, runId);
    if (!r) return;
    createMode = false;
    editingItem = null;
    modalTitle.textContent = `Prueba ${r.id}`;
    modalBody.innerHTML = buildSingleTestRunForm(r);
    modalOverlay?.classList.remove("hidden");
    if (modalSave) {
      modalSave.textContent = "Guardar";
      modalSave.onclick = () => saveSingleTestRunModal(r.id);
    }
  }

  /**
   * @param {import('./dataService.js').TestRun} r
   */
  function buildSingleTestRunForm(r) {
    const opts = ["PENDIENTE", "OK", "KO", "N/A"].map(
      (o) => `<option value="${o}" ${r.outcome === o ? "selected" : ""}>${o}</option>`
    ).join("");
    return `
      <input type="hidden" data-tr-edit-id value="${escapeHtml(r.id)}" />
      <div class="form-grid">
        <label>ID</label><input value="${escapeHtml(r.id)}" readonly />
        <label>Task</label><input value="${escapeHtml(r.taskId)}" readonly />
        <label>Nombre</label><input data-tr-field="name" value="${escapeHtml(r.name)}" />
        <label>Resultado</label><select data-tr-field="outcome">${opts}</select>
        <label>Fecha</label><input data-tr-field="executedAt" type="date" value="${escapeHtml((r.executedAt || "").slice(0, 10))}" />
        <label>Tester</label><input data-tr-field="tester" value="${escapeHtml(r.tester)}" />
        <label>Entorno</label><select data-tr-field="environment">${["PRE", "PRO", "DEV"].map((env) => `<option value="${env}" ${r.environment === env ? "selected" : ""}>${env}</option>`).join("")}</select>
        <label>RLSE</label><input data-tr-field="rlse" value="${escapeHtml(r.rlse)}" />
        <label>Notas</label><textarea data-tr-field="notes" rows="4">${escapeHtml(r.notes)}</textarea>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-sm" data-delete-tr="${escapeHtml(r.id)}">Eliminar</button>
      </div>`;
  }

  function saveSingleTestRunModal(runId) {
    const db = getDb();
    if (!db) return;
    const r = findTestRunById(db, runId);
    if (!r) return;
    modalBody?.querySelectorAll("[data-tr-field]").forEach((el) => {
      const field = el.getAttribute("data-tr-field");
      if (!field) return;
      /** @type {*} */ (r)[field] = /** @type {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} */ (el).value;
    });
    r.name = String(r.name || "").trim() || r.name;
    const task = db.items.find((i) => i.id === r.taskId);
    if (task && r.rlse) task.rlse = String(r.rlse);
    onDataChange();
    closeModal();
    renderAll();
    toast("Prueba actualizada.");
  }

  function renderDone() {
    const db = getDb();
    if (!db || !tbodyDone) return;
    const list = filterCompleted(db.items);
    const q = filterTextD?.value.trim() || "";
    const ow = filterOwnerD?.value || "";
    const ep = filterEpicD?.value || "";
    const rows = list.filter((it) => {
      if (ow && it.owner !== ow) return false;
      if (ep && it.epic !== ep) return false;
      return rowMatchesGlobalSearch(it, q);
    });

    tbodyDone.innerHTML = rows
      .map((it) => {
        const n = countTestRunsForTask(db, it.id);
        const tpLabel = n ? `${n} prueba(s)` : "—";
        return `<tr class="${rowClass(it)}" data-id="${escapeHtml(it.id)}">
      <td><button type="button" class="btn btn-ghost link-open" data-open="${escapeHtml(it.id)}">${escapeHtml(it.id)}</button></td>
      <td>${escapeHtml(it.level)}</td>
      <td>${escapeHtml(it.title)}</td>
      <td>${escapeHtml(it.epic)}</td>
      <td>${escapeHtml(it.owner)}</td>
      <td>${escapeHtml(it.completedAt || "")}</td>
      <td>${escapeHtml(it.rlse || "")}</td>
      <td>${escapeHtml(tpLabel)}</td>
      <td class="cell-actions">
        <button type="button" class="btn btn-sm" data-action="edit" data-id="${escapeHtml(it.id)}">Editar</button>
        <button type="button" class="btn btn-sm" data-action="testplan" data-id="${escapeHtml(it.id)}">Pruebas</button>
        <button type="button" class="btn btn-sm" data-action="reopen" data-id="${escapeHtml(it.id)}">Reabrir</button>
      </td>
    </tr>`;
      })
      .join("") || '<tr><td colspan="9">Sin completadas</td></tr>';
  }

  function renderTestPlans() {
    const db = getDb();
    if (!db || !tbodyTestPlans) return;
    const q = filterTp?.value.trim().toLowerCase() || "";
    let runs = db.testRuns || [];
    if (q) {
      runs = runs.filter(
        (r) =>
          String(r.name || "")
            .toLowerCase()
            .includes(q) ||
          String(r.rlse || "")
            .toLowerCase()
            .includes(q) ||
          String(r.taskId || "")
            .toLowerCase()
            .includes(q) ||
          String(r.id || "")
            .toLowerCase()
            .includes(q)
      );
    }
    runs = [...runs].sort((a, b) => String(b.executedAt || "").localeCompare(String(a.executedAt || "")));

    tbodyTestPlans.innerHTML = runs
      .map(
        (r) => `<tr>
      <td><button type="button" class="btn btn-ghost" data-open-tr="${escapeHtml(r.id)}">${escapeHtml(r.id)}</button></td>
      <td>${escapeHtml(r.taskId)}</td>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml((r.executedAt || "").slice(0, 10))}</td>
      <td>${escapeHtml(r.outcome)}</td>
      <td>${escapeHtml(r.rlse || "")}</td>
      <td>${escapeHtml(r.environment || "")}</td>
      <td class="cell-actions"><button type="button" class="btn btn-sm" data-delete-tr="${escapeHtml(r.id)}">Eliminar</button></td>
    </tr>`
      )
      .join("") || '<tr><td colspan="8">Sin registros de prueba</td></tr>';
  }

  function renderPanel() {
    const db = getDb();
    if (!db || !panelKpis) return;
    const items = db.items;
    const workLike = items.filter((i) => i.level === "TASK" || i.level === "SUBTASK");
    const tracking = filterTracking(items).filter((i) => isBoardVisibleLevel(i.level));
    const blocked = items.filter((i) => isBlockedState(i) && !isCompleted(i));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseD = (s) => {
      if (!s) return null;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const upcoming = workLike
      .filter((i) => !isCompleted(i) && i.targetDate)
      .map((i) => ({ i, d: parseD(i.targetDate) }))
      .filter((x) => x.d)
      .sort((a, b) => /** @type {Date} */ (a.d) - /** @type {Date} */ (b.d))
      .slice(0, 8);

    const overdue = workLike.filter((i) => {
      if (isCompleted(i) || !i.targetDate) return false;
      const d = parseD(i.targetDate);
      return d && d < today;
    });

    const recentDone = filterCompleted(items)
      .filter((i) => i.completedAt)
      .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))
      .slice(0, 8);

    const byOwner = {};
    const byStatus = {};
    const byRelease = {};
    for (const it of items) {
      if (it.owner) byOwner[it.owner] = (byOwner[it.owner] || 0) + 1;
      const st = String(it.status || "");
      byStatus[st] = (byStatus[st] || 0) + 1;
      const rt = it.releaseTarget || it.rlse || "(sin release)";
      byRelease[rt] = (byRelease[rt] || 0) + 1;
    }

    const listObj = (o) =>
      Object.entries(o)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `<li>${escapeHtml(k)}: ${v}</li>`)
        .join("");

    panelKpis.innerHTML = `
      <div class="kpi-card kpi-wide"><h2>Resumen operativo</h2>
        <p class="kpi-muted">Tareas: ${workLike.length} · En pizarra: ${tracking.length} · Bloqueadas: ${blocked.length} · Vencidas: ${overdue.length}</p>
      </div>
      <div class="kpi-card"><h3>En seguimiento (${tracking.length})</h3><ul class="kpi-list">${tracking.slice(0, 10).map((i) => `<li><button type="button" class="link-open-panel" data-open="${escapeHtml(i.id)}">${escapeHtml(i.id)} — ${escapeHtml(i.title)}</button></li>`).join("") || "<li>—</li>"}</ul></div>
      <div class="kpi-card"><h3>Próximos vencimientos</h3><ul class="kpi-list">${upcoming.map((x) => `<li><button type="button" class="link-open-panel" data-open="${escapeHtml(x.i.id)}">${escapeHtml(x.i.targetDate)} · ${escapeHtml(x.i.title)}</button></li>`).join("") || "<li>—</li>"}</ul></div>
      <div class="kpi-card"><h3>Vencidas</h3><ul class="kpi-list">${overdue.map((i) => `<li><button type="button" class="link-open-panel" data-open="${escapeHtml(i.id)}">${escapeHtml(i.targetDate)} · ${escapeHtml(i.title)}</button></li>`).join("") || "<li>—</li>"}</ul></div>
      <div class="kpi-card"><h3>Bloqueadas</h3><ul class="kpi-list">${blocked.slice(0, 10).map((i) => `<li><button type="button" class="link-open-panel" data-open="${escapeHtml(i.id)}">${escapeHtml(i.id)} — ${escapeHtml(i.title)}</button></li>`).join("") || "<li>—</li>"}</ul></div>
      <div class="kpi-card"><h3>Completadas recientes</h3><ul class="kpi-list">${recentDone.map((i) => `<li><button type="button" class="link-open-panel" data-open="${escapeHtml(i.id)}">${escapeHtml(i.completedAt)} · ${escapeHtml(i.title)}</button></li>`).join("") || "<li>—</li>"}</ul></div>
      <div class="kpi-card"><h3>Por responsable</h3><ul class="kpi-list">${listObj(byOwner)}</ul></div>
      <div class="kpi-card"><h3>Por estado</h3><ul class="kpi-list">${listObj(byStatus)}</ul></div>
      <div class="kpi-card"><h3>Por release / RLSE</h3><ul class="kpi-list">${listObj(byRelease)}</ul></div>
    `;

    panelKpis.querySelectorAll(".link-open-panel").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-open");
        if (id) openDetail(id);
      });
    });
  }

  function renderHelp() {
    const el = document.getElementById("help-content");
    if (!el) return;
    el.innerHTML = `
      <h2>Last Mile Kanban — proceso</h2>
      <p><strong>Abrir base:</strong> elige un JSON. Con File System Access, <strong>Guardar</strong> sobrescribe el mismo archivo.</p>
      <p><strong>Indicador:</strong> muestra archivo, cambios pendientes y último guardado.</p>
      <p><strong>Lista general:</strong> backlog completo (épicas, topics, tareas y subtareas); <strong>Pizarra:</strong> solo tareas activadas (nivel TASK con seguimiento activo).</p>
      <p><strong>Estados:</strong> BACKLOG, PENDIENTE, EN PROGRESO, BLOQUEADA, CERTIFICACIÓN, COMPLETADA (workflow fijo).</p>
      <p><strong>Pruebas:</strong> varias entradas por tarea completada; pestaña <em>Plan de pruebas</em> o botón <strong>Pruebas</strong> en Completadas.</p>
      <h3>Atajos y uso rápido</h3>
      <ul>
        <li><kbd>Ctrl</kbd>+<kbd>S</kbd> / <kbd>Cmd</kbd>+<kbd>S</kbd>: guardar base de datos.</li>
        <li><kbd>Esc</kbd>: cerrar el modal de detalle.</li>
        <li><strong>Pizarra:</strong> arrastra tarjetas entre columnas (estado) o entre swimlanes (responsable en vista “Por responsable”). Doble clic en tarjeta = detalle.</li>
        <li><strong>Lista general:</strong> clic en cabeceras de columna para ordenar; filtros combinables.</li>
      </ul>
    `;
  }

  function openDetail(id) {
    const db = getDb();
    if (!db || !id) return;
    const it = db.items.find((x) => x.id === id);
    if (!it) return;
    createMode = false;
    editingItem = it;
    modalTitle.textContent = `Editar ${it.id}`;
    modalBody.innerHTML = buildEditForm(it, db);
    modalOverlay?.classList.remove("hidden");
    restoreDefaultModalFooter();
  }

  function openCreateDialog() {
    const db = getDb();
    if (!db) return;
    createMode = true;
    editingItem = null;
    modalTitle.textContent = "Nueva tarea";
    modalBody.innerHTML = buildCreateForm(db);
    modalOverlay?.classList.remove("hidden");
    restoreDefaultModalFooter();
  }

  const STATUS_OPTS = [
    STATUS.BACKLOG,
    STATUS.PENDING,
    STATUS.IN_PROGRESS,
    STATUS.BLOCKED,
    STATUS.CERTIFICATION,
    STATUS.DONE,
  ];

  /**
   * @returns {Record<string, *>}
   */
  function readFieldsFromModal() {
    /** @type {Record<string, *>} */
    const raw = {};
    modalBody?.querySelectorAll("[data-field]").forEach((el) => {
      const field = el.getAttribute("data-field");
      if (!field) return;
      if (el instanceof HTMLInputElement && el.type === "checkbox") {
        raw[field] = el.checked;
      } else if (field === "parentId") {
        const v = /** @type {HTMLSelectElement} */ (el).value;
        raw[field] = v || null;
      } else {
        raw[field] = /** @type {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} */ (el).value;
      }
    });
    return raw;
  }

  /**
   * @param {import('./workItem.js').WorkItem} it
   * @param {ProjectDb} db
   */
  function buildSubtasksPanel(it, db) {
    const kids = directChildren(db.items, it.id);
    const rows = kids
      .map(
        (k) =>
          `<li><button type="button" class="btn btn-ghost link-open" data-open="${escapeHtml(k.id)}">${escapeHtml(k.id)}</button> ${escapeHtml(k.title)} · ${statusBadge(k)}</li>`
      )
      .join("");
    return `
      <p class="hint">Subtareas bajo este ítem.</p>
      <ul class="subtask-panel-list">${rows || "<li>Sin subtareas</li>"}</ul>
      <button type="button" class="btn btn-sm" data-add-subtask="${escapeHtml(it.id)}">+ Subtarea rápida</button>`;
  }

  /**
   * @param {import('./workItem.js').WorkItem} it
   */
  function buildCommentsPanel(it) {
    const list = (it.comments || [])
      .map(
        (c) =>
          `<li class="comment-row"><time>${escapeHtml(c.createdAt)}</time> <strong>${escapeHtml(c.author)}</strong><p>${escapeHtml(c.text)}</p></li>`
      )
      .join("");
    return `
      <ul class="comment-panel-list">${list || "<li class='hint'>Sin comentarios</li>"}</ul>
      <label>Nuevo comentario</label>
      <textarea data-comment-text rows="3" class="textarea"></textarea>
      <label>Autor</label>
      <input data-comment-author value="${escapeHtml(it.owner || "")}" />
      <button type="button" class="btn btn-primary btn-sm" data-add-comment="${escapeHtml(it.id)}">Publicar comentario</button>`;
  }

  /**
   * @param {import('./workItem.js').WorkItem} it
   */
  function buildActivityPanel(it) {
    const log = [...(it.activityLog || [])].reverse();
    if (!log.length) return '<p class="hint">Sin actividad registrada aún.</p>';
    return `<ul class="activity-list">${log
      .map((e) => {
        const bits = [e.action];
        if (e.field) bits.push(e.field);
        if (e.from || e.to) bits.push(`${e.from} → ${e.to}`);
        if (e.detail) bits.push(e.detail);
        if (e.user) bits.push(`@${e.user}`);
        return `<li><time datetime="${escapeHtml(e.ts)}">${escapeHtml(e.ts)}</time> — ${escapeHtml(bits.join(" · "))}</li>`;
      })
      .join("")}</ul>`;
  }

  function buildCreateForm(db) {
    const parents = db.items
      .map(
        (x) =>
          `<option value="${escapeHtml(x.id)}">${escapeHtml(x.id)} — ${escapeHtml(x.title)}</option>`
      )
      .join("");
    const opts = STATUS_OPTS.map(
      (s) => `<option value="${s}" ${s === STATUS.BACKLOG ? "selected" : ""}>${escapeHtml(statusLabel(s))}</option>`
    ).join("");
    return `
      <div class="form-grid">
        <label>Nivel</label><select data-field="level">${["EPIC", "TOPIC", "TASK", "SUBTASK"].map((l) => `<option value="${l}" ${l === "TASK" ? "selected" : ""}>${l}</option>`).join("")}</select>
        <label>Parent</label><select data-field="parentId"><option value="">(ninguno)</option>${parents}</select>
        <label>Tipo</label><select data-field="type">${["task", "bug", "feature"].map((t) => `<option value="${t}" ${t === "task" ? "selected" : ""}>${t}</option>`).join("")}</select>
        <label>Título</label><input data-field="title" value="" required />
        <label>Resumen</label><textarea data-field="summary"></textarea>
        <label>Épica</label><input data-field="epic" value="" />
        <label>Responsable</label><input data-field="owner" value="" />
        <label>Prioridad</label><input data-field="priority" value="Media" />
        <label>Estado</label><select data-field="status">${opts}</select>
        <label>Def. OK</label><input type="checkbox" data-field="definitionOk" />
        <label>Release target</label><input data-field="releaseTarget" value="" />
        <label>RLSE</label><input data-field="rlse" value="" />
        <label>Notas internas</label><textarea data-field="notes"></textarea>
      </div>`;
  }

  function buildEditForm(it, db) {
    const parents = db.items
      .filter((x) => x.id !== it.id)
      .map((x) => `<option value="${escapeHtml(x.id)}" ${x.id === it.parentId ? "selected" : ""}>${escapeHtml(x.id)} — ${escapeHtml(x.title)}</option>`)
      .join("");
    const curSt = String(it.status || STATUS.BACKLOG);
    const extraOpt = STATUS_OPTS.includes(curSt)
      ? ""
      : `<option value="${escapeHtml(curSt)}" selected>${escapeHtml(curSt)}</option>`;
    const opts =
      extraOpt +
      STATUS_OPTS.map(
        (s) =>
          `<option value="${s}" ${curSt === s ? "selected" : ""}>${escapeHtml(statusLabel(s))}</option>`
      ).join("");
    const typ = String(it.type || "task");
    const dataForm = `
      <div class="form-grid">
        <label>ID</label><input type="text" data-field="id" value="${escapeHtml(it.id)}" readonly />
        <label>Parent</label><select data-field="parentId"><option value="">(ninguno)</option>${parents}</select>
        <label>Nivel</label><select data-field="level">${["EPIC", "TOPIC", "TASK", "SUBTASK"].map((l) => `<option value="${l}" ${it.level === l ? "selected" : ""}>${l}</option>`).join("")}</select>
        <label>Tipo</label><select data-field="type">${["task", "bug", "feature"].map((x) => `<option value="${x}" ${typ === x ? "selected" : ""}>${x}</option>`).join("")}</select>
        <label>Título</label><input data-field="title" value="${escapeHtml(it.title)}" />
        <label>Resumen</label><textarea data-field="summary">${escapeHtml(it.summary || "")}</textarea>
        <label>Épica</label><input data-field="epic" value="${escapeHtml(it.epic)}" />
        <label>Responsable</label><input data-field="owner" value="${escapeHtml(it.owner)}" />
        <label>Prioridad</label><input data-field="priority" value="${escapeHtml(it.priority)}" />
        <label>Estado</label><select data-field="status">${opts}</select>
        <label>En pizarra</label><input type="checkbox" data-field="inTracking" ${it.inTracking ? "checked" : ""} ${!isBoardVisibleLevel(it.level) ? "disabled" : ""} title="${isBoardVisibleLevel(it.level) ? "Seguimiento en pizarra (solo TASK)" : "Solo las TASK pueden estar en pizarra"}" />
        <label>Def. OK</label><input type="checkbox" data-field="definitionOk" ${it.definitionOk ? "checked" : ""} />
        <label>Release target</label><input data-field="releaseTarget" value="${escapeHtml(it.releaseTarget)}" />
        <label>RLSE</label><input data-field="rlse" value="${escapeHtml(it.rlse || "")}" />
        <label>Pre version</label><input data-field="preVersion" value="${escapeHtml(it.preVersion)}" />
        <label>Pro version</label><input data-field="proVersion" value="${escapeHtml(it.proVersion)}" />
        <label>Fecha objetivo</label><input data-field="targetDate" value="${escapeHtml(it.targetDate)}" />
        <label>Fecha inicio</label><input data-field="startDate" value="${escapeHtml(it.startDate)}" />
        <label>Fecha fin</label><input data-field="completedAt" value="${escapeHtml(it.completedAt)}" />
        <label>Bloqueada</label><input type="checkbox" data-field="blocked" ${it.blocked ? "checked" : ""} />
        <label>Dependencias</label><input data-field="dependencies" value="${escapeHtml(it.dependencies)}" />
        <label>Notas internas</label><textarea data-field="notes">${escapeHtml(it.notes)}</textarea>
      </div>`;
    const nRuns = countTestRunsForTask(db, it.id);
    const tpExtra =
      isCompleted(it)
        ? `<hr class="form-divider" />
      <p class="hint">Registro de pruebas: <strong>${nRuns}</strong> entrada(s).</p>
      <div class="btn-row">
        <button type="button" class="btn btn-sm btn-primary" data-open-test-runs="${escapeHtml(it.id)}">Ver / añadir pruebas</button>
      </div>`
        : "";
    const tabs = `
      <div class="modal-tabs" role="tablist">
        <button type="button" class="modal-tab-btn active" data-modal-tab="data">Datos</button>
        <button type="button" class="modal-tab-btn" data-modal-tab="subtasks">Subtareas</button>
        <button type="button" class="modal-tab-btn" data-modal-tab="comments">Comentarios</button>
        <button type="button" class="modal-tab-btn" data-modal-tab="activity">Actividad</button>
      </div>
      <div class="modal-tab-panel" data-panel="data">${dataForm}${tpExtra}</div>
      <div class="modal-tab-panel hidden" data-panel="subtasks">${buildSubtasksPanel(it, db)}</div>
      <div class="modal-tab-panel hidden" data-panel="comments">${buildCommentsPanel(it)}</div>
      <div class="modal-tab-panel hidden" data-panel="activity">${buildActivityPanel(it)}</div>`;
    return tabs;
  }

  function saveModal() {
    const db = getDb();
    if (!db) return;
    if (createMode) {
      const raw = readFieldsFromModal();
      if (!String(raw.title || "").trim()) {
        toast("El título es obligatorio.");
        return;
      }
      const item = createWorkItemFromForm(
        /** @type {*} */ ({
          ...raw,
          parentId: raw.parentId || null,
        }),
        db.items
      );
      addLogEntry(item, { action: "created", detail: item.id });
      db.items.push(item);
      createMode = false;
      modalOverlay?.classList.add("hidden");
      onDataChange();
      renderAll();
      toast(`Creado ${item.id}.`);
      return;
    }
    if (!editingItem) return;
    const before = {
      title: editingItem.title,
      summary: editingItem.summary,
      epic: editingItem.epic,
      owner: editingItem.owner,
      priority: editingItem.priority,
      status: editingItem.status,
      inTracking: editingItem.inTracking,
      definitionOk: editingItem.definitionOk,
      rlse: editingItem.rlse,
      releaseTarget: editingItem.releaseTarget,
      type: editingItem.type,
    };
    const form = modalBody?.querySelectorAll("[data-field]");
    if (!form) return;
    for (const el of form) {
      const field = el.getAttribute("data-field");
      if (!field) continue;
      if (el instanceof HTMLInputElement && el.type === "checkbox") {
        if (field === "inTracking" && el.disabled) {
          /** @type {*} */ (editingItem)[field] = false;
        } else {
          /** @type {*} */ (editingItem)[field] = el.checked;
        }
      } else if (field === "parentId") {
        const v = /** @type {HTMLSelectElement} */ (el).value;
        editingItem.parentId = v || null;
      } else {
        /** @type {*} */ (editingItem)[field] = el.value;
      }
    }
    const it = editingItem;
    logFieldChange(it, "title", String(before.title), String(it.title));
    logFieldChange(it, "summary", String(before.summary || ""), String(it.summary || ""));
    logFieldChange(it, "epic", String(before.epic || ""), String(it.epic || ""));
    logFieldChange(it, "owner", String(before.owner || ""), String(it.owner || ""));
    logFieldChange(it, "priority", String(before.priority || ""), String(it.priority || ""));
    if (String(before.status) !== String(it.status)) {
      addLogEntry(it, {
        action: "status_changed",
        field: "status",
        from: String(before.status),
        to: String(it.status),
      });
    }
    if (Boolean(before.inTracking) !== Boolean(it.inTracking)) {
      addLogEntry(it, {
        action: it.inTracking ? "activated" : "deactivated",
        detail: "Editado en formulario",
      });
    }
    if (String(before.type || "task") !== String(it.type || "task")) {
      logFieldChange(it, "type", String(before.type || "task"), String(it.type || "task"));
    }
    if (String(editingItem.status) === STATUS_COMPLETED && !editingItem.completedAt) {
      editingItem.completedAt = new Date().toISOString().slice(0, 10);
      editingItem.inTracking = true;
    }
    if (editingItem.inTracking && !isBoardVisibleLevel(editingItem.level)) {
      editingItem.inTracking = false;
      toast("En pizarra solo aplica a TASK; se ha desmarcado seguimiento para este nivel.");
    }
    if (String(editingItem.status) === STATUS.BLOCKED) {
      editingItem.blocked = true;
    }
    if (String(editingItem.status) !== STATUS.BLOCKED && editingItem.blocked && String(before.status) === STATUS.BLOCKED) {
      editingItem.blocked = false;
    }
    modalOverlay?.classList.add("hidden");
    editingItem = null;
    onDataChange();
    renderAll();
    toast("Cambios guardados.");
  }

  function doSendTracking(id) {
    const db = getDb();
    if (!db) return;
    const it = db.items.find((x) => x.id === id);
    if (!it) return;
    if (!isKanbanActivatableLevel(it.level)) {
      toast("Solo las tareas pueden activarse para la pizarra.");
      return;
    }
    if (isCompleted(it)) {
      toast("La tarea ya está completada.");
      return;
    }
    if (it.inTracking) {
      toast("La tarea ya está en la pizarra.");
      return;
    }
    const v = validateForTracking(it);
    if (!v.ok) {
      toast(`No se puede activar: falta ${v.missing.join(", ")}`);
      return;
    }
    const res = sendToTracking(db.items, id, false);
    if (res.errors.length) {
      toast(`Error: ${res.errors.slice(0, 3).join("; ")}`);
    } else {
      toast("Tarea activada en la pizarra.");
    }
    onDataChange();
    renderAll();
  }

  function doComplete(id) {
    const db = getDb();
    if (!db || !id) return;
    const it = db.items.find((x) => x.id === id);
    if (!it) return;
    if (!canCompleteOrBlock(it.level)) {
      toast("Las épicas y topics no pueden completarse.");
      return;
    }
    if (!window.confirm("¿Marcar como completada?")) return;
    completeItem(db.items, id);
    onDataChange();
    renderAll();
    toast("Completada.");
  }

  function doUntrack(id) {
    const db = getDb();
    if (!db || !id) return;
    removeFromTracking(db.items, id);
    onDataChange();
    renderAll();
    toast("Devuelto a backlog (sin seguimiento).");
  }

  function doToggleBlock(id) {
    const db = getDb();
    if (!db || !id) return;
    const it = db.items.find((x) => x.id === id);
    if (!it) return;
    if (!canCompleteOrBlock(it.level)) {
      toast("Las épicas y topics no pueden bloquearse.");
      return;
    }
    toggleBlocked(db.items, id);
    onDataChange();
    renderAll();
  }

  function doReopen(id) {
    const db = getDb();
    if (!db || !id) return;
    if (!window.confirm("¿Reabrir esta tarea? (pasa a BACKLOG)")) return;
    reopenItem(db.items, id);
    onDataChange();
    renderAll();
    toast("Reabierta.");
  }

  function closeModal() {
    modalOverlay?.classList.add("hidden");
    editingItem = null;
    createMode = false;
    restoreDefaultModalFooter();
  }

  modalClose?.addEventListener("click", closeModal);
  modalOverlay?.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  if (modalSave) modalSave.onclick = () => saveModal();

  const filterOwnerB = /** @type {HTMLSelectElement|null} */ (document.getElementById("filter-owner-b"));
  const filterEpicB = /** @type {HTMLSelectElement|null} */ (document.getElementById("filter-epic-b"));

  filterText?.addEventListener("input", () => renderBacklog());
  filterOwner?.addEventListener("change", () => renderBacklog());
  filterEpic?.addEventListener("change", () => renderBacklog());
  filterStatusBl?.addEventListener("change", () => renderBacklog());
  filterTopic?.addEventListener("change", () => renderBacklog());
  filterPriorityBl?.addEventListener("change", () => renderBacklog());
  filterTextD?.addEventListener("input", () => renderDone());
  filterOwnerD?.addEventListener("change", () => renderDone());
  filterEpicD?.addEventListener("change", () => renderDone());
  filterTp?.addEventListener("input", () => renderTestPlans());

  setupTableDelegation();

  function renderAll() {
    fillFilterSelects();
    renderBacklog();
    renderDone();
    renderPanel();
    renderTestPlans();
    renderHelp();
    renderBoardView();
    refreshToolbar();
  }

  const boardApi = mountBoard({
    getDb,
    onDataChange,
    openDetail,
    refreshAll: renderAll,
  });
  renderBoardView = boardApi.renderBoard;

  function fillFilterSelects() {
    const db = getDb();
    if (!db) return;
    const owners = db.catalogs.owners || [];
    const epics = db.catalogs.epics || [];
    const priorities = db.catalogs.priorities || [];
    if (filterOwner) {
      const cur = filterOwner.value;
      filterOwner.innerHTML =
        `<option value="">Todos los responsables</option>` +
        owners.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
      filterOwner.value = cur;
    }
    if (filterEpic) {
      const cur = filterEpic.value;
      filterEpic.innerHTML =
        `<option value="">Todas las épicas</option>` +
        epics.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
      filterEpic.value = cur;
    }
    if (filterTopic) {
      const cur = filterTopic.value;
      const topics = [...new Set(db.items.map((i) => i.topic || "").filter(Boolean))].sort();
      filterTopic.innerHTML =
        `<option value="">Todos los topics</option>` +
        topics.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
      filterTopic.value = cur;
    }
    if (filterStatusBl) {
      const cur = filterStatusBl.value;
      filterStatusBl.innerHTML =
        `<option value="">Todos los estados</option>` +
        STATUS_ORDER.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(statusLabel(s))}</option>`).join("");
      filterStatusBl.value = cur;
    }
    if (filterPriorityBl) {
      const cur = filterPriorityBl.value;
      filterPriorityBl.innerHTML =
        `<option value="">Todas las prioridades</option>` +
        priorities.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
      filterPriorityBl.value = cur;
    }
    if (filterOwnerB) {
      const cur = filterOwnerB.value;
      filterOwnerB.innerHTML =
        `<option value="">Todos</option>` +
        owners.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
      filterOwnerB.value = cur;
    }
    if (filterEpicB) {
      const cur = filterEpicB.value;
      filterEpicB.innerHTML =
        `<option value="">Todas</option>` +
        epics.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
      filterEpicB.value = cur;
    }
  }

  return {
    renderAll,
    openDetail,
    openCreateDialog,
    renderBacklog,
    renderPanel,
    renderBoard: () => renderBoardView(),
  };
}
