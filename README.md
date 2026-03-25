# Last Mile Kanban

Aplicación web local (**HTML + CSS + JavaScript**) para gestión de backlog tipo Kanban/Jira ligero. **Una sola fuente de datos** en JSON (`items`, catálogos, `testRuns`, `testPlans` vacío tras migración, preferencias `ui`). Las vistas **Panel**, **Lista general**, **Pizarra** (solo **TASK** en seguimiento), **Completadas** y **Plan de pruebas** comparten el mismo modelo.

## Cómo ejecutar

1. **Servidor HTTP** (obligatorio para módulos ES y `fetch` del seed; no uses `file://`):

   - **Windows:** doble clic en `run.bat` — abre el navegador y deja **un solo proceso** en la ventana (Python `http.server`, o `npx serve` si no hay Python).
   - **Con Node:** en la carpeta del proyecto: `npm start` (equivale a `npx serve` en el puerto 8765).

   ```bash
   npx serve . -l 8765
   ```

2. **Abrir base de datos:** botón **Abrir base de datos** y elige un JSON (p. ej. `data/project-db.json`).

3. **Guardar:** con **File System Access**, **Guardar** sobrescribe el mismo archivo. Indicador de **cambios sin guardar**, nombre de archivo y último guardado. Atajo **Ctrl+S**.

## Estados y modelo

- Estados (v3): `BACKLOG`, `PENDING`, `IN_PROGRESS`, `BLOCKED`, `CERTIFICATION`, `DONE` (JSON v1/v2 y etiquetas en español se migran al cargar).
- `inTracking`: seguimiento operativo; la **Pizarra** muestra solo **`level === TASK`** con `inTracking` (incluye completadas si siguen en seguimiento). Épicas, tópicos y subtareas no se activan para pizarra.
- `type`: `task` | `bug` | `feature` por ítem (independiente del nivel EPIC/TOPIC/TASK/SUBTASK).
- `activityLog` / `comments`: historial y comentarios por tarea (append-only).
- `rlse`: identificador de release/certificación.
- **Pruebas:** varias entradas por tarea en `testRuns[]` (nombre, resultado, fecha, notas…). Los JSON antiguos con `testPlans` se migran al abrir.
- **Lista general:** vista **Plana** o **Árbol** (persistente en `ui.viewMode`).

## Importar / exportar

- Pestaña **Importar / Exportar** (JSON principal): descargar actual, plantilla, copiar ejemplo, reemplazar o fusionar por `id`.
- CSV y XLSX como opciones secundarias (menú o CSV en la misma pestaña).

## Estructura del proyecto

```
├── index.html
├── run.bat
├── package.json
├── css/styles.css
├── data/project-db.json
├── js/
│   ├── app.js
│   ├── constants.js
│   ├── dataService.js
│   ├── importExport.js
│   ├── migrate.js
│   ├── testPlans.js
│   ├── ui.js
│   ├── board.js
│   ├── activityLog.js
│   ├── comments.js
│   └── workItem.js
├── scripts/generate-seed.mjs
├── CHANGELOG.md
└── README.md
```

## Documentación de cambios

Ver [CHANGELOG.md](CHANGELOG.md).

## Pruebas manuales

Checklist detallado en [TESTING.md](TESTING.md).

## Limitaciones

- `file://` puede no cargar el seed; usar servidor local o **Abrir base de datos**.
- File System Access: principalmente Chromium.
- Ordenación avanzada por columnas y selector visual de columnas: `ui.columnVisibility` está preparado; la UI puede ampliarse en iteraciones posteriores.
