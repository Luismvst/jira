# Changelog — Last Mile Kanban

## 2026-03-23 — Cierre (test plans, filtros, búsqueda global)

- **Plan de pruebas:** `deleteTestPlanById`; referencia opcional `testPlanId` en la tarea; botón **Eliminar** en tabla, modal y detalle de tarea completada; confirmación antes de borrar; sin duplicados al crear (sigue `findTestPlanByTaskId`).
- **Seguimiento:** filtros por responsable, épica, estado, RLSE (subcadena) y bloqueo; combinan con la búsqueda global.
- **Completadas:** mismos desplegables de responsable y épica que en Backlog, más búsqueda en fila.
- **Búsqueda global:** `rowMatchesGlobalSearch` en Backlog, Seguimiento y Completadas (título, resumen, owner, épica, topic/task/subtask, estado, prioridad, notas, RLSE, release, versiones, etc.; case-insensitive).

## 2026-03 — Iteración mayor (plan Last Mile)

### Modelo y datos

- Estados normalizados: `BACKLOG`, `READY`, `IN_PROGRESS`, `IN_REVIEW`, `BLOCKED`, `COMPLETED` (migración automática desde JSON antiguo en español al cargar).
- Campo `rlse` en ítems para certificación / release.
- `ProjectDb` v2: `testPlans[]`, `ui` (preferencias: `treeExpandedIds`, columnas, orden), `meta` (`lastOpenedFileLabel`, `lastSavedAt`).
- Entidad **plan de pruebas** (`testPlans`): borrador al completar tarea; editable en pestaña dedicada.

### UX

- Marca **Last Mile Kanban**; pestaña **Panel** por defecto.
- Colapsado de jerarquía persistente en `ui.treeExpandedIds` (ya no se fuerza todo expandido).
- Seguimiento: acción **A backlog** (quitar seguimiento). Completadas: **RLSE**, enlace a plan, **Reabrir**.
- Indicador de **cambios sin guardar**, archivo actual y último guardado; **Ctrl+S** guarda.
- Panel ampliado: vencimientos, vencidas, bloqueadas, seguimiento, completadas recientes, por responsable/estado/release.
- Import/Export: pestaña JSON-first (descargar actual, plantilla, copiar, reemplazar, fusionar por ID); CSV secundario.

### Decisiones técnicas

- **`inTracking`**: se mantiene como flag operativo; al enviar a seguimiento se puede poner estado `IN_PROGRESS` si venía de backlog.
- **`blocked`**: alineado con `status === BLOCKED` al editar/guardar.
- **Sin backend**: persistencia solo vía JSON local; File System Access en Chromium; fallback descarga.

### Limitaciones

- Ordenación avanzada por columnas y selector de columnas visibles: base en `ui`; UI de configuración detallada puede ampliarse en siguientes iteraciones.
- XLSX sigue dependiendo de SheetJS (CDN).
