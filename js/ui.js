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
import { STATUS, STATUS_COMPLETED, STATUS_ORDER, isBoardVisibleLevel, statusLabel } from "./constants.js";
import { deleteTestPlanById, ensureDraftTestPlan, findTestPlanByTaskId } from "./testPlans.js";
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
  let c = "";
  if (it.inTracking) c += " row-tracking";
  if (isCompleted(it)) c += " row-done";
  if (isBlockedState(it)) c += " row-blocked";
  return c.trim();
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
    const stf = filterStatusBl?.value || "";
    const prf = filterPriorityBl?.value || "";

    const filtered = backlog.filter((it) => {
      if (ow && it.owner !== ow) return false;
      if (ep && it.epic !== ep) return false;
      if (stf && String(it.status || "") !== stf) return false;
      if (prf && String(it.priority || "") !== prf) return false;
      if (!rowMatchesGlobalSearch(it, q)) return false;
      return true;
    });

    const hasFilter = Boolean(q || ow || ep || stf || prf);
    const rowsHtml = [];

    const rowActions = (nodeId) => `
      <div class="cell-actions">
        <button type="button" class="btn btn-sm" data-action="track" data-id="${escapeHtml(nodeId)}">Activar</button>
        <button type="button" class="btn btn-sm" data-action="done" data-id="${escapeHtml(nodeId)}">Completar</button>
        <button type="button" class="btn btn-sm" data-action="block" data-id="${escapeHtml(nodeId)}">Bloq./Des.</button>
        <button type="button" class="btn btn-sm" data-action="edit" data-id="${escapeHtml(nodeId)}">Editar</button>
      </div>`;

    const rowCells = (node, pad, toggle) => `<tr class="${rowClass(node)}" data-id="${escapeHtml(node.id)}">
        <td style="padding-left:${pad}px">${toggle}</td>
        <td><button type="button" class="btn btn-ghost link-open" data-open="${escapeHtml(node.id)}">${escapeHtml(node.id)}</button></td>
        <td>${escapeHtml(node.level)}</td>
        <td><span class="cell-type cell-type-${escapeHtml(String(node.type || "task"))}">${escapeHtml(typeLabel(node))}</span></td>
        <td>${escapeHtml(node.title)}</td>
        <td>${escapeHtml(node.epic)}</td>
        <td>${escapeHtml(node.owner)}</td>
        <td>${escapeHtml(node.priority)}</td>
        <td>${statusBadge(node)}</td>
        <td class="cell-tracking">${trackingCell(node)}</td>
        <td>${node.definitionOk ? "Sí" : "No"}</td>
        <td>${escapeHtml(node.releaseTarget || "")}</td>
        <td>${escapeHtml(node.rlse || "")}</td>
        <td>${escapeHtml(node.targetDate || "")}</td>
        <td>${rowActions(node.id)}</td>
      </tr>`;

    if (hasFilter) {
      const flat = [...filtered];
      sortBacklogFlat(flat, db);
      for (const node of flat) {
        rowsHtml.push(rowCells(node, 0, '<span class="tree-toggle"></span>'));
      }
      tbodyBacklog.innerHTML = rowsHtml.join("") || '<tr><td colspan="15">Sin resultados</td></tr>';
      updateBacklogSortHeaders(db);
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

    tbodyBacklog.innerHTML = rowsHtml.join("") || '<tr><td colspan="15">Sin datos</td></tr>';
    updateBacklogSortHeaders(db);
  }

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
      if (action === "testplan") openTestPlanForTask(id);
    });

    tbodyTestPlans?.addEventListener("click", (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      const delBtn = t.closest("[data-delete-tp]");
      if (delBtn) {
        const pid = delBtn.getAttribute("data-delete-tp");
        if (pid) doDeleteTestPlan(pid);
        return;
      }
      const openBtn = t.closest("[data-open-tp]");
      if (openBtn) {
        openTestPlanModal(openBtn.getAttribute("data-open-tp"));
      }
    });

    modalBody?.addEventListener("click", (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      const delBtn = t.closest("[data-delete-tp]");
      if (delBtn) {
        const pid = delBtn.getAttribute("data-delete-tp");
        if (pid) doDeleteTestPlan(pid);
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

  /**
   * @param {string} planId
   */
  function doDeleteTestPlan(planId) {
    const db = getDb();
    if (!db) return;
    if (!confirm("¿Eliminar este plan de pruebas? No se puede deshacer.")) return;
    if (!deleteTestPlanById(db, planId)) {
      toast("No se encontró el plan.");
      return;
    }
    onDataChange();
    closeModal();
    renderAll();
    toast("Plan de pruebas eliminado.");
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
        const tp = findTestPlanByTaskId(db, it.id);
        const tpLabel = tp ? tp.id : "—";
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
        <button type="button" class="btn btn-sm" data-action="testplan" data-id="${escapeHtml(it.id)}">Plan pruebas</button>
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
    let plans = db.testPlans || [];
    if (q) {
      plans = plans.filter(
        (p) =>
          String(p.title || "")
            .toLowerCase()
            .includes(q) ||
          String(p.rlse || "")
            .toLowerCase()
            .includes(q) ||
          String(p.id || "")
            .toLowerCase()
            .includes(q)
      );
    }

    tbodyTestPlans.innerHTML = plans
      .map(
        (p) => `<tr>
      <td><button type="button" class="btn btn-ghost" data-open-tp="${escapeHtml(p.id)}">${escapeHtml(p.id)}</button></td>
      <td>${escapeHtml(p.taskId)}</td>
      <td>${escapeHtml(p.title)}</td>
      <td>${escapeHtml(p.rlse || "")}</td>
      <td>${escapeHtml(p.status || "")}</td>
      <td>${escapeHtml(p.environment || "")}</td>
      <td>${escapeHtml(p.certificationStatus || "")}</td>
      <td class="cell-actions"><button type="button" class="btn btn-sm" data-delete-tp="${escapeHtml(p.id)}">Eliminar</button></td>
    </tr>`
      )
      .join("") || '<tr><td colspan="8">Sin planes de prueba</td></tr>';
  }

  function openTestPlanModal(planId) {
    const db = getDb();
    if (!db) return;
    const p = (db.testPlans || []).find((x) => x.id === planId);
    if (!p) return;
    createMode = false;
    editingItem = null;
    modalTitle.textContent = `Plan de pruebas ${p.id}`;
    modalBody.innerHTML = buildTestPlanForm(p);
    modalOverlay?.classList.remove("hidden");
    if (modalSave) modalSave.onclick = () => saveTestPlanModal(p.id);
  }

  function openTestPlanForTask(taskId) {
    const db = getDb();
    if (!db) return;
    const tp = ensureDraftTestPlan(db, taskId);
    if (!tp) {
      toast("No hay plan de pruebas para este ítem.");
      return;
    }
    onDataChange();
    openTestPlanModal(tp.id);
  }

  /**
   * @param {import('./dataService.js').TestPlan} p
   */
  function buildTestPlanForm(p) {
    return `
      <div class="form-grid">
        <label>ID</label><input data-tp-field="id" value="${escapeHtml(p.id)}" readonly />
        <label>Task</label><input data-tp-field="taskId" value="${escapeHtml(p.taskId)}" readonly />
        <label>Título</label><input data-tp-field="title" value="${escapeHtml(p.title)}" />
        <label>RLSE</label><input data-tp-field="rlse" value="${escapeHtml(p.rlse)}" />
        <label>Estado</label><input data-tp-field="status" value="${escapeHtml(p.status)}" />
        <label>Entorno</label><select data-tp-field="environment">${["PRE", "PRO", "DEV"].map((env) => `<option value="${env}" ${p.environment === env ? "selected" : ""}>${env}</option>`).join("")}</select>
        <label>Pasos</label><textarea data-tp-field="steps">${escapeHtml(p.steps)}</textarea>
        <label>Resultado esperado</label><textarea data-tp-field="expectedResult">${escapeHtml(p.expectedResult)}</textarea>
        <label>Resultado real</label><textarea data-tp-field="actualResult">${escapeHtml(p.actualResult)}</textarea>
        <label>Evidencias</label><textarea data-tp-field="evidenceNotes">${escapeHtml(p.evidenceNotes)}</textarea>
        <label>Tester</label><input data-tp-field="tester" value="${escapeHtml(p.tester)}" />
        <label>Fecha ejecución</label><input data-tp-field="executedAt" type="date" value="${escapeHtml((p.executedAt || "").slice(0, 10))}" />
        <label>Certificación</label><input data-tp-field="certificationStatus" value="${escapeHtml(p.certificationStatus)}" />
        <label>Notas</label><textarea data-tp-field="notes">${escapeHtml(p.notes)}</textarea>
      </div>
      <p class="hint">Eliminar quita el plan del JSON y limpia la referencia en la tarea.</p>
      <div class="btn-row">
        <button type="button" class="btn btn-sm" data-delete-tp="${escapeHtml(p.id)}">Eliminar plan de pruebas</button>
      </div>`;
  }

  function saveTestPlanModal(planId) {
    const db = getDb();
    if (!db) return;
    const p = (db.testPlans || []).find((x) => x.id === planId);
    if (!p) return;
    modalBody?.querySelectorAll("[data-tp-field]").forEach((el) => {
      const field = el.getAttribute("data-tp-field");
      if (!field || field === "id" || field === "taskId") return;
      /** @type {*} */ (p)[field] = /** @type {HTMLInputElement} */ (el).value;
    });
    const task = db.items.find((i) => i.id === p.taskId);
    if (task && p.rlse) task.rlse = p.rlse;
    modalOverlay?.classList.add("hidden");
    if (modalSave) modalSave.onclick = () => saveModal();
    onDataChange();
    renderAll();
    toast("Plan de pruebas guardado.");
  }

  function renderPanel() {
    const db = getDb();
    if (!db || !panelKpis) return;
    const items = db.items;
    const workLike = items.filter((i) => i.level === "TASK" || i.level === "SUBTASK");
    const tracking = filterTracking(items);
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
        <p class="kpi-muted">Tareas/subtareas: ${workLike.length} · En seguimiento: ${tracking.length} · Bloqueadas: ${blocked.length} · Vencidas: ${overdue.length}</p>
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
      <p><strong>Lista general:</strong> todas las tareas; <strong>Pizarra:</strong> TASK y TOPIC con <code>inTracking</code> (activas), incluidas completadas en pizarra.</p>
      <p><strong>Estados:</strong> BACKLOG, PENDIENTE, EN PROGRESO, BLOQUEADA, CERTIFICACIÓN, COMPLETADA (workflow fijo).</p>
      <p><strong>Plan de pruebas:</strong> se genera borrador al completar; edítalo en la pestaña correspondiente.</p>
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
    modalSave.onclick = () => saveModal();
  }

  function openCreateDialog() {
    const db = getDb();
    if (!db) return;
    createMode = true;
    editingItem = null;
    modalTitle.textContent = "Nueva tarea";
    modalBody.innerHTML = buildCreateForm(db);
    modalOverlay?.classList.remove("hidden");
    modalSave.onclick = () => saveModal();
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
        <label>En pizarra</label><input type="checkbox" data-field="inTracking" ${it.inTracking ? "checked" : ""} title="Seguimiento operativo" />
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
    const tp = findTestPlanByTaskId(db, it.id);
    const tpExtra =
      isCompleted(it) && tp
        ? `<hr class="form-divider" />
      <p class="hint">Plan de pruebas vinculado: <strong>${escapeHtml(tp.id)}</strong></p>
      <div class="btn-row">
        <button type="button" class="btn btn-sm" data-delete-tp="${escapeHtml(tp.id)}">Eliminar plan de pruebas</button>
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
        /** @type {*} */ (editingItem)[field] = el.checked;
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
      ensureDraftTestPlan(db, editingItem.id);
      editingItem.inTracking = true;
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
    if (isCompleted(it)) {
      toast("El ítem ya está completado.");
      return;
    }
    const v = validateForTracking(it);
    if (!v.ok) {
      toast(`No se puede enviar: falta ${v.missing.join(", ")}`);
      return;
    }
    let include = false;
    if (it.level === "SUBTASK") {
      include = false;
    } else {
      include = window.confirm(
        "¿Incluir todos los descendientes válidos en seguimiento? (Cancelar = solo este ítem)"
      );
    }
    const res = sendToTracking(db.items, id, include);
    if (res.errors.length) {
      toast(`Actualizados ${res.updated}. Errores: ${res.errors.slice(0, 3).join("; ")}${res.errors.length > 3 ? "…" : ""}`);
    } else {
      let msg = `Seguimiento actualizado: ${res.updated} ítem(s).`;
      if (!isBoardVisibleLevel(it.level)) {
        msg += " La pizarra solo muestra TASK y TOPIC en seguimiento (no EPIC ni SUBTASK).";
      }
      toast(msg);
    }
    onDataChange();
    renderAll();
  }

  function doComplete(id) {
    const db = getDb();
    if (!db || !id) return;
    if (!window.confirm("¿Marcar como completada?")) return;
    completeItem(db.items, id);
    ensureDraftTestPlan(db, id);
    onDataChange();
    renderAll();
    toast("Completada; plan de pruebas borrador si aplica.");
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
    if (modalSave) modalSave.onclick = () => saveModal();
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
