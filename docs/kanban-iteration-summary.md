# Resumen de la iteración (implementación)

## Qué cambió

- **Regla de pizarra:** únicamente ítems con `level === "TASK"` pueden estar en la pizarra y activarse con sentido. TOPIC dejó de mostrarse como tarjeta.
- **Lista general:** botones **Plana** / **Árbol** guardan preferencia en `ui.viewMode`. Con cualquier filtro activo la tabla es siempre plana.
- **Pruebas:** de un “plan” único por tarea a **`testRuns`**: varias entradas (nombre, resultado, fecha, tester, entorno, notas, RLSE). Al abrir un JSON antiguo, `testPlans` se vuelca a `testRuns` y `testPlans` queda vacío.
- **Pizarra:** más zona vertical para soltar; la cola de columna resalta al arrastrar encima.
- **Arranque:** `run.bat` usa una sola ventana; si no hay Python, intenta `npx serve`. También puedes usar `npm start`.

## Cómo probarlo (rápido)

1. Arranca con `run.bat` o `npm start` y abre el seed o un JSON.
2. En **Lista general:** en una EPIC/TOPIC/SUBTASK no debe aparecer **Activar**; en una TASK sí. Activa una TASK válida y comprueba **Pizarra**.
3. **Vista Plana / Árbol:** cambia modo, guarda JSON, recarga.
4. Completa una TASK; en **Completadas** pulsa **Pruebas**, añade dos registros; revisa la pestaña **Plan de pruebas**.
5. Arrastra tarjetas al final de una columna (zona vacía amplia).

Checklist amplio: [TESTING.md](../TESTING.md).

## Cómo levantar el proyecto

- `run.bat` (Windows, recomendado), o  
- `npm start`, o  
- `npx serve . -l 8765`

Documento de diagnóstico previo: [kanban-iteration-review.md](./kanban-iteration-review.md).
