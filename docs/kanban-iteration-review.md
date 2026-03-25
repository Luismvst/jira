# Last Mile Kanban — revisión e iteración (diagnóstico y plan)

Este documento **adapta** el prompt largo de “Staff Engineer / iteración integral” al **proyecto real** (HTML + CSS + JS modular, JSON local, sin build ni suite de tests).  
**No** incluye obligación de tests automatizados: la validación será **manual** y, al cerrar la iteración, conviene **actualizar** el checklist en `TESTING.md` (no crear framework de tests salvo que tú lo pidas después).

---

## 1. Qué del prompt original encaja y qué se deja fuera

| Enfoque original | En este repo |
|------------------|--------------|
| Análisis completo antes de tocar código | Sí |
| Plan por fases pequeñas, proyecto siempre usable | Sí |
| Tests unitarios / E2E / “compila y ejecuta tests” | **No** (no hay `package.json`, ni runner). Sustituido por prueba manual + checklist |
| Commits pequeños y frecuentes | Recomendado si usas git; no es requisito del entorno |
| “Un comando único” dev server | Valorable; hoy es `run.bat` o `npx serve .` sin `package.json` en raíz |

---

## 2. Stack y arquitectura (estado actual)

- **Entrada:** `index.html` + módulos ES en `js/`.
- **Datos:** un único `ProjectDb` (items, catálogos, `testPlans`, `ui`, `meta`). Persistencia vía File System Access o export/import.
- **Vistas principales:** Panel, **Lista general** (backlog en tabla), **Pizarra**, Completadas, Plan de pruebas, Importar/exportar.
- **Arranque:** servidor estático (`run.bat` → Python `http.server` en ventana aparte + abre navegador), o `npx serve .` según README.

Archivos núcleo:

- Modelo / reglas: `js/workItem.js`, `js/constants.js`
- Pizarra + DnD: `js/board.js`, `css/styles.css`
- Lista, modales, acciones: `js/ui.js`
- Planes de prueba: `js/testPlans.js`, formulario en `ui.js`
- Datos: `js/dataService.js`, `data/project-db.json`

---

## 3. Modelo de dominio hoy (resumen claro)

- **`WorkItem.level`:** `EPIC` → `TOPIC` → `TASK` → `SUBTASK` (jerarquía validada en `validateHierarchy`).
- **`type`:** `task` | `bug` | `feature` (tipo de trabajo, no confundir con `level`).
- **Flujo de estado:** `BACKLOG` (fuera de columnas de pizarra) y columnas `PENDING` … `DONE` (`BOARD_COLUMNS` en `constants.js`).
- **Seguimiento:** `inTracking` + estado; la pizarra filtra con `filterBoardTasks` → `inTracking` **y** `isBoardVisibleLevel(level)`.
- **`isBoardVisibleLevel`:** en código actual admite **`TASK` y `TOPIC`** (`BOARD_VISIBLE_LEVELS` en `constants.js`). El README dice solo TASK: hay **desalineación documentación ↔ código**.

---

## 4. Diagnóstico — incoherencias y causas probables

### 4.1 Activación vs pizarra (crítico)

- **`sendToTracking`** puede marcar como en seguimiento **cualquier** ítem que pase `validateForTracking` (incluidos `EPIC` y, en flujo normal, `TOPIC`).
- La **pizarra solo muestra** niveles en `BOARD_VISIBLE_LEVELS` (TASK y TOPIC).
- **Consecuencia:** Un usuario puede **activar** una épica: el ítem pasa a `PENDING` / `inTracking`, pero **no aparece en la pizarra**. El toast en `doSendTracking` ya avisa para niveles no visibles en tablero, pero la **UI sigue ofreciendo “Activar”** igual que para una tarea — fricción y sensación de bug.

### 4.2 TOPIC en pizarra vs intención de producto

- Si el producto debe ser “solo unidades ejecutables tipo tarea en Kanban”, tener **TOPIC** como tarjeta en pizarra puede ser **incorrecto** o confuso frente al README (“solo TASK activas”).
- Hay que **decidir una regla única** y alinear `BOARD_VISIBLE_LEVELS`, mensajes vacíos de pizarra, README y botones de activar.

### 4.3 SUBTASK

- Se puede **activar** (con validación); no sale en pizarra. El comportamiento es coherente con el filtro, pero la **acción “Activar”** debería estar **oculta o deshabilitada** con explicación, o el producto debe permitir subtareas en tablero (implica cambio de modelo/UI mayor). Lo pragmático: **no activar SUBTASK** desde lista si no van al tablero.

### 4.4 Lista general: árbol vs “tipo Excel”

- Con **filtros desactivados** la lista se renderiza en **árbol** (expand/collapse con `ui.treeExpandedIds`).
- Con **filtros activos** pasa a lista **plana** ordenada.
- **`db.ui.viewMode`** existe en el esquema (`tree` | `flat`) pero **`renderBacklog` no lo usa**: la preferencia está **muerta**. Eso impide un modo “siempre plano” sin hacks.
- El árbol mezcla **nivel** (`EPIC`/`TOPIC`/…) con **tipo** (`task`/`bug`): columnas separadas ayudan, pero la **jerarquía visual + acciones idénticas** en todos los niveles refuerza la confusión.

### 4.5 Drag and drop

- Los listeners están en **`.board-column`** (contenedor completo), no solo en el cuerpo; aun así, **`board-col-body`** tiene `flex: 1` dentro de columna con `max-height: 70vh` — con **pocas tarjetas** el área útil visual para “soltar al final” puede sentirse **pequeña** frente a una columna vacía con solo el texto “Sin tareas”.
- No hay **zona de drop dedicada** al final de columna (padding/min-height generoso o placeholder persistente).
- **reordenación** dentro de la misma columna: el modelo **no persiste orden intra-columna** entre tarjetas (solo `status` / owner en modo swimlane); si se espera orden manual, faltaría campo o convención — hoy es limitación conocida, no bug de DnD solo.

### 4.6 Plan de pruebas

- **Un plan por `taskId`** (`findTestPlanByTaskId`): no hay historial nativo de “prueba 1, prueba 2…” como ejecuciones sucesivas.
- Estado **`BORRADOR`** y muchos campos (pasos, esperado, real, evidencias, certificación…) encajan con un **documento único**, no con “registro operativo acumulativo”.
- `ensureDraftTestPlan` al completar: coherente con ese modelo, pero choca con el objetivo de **varias pruebas por tarea** sin fricción.

### 4.7 Arranque local

- `run.bat` abre **segunda ventana** (`start cmd /k`) para el servidor: funciona, pero es la “experiencia torpe” que mencionas.
- No hay `package.json`; depender de `npx serve` sin pin de versión está documentado pero no unificado.

---

## 5. Decisiones recomendadas (producto + implementación)

1. **Regla de pizarra:** Definir explícitamente qué niveles son **ejecutables en Kanban**. Opción pragmática alineada con tu README y criterios: **`TASK` únicamente** en pizarra (retirar `TOPIC` de `BOARD_VISIBLE_LEVELS` salvo que decidas explícitamente lo contrario).
2. **Activación:** Solo mostrar **Activar** (y quizá el diálogo de descendientes) para ítems que **puedan aparecer en pizarra** tras activar. Para el resto: sin botón o botón deshabilitado + tooltip.
3. **Lista:** Implementar **`viewMode`** de verdad: modo **plano por defecto** o conmutador persistente “Árbol / Plano”, con plano estilo tabla escaneable (indentación mínima opcional por `parentId` solo en modo árbol).
4. **DnD:** Mejora **solo presentación y hit area** (min-height en `board-col-body`, padding inferior grande, quizá `::after` o bloque “Soltar aquí” en columnas vacías o al final) sin inventar persistencia de orden si no la pides.
5. **Plan de pruebas:** Evolucionar a **`testRuns[]` o entradas múltiples** bajo el mismo `taskId` (migración suave: si existe un `TestPlan` legacy, convertir a primera entrada o mantener compatibilidad leyendo ambos). UI: lista compacta + “Añadir prueba” con campos mínimos (nombre, resultado, fecha, notas opcionales).
6. **DX:** Mejorar `run.bat` (o añadir `package.json` mínimo con script `start`) para **un comando** que levante servidor **en primer plano** o una sola ventana con instrucción clara — sin obligar a Node si el usuario prefiere Python.

---

## 6. Plan de implementación por fases (pequeñas, entregables)

Cada fase debe terminar con app usable y **validación manual** corta (3–10 min). No avanzar si la fase rompe carga/guardado/pizarra.

### Fase A — Reglas de dominio y activación (alto valor, bajo riesgo si se acota)

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Una sola verdad: qué puede ir a pizarra; UI y `sendToTracking` alineados. |
| **Archivos** | `js/constants.js` (`BOARD_VISIBLE_LEVELS`), `js/workItem.js` (opcional helper `canAppearOnBoard`), `js/ui.js` (render de acciones, mensajes `doSendTracking`), `README.md` (una frase si cambia la regla). |
| **Riesgo** | Bajo: datos antiguos con TOPIC en pizarra dejarían de mostrarse si se quita TOPIC — documentar o migración one-shot en `migrate.js` si hace falta. |
| **Validación manual** | Activar EPIC/TOPIC/SUBTASK: no debe confundir (sin Activar o deshabilitado). Activar TASK válida: aparece en PENDIENTE en pizarra; recargar JSON conserva estado. |
| **Criterio de aceptación** | Ninguna acción de “Activar” sugiere resultado que la pizarra no cumple. |

### Fase B — Lista general más plana y usable

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Tabla tipo Excel: plano por defecto o toggle persistente; menos fricción en expand/collapse. |
| **Archivos** | `js/ui.js` (`renderBacklog`, persistencia `db.ui.viewMode`), `index.html` (control UI si hace falta), `css/styles.css` (densidad, headers, filas). |
| **Riesgo** | Medio-bajo: tocar solo render, no el modelo de items. |
| **Validación manual** | Cambiar modo, guardar, recargar: modo se conserva. Filtros + ordenación siguen funcionando. |
| **Criterio de aceptación** | Vista plana escaneable; jerarquía solo cuando el usuario la elige. |

### Fase C — Robustez pizarra (estado y filtros)

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Tras activar TASK, siempre visible en columna correcta; estados “fantasma” revisados (p. ej. status fuera de `BOARD_COLUMNS` → fallback ya existe; revisar edge cases). |
| **Archivos** | `js/board.js`, `js/workItem.js` si hace falta coherencia al activar. |
| **Validación manual** | Completar desde pizarra, reabrir desde completadas, volver a activar; filtros pizarra + limpiar filtros. |
| **Criterio de aceptación** | La pizarra refleja `inTracking` + `status` sin contradicciones visibles con la lista. |

### Fase D — Drag & drop más cómodo

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Zonas de drop grandes, columnas vacías cómodas, feedback claro. |
| **Archivos** | `css/styles.css`, posiblemente `js/board.js` (elemento drop zone al final de `.board-col-body`). |
| **Riesgo** | Bajo. |
| **Validación manual** | Columna vacía, 1 tarjeta, muchas; scroll vertical dentro de columna. |
| **Criterio de aceptación** | No hace falta apuntar a un “pixel” pequeño para soltar. |

### Fase E — Plan de pruebas acumulativo

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Varias ejecuciones/pruebas por tarea; menos “documento único rígido”; eliminar o rebajar “BORRADOR” si sobra. |
| **Archivos** | `js/dataService.js` (tipos), `js/testPlans.js`, `js/ui.js` (formulario/lista), `js/migrate.js` (migración datos antiguos), quizá `importExport.js` si exporta testPlans. |
| **Riesgo** | **Alto** (cambio de forma de datos). Mitigar con migración al cargar y lectura compatible. |
| **Validación manual** | Tarea completada → añadir dos pruebas; recargar; export/import JSON. |
| **Criterio de aceptación** | Flujo diario: añadir prueba en &lt; 30 s sin pasos redundantes. |

### Fase F — Pulido visual ligero

| Campo | Contenivo |
|-------|-----------|
| **Objetivo** | Espaciado, badges, hover en tabla y pizarra, coherencia sin rediseño. |
| **Archivos** | `css/styles.css`, toques mínimos en `index.html` si aplica. |
| **Riesgo** | Muy bajo. |
| **Validación manual** | Navegación rápida por pestañas. |
| **Criterio de aceptación** | Misma identidad visual, sensación más “producto”. |

### Fase G — Arranque / DX

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Un flujo claro: un comando o un `.bat` que no obligue a dos ventanas sin necesidad. |
| **Archivos** | `run.bat`, opcional `package.json` + script, `README.md`. |
| **Riesgo** | Bajo. |
| **Validación manual** | Arranque en máquina limpia (solo Python o solo Node según camino). |
| **Criterio de aceptación** | README describe un método recomendado en 1–2 líneas. |

### Fase H — Cierre (sin tests automáticos)

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Regresión manual completa; documentación breve final. |
| **Archivos** | `TESTING.md` (checklist actualizado), `docs/kanban-iteration-summary.md` (opcional: qué cambió / cómo probar / cómo levantar) o ampliar `CHANGELOG.md`. |
| **Riesgo** | N/A |
| **Validación manual** | Recorrer checklist tipo el prompt original (activación, estados, DnD, lista, pruebas, arranque) en una pasada. |
| **Criterio de aceptación** | Lista de comprobación ejecutada sin fallos bloqueantes. |

---

## 7. Autocrítica del plan (mejoras respecto a un plan genérico)

- **E y A no deberían mezclarse:** cambiar modelo de pruebas al mismo tiempo que reglas de board multiplica riesgo. Orden sugerido: **A → B → C → D → E → F → G → H**.
- **TOPIC:** La fase A debe incluir **decisión explícita** (comentario en `constants.js` + README) para no reabrir el debate en cada PR.
- **Orden intra-columna:** Fuera de alcance salvo que en D descubras necesidad; documentado como límite para no sobreingenierizar.
- **Tests:** Sustituidos por checklist; si más adelante añades Vitest/Jest, la Fase H puede incorporar 2–3 pruebas de **funciones puras** (`validateForTracking`, migración) sin bloquear esta iteración.

---

## 8. Próximo paso

Cuando quieras **ejecutar el plan**, conviene hacerlo **fase a fase** empezando por **Fase A**, validar, y solo entonces seguir. Si confirmas la regla de negocio “**solo TASK en pizarra**” (o “TASK + TOPIC”), se implementa A sin ambigüedad.

---

*Documento generado como base para la iteración; alinear con decisiones finales de producto antes de commitear cambios de código.*
