/**
 * @typedef {import('./dataService.js').ProjectDb} ProjectDb
 */
import * as dataService from "./dataService.js";
import { mount } from "./ui.js";
import { cleanupOldTracking } from "./workItem.js";
import * as exportImport from "./importExport.js";

const toastEl = document.getElementById("toast");
let toastTimer = 0;

/**
 * @param {string} msg
 */
function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.add("hidden"), 4200);
}

function setToolbarEnabled(on) {
  document.querySelectorAll("#btn-save, #btn-export, #btn-import").forEach((b) => {
    /** @type {HTMLButtonElement} */ (b).disabled = !on;
  });
}

function refreshToolbar() {
  const has = dataService.getDb() != null;
  setToolbarEnabled(has);
  const labelEl = document.getElementById("file-label");
  const dirtyEl = document.getElementById("file-dirty");
  const savedEl = document.getElementById("file-saved");
  const db = dataService.getDb();

  if (labelEl) {
    if (!has) {
      labelEl.textContent = "Sin archivo — Abre o carga datos iniciales";
    } else {
      const name = db?.meta?.lastOpenedFileLabel || "project-db.json (memoria)";
      labelEl.textContent = `Archivo: ${name}`;
    }
  }
  if (dirtyEl) {
    dirtyEl.classList.toggle("hidden", !dataService.isDirty());
  }
  if (savedEl && db?.meta?.lastSavedAt) {
    const d = new Date(db.meta.lastSavedAt);
    savedEl.textContent = `Último guardado: ${d.toLocaleString()}`;
  } else if (savedEl) {
    savedEl.textContent = "";
  }
}

function onDataChange() {
  dataService.markDirty();
  refreshToolbar();
}

const ui = mount({
  getDb: () => dataService.getDb(),
  onDataChange,
  toast,
  refreshToolbar,
});

const btnOpen = document.getElementById("btn-open");
const btnSave = document.getElementById("btn-save");
const btnExport = document.getElementById("btn-export");
const btnImport = document.getElementById("btn-import");
const exportMenu = document.getElementById("export-menu");
const importMenu = document.getElementById("import-menu");
const btnLoadSeed = document.getElementById("btn-load-seed");
const btnRefresh = document.getElementById("btn-refresh");
const btnCleanup = document.getElementById("btn-cleanup");
const btnNewItem = document.getElementById("btn-new-item");
const importJson = document.getElementById("import-json");
const importCsv = document.getElementById("import-csv");
const bulkCsv = document.getElementById("bulk-csv");
const bulkReport = document.getElementById("bulk-report");
const btnBulkCsv = document.getElementById("btn-bulk-csv");
const pasteJson = /** @type {HTMLTextAreaElement|null} */ (document.getElementById("paste-json"));
const btnImportReplace = document.getElementById("btn-import-replace");
const btnImportMerge = document.getElementById("btn-import-merge");
const importReport = document.getElementById("import-report");
const btnDlJson = document.getElementById("btn-dl-json");
const btnDlTemplate = document.getElementById("btn-dl-template");
const btnCopyTemplate = document.getElementById("btn-copy-template");

btnOpen?.addEventListener("click", async () => {
  try {
    const data = await dataService.openDatabaseFile();
    if (data) {
      toast("Base cargada.");
      ui.renderAll();
    }
  } catch (e) {
    toast(String(e));
  }
});

btnSave?.addEventListener("click", async () => {
  try {
    await dataService.saveDatabaseFile();
    toast("Guardado correctamente.");
    refreshToolbar();
    ui.renderAll();
  } catch (e) {
    toast(String(e));
  }
});

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    if (dataService.getDb()) {
      dataService.saveDatabaseFile().then(() => {
        toast("Guardado.");
        refreshToolbar();
      });
    }
  }
});

btnExport?.addEventListener("click", (e) => {
  e.stopPropagation();
  exportMenu?.classList.toggle("hidden");
  importMenu?.classList.add("hidden");
});

btnImport?.addEventListener("click", (e) => {
  e.stopPropagation();
  importMenu?.classList.toggle("hidden");
  exportMenu?.classList.add("hidden");
});

document.addEventListener("click", () => {
  exportMenu?.classList.add("hidden");
  importMenu?.classList.add("hidden");
});

exportMenu?.addEventListener("click", (e) => e.stopPropagation());
importMenu?.addEventListener("click", (e) => e.stopPropagation());

exportMenu?.querySelectorAll("[data-export]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const kind = btn.getAttribute("data-export");
    const db = dataService.getDb();
    if (!db || !kind) return;
    try {
      if (kind === "json") {
        const blob = new Blob([exportImport.exportJsonString(db)], {
          type: "application/json",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = db.meta?.lastOpenedFileLabel || "project-db.json";
        a.click();
        URL.revokeObjectURL(a.href);
        toast("JSON exportado.");
      } else if (kind === "csv") {
        const blob = new Blob([exportImport.exportCsv(db)], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "project-export.csv";
        a.click();
        URL.revokeObjectURL(a.href);
        toast("CSV exportado.");
      } else if (kind === "xlsx") {
        exportImport.exportXlsxSnapshot(db, "project-snapshot.xlsx");
        toast("XLSX exportado.");
      }
    } catch (err) {
      toast(String(err));
    }
    exportMenu?.classList.add("hidden");
  });
});

importJson?.addEventListener("change", async () => {
  const f = importJson.files?.[0];
  if (!f) return;
  try {
    const text = await f.text();
    const data = exportImport.parseProjectJson(text);
    dataService.loadFromObject(data);
    const db = dataService.getDb();
    if (db) {
      db.meta = db.meta || {};
      db.meta.lastOpenedFileLabel = f.name;
    }
    toast("JSON importado.");
    ui.renderAll();
  } catch (e) {
    toast(String(e));
  }
  importJson.value = "";
});

importCsv?.addEventListener("change", async () => {
  const f = importCsv.files?.[0];
  if (!f) return;
  try {
    const text = await f.text();
    const db = dataService.getDb();
    if (!db) return;
    const res = exportImport.importCsvIntoDb(db, text);
    bulkReport.textContent =
      res.errors.length > 0
        ? `Insertadas: ${res.inserted}\nErrores:\n${res.errors.map((e) => `Línea ${e.line}: ${e.message}`).join("\n")}`
        : `Insertadas: ${res.inserted}`;
    toast(`CSV: ${res.inserted} filas, ${res.errors.length} errores`);
    onDataChange();
    ui.renderAll();
  } catch (e) {
    toast(String(e));
  }
  importCsv.value = "";
});

btnLoadSeed?.addEventListener("click", async () => {
  const seed = await dataService.tryLoadBundledSeed();
  if (seed) {
    dataService.setDb(seed);
    dataService.clearFileHandle();
    dataService.clearDirty();
    toast("Datos iniciales cargados.");
    ui.renderAll();
  } else {
    toast("No se pudo cargar (usa servidor local o Abrir archivo).");
  }
});

btnRefresh?.addEventListener("click", () => {
  ui.renderAll();
  toast("Vistas refrescadas.");
});

btnCleanup?.addEventListener("click", () => {
  const db = dataService.getDb();
  if (!db) return;
  const n = cleanupOldTracking(db.items);
  toast(`Limpieza: ${n} ítem(s) actualizados.`);
  onDataChange();
  ui.renderAll();
});

btnNewItem?.addEventListener("click", () => ui.openCreateDialog());

btnBulkCsv?.addEventListener("click", () => {
  const db = dataService.getDb();
  const text = bulkCsv?.value;
  if (!db || !text) {
    toast("Pega CSV o carga datos primero.");
    return;
  }
  const res = exportImport.importCsvIntoDb(db, text);
  bulkReport.textContent =
    res.errors.length > 0
      ? `Insertadas: ${res.inserted}\nErrores:\n${res.errors.map((e) => `Línea ${e.line}: ${e.message}`).join("\n")}`
      : `Insertadas: ${res.inserted}`;
  toast(`CSV masivo: ${res.inserted} filas.`);
  onDataChange();
  ui.renderAll();
});

btnDlJson?.addEventListener("click", () => {
  const db = dataService.getDb();
  if (!db) return;
  const blob = new Blob([exportImport.exportJsonString(db)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = db.meta?.lastOpenedFileLabel || "project-db.json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Descarga iniciada.");
});

btnDlTemplate?.addEventListener("click", () => {
  const blob = new Blob([exportImport.exportTemplateJson()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "last-mile-kanban-template.json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Plantilla descargada.");
});

btnCopyTemplate?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(exportImport.exportTemplateJson());
    toast("Plantilla copiada al portapapeles.");
  } catch {
    toast("No se pudo copiar.");
  }
});

btnImportReplace?.addEventListener("click", () => {
  const db = dataService.getDb();
  const text = pasteJson?.value?.trim();
  if (!db || !text) {
    toast("Pega JSON válido.");
    return;
  }
  try {
    const incoming = exportImport.parseProjectJson(text);
    if (!window.confirm("¿Reemplazar toda la base en memoria?")) return;
    exportImport.replaceProjectData(db, incoming);
    onDataChange();
    if (importReport) importReport.textContent = "Base reemplazada.";
    ui.renderAll();
    toast("Reemplazado.");
  } catch (e) {
    toast(String(e));
  }
});

btnImportMerge?.addEventListener("click", () => {
  const db = dataService.getDb();
  const text = pasteJson?.value?.trim();
  if (!db || !text) {
    toast("Pega JSON con ítems.");
    return;
  }
  try {
    const incoming = exportImport.parseProjectJson(text);
    const r = exportImport.mergeItemsById(db, incoming);
    if (importReport) importReport.textContent = `Fusionados: ${r.merged}, nuevos: ${r.added}`;
    onDataChange();
    ui.renderAll();
    toast("Fusión aplicada.");
  } catch (e) {
    toast(String(e));
  }
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const name = tab.getAttribute("data-tab");
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    const target = document.getElementById(`view-${name}`);
    target?.classList.remove("hidden");
  });
});

async function init() {
  const seed = await dataService.tryLoadBundledSeed();
  if (seed) {
    dataService.setDb(seed);
    dataService.clearDirty();
    toast("Datos iniciales cargados.");
  }
  ui.renderAll();
}

init();
