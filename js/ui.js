/**
 * @typedef {import('./workItem.js').WorkItem} WorkItem
 * @typedef {import('./dataService.js').ProjectDb} ProjectDb
 */
import {
  completeItem,
  createWorkItemFromForm,
  filterBacklog,
  filterCompleted,
  filterTracking,
  sendToTracking,
  validateForTracking,
  isCompleted,
} from "./workItem.js";
import { STATUS_COMPLETED } from "./constants.js";

/** @type {Set<string>} */
const expandedRows = new Set();

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
 * @param {WorkItem[]} items
 */
function ensureExpandedDefaults(items) {
  for (const it of items) {
    if (!expandedRows.has(it.id)) expandedRows.add(it.id);
  }
}

/**
 * @param {WorkItem} it
 * @param {WorkItem[]} all
 */
function hasChildren(it, all) {
  return all.some((x) => x.parentId === it.id);
}

/**
 * @param {object} api
 * @param {() => ProjectDb|null} api.getDb
 * @param {() => void} api.onPersist
 * @param {(msg: string) => void} api.toast
 * @param {() => void} api.refreshToolbar
 */
export function mount(api) {
  const getDb = api.getDb;
  const toast = api.toast;
  const onPersist = api.onPersist;
  const refreshToolbar = api.refreshToolbar;

  /** @type {WorkItem|null} */
  let editingItem = null;
  /** @type {boolean} */
  let createMode = false;

  const tbodyBacklog = /** @type {HTMLTableSectionElement} */ (
    document.getElementById("tbody-backlog")
  );
  const tbodyTracking = /** @type {HTMLTableSectionElement} */ (
    document.getElementById("tbody-tracking")
  );
  const tbodyDone = /** @type {HTMLTableSectionElement} */ (document.getElementById("tbody-done"));
  const panelKpis = document.getElementById("panel-kpis");
  const filterText = /** @type {HTMLInputElement} */ (document.getElementById("filter-text"));
  const filterOwner = /** @type {HTMLSelectElement} */ (document.getElementById("filter-owner"));
  const filterEpic = /** @type {HTMLSelectElement} */ (document.getElementById("filter-epic"));
  const filterTextT = /** @type {HTMLInputElement} */ (document.getElementById("filter-text-t"));
  const filterTextD = /** @type {HTMLInputElement} */ (document.getElementById("filter-text-d"));
  const modalOverlay = document.getElementById("modal-overlay");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalClose = document.getElementById("modal-close");
  const modalSave = document.getElementById("modal-save");

  function textMatch(it, q) {
    if (!q) return true;
    const t = q.toLowerCase();
    return (
      String(it.title || "")
        .toLowerCase()
        .includes(t) ||
      String(it.id || "")
        .toLowerCase()
        .includes(t) ||
      String(it.notes || "")
        .toLowerCase()
        .includes(t)
    );
  }

  function renderBacklog() {
    const db = getDb();
    if (!db || !tbodyBacklog) return;
    const items = db.items;
    ensureExpandedDefaults(items);
    const backlog = filterBacklog(items);
    const q = filterText?.value.trim() || "";
    const ow = filterOwner?.value || "";
    const ep = filterEpic?.value || "";

    const filtered = backlog.filter((it) => {
      if (ow && it.owner !== ow) return false;
      if (ep && it.epic !== ep) return false;
      if (!textMatch(it, q)) return false;
      return true;
    });

    const hasFilter = Boolean(q || ow || ep);
    const rowsHtml = [];

    if (hasFilter) {
      const flat = [...filtered].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      for (const node of flat) {
        const trClass = node.inTracking ? "row-tracking" : node.blocked ? "row-blocked" : "";
        rowsHtml.push(`<tr class="${trClass}" data-id="${escapeHtml(node.id)}">
        <td></td>
        <td><button type="button" class="btn btn-ghost link-open" data-open="${escapeHtml(node.id)}">${escapeHtml(node.id)}</button></td>
        <td>${escapeHtml(node.level)}</td>
        <td>${escapeHtml(node.title)}</td>
        <td>${escapeHtml(node.epic)}</td>
        <td>${escapeHtml(node.owner)}</td>
        <td>${escapeHtml(node.priority)}</td>
        <td><span class="badge">${escapeHtml(node.status)}</span></td>
        <td>${node.inTracking ? "Sí" : "No"}</td>
        <td>${node.definitionOk ? "Sí" : "No"}</td>
        <td>${escapeHtml(node.releaseTarget || "")}</td>
        <td class="cell-actions">
          <button type="button" class="btn" data-action="track" data-id="${escapeHtml(node.id)}">Seguimiento</button>
          <button type="button" class="btn" data-action="done" data-id="${escapeHtml(node.id)}">Completar</button>
        </td>
      </tr>`);
      }
      tbodyBacklog.innerHTML = rowsHtml.join("") || '<tr><td colspan="12">Sin resultados</td></tr>';
      return;
    }

    const roots = sortedChildren(filtered, null);

    function walk(node, depth) {
      const kids = sortedChildren(filtered, node.id);
      const exp = expandedRows.has(node.id);
      const hc = hasChildren(node, filtered);
      const pad = depth * 18;
      let toggle = "";
      if (hc) {
        toggle = `<button type="button" class="tree-toggle" data-toggle="${escapeHtml(node.id)}" aria-expanded="${exp}">${exp ? "▼" : "▶"}</button>`;
      } else {
        toggle = '<span class="tree-toggle"></span>';
      }

      const trClass = node.inTracking ? "row-tracking" : node.blocked ? "row-blocked" : "";
      rowsHtml.push(`<tr class="${trClass}" data-id="${escapeHtml(node.id)}">
        <td style="padding-left:${pad}px">${toggle}</td>
        <td><button type="button" class="btn btn-ghost link-open" data-open="${escapeHtml(node.id)}">${escapeHtml(node.id)}</button></td>
        <td>${escapeHtml(node.level)}</td>
        <td>${escapeHtml(node.title)}</td>
        <td>${escapeHtml(node.epic)}</td>
        <td>${escapeHtml(node.owner)}</td>
        <td>${escapeHtml(node.priority)}</td>
        <td><span class="badge">${escapeHtml(node.status)}</span></td>
        <td>${node.inTracking ? "Sí" : "No"}</td>
        <td>${node.definitionOk ? "Sí" : "No"}</td>
        <td>${escapeHtml(node.releaseTarget || "")}</td>
        <td class="cell-actions">
          <button type="button" class="btn" data-action="track" data-id="${escapeHtml(node.id)}">Seguimiento</button>
          <button type="button" class="btn" data-action="done" data-id="${escapeHtml(node.id)}">Completar</button>
        </td>
      </tr>`);

      if (hc && exp) {
        for (const ch of kids) walk(ch, depth + 1);
      }
    }

    for (const r of roots) walk(r, 0);

    tbodyBacklog.innerHTML = rowsHtml.join("") || '<tr><td colspan="12">Sin datos</td></tr>';
  }

  function setupTableDelegation() {
    if (!tbodyBacklog) return;
    tbodyBacklog.addEventListener("click", (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      const toggleBtn = t.closest("[data-toggle]");
      if (toggleBtn) {
        const id = toggleBtn.getAttribute("data-toggle");
        if (!id) return;
        if (expandedRows.has(id)) expandedRows.delete(id);
        else expandedRows.add(id);
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
      }
    });

    tbodyTracking?.addEventListener("click", (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      const openBtn = t.closest("[data-open]");
      if (openBtn) {
        openDetail(openBtn.getAttribute("data-open"));
        return;
      }
      const actBtn = t.closest("[data-action]");
      if (actBtn && actBtn.getAttribute("data-action") === "done") {
        doComplete(actBtn.getAttribute("data-id"));
      }
    });

    tbodyDone?.addEventListener("click", (e) => {
      const t = /** @type {HTMLElement} */ (e.target);
      const openBtn = t.closest("[data-open]");
      if (openBtn) openDetail(openBtn.getAttribute("data-open"));
    });
  }

  function renderTracking() {
    const db = getDb();
    if (!db || !tbodyTracking) return;
    const list = filterTracking(db.items);
    const q = filterTextT?.value.trim() || "";
    const rows = list.filter((it) => textMatch(it, q));

    tbodyTracking.innerHTML = rows
      .map(
        (it) => `<tr class="row-tracking" data-id="${escapeHtml(it.id)}">
      <td><button type="button" class="btn btn-ghost link-open" data-open="${escapeHtml(it.id)}">${escapeHtml(it.id)}</button></td>
      <td>${escapeHtml(it.level)}</td>
      <td>${escapeHtml(it.title)}</td>
      <td>${escapeHtml(it.epic)}</td>
      <td>${escapeHtml(it.owner)}</td>
      <td>${escapeHtml(it.priority)}</td>
      <td>${escapeHtml(it.status)}</td>
      <td class="cell-actions">
        <button type="button" class="btn" data-action="done" data-id="${escapeHtml(it.id)}">Completar</button>
      </td>
    </tr>`
      )
      .join("") || '<tr><td colspan="8">Nada en seguimiento</td></tr>';
  }

  function renderDone() {
    const db = getDb();
    if (!db || !tbodyDone) return;
    const list = filterCompleted(db.items);
    const q = filterTextD?.value.trim() || "";
    const rows = list.filter((it) => textMatch(it, q));

    tbodyDone.innerHTML = rows
      .map(
        (it) => `<tr class="row-done" data-id="${escapeHtml(it.id)}">
      <td><button type="button" class="btn btn-ghost link-open" data-open="${escapeHtml(it.id)}">${escapeHtml(it.id)}</button></td>
      <td>${escapeHtml(it.level)}</td>
      <td>${escapeHtml(it.title)}</td>
      <td>${escapeHtml(it.epic)}</td>
      <td>${escapeHtml(it.owner)}</td>
      <td>${escapeHtml(it.completedAt || "")}</td>
      <td class="cell-actions"></td>
    </tr>`
      )
      .join("") || '<tr><td colspan="7">Sin completadas</td></tr>';
  }

  function renderPanel() {
    const db = getDb();
    if (!db || !panelKpis) return;
    const items = db.items;
    const workLike = items.filter((i) => i.level === "TASK" || i.level === "SUBTASK");
    const total = workLike.length;
    const tracking = filterTracking(items).length;
    const done = filterCompleted(items).length;

    const byOwner = {};
    const byStatus = {};
    const byRelease = {};
    for (const it of items) {
      if (it.owner) {
        byOwner[it.owner] = (byOwner[it.owner] || 0) + 1;
      }
      const st = it.status || "";
      byStatus[st] = (byStatus[st] || 0) + 1;
      const rt = it.releaseTarget || "(sin release)";
      byRelease[rt] = (byRelease[rt] || 0) + 1;
    }

    const listObj = (o) =>
      Object.entries(o)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `<li>${escapeHtml(k)}: ${v}</li>`)
        .join("");

    panelKpis.innerHTML = `
      <div class="kpi-card"><h3>Tareas + subtareas</h3><div class="kpi-value">${total}</div></div>
      <div class="kpi-card"><h3>En seguimiento</h3><div class="kpi-value">${tracking}</div></div>
      <div class="kpi-card"><h3>Completadas</h3><div class="kpi-value">${done}</div></div>
      <div class="kpi-card"><h3>Por responsable</h3><ul class="kpi-list">${listObj(byOwner)}</ul></div>
      <div class="kpi-card"><h3>Por estado</h3><ul class="kpi-list">${listObj(byStatus)}</ul></div>
      <div class="kpi-card"><h3>Por release (objetivo)</h3><ul class="kpi-list">${listObj(byRelease)}</ul></div>
    `;
  }

  function renderHelp() {
    const el = document.getElementById("help-content");
    if (!el) return;
    el.innerHTML = `
      <h2>Procesos</h2>
      <p><strong>Abrir base de datos:</strong> carga un JSON (File System Access o selector de archivo).</p>
      <p><strong>Guardar:</strong> sobrescribe el archivo abierto o descarga si no hay permiso de escritura.</p>
      <p><strong>Refrescar vistas:</strong> recalcula tablas en memoria (equivalente a la macro RefrescarVistas).</p>
      <p><strong>Seguimiento:</strong> valida campos obligatorios y marca <code>inTracking</code>. Opcionalmente incluye descendientes válidos.</p>
      <p><strong>Completar:</strong> estado Completada, fecha fin hoy, quita seguimiento.</p>
      <p><strong>Limpiar seguimiento &gt;30d:</strong> en ítems completados antiguos, fuerza <code>inTracking</code> a no.</p>
      <p><strong>Import masivo CSV:</strong> columnas documentadas en Creador; líneas erróneas se listan.</p>
      <h2>Plan de pruebas (v1)</h2>
      <p>Los casos de prueba detallados por hoja Excel se documentan en README (checklist). Esta app no incluye aún la entidad Plan_Pruebas.</p>
    `;
  }

  /**
   * @param {string|null} id
   */
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
  }

  function openCreateDialog() {
    const db = getDb();
    if (!db) return;
    createMode = true;
    editingItem = null;
    modalTitle.textContent = "Nueva tarea";
    modalBody.innerHTML = buildCreateForm(db);
    modalOverlay?.classList.remove("hidden");
  }

  /**
   * @param {ProjectDb} db
   */
  function buildCreateForm(db) {
    const parents = db.items
      .map(
        (x) =>
          `<option value="${escapeHtml(x.id)}">${escapeHtml(x.id)} — ${escapeHtml(x.title)}</option>`
      )
      .join("");
    return `
      <div class="form-grid">
        <label>Nivel</label><select data-field="level">${["EPIC", "TOPIC", "TASK", "SUBTASK"].map((l) => `<option value="${l}" ${l === "TASK" ? "selected" : ""}>${l}</option>`).join("")}</select>
        <label>Parent</label><select data-field="parentId"><option value="">(ninguno)</option>${parents}</select>
        <label>Título</label><input data-field="title" value="" required />
        <label>Resumen</label><textarea data-field="summary"></textarea>
        <label>Épica</label><input data-field="epic" value="" />
        <label>Topic</label><input data-field="topic" value="" />
        <label>Task</label><input data-field="task" value="" />
        <label>Subtarea</label><input data-field="subtask" value="" />
        <label>Responsable</label><input data-field="owner" value="" />
        <label>Prioridad</label><input data-field="priority" value="Media" />
        <label>Estado</label><input data-field="status" value="Backlog" />
        <label>Def. OK</label><input type="checkbox" data-field="definitionOk" />
        <label>Release target</label><input data-field="releaseTarget" value="" />
        <label>Notas</label><textarea data-field="notes"></textarea>
      </div>`;
  }

  function buildEditForm(it, db) {
    const parents = db.items
      .filter((x) => x.id !== it.id)
      .map((x) => `<option value="${escapeHtml(x.id)}" ${x.id === it.parentId ? "selected" : ""}>${escapeHtml(x.id)} — ${escapeHtml(x.title)}</option>`)
      .join("");
    return `
      <div class="form-grid">
        <label>ID</label><input type="text" data-field="id" value="${escapeHtml(it.id)}" readonly />
        <label>Parent</label><select data-field="parentId"><option value="">(ninguno)</option>${parents}</select>
        <label>Nivel</label><select data-field="level">${["EPIC", "TOPIC", "TASK", "SUBTASK"].map((l) => `<option value="${l}" ${it.level === l ? "selected" : ""}>${l}</option>`).join("")}</select>
        <label>Título</label><input data-field="title" value="${escapeHtml(it.title)}" />
        <label>Resumen</label><textarea data-field="summary">${escapeHtml(it.summary)}</textarea>
        <label>Épica</label><input data-field="epic" value="${escapeHtml(it.epic)}" />
        <label>Topic</label><input data-field="topic" value="${escapeHtml(it.topic)}" />
        <label>Task</label><input data-field="task" value="${escapeHtml(it.task)}" />
        <label>Subtarea</label><input data-field="subtask" value="${escapeHtml(it.subtask)}" />
        <label>Responsable</label><input data-field="owner" value="${escapeHtml(it.owner)}" />
        <label>Prioridad</label><input data-field="priority" value="${escapeHtml(it.priority)}" />
        <label>Estado</label><input data-field="status" value="${escapeHtml(it.status)}" />
        <label>Seguimiento</label><input type="checkbox" data-field="inTracking" ${it.inTracking ? "checked" : ""} />
        <label>Def. OK</label><input type="checkbox" data-field="definitionOk" ${it.definitionOk ? "checked" : ""} />
        <label>Release target</label><input data-field="releaseTarget" value="${escapeHtml(it.releaseTarget)}" />
        <label>Pre version</label><input data-field="preVersion" value="${escapeHtml(it.preVersion)}" />
        <label>Pro version</label><input data-field="proVersion" value="${escapeHtml(it.proVersion)}" />
        <label>Fecha objetivo</label><input data-field="targetDate" value="${escapeHtml(it.targetDate)}" />
        <label>Fecha inicio</label><input data-field="startDate" value="${escapeHtml(it.startDate)}" />
        <label>Fecha fin</label><input data-field="completedAt" value="${escapeHtml(it.completedAt)}" />
        <label>Bloqueada</label><input type="checkbox" data-field="blocked" ${it.blocked ? "checked" : ""} />
        <label>Dependencias</label><input data-field="dependencies" value="${escapeHtml(it.dependencies)}" />
        <label>Notas</label><textarea data-field="notes">${escapeHtml(it.notes)}</textarea>
      </div>`;
  }

  function readFieldsFromModal() {
    /** @type {Record<string, string|boolean>} */
    const raw = {};
    const form = modalBody?.querySelectorAll("[data-field]");
    if (!form) return raw;
    for (const el of form) {
      const field = el.getAttribute("data-field");
      if (!field) continue;
      if (el instanceof HTMLInputElement && el.type === "checkbox") {
        raw[field] = el.checked;
      } else if (field === "parentId") {
        const v = /** @type {HTMLSelectElement} */ (el).value;
        raw[field] = v || "";
      } else {
        raw[field] = el.value;
      }
    }
    return raw;
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
      db.items.push(item);
      createMode = false;
      modalOverlay?.classList.add("hidden");
      onPersist();
      renderAll();
      toast(`Creado ${item.id}. Guarda el archivo para persistir.`);
      return;
    }
    if (!editingItem) return;
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
    if (String(editingItem.status) === STATUS_COMPLETED && !editingItem.completedAt) {
      editingItem.completedAt = new Date().toISOString().slice(0, 10);
    }
    modalOverlay?.classList.add("hidden");
    editingItem = null;
    onPersist();
    renderAll();
    toast("Cambios guardados en memoria. Usa Guardar para escribir el archivo.");
  }

  /**
   * @param {string} id
   */
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
      toast(`Seguimiento actualizado: ${res.updated} ítem(s).`);
    }
    onPersist();
    renderAll();
  }

  /**
   * @param {string|null} id
   */
  function doComplete(id) {
    const db = getDb();
    if (!db || !id) return;
    if (!window.confirm("¿Marcar como completada?")) return;
    completeItem(db.items, id);
    toast("Completada.");
    onPersist();
    renderAll();
  }

  function closeModal() {
    modalOverlay?.classList.add("hidden");
    editingItem = null;
    createMode = false;
  }

  modalClose?.addEventListener("click", closeModal);
  modalOverlay?.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  modalSave?.addEventListener("click", saveModal);

  filterText?.addEventListener("input", () => renderBacklog());
  filterOwner?.addEventListener("change", () => renderBacklog());
  filterEpic?.addEventListener("change", () => renderBacklog());
  filterTextT?.addEventListener("input", () => renderTracking());
  filterTextD?.addEventListener("input", () => renderDone());

  setupTableDelegation();

  function renderAll() {
    fillFilterSelects();
    renderBacklog();
    renderTracking();
    renderDone();
    renderPanel();
    renderHelp();
    refreshToolbar();
  }

  function fillFilterSelects() {
    const db = getDb();
    if (!db) return;
    const owners = db.catalogs.owners || [];
    const epics = db.catalogs.epics || [];
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
  }

  return { renderAll, openDetail, openCreateDialog, renderBacklog, renderPanel };
}
