# Prompt maestro para iterar el Excel de seguimiento del proyecto

Quiero que actúes como un **arquitecto de soluciones Excel + VBA para gestión de proyecto** y que me construyas / iteres un workbook de Microsoft Excel **serio, robusto, simple de usar y mantenible**, pensado como un híbrido entre **Kanban, backlog jerárquico y control de releases/despliegues**.

## Contexto funcional

Este Excel debe servirme como herramienta base de seguimiento del proyecto. Tiene que reemplazar de forma ligera un Jira simple, sin sprints, con forma de trabajo Kanban. Quiero que sea útil desde ya, pero escalable.

Equipo involucrado:
- Juan Luis
- Guillermo
- Diego
- Luis
- Alejandro

Épicas base:
- LM Core
- Taxonomía
- Fix
- Release/Despliegues
- Scripts de datos
- Base de datos
- Traducciones

El objetivo es que exista una **fuente maestra de backlog** con varios niveles:
- Épica
- Topic
- Tarea
- Subtarea

Y luego vistas operativas:
- Seguimiento
- Completadas

## Requisitos de diseño obligatorios

### 1. Arquitectura del workbook
Quiero que el archivo tenga como mínimo estas hojas:

1. **Panel**
   - Resumen de KPIs
   - Conteos por estado
   - Conteos por responsable
   - Conteos por release
   - Indicaciones de uso
   - Accesos visuales a procesos/macros

2. **Parametros**
   - Catálogos centralizados:
     - responsables
     - estados
     - prioridades
     - niveles
     - sí/no
     - épicas
   - Todo con listas desplegables reutilizables

3. **Backlog**
   - Fuente maestra real
   - Aquí viven todas las épicas, topics, tareas y subtareas
   - Debe ser una tabla estructurada
   - Debe tener filtros, formato claro y validaciones
   - No quiero que Seguimiento ni Completadas sean la fuente maestra

4. **Seguimiento**
   - Vista operativa de lo que está siendo preparado o ejecutado
   - Debe regenerarse automáticamente vía macro desde Backlog
   - No puede ser una vista estática pegada a mano
   - Solo deben aparecer elementos marcados para seguimiento y no completados

5. **Completadas**
   - Histórico operativo
   - Debe regenerarse vía macro desde Backlog
   - Debe contener todo lo marcado como completado
   - Se puede plantear una lógica de ventana: completadas recientes permanecen un tiempo en seguimiento, pero el histórico definitivo vive aquí

6. **Creador_Tareas**
   - Alta individual
   - Alta masiva
   - Debe permitir dos modos:
     - formulario simple
     - pegado CSV o JSON sencillo
   - Debe crear filas en Backlog automáticamente mediante macro
   - Debe asignar automáticamente:
     - ID
     - fecha de alta
     - estado inicial
     - seguimiento=no
   - Debe validar antes de insertar

7. **Procesos**
   - Inventario de procesos/macros
   - Qué hace cada macro
   - Qué campos revisa
   - Qué automatismos existen

8. **Plan_Pruebas**
   - Casos de prueba funcionales
   - Estado de cada caso
   - Evidencia / notas si se quiere ampliar

## 2. Modelo de datos del Backlog
Columnas recomendadas mínimas:

- ID
- Parent_ID
- Nivel
- Orden
- Epic
- Topic
- Tarea
- Subtarea
- Resumen
- Responsable
- Prioridad
- Estado
- Seguimiento
- Definición_OK
- Release_Target
- Pre_Version
- Pro_Version
- Fecha_Alta
- Fecha_Objetivo
- Fecha_Inicio
- Fecha_Fin
- Bloqueada
- Dependencias
- Observaciones

### Reglas funcionales del modelo
- `Backlog` es la **única fuente maestra**
- `Seguimiento` y `Completadas` son **vistas regeneradas**
- El campo `Seguimiento` debe ser un **Sí/No**
- Cuando `Seguimiento = Sí`, debe aplicarse **estilo gris** visual a la parte operativa de la fila
- `Definición_OK` debe controlar si un elemento se puede mandar a seguimiento
- No debe permitirse mandar algo a seguimiento si faltan campos obligatorios
- La fecha de alta se pone sola
- La fecha objetivo la define el usuario
- La fecha fin la pone la macro al completar o la persona manualmente

## 3. Reglas jerárquicas clave
Quiero comportamiento inteligente al mover elementos a Seguimiento:

### Caso A: selecciono una Épica
- El sistema debe preguntar:
  - si quiero incluir topics
  - si quiero incluir tareas
  - si quiero incluir subtareas
- Si digo que sí, debe incluir hijos descendientes válidos

### Caso B: selecciono un Topic
- Debe preguntar si quiero incluir:
  - tareas
  - subtareas

### Caso C: selecciono una Tarea
- Debe preguntar si quiero incluir:
  - subtareas

### Caso D: selecciono una Subtarea
- Debe incluir solo esa

### Validación antes de mover a Seguimiento
No se puede mover si faltan al menos estos campos:
- ID
- Nivel
- Epic
- Resumen
- Responsable
- Prioridad
- Estado
- Definición_OK = Sí

Si no cumple, debe salir mensaje explicando qué falta.

## 4. Macros / automatizaciones que quiero
Quiero VBA real, no solo fórmulas. Las macros deben estar pensadas para poder asociarse a botones en Excel.

### Macro 1: RefrescarVistas
- Limpia y reconstruye `Seguimiento`
- Limpia y reconstruye `Completadas`
- Lee siempre desde `Backlog`
- `Seguimiento`: filas con Seguimiento=Sí y Estado<>Completada
- `Completadas`: filas con Estado=Completada

### Macro 2: EnviarSeleccionASeguimiento
- Se ejecuta desde una fila del Backlog
- Valida la fila
- Pregunta si incluir descendientes según el nivel
- Marca Seguimiento=Sí
- Refresca vistas

### Macro 3: MoverSeleccionACompletadas
- Puede ejecutarse desde Backlog o Seguimiento
- Marca:
  - Estado=Completada
  - Fecha_Fin=Today
  - Seguimiento=No
- Refresca vistas

### Macro 4: CrearTareaIndividual
- Lee datos del formulario en `Creador_Tareas`
- Genera ID automáticamente según el nivel:
  - EP-xxx
  - TP-xxx
  - TK-xxx
  - ST-xxx
- Inserta fila en Backlog

### Macro 5: CrearTareasDesdeCSV
- Lee varias líneas CSV pegadas en `Creador_Tareas`
- Inserta todas las válidas
- Las inválidas deben quedar reportadas

### Macro 6: LimpiarSeguimientoAntiguo
- Opcional
- Si una tarea lleva más de 30 días completada:
  - Seguimiento = No
  - Se conserva en Completadas

## 5. Reglas visuales
Quiero algo profesional pero simple:
- Cabeceras claras
- Congelar paneles
- Tablas con filtros
- Listas desplegables
- Colores coherentes:
  - inputs editables en azul
  - fórmulas/derivados en negro
  - constantes en gris
  - revisión/cautela en naranja
  - flags/error en rojo suave
  - seguimiento en gris
  - completadas en verde suave
- Anchos de columnas adecuados
- Nada recargado

## 6. Control de releases y despliegues
Quiero que el Excel me sirva para documentar cambios que entran en release y despliegues a PRE/PRO.

Necesidades:
- columna `Release_Target`
- columna `Pre_Version`
- columna `Pro_Version`
- solo debe quedar visible la **última versión** subida a PRE y PRO por cada elemento
- se tiene que poder filtrar fácilmente:
  - qué entra en una release
  - qué está en certificación
  - qué se ha desplegado a PRE
  - qué está ya en PRO

## 7. Lógica de completadas
Quiero una propuesta clara:
- `Backlog` mantiene la trazabilidad histórica completa
- `Seguimiento` es solo operativo
- `Completadas` es vista/histórico
- opcionalmente, una tarea completada puede seguir visible en Seguimiento durante 30 días, pero después debe desaparecer de ahí automáticamente al ejecutar limpieza

## 8. Tareas reales que ya debe traer cargadas
Quiero que el workbook venga precargado con estas tareas, ya estructuradas.

### LM Core — Aplicación internal Sancorep 2
Topic: Aplicación internal Sancorep 2
Subtareas:
1. Probar que el exportador funciona correctamente en PRE
2. Probar que el exportador funciona correctamente en PRO
3. Validar que los datos son iguales para internal sancorep1 y 2
4. Chequear que el nombre del fichero cumple el requerimiento:
   `corep_interno_variable_tex_taxonomic_code_20_variable_period_timestamp.txt`

### LM Core — Ajustes por ingesta masiva
Topic: Ajustes por ingesta masiva
Subtareas:
1. Ingestar un fichero de ajustes masivo a un módulo
2. Probar que se puede ingestar parcial o total
3. Probar que si hay más informes de los que se pueden ingestar en ajustes porque no están cargados en el módulo, se indica correctamente
4. Ver que el modal de ajustes y descarga funciona correctamente
5. Aplicar a las queries de los exportadores la tabla de ajustes, solo para exportadores del modelo nuevo
6. Hacer pruebas con el visor, comparar lo visualizado y lo descargado, y contrastar que los ajustes se aplican correctamente

Estados ya conocidos:
- “Probar parcial o total” => completada
- “Modal ajustes/descarga” => completada
- “Más informes…” => pendiente
- “Aplicar tabla de ajustes…” => dejar con interrogación / definición abierta

### LM Core — Validaciones
Topic evolutivo: Validaciones
Subtareas:
1. Esconder por defecto columna estatus en el modal de validaciones
2. No se ordenan bien restrictivas y luego informativas
3. Poner el botón de validar primero y luego el botón de visualizar

Estas tres están terminadas desde hace dos semanas.

### LM Core — Ingestas
Topic: Ingestas
Subtareas:
1. Borrado de módulos: no se borran las ingestas cuando borras un módulo
2. Proteger la redirección de la ingesta a un módulo con alerta: “Este módulo ya no se encuentra disponible”

### Fix — Copiado de módulos
Topic: Copiado de módulos
Subtarea:
- Copiado de solvencia 3 agrega el periodo start de la jurisdicción y no del regulador. Chequear qué pasa.
Notas:
- Incidencia Alberto

### LM Core — Migraciones
Topic: Migraciones
Tareas:
- Migración a Node 22
- Migración a Angular 19

### Base de datos — Vista estructura de informes
Topic: Vista estructura de informes
Subtarea:
- Comentar si la agregación de tipo text se pone como max, listagg o first

### Base de datos — Vista ajustes regulatorios
Topic: Vista ajustes regulatorios
Subtareas:
1. Certificar que los datos están correctos
2. Creación de la vista
3. Mandar GoPortal a los tres entornos y certificar que se han subido los datos a todos los entornos

### Traducciones
Topic: Traducciones
Subtareas:
1. Fix de que se inserta null / "null" / vacío / espacio en el formulario de base de datos
2. Propuesta de cambiar validaciones a vista global con cruce fila-columna para traducciones dobles
Notas:
- La segunda pertenece a Luis
- No es prioritaria, pero debe quedar recogida

### Scripts de datos
Topic: Scripts prioritarios 30 marzo
Subtareas:
1. Script de traducciones no incluido en la release anterior; incluir para el 30 de marzo y hacer seguimiento
2. Script de borrado de reporting más taxonomías; incluir en el script del 30
3. Hacer la release que aún no está hecha

### Fix — Correctivos de queries
Topic: Correctivos de queries
Subtareas:
1. FC201 con Custom View
2. Internal sync corep para resolver la query de Corep

### Release/Despliegues — Plan de pruebas release 23/24 marzo PRE
Topic: Plan de pruebas release última del 23/24 de marzo a PRE
Subtarea:
- Probar la release en PRE
Notas:
- Pertenece a Luis

## 9. Qué quiero que me entregues
Quiero que entregues:

1. **Workbook Excel iterado**
   - preferiblemente `.xlsm`
   - con estructura limpia
   - con listas desplegables
   - con tablas
   - con formato consistente
   - con las tareas reales cargadas

2. **Módulo VBA**
   - código limpio
   - comentado
   - listo para asociar a botones

3. **Plan de pruebas completo**
   - funcional
   - de regresión
   - de usabilidad
   - de datos
   - de jerarquía
   - de releases / despliegues

4. **Checklist de validación**
   - qué probar al abrir
   - qué probar al crear tareas
   - qué probar al mover a seguimiento
   - qué probar al completar
   - qué probar al regenerar vistas
   - qué probar con hijos/descendientes
   - qué probar con CSV

5. **Recomendaciones de mejora futura**
   - roadmap v2 / v3
   - riesgos
   - limitaciones
   - puntos de endurecimiento

## 10. Expectativas de calidad
No quiero un Excel “bonito pero frágil”.  
Quiero uno:
- sólido
- entendible
- fácil de usar
- mantenible
- que no dependa de fórmulas raras
- que priorice VBA simple y claro para procesos
- que tenga sentido real para seguimiento de proyecto

Además:
- evita fórmulas dinámicas frágiles
- evita referencias rotas
- evita automatismos opacos
- deja claro qué es fuente maestra y qué son vistas
- usa nombres consistentes
- deja preparada la evolución futura

## 11. Plan de pruebas que quiero que redactes
Quiero que redactes y/o implementes un plan de pruebas con al menos estas áreas:

### A. Apertura e integridad
- abre sin reparación
- no hay fórmulas corruptas
- tablas válidas
- validaciones intactas

### B. Backlog
- filtros correctos
- listas desplegables correctas
- estilos correctos
- seguimiento pinta en gris
- definición_ok controla entradas

### C. Jerarquía
- épica con hijos
- topic con hijos
- tarea con subtareas
- inclusión parcial o total

### D. Seguimiento
- se limpia y reconstruye bien
- no duplica filas
- no arrastra basura previa

### E. Completadas
- mueve correctamente
- mantiene histórico
- fecha fin correcta

### F. Creador de tareas
- alta individual mínima
- alta masiva
- errores por CSV mal formado
- IDs autogenerados sin colisiones

### G. Release / despliegues
- filtros por release
- filtros por pre/pro
- actualización de última versión

### H. Operación diaria
- crear
- priorizar
- mandar a seguimiento
- completar
- refrescar
- consultar histórico

## 12. Qué espero del agente al iterar
Quiero que:
- analices la versión actual
- propongas una arquitectura mejor si hace falta
- simplifiques donde convenga
- mantengas robustez
- implementes la siguiente mejor versión útil, no una demo
- señales claramente limitaciones reales de Excel/VBA si las hay
- priorices operatividad real por encima de adornos
