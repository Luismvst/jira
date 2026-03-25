# Checklist de pruebas manuales (Last Mile Kanban)

Ejecutar con **servidor HTTP local** (`run.bat` o `npm start` / `npx serve . -l 8765`). No usar `file://` para el seed.

---

## Arranque y datos

- [ ] La app carga sin errores en la consola del navegador (F12).
- [ ] Con seed por defecto: aparece toast “Datos iniciales cargados” o datos visibles en Panel / Lista general.
- [ ] **Abrir base de datos**: seleccionar un JSON válido; etiqueta de archivo y “Último guardado” coherentes.
- [ ] **Guardar** (y **Ctrl+S**): archivo se escribe; indicador “Cambios sin guardar” se comporta bien.
- [ ] `run.bat` deja **una ventana** con el servidor (o prueba `npm start` si tienes Node).

---

## Navegación y accesibilidad básica

- [ ] Pestañas: Panel → Lista general → Pizarra → Completadas → Plan de pruebas → Importar → Ayuda; solo una vista visible.
- [ ] Al ir a **Pizarra**, el contenido se refresca (tarjetas al día).
- [ ] Con modal de detalle abierto: **Esc** cierra el modal.
- [ ] Con modal cerrado: **Esc** no rompe nada.
- [ ] **Ayuda** describe TASK en pizarra y pruebas acumulativas.

---

## Lista general

- [ ] **Vista Plana / Árbol**: el modo activo se ve resaltado; al guardar y recargar se conserva (`ui.viewMode`).
- [ ] Con **filtros** (texto, responsable, épica, estado, prioridad): siempre lista plana aunque el modo sea árbol.
- [ ] En modo **árbol** sin filtros: expandir/contraer nodos.
- [ ] **Sin resultados**: mensaje “Sin resultados” (no tabla rota).
- [ ] Clic en **cabeceras ordenables**: orden cambia; repetir invierte dirección.
- [ ] Columna **Activa**: badge coherente con `inTracking`.
- [ ] **Activar** solo en filas **TASK**; en EPIC/TOPIC/SUBTASK aparece “—” con tooltip.
- [ ] Clic en **ID** abre modal de edición.

---

## Activación y validaciones

- [ ] **Activar** en ítem **sin responsable**: toast con error claro; no entra en pizarra.
- [ ] **Activar** sin definición mínima: toast con error.
- [ ] **Activar** en **TASK** válida: entra en pizarra (Pendiente si estaba en Backlog).
- [ ] **Activar** con confirmación de hijas: solo **TASK** descendientes válidas se marcan; errores listados si hay hijas inválidas.
- [ ] No debe poder “activarse” una épica/tópico/subtarea desde la lista (sin botón).

---

## Pizarra

- [ ] **Vacía**: mensaje coherente (solo TASK en seguimiento) + requisitos.
- [ ] Con tareas en pizarra: resumen “N tareas en pizarra”.
- [ ] **Filtros** de pizarra: reducen tarjetas; si ninguna coincide: mensaje + **Quitar filtros**.
- [ ] **Por estado**: cinco columnas; contadores por columna.
- [ ] **Por responsable**: swimlanes; “Sin asignar” si aplica.
- [ ] **Arrastrar** entre columnas: estado persiste al guardar JSON.
- [ ] **Soltar** al **final** de columna o en columna casi vacía: cómodo (zona amplia / cola).
- [ ] **Modo por responsable**: soltar en otra persona cambia responsable.
- [ ] **Doble clic** en tarjeta abre detalle.
- [ ] Scroll horizontal en columnas: usable.

---

## Modal de detalle

- [ ] Pestañas **Datos / Subtareas / Comentarios / Actividad** cambian panel.
- [ ] **En pizarra** deshabilitado si el nivel no es TASK; al guardar no deja `inTracking` incoherente.
- [ ] Tarea **completada**: bloque “Ver / añadir pruebas” y contador de entradas.
- [ ] **Guardar** en datos persiste cambios; toast “Cambios guardados”.
- [ ] **Nueva tarea** desde lista: formulario guarda sin error.
- [ ] **Comentario** y **Subtarea rápida** funcionan.
- [ ] **Actividad**: eventos legibles.

---

## Completadas, pruebas y migración

- [ ] **Completar** desde lista: ítem pasa a Completadas (sin crear plan automático).
- [ ] **Pruebas** en completadas: modal con lista + formulario **Añadir**; varias entradas por la misma tarea.
- [ ] Clic en nombre de prueba: edición individual; **Guardar** y **Eliminar** coherentes.
- [ ] Pestaña **Plan de pruebas**: tabla de todas las entradas `testRuns`.
- [ ] **Reabrir** tarea completada: vuelve a backlog.
- [ ] **Limpiar seguimiento >30d**: no borra datos críticos.
- [ ] Abrir JSON **antiguo con `testPlans`**: tras cargar, datos en `testRuns` (revisar en export JSON).

---

## Importar / exportar

- [ ] **Exportar JSON**: incluye `testRuns`; `testPlans` vacío si ya migró.
- [ ] **Importar** reemplazar / fusionar ítems: no corrompe lo esperado (fusionar no mezcla `testRuns` de incoming — solo ítems).

---

## Persistencia

- [ ] Guardar, **recargar página** (F5), **Abrir** mismo archivo: pizarra, pruebas y `viewMode` coherentes.

---

## Regresiones rápidas

- [ ] **Panel**: KPI “En seguimiento” solo lista TASK en seguimiento.
- [ ] Tablas: cabecera **sticky** al hacer scroll vertical.

---

## Entorno

- [ ] Probar en **Chromium** (recomendado para File System Access).
- [ ] Ventana estrecha: toolbar y pizarra usables (scroll).
