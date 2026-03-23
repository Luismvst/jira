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
  const status = document.getElementById("file-status");
  if (status) {
    status.textContent = has
      ? dataService.hasFileHandle()
        ? "Archivo vinculado (guardar sobrescribe)"
        : "Datos en memoria (guardar descarga o elige destino)"
      : "Sin archivo — Abre o carga el ejemplo";
  }
}

function onPersist() {
  /* no-op; persist is explicit save */
}

const ui = mount({
  getDb: () => dataService.getDb(),
  onPersist,
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
const bulkJson = document.getElementById("bulk-json");
const btnBulkJson = document.getElementById("btn-bulk-json");

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
  } catch (e) {
    toast(String(e));
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
        a.download = "project-db.json";
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
    toast("JSON importado (memoria).");
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
    toast("Cargado ejemplo desde data/project-db.json.");
    ui.renderAll();
  } else {
    toast("No se pudo cargar el seed (usa un servidor local o Abrir archivo).");
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
  ui.renderAll();
});

btnBulkJson?.addEventListener("click", () => {
  const db = dataService.getDb();
  const text = bulkJson?.value?.trim();
  if (!db || !text) {
    toast("Pega JSON válido.");
    return;
  }
  try {
    const parsed = exportImport.parseProjectJson(text);
    if (!window.confirm("¿Reemplazar toda la base en memoria con este JSON?")) return;
    dataService.loadFromObject(parsed);
    toast("Base reemplazada en memoria.");
    ui.renderAll();
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
    toast("Datos iniciales cargados (seed).");
  }
  ui.renderAll();
}

init();
