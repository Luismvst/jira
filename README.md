# Seguimiento proyecto — app web local (Kanban / backlog)

Aplicación estática en **HTML + CSS + JavaScript** (sin backend). La base de datos es un **único JSON** (`work items` + catálogos). Las vistas **Backlog**, **Seguimiento** y **Completadas** son proyecciones del mismo array en memoria.

## Cómo ejecutar

1. **Recomendado:** servir la carpeta con un servidor HTTP local (los módulos ES y el `fetch` del seed suelen fallar con `file://`):

   ```bash
   npx serve .
   ```

   Abre la URL indicada (p. ej. `http://localhost:3000`) y usa `index.html`.

2. **Abrir base de datos:** botón **Abrir base de datos** y elige `data/project-db.json` (o una copia).

3. **Guardar:** **Guardar** escribe en el archivo si el navegador tiene permiso (File System Access API); si abriste desde un selector clásico sin handle, se descarga `project-db.json`.

## Exportar / importar

- **Exportar:** JSON, CSV (compatible con columnas documentadas en Creador) o XLSX (snapshot vía SheetJS en CDN).
- **Importar:** JSON completo o CSV (desde menú o pestaña **Creador / import masivo**).

## Funcionalidades (paridad con Excel/VBA)

| Acción | Descripción |
|--------|-------------|
| Refrescar vistas | Recalcula tablas (equivalente a `RefrescarVistas`). |
| Seguimiento | Valida campos obligatorios; opción de incluir descendientes válidos. |
| Completar | Estado `Completada`, fecha fin, quita seguimiento. |
| Limpiar seguimiento >30d | Completadas antiguas dejan `inTracking` en falso. |
| IDs | `EP-###`, `TP-###`, `TK-###`, `ST-###` según nivel. |

## Datos iniciales (seed)

El archivo `data/project-db.json` incluye el seed de tareas alineado con el prompt Excel (§8): épicas, topics, tareas y subtareas de ejemplo.

## Plan de pruebas (checklist)

### A. Apertura e integridad

- Abrir `index.html` vía servidor local; no errores en consola.
- Cargar seed automático o **Cargar ejemplo (seed)**.
- Abrir JSON manualmente y **Guardar** sin pérdida de datos.

### B. Backlog

- Jerarquía con expandir/colapsar (sin filtros).
- Con filtro de texto/responsable/épica, vista plana ordenada por ID.
- Colores: gris en seguimiento; rojo suave si `blocked` (campo en detalle).

### C. Seguimiento

- Solo ítems con `inTracking` y no completados.
- Completar desde esta vista actualiza el backlog.

### D. Completadas

- Muestra `status = Completada` e histórico de fecha fin.

### E. Panel

- KPIs: tareas+subtareas, en seguimiento, completadas; desglose por responsable, estado y release target.

### F. Creador / CSV

- Alta masiva con cabecera; líneas inválidas listadas en el informe.
- JSON pegado: reemplazo con confirmación.

### G. Ayuda / Procesos

- Texto estático describe cada acción.

## Limitaciones

- **file://** puede bloquear `fetch` del seed; usar servidor local o **Abrir base de datos**.
- **File System Access** no está en todos los navegadores; en ese caso **Guardar** descarga el archivo.
- **Plan_Pruebas** (hoja Excel del prompt maestro) no está modelada como entidad en v1; solo documentación en README y ayuda.

## Estructura del proyecto

```
├── index.html
├── css/styles.css
├── data/project-db.json
├── js/
│   ├── app.js
│   ├── constants.js
│   ├── dataService.js
│   ├── importExport.js
│   ├── ui.js
│   └── workItem.js
├── scripts/generate-seed.mjs   # regenerar seed desde Node (opcional)
└── README.md
```

Para regenerar el JSON de ejemplo desde el script:

```bash
node scripts/generate-seed.mjs
```
