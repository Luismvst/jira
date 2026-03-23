Prompt — Aplicación web local ligera con JSON como base de datos

Quiero que actúes como un senior software architect + frontend engineer, con foco en simplicidad, mantenibilidad, cero dependencias innecesarias y ejecución local, y construyas una aplicación web para gestión de proyecto tipo Kanban/Jira simplificado.

1. Contexto

He intentado construir este sistema en Excel + VBA y no ha funcionado bien por:

vistas dinámicas frágiles
dificultad en jerarquía
macros difíciles de mantener
mala UX
difícil iteración en repo

Por eso quiero migrarlo a una aplicación web local muy ligera.

2. Restricción clave

NO puedo depender de:

backend desplegado
instalación compleja
muchas librerías

La aplicación debe:

ejecutarse en local
abrirse en navegador
funcionar sin servidor
persistir datos en un archivo local
3. Arquitectura obligatoria
Frontend
HTML + CSS + JavaScript (preferiblemente modular)
sin frameworks pesados
evitar dependencias innecesarias
Persistencia
archivo JSON como base de datos
ubicado en una carpeta (ej: /data/project-db.json)
acceso mediante selección de archivo por el usuario (File System Access API o fallback)
Export/Import
export JSON
import JSON
export CSV
import CSV
export XLSX snapshot
4. Modelo de datos

Entidad principal: WorkItem

Campos:

id
parentId
level (EPIC, TOPIC, TASK, SUBTASK)
title
summary
epic
topic
task
subtask
owner
priority
status
inTracking (boolean)
definitionOk (boolean)
releaseTarget
preVersion
proVersion
createdAt
targetDate
startDate
completedAt
blocked (boolean)
dependencies
notes
5. Vistas

Debe haber:

Backlog
todo lo no completado
jerarquía expandible
filtros
Seguimiento
items con inTracking = true
no completados
Completadas
items con status = COMPLETED
Panel
KPIs:
total tareas
en seguimiento
completadas
por responsable
por estado
6. Funcionalidades obligatorias
Crear tareas
formulario
asignar automáticamente:
id
createdAt
inTracking = false
Enviar a seguimiento
validar campos obligatorios
preguntar inclusión de descendientes:
EPIC → topics/tareas/subtareas
TOPIC → tareas/subtareas
TASK → subtareas
Completar tarea
status = COMPLETED
completedAt = hoy
inTracking = false
Validaciones

No permitir enviar a seguimiento si faltan:

title
owner
priority
epic
definitionOk = true
7. UX / Diseño

Quiero una UI:

limpia
profesional
fácil de usar
rápida de leer
Requisitos visuales
tabla clara
badges de estado
colores:
gris → seguimiento
verde → completadas
rojo suave → bloqueos
panel de detalle (modal o lateral)
filtros visibles
8. Persistencia
Flujo esperado
Usuario abre la app
Hace clic en “Abrir base de datos”
Selecciona archivo JSON
La app lo carga en memoria
Cambios se guardan sobre el mismo archivo
9. Seed inicial

Cargar automáticamente datos iniciales del proyecto (los que ya hemos definido en conversaciones previas).

10. Entregables

Quiero:

Estructura de proyecto
HTML funcional
CSS limpio
JS modular:
data service
UI
lógica negocio
sistema de carga/guardado JSON
tabla funcional
acciones:
crear
seguimiento
completar
export JSON
README
11. Plan de implementación

Fase 1:

estructura
modelo datos
carga JSON
render backlog

Fase 2:

seguimiento
completadas
acciones

Fase 3:

import/export
validaciones

Fase 4:

mejoras UI
limpieza
12. Restricciones

No quiero:

overengineering
frameworks pesados
dependencias innecesarias
backend obligatorio

Sí quiero:

código claro
simplicidad
funcionalidad real
base escalable
13. Instrucción final

No intentes replicar Excel.
Construye una aplicación web ligera, usable y robusta, optimizada para uso real.