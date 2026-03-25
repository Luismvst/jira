# Last Mile Kanban

Aplicación web local (**HTML + CSS + JavaScript**) para gestión de backlog tipo Kanban/Jira ligero. **Una sola fuente de datos** en JSON (`items`, catálogos, `testPlans`, preferencias `ui`). Las vistas **Panel**, **Lista general** (todas las tareas), **Pizarra** (solo TASK activas en seguimiento), **Completadas** y **Plan de pruebas** comparten el mismo modelo.

## Cómo ejecutar

1. **Recomendado:** servidor HTTP local (módulos ES y `fetch` del seed fallan con `file://`):

   ```bash
   npx serve .
   ```

   O en Windows: ejecuta `run.bat` (Python `http.server`).

2. **Abrir base de datos:** botón **Abrir base de datos** y elige un JSON (p. ej. `data/project-db.json`).

3. **Guardar:** con **File System Access**, **Guardar** sobrescribe el mismo archivo. Indicador de **cambios sin guardar**, nombre de archivo y último guardado. Atajo **Ctrl+S**.

## Estados y modelo

- Estados (v3): `BACKLOG`, `PENDING`, `IN_PROGRESS`, `BLOCKED`, `CERTIFICATION`, `DONE` (JSON v1/v2 y etiquetas en español se migran al cargar).
- `inTracking`: tarea en seguimiento operativo; la **Pizarra** muestra solo ítems `level === TASK` con `inTracking` (incluye hechas si siguen en seguimiento).
- `type`: `task` | `bug` | `feature` por ítem.
- `activityLog` / `comments`: historial y comentarios por tarea (append-only).
- `rlse`: identificador de release/certificación (completadas y planes de prueba).
- **Plan de pruebas:** borrador al completar una tarea; edición en la pestaña **Plan de pruebas**.

## Importar / exportar

- Pestaña **Importar / Exportar** (JSON principal): descargar actual, plantilla, copiar ejemplo, reemplazar o fusionar por `id`.
- CSV y XLSX como opciones secundarias (menú o CSV en la misma pestaña).

## Estructura del proyecto

```
├── index.html
├── run.bat
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

## Limitaciones

- `file://` puede no cargar el seed; usar servidor local o **Abrir base de datos**.
- File System Access: principalmente Chromium.
- Ordenación avanzada por columnas y selector visual de columnas: `ui.columnVisibility` está preparado; la UI puede ampliarse en iteraciones posteriores.
