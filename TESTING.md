# Checklist de pruebas manuales (Last Mile Kanban)

Ejecutar con **servidor HTTP local** (`run.bat` o `npx serve .`). No usar `file://` para el seed.

---

## Arranque y datos

- [ ] La app carga sin errores en la consola del navegador (F12).
- [ ] Con seed por defecto: aparece toast “Datos iniciales cargados” o datos visibles en Panel / Lista general.
- [ ] **Abrir base de datos**: seleccionar un JSON válido; etiqueta de archivo y “Último guardado” coherentes.
- [ ] **Guardar** (y **Ctrl+S**): archivo se escribe; indicador “Cambios sin guardar” se comporta bien.

---

## Navegación y accesibilidad básica

- [ ] Pestañas: Panel → Lista general → Pizarra → Completadas → Plan de pruebas → Importar → Ayuda; solo una vista visible.
- [ ] Al ir a **Pizarra**, el contenido se refresca (tarjetas al día).
- [ ] Con modal de detalle abierto: **Esc** cierra el modal.
- [ ] Con modal cerrado: **Esc** no rompe nada.
- [ ] **Ayuda** lista atajos (Ctrl+S, Esc, pizarra, lista).

---

## Lista general

- [ ] Árbol por defecto (sin filtros de texto/estado/prioridad): expandir/contraer nodos.
- [ ] Activar **filtros** (texto, responsable, épica, estado, prioridad): pasa a lista plana y respeta filtros.
- [ ] **Sin resultados**: mensaje “Sin resultados” (no tabla rota).
- [ ] Clic en **cabeceras ordenables**: orden cambia; repetir invierte dirección.
- [ ] Columna **Activa**: badge coherente con `inTracking`.
- [ ] Columna **Tipo**: task / bug / feature visible.
- [ ] Clic en **ID** abre modal de edición.

---

## Activación y validaciones

- [ ] **Activar** en ítem **sin responsable**: toast con error claro; no entra en pizarra.
- [ ] **Activar** sin definición mínima (sin Def. OK y resumen corto): toast con error.
- [ ] **Activar** en TASK o TOPIC válida: entra en pizarra (estado pasa a Pendiente si estaba en Backlog).
- [ ] **Activar** con descendientes (confirmación): solo ítems válidos se actualizan; errores listados si hay hijos inválidos.

---

## Pizarra

- [ ] **Vacía** (ninguna TASK/TOPIC en seguimiento): mensaje “Pizarra vacía” + requisitos.
- [ ] Con tareas en pizarra: línea resumen “N tareas en pizarra”.
- [ ] **Filtros** de pizarra (texto, responsable, épica): reducen tarjetas; si ninguna coincide: mensaje + **Quitar filtros** restaura.
- [ ] **Por estado**: cinco columnas (Pendiente … Completada); contadores por columna.
- [ ] **Por responsable**: swimlanes; columna “Sin asignar” si aplica.
- [ ] **Hover / tooltip** en tarjeta: título largo visible en tooltip nativo.
- [ ] **Arrastrar** a otra columna de estado: estado y persistencia tras guardar JSON.
- [ ] **Arrastrar** a columna Completada: tarea Done; sigue en pizarra si `inTracking`.
- [ ] **Modo por responsable**: soltar en otra persona cambia responsable y se refleja al guardar.
- [ ] **Doble clic** en tarjeta abre detalle.
- [ ] Scroll horizontal en columnas estrechas: usable.

---

## Modal de detalle

- [ ] Pestañas **Datos / Subtareas / Comentarios / Actividad** cambian panel.
- [ ] **Guardar** en datos persiste cambios; toast “Cambios guardados”.
- [ ] Crear **Nueva tarea** desde lista: formulario guarda sin error (antes fallaba sin `readFieldsFromModal`).
- [ ] **Comentario**: publicar añade línea en comentarios y en actividad.
- [ ] **Subtarea rápida**: crea ST-xxx y aparece en pestaña Subtareas.
- [ ] **Actividad**: eventos recientes (estado, owner, activación, etc.) legibles.

---

## Completadas y reapertura

- [ ] **Completar** desde lista: ítem pasa a Completadas; plan borrador si aplica.
- [ ] **Reabrir**: vuelve a backlog y sale de completadas.
- [ ] **Limpiar seguimiento >30d** (solo ítems completados antiguos en tracking): no borra datos críticos.

---

## Importar / exportar

- [ ] **Exportar JSON**: descarga coherente con lo en pantalla.
- [ ] **Importar** reemplazar / fusionar: no corrompe IDs conocidos (revisar mensaje de informe).

---

## Persistencia y migración

- [ ] Guardar, **recargar página** (F5), **Abrir** mismo archivo: estados, comentarios, log y pizarra iguales.
- [ ] Abrir JSON **antiguo (v2)**: migración silenciosa a v3; estados renombrados correctamente.

---

## Regresiones rápidas

- [ ] **Panel**: KPIs y enlaces abren detalle.
- [ ] **Plan de pruebas**: abrir / editar / eliminar sin excepción.
- [ ] Tablas largas: **cabecera** de tabla permanece visible al hacer scroll vertical (sticky).

---

## Entorno

- [ ] Probar en **Chromium** (recomendado para File System Access).
- [ ] Opcional: ventana estrecha (~360px): toolbar y pizarra siguen usables (scroll).
