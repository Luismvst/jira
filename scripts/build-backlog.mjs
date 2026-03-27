#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const now = "2026-03-27T10:00:00.000Z";

function base(id, parentId, level, epic, topic, title, opts = {}) {
  return {
    id,
    parentId,
    level,
    order: opts.order ?? 0,
    title,
    summary: opts.summary ?? "",
    epic,
    topic: topic ?? "",
    task: opts.task ?? "",
    subtask: "",
    owner: opts.owner ?? "",
    priority: opts.priority ?? "Media",
    status: "BACKLOG",
    type: "task",
    inTracking: false,
    definitionOk: true,
    releaseTarget: "",
    rlse: "",
    preVersion: "",
    proVersion: "",
    createdAt: now,
    targetDate: opts.targetDate ?? "",
    startDate: "",
    completedAt: "",
    blocked: false,
    dependencies: "",
    notes: opts.notes ?? "",
    activityLog: [],
    comments: [],
  };
}

const items = [];

// ═══ A. Exportadores ═══
items.push(base("EP-001", null, "EPIC", "Exportadores", "", "Exportadores", { priority: "Alta" }));
items.push(base("TP-001", "EP-001", "TOPIC", "Exportadores", "Exportadores", "Exportadores"));
items.push(base("TK-001", "TP-001", "TASK", "Exportadores", "Exportadores", "Query Pyramid CSV", { targetDate: "2026-03-31" }));
items.push(base("ST-001", "TK-001", "SUBTASK", "Exportadores", "Exportadores", "Nueva implementación de Pyramid CSV", { targetDate: "2026-03-31" }));
items.push(base("ST-002", "TK-001", "SUBTASK", "Exportadores", "Exportadores", "Soporte para ejes de inventario", { targetDate: "2026-03-31" }));
items.push(base("TK-002", "TP-001", "TASK", "Exportadores", "Exportadores", "Nuevo exportador Internal Sancore v2", { targetDate: "2026-03-31" }));
items.push(base("ST-003", "TK-002", "SUBTASK", "Exportadores", "Exportadores", "Realizar un envío a Corev con este exportador", { targetDate: "2026-03-31" }));
items.push(base("ST-004", "TK-002", "SUBTASK", "Exportadores", "Exportadores", "Confirmar que el nombre corresponde con el esperado", { targetDate: "2026-03-31" }));
items.push(base("ST-005", "TK-002", "SUBTASK", "Exportadores", "Exportadores", "Cambiar en producción y preproducción los nombres de tech taxonomic code para módulos que usen Internal Sancore v1 y v2", { targetDate: "2026-03-31" }));

// ═══ B. Envíos ═══
items.push(base("EP-002", null, "EPIC", "Envíos", "", "Envíos", { priority: "Alta" }));
items.push(base("TP-002", "EP-002", "TOPIC", "Envíos", "Envíos", "Envíos"));
items.push(base("TK-003", "TP-002", "TASK", "Envíos", "Envíos", "All checks / shocks", { targetDate: "2026-03-31" }));

// ═══ C. Ajustes ═══
items.push(base("EP-003", null, "EPIC", "Ajustes", "", "Ajustes", { priority: "Alta" }));
items.push(base("TP-003", "EP-003", "TOPIC", "Ajustes", "Ajustes", "Ajustes"));
items.push(base("TK-004", "TP-003", "TASK", "Ajustes", "Ajustes", "Ajustes por ingesta masiva", { targetDate: "2026-03-31" }));
items.push(base("ST-006", "TK-004", "SUBTASK", "Ajustes", "Ajustes", "Probar que, si hay más informes de los que se pueden ingestar en ajustes porque no están cargados en el módulo, los ajustes se ingestan correctamente", { targetDate: "2026-03-31" }));
items.push(base("TK-005", "TP-003", "TASK", "Ajustes", "Ajustes", "Aplicar ajustes a la query de exportadores", { targetDate: "2026-03-31" }));
items.push(base("TK-006", "TP-003", "TASK", "Ajustes", "Ajustes", "Crear vista de ajustes", { targetDate: "2026-03-31" }));
items.push(base("ST-007", "TK-006", "SUBTASK", "Ajustes", "Ajustes", "Crear en desarrollo", { targetDate: "2026-03-31" }));
items.push(base("ST-008", "TK-006", "SUBTASK", "Ajustes", "Ajustes", "Crear en preproducción", { targetDate: "2026-03-31" }));
items.push(base("ST-009", "TK-006", "SUBTASK", "Ajustes", "Ajustes", "Crear en producción", { targetDate: "2026-03-31" }));
items.push(base("ST-010", "TK-006", "SUBTASK", "Ajustes", "Ajustes", "Validar query con todos los casos", { targetDate: "2026-03-31" }));
items.push(base("TK-007", "TP-003", "TASK", "Ajustes", "Ajustes", "Validar visor vs descarga", { targetDate: "2026-03-31", summary: "Comprobar que en el visor se visualiza exactamente lo mismo que en la descarga" }));
items.push(base("TK-008", "TP-003", "TASK", "Ajustes", "Ajustes", "Validar envíos con ajustes", { targetDate: "2026-03-31" }));
items.push(base("TK-009", "TP-003", "TASK", "Ajustes", "Ajustes", "Corrección de semáforos cuando un ajuste no incluye datos regulatorios", { targetDate: "2026-03-31", summary: "Actualmente, si se incluye un ajuste sin datos regulatorios, los semáforos lo tratan como si sí existieran datos regulatorios" }));

// ═══ D. Ingestas externas ═══
items.push(base("EP-004", null, "EPIC", "Ingestas externas", "", "Ingestas externas", { priority: "Alta" }));
items.push(base("TP-004", "EP-004", "TOPIC", "Ingestas externas", "Ingestas externas", "Ingestas externas"));
items.push(base("TK-010", "TP-004", "TASK", "Ingestas externas", "Ingestas externas", "Borrado de módulos", { targetDate: "2026-03-31", summary: "Actualmente no se borran las ingestas cuando se realiza un borrado de módulos" }));
items.push(base("TK-011", "TP-004", "TASK", "Ingestas externas", "Ingestas externas", "Proteger acceso al detalle de módulo borrado desde ingestas", { targetDate: "2026-03-31", summary: "Si desde el detalle de una ingesta se intenta acceder al detalle de un módulo que ya no existe, debe mostrarse una alerta clara indicando 'Este módulo ya no se encuentra disponible'" }));

// ═══ E. Queries ═══
items.push(base("EP-005", null, "EPIC", "Queries", "", "Queries", { priority: "Alta" }));
items.push(base("TP-005", "EP-005", "TOPIC", "Queries", "Queries", "Queries"));
items.push(base("TK-012", "TP-005", "TASK", "Queries", "Queries", "Incluir cruce con vista de estructura de informe", { targetDate: "2026-03-31" }));
items.push(base("ST-011", "TK-012", "SUBTASK", "Queries", "Queries", "Informar correctamente tipos de dato: amount, numeric, porcentaje, texto, etc.", { targetDate: "2026-03-31" }));
items.push(base("ST-012", "TK-012", "SUBTASK", "Queries", "Queries", "Alinear esta query con la query de ingestas sin externos", { targetDate: "2026-03-31" }));

// ═══ F. Fixes ═══
items.push(base("EP-006", null, "EPIC", "Fixes", "", "Fixes", { priority: "Alta" }));

items.push(base("TP-006", "EP-006", "TOPIC", "Fixes", "Copiado de módulos", "Copiado de módulos"));
items.push(base("TK-013", "TP-006", "TASK", "Fixes", "Copiado de módulos", "Incidencia Alberto en copiado de módulos", { targetDate: "2026-03-31", owner: "Juan Luis", summary: "En el copiado de solvencia del módulo de Solvencia 3 se agrega el period start de la jurisdicción y no el del regulador" }));
items.push(base("ST-013", "TK-013", "SUBTASK", "Fixes", "Copiado de módulos", "Chequear por qué ocurre", { targetDate: "2026-03-31", owner: "Juan Luis" }));

items.push(base("TP-007", "EP-006", "TOPIC", "Fixes", "Pantalla de ingestas", "Pantalla de ingestas"));
items.push(base("TK-014", "TP-007", "TASK", "Fixes", "Pantalla de ingestas", "Ajustar layout para evitar scroll innecesario", { targetDate: "2026-03-31", summary: "La pantalla de ingestas debe quedar fija y ajustarse al tamaño del monitor, incluyendo correctamente la altura del bloque de comentarios" }));
items.push(base("TK-015", "TP-007", "TASK", "Fixes", "Pantalla de ingestas", "Rehabilitar botón de carga tras error de ingesta", { targetDate: "2026-03-31", summary: "Si una ingesta falla por error funcional o de configuración, el botón de cargar no debe quedar permanentemente deshabilitado; debe poder reintentarse sin salir y volver a entrar a la pantalla" }));

items.push(base("TP-008", "EP-006", "TOPIC", "Fixes", "Listado de ingestas", "Listado de ingestas"));
items.push(base("TK-016", "TP-008", "TASK", "Fixes", "Listado de ingestas", "Añadir columna de tipo de ingesta", { targetDate: "2026-03-31", summary: "Diferenciar visualmente en el listado si la ingesta proviene de ajustes masivos o de ingesta externa" }));

items.push(base("TP-009", "EP-006", "TOPIC", "Fixes", "Detalle de módulo", "Detalle de módulo"));
items.push(base("TK-017", "TP-009", "TASK", "Fixes", "Detalle de módulo", "Proteger doble clic y mejorar responsividad del menú de acciones", { targetDate: "2026-03-31", summary: "Al pulsar en los tres puntos del módulo debe evitarse el doble clic, deshabilitarse correctamente la acción y mejorar la respuesta visual" }));

items.push(base("TP-010", "EP-006", "TOPIC", "Fixes", "Protección general de acciones", "Protección general de acciones"));
items.push(base("TK-018", "TP-010", "TASK", "Fixes", "Protección general de acciones", "Extender protección anti doble clic en botones críticos", { targetDate: "2026-03-31", summary: "Reutilizar el patrón de protección que metió Guillermo en el botón de ingestas donde aplique" }));
items.push(base("ST-014", "TK-018", "SUBTASK", "Fixes", "Protección general de acciones", "Pantalla de nueva ingesta / nuevo módulo", { targetDate: "2026-03-31" }));
items.push(base("ST-015", "TK-018", "SUBTASK", "Fixes", "Protección general de acciones", "Query de semáforos al cargar informes", { targetDate: "2026-03-31" }));
items.push(base("ST-016", "TK-018", "SUBTASK", "Fixes", "Protección general de acciones", "Generación", { targetDate: "2026-03-31" }));
items.push(base("ST-017", "TK-018", "SUBTASK", "Fixes", "Protección general de acciones", "Cambio de idioma", { targetDate: "2026-03-31" }));
items.push(base("ST-018", "TK-018", "SUBTASK", "Fixes", "Protección general de acciones", "Añadir nuevo informe", { targetDate: "2026-03-31" }));
items.push(base("ST-019", "TK-018", "SUBTASK", "Fixes", "Protección general de acciones", "Otros puntos equivalentes donde un doble clic pueda provocar efectos no deseados", { targetDate: "2026-03-31" }));
items.push(base("ST-020", "TK-018", "SUBTASK", "Fixes", "Protección general de acciones", "Revisar también desplegables del detalle de módulo", { targetDate: "2026-03-31" }));

items.push(base("TP-011", "EP-006", "TOPIC", "Fixes", "Envíos", "Envíos"));
items.push(base("TK-019", "TP-011", "TASK", "Fixes", "Envíos", "Cerrar modal de envío cuando se produce error", { targetDate: "2026-03-31", summary: "Si al realizar un envío el informe está bloqueado, PrimeNG muestra una alerta o el supervisor devuelve error, el modal debe cerrarse o no tapar la alerta para que el usuario entienda qué ha ocurrido" }));

items.push(base("TP-012", "EP-006", "TOPIC", "Fixes", "Vinculación de jurisdicciones", "Vinculación de jurisdicciones"));
items.push(base("TK-020", "TP-012", "TASK", "Fixes", "Vinculación de jurisdicciones", "Ordenar correctamente el desplegable de versión ID", { targetDate: "2026-03-31", summary: "Añadir order by en la query backend porque actualmente sale desordenado" }));

items.push(base("TP-013", "EP-006", "TOPIC", "Fixes", "Formulario de declaraciones / módulo", "Formulario de declaraciones / módulo"));
items.push(base("TK-021", "TP-013", "TASK", "Fixes", "Formulario de declaraciones / módulo", "Evitar persistencia de \"null\" textual en el punto de entrada taxonómico", { targetDate: "2026-03-31", summary: "Cuando se configura por primera vez, no deben guardarse ni mostrarse cadenas tipo \"null\", vacío incorrecto o variantes equivalentes" }));

// ═══ G. LMCore ═══
items.push(base("EP-007", null, "EPIC", "LMCore", "", "LMCore", { priority: "Alta" }));

items.push(base("TP-014", "EP-007", "TOPIC", "LMCore", "Traducciones", "Traducciones"));
items.push(base("TK-022", "TP-014", "TASK", "LMCore", "Traducciones", "Corregir inserción inválida de null en traducciones", { targetDate: "2026-03-31", summary: "Arreglar casos en los que se inserta null, \"null\", null vacío o espacios en formulario y base de datos" }));
items.push(base("TK-023", "TP-014", "TASK", "LMCore", "Traducciones", "Propuesta de vista global de traducciones", { targetDate: "2026-03-31" }));
items.push(base("ST-021", "TK-023", "SUBTASK", "LMCore", "Traducciones", "Propuesta con cruce fila-columna", { targetDate: "2026-03-31" }));
items.push(base("ST-022", "TK-023", "SUBTASK", "LMCore", "Traducciones", "Propuesta de vista para traducciones dobles", { targetDate: "2026-03-31" }));

items.push(base("TP-015", "EP-007", "TOPIC", "LMCore", "Datos", "Datos"));
items.push(base("TK-024", "TP-015", "TASK", "LMCore", "Datos", "Vista de estructura de informes", { targetDate: "2026-03-31" }));
items.push(base("ST-023", "TK-024", "SUBTASK", "LMCore", "Datos", "Validar, chequear y certificar qué agregación aplicar al tipo text", { targetDate: "2026-03-31" }));
items.push(base("ST-024", "TK-024", "SUBTASK", "LMCore", "Datos", "Evaluar opciones como max, listado, first u otra agregación correcta", { targetDate: "2026-03-31" }));
items.push(base("TK-025", "TP-015", "TASK", "LMCore", "Datos", "Evolucionar parámetros de la vista de estructura de informes", { targetDate: "2026-03-31" }));
items.push(base("ST-025", "TK-025", "SUBTASK", "LMCore", "Datos", "Meter los parámetros en la tabla de parámetros", { targetDate: "2026-03-31" }));
items.push(base("ST-026", "TK-025", "SUBTASK", "LMCore", "Datos", "Alinearse con Alejandro", { targetDate: "2026-03-31" }));
items.push(base("ST-027", "TK-025", "SUBTASK", "LMCore", "Datos", "Incluir esta vista en la query de PM regulatorio", { targetDate: "2026-03-31" }));
items.push(base("ST-028", "TK-025", "SUBTASK", "LMCore", "Datos", "Hacer pruebas", { targetDate: "2026-03-31" }));

items.push(base("TP-016", "EP-007", "TOPIC", "LMCore", "Vinculación de jurisdicciones", "Vinculación de jurisdicciones"));
items.push(base("TK-026", "TP-016", "TASK", "LMCore", "Vinculación de jurisdicciones", "Permitir seleccionar declaraciones inexistentes para el informe", { targetDate: "2026-03-31", summary: "Actualmente solo permite seleccionar declaraciones que ya existen para ese informe" }));

items.push(base("TP-017", "EP-007", "TOPIC", "LMCore", "Detalles", "Detalles"));
items.push(base("TK-027", "TP-017", "TASK", "LMCore", "Detalles", "Eliminar comentarios y console logs del código", { targetDate: "2026-03-31" }));

items.push(base("TP-018", "EP-007", "TOPIC", "LMCore", "Listado de módulos", "Listado de módulos"));
items.push(base("TK-028", "TP-018", "TASK", "LMCore", "Listado de módulos", "Limitar carga inicial de módulos a 100 elementos", { targetDate: "2026-03-31" }));
items.push(base("ST-029", "TK-028", "SUBTASK", "LMCore", "Listado de módulos", "Analizar la mejor forma de hacerlo", { targetDate: "2026-03-31" }));
items.push(base("ST-030", "TK-028", "SUBTASK", "LMCore", "Listado de módulos", "Mostrar menos workflows inicialmente", { targetDate: "2026-03-31" }));
items.push(base("ST-031", "TK-028", "SUBTASK", "LMCore", "Listado de módulos", "Si el usuario filtra, permitir mostrar todos cuando corresponda", { targetDate: "2026-03-31" }));

items.push(base("TP-019", "EP-007", "TOPIC", "LMCore", "Tabs de la aplicación", "Tabs de la aplicación"));
items.push(base("TK-029", "TP-019", "TASK", "LMCore", "Tabs de la aplicación", "Resaltar correctamente la tab padre en pantallas hijas", { targetDate: "2026-03-31", summary: "En pantallas como Nuevo módulo o Nueva ingesta debe quedar sombreada/en rojo la tab padre correspondiente", notes: "Revisar si sigue siendo necesario tras Casandra" }));
items.push(base("TK-030", "TP-019", "TASK", "LMCore", "Tabs de la aplicación", "Mejorar hover de tabs padre", { targetDate: "2026-03-31", summary: "Al pasar el ratón por las tabs padre aplicar sombreado/negrita igual que en el header", notes: "Revisar si sigue siendo necesario; el CSS aparentemente ya se hizo" }));

items.push(base("TP-020", "EP-007", "TOPIC", "LMCore", "Overdue de informes", "Overdue de informes"));
items.push(base("TK-031", "TP-020", "TASK", "LMCore", "Overdue de informes", "Corregir overdue cuando el informe está en presentación", { targetDate: "2026-03-31", summary: "Si se está presentando un informe, no debe marcar overdue en la query del listado de módulos" }));
items.push(base("ST-032", "TK-031", "SUBTASK", "LMCore", "Overdue de informes", "Revisar con estatus interno para ajustar el case de la query en ese caso particular", { targetDate: "2026-03-31" }));

items.push(base("TP-021", "EP-007", "TOPIC", "LMCore", "Validaciones", "Validaciones"));
items.push(base("TK-032", "TP-021", "TASK", "LMCore", "Validaciones", "Aplicación de validaciones estructurales", { targetDate: "2026-03-31" }));
items.push(base("ST-033", "TK-032", "SUBTASK", "LMCore", "Validaciones", "Realizar el desarrollo comentado por correo y en la reunión de seguimiento", { targetDate: "2026-03-31" }));
items.push(base("ST-034", "TK-032", "SUBTASK", "LMCore", "Validaciones", "Revisar lo comentado con Sebastián", { targetDate: "2026-03-31" }));
items.push(base("ST-035", "TK-032", "SUBTASK", "LMCore", "Validaciones", "Esconder semáforos en aplicación de validaciones estructurales", { targetDate: "2026-03-31" }));
items.push(base("TK-033", "TP-021", "TASK", "LMCore", "Validaciones", "Evolución semántica de validaciones", { targetDate: "2026-03-31" }));
items.push(base("TK-034", "TP-021", "TASK", "LMCore", "Validaciones", "Semáforos de datos", { targetDate: "2026-03-31", owner: "Luis", summary: "Incluir nueva tabla de level global para complementar la información que la tabla normal no tiene en ciertos informes de Corep" }));
items.push(base("ST-036", "TK-034", "SUBTASK", "LMCore", "Validaciones", "Hablar con Sebastián para pedir requerimientos", { targetDate: "2026-03-31", owner: "Luis" }));

items.push(base("TP-022", "EP-007", "TOPIC", "LMCore", "Resource wrapper", "Resource wrapper"));
items.push(base("TK-035", "TP-022", "TASK", "LMCore", "Resource wrapper", "Aplicar nuevo argumento del decorador", { targetDate: "2026-03-31", summary: "Dejar de utilizar token y chequear si está funcionando correctamente" }));

items.push(base("TP-023", "EP-007", "TOPIC", "LMCore", "Pruebas de carga", "Pruebas de carga"));
items.push(base("TK-036", "TP-023", "TASK", "LMCore", "Pruebas de carga", "Ejecutar pruebas de carga de LMCore", { targetDate: "2026-03-31", summary: "Validar redimensionamiento de warehouses y comprobar estabilidad de la aplicación" }));

items.push(base("TP-024", "EP-007", "TOPIC", "LMCore", "FC", "FC"));
items.push(base("TK-037", "TP-024", "TASK", "LMCore", "FC", "Despliegue de seguridad para los diferentes entornos", { targetDate: "2026-03-31" }));

items.push(base("TP-025", "EP-007", "TOPIC", "LMCore", "Visor de informes", "Visor de informes"));
items.push(base("TK-038", "TP-025", "TASK", "LMCore", "Visor de informes", "Modo edición", { targetDate: "2026-03-31" }));
items.push(base("TK-039", "TP-025", "TASK", "LMCore", "Visor de informes", "Incorporación de ejes", { targetDate: "2026-03-31" }));
items.push(base("TK-040", "TP-025", "TASK", "LMCore", "Visor de informes", "Incorporación de ajustes", { targetDate: "2026-03-31" }));
items.push(base("TK-041", "TP-025", "TASK", "LMCore", "Visor de informes", "Generación y certificación de XBRL-CSV", { targetDate: "2026-03-31" }));
items.push(base("TK-042", "TP-025", "TASK", "LMCore", "Visor de informes", "Generación y certificación de XBRL", { targetDate: "2026-03-31" }));

items.push(base("TP-026", "EP-007", "TOPIC", "LMCore", "Taxonomías", "Taxonomías"));
items.push(base("TK-043", "TP-026", "TASK", "LMCore", "Taxonomías", "Carga completa de taxonomía 4.2", { targetDate: "2026-03-31" }));

items.push(base("TP-027", "EP-007", "TOPIC", "LMCore", "Integración Casandra", "Integración Casandra"));
items.push(base("TK-044", "TP-027", "TASK", "LMCore", "Integración Casandra", "Integración Casandra", { targetDate: "2026-03-31" }));

items.push(base("TP-028", "EP-007", "TOPIC", "LMCore", "Mantenimiento", "Mantenimiento"));
items.push(base("TK-045", "TP-028", "TASK", "LMCore", "Mantenimiento", "Ajuste de pantallas de mantenimiento", { targetDate: "2026-03-31" }));
items.push(base("ST-037", "TK-045", "SUBTASK", "LMCore", "Mantenimiento", "Ordenar campos de formularios", { targetDate: "2026-03-31" }));

items.push(base("TP-029", "EP-007", "TOPIC", "LMCore", "Informes fantasma / data flags", "Informes fantasma / data flags"));
items.push(base("TK-046", "TP-029", "TASK", "LMCore", "Informes fantasma / data flags", "Listado de módulos e informes fantasma", { targetDate: "2026-03-31", notes: "Objetivo no primario de marzo según mensaje a Juan Carlos" }));
items.push(base("TK-047", "TP-029", "TASK", "LMCore", "Informes fantasma / data flags", "Flag de data en el listado de módulos e informes", { targetDate: "2026-03-31", notes: "Objetivo no primario de marzo según mensaje a Juan Carlos" }));

// ═══ H. Releases ═══
items.push(base("EP-008", null, "EPIC", "Releases", "", "Releases", { priority: "Alta" }));
items.push(base("TP-030", "EP-008", "TOPIC", "Releases", "Releases", "Releases"));
items.push(base("TK-048", "TP-030", "TASK", "Releases", "Releases", "Release 30 de marzo", { targetDate: "2026-03-30" }));
items.push(base("TK-049", "TP-030", "TASK", "Releases", "Releases", "Release 1 de abril", { targetDate: "2026-04-01" }));

// ═══ I. Otros ═══
items.push(base("EP-009", null, "EPIC", "Otros", "", "Otros"));
items.push(base("TP-031", "EP-009", "TOPIC", "Otros", "Otros", "Otros"));
items.push(base("TK-050", "TP-031", "TASK", "Otros", "Otros", "Migración a Node 22", { targetDate: "2026-03-31" }));
items.push(base("TK-051", "TP-031", "TASK", "Otros", "Otros", "Migración a Angular 19", { targetDate: "2026-03-31" }));

// ═══ Build DB ═══
const db = {
  version: 4,
  catalogs: {
    owners: ["Juan Luis", "Guillermo", "Diego", "Luis", "Alejandro", "Sebastián"],
    statuses: ["BACKLOG", "PENDING", "IN_PROGRESS", "BLOCKED", "CERTIFICATION", "DONE"],
    priorities: ["Alta", "Media", "Baja"],
    levels: ["EPIC", "TOPIC", "TASK", "SUBTASK"],
    epics: [
      "Exportadores", "Envíos", "Ajustes", "Ingestas externas",
      "Queries", "Fixes", "LMCore", "Releases", "Otros",
    ],
    epicColors: {
      Exportadores: "#0052cc",
      "Envíos": "#ff8b00",
      Ajustes: "#6554c0",
      "Ingestas externas": "#00a3bf",
      Queries: "#00b8d9",
      Fixes: "#ff5630",
      LMCore: "#00875a",
      Releases: "#ff69b4",
      Otros: "#8993a4",
    },
  },
  items,
  testPlans: [],
  testRuns: [],
  ui: {
    viewMode: "tree",
    sortKey: null,
    sortDir: "asc",
    treeExpandedIds: [
      "EP-001", "EP-002", "EP-003", "EP-004", "EP-005",
      "EP-006", "EP-007", "EP-008", "EP-009",
    ],
    columnVisibility: {},
  },
  meta: { backlogRevision: "2026-03" },
};

// Validate hierarchy
const idSet = new Set(items.map((i) => i.id));
for (const it of items) {
  if (it.parentId && !idSet.has(it.parentId)) {
    console.error(`BROKEN REF: ${it.id} -> parentId ${it.parentId} not found`);
    process.exit(1);
  }
}
const dups = items.length - idSet.size;
if (dups) {
  console.error(`DUPLICATE IDs: ${dups}`);
  process.exit(1);
}

const out = resolve(__dirname, "..", "data", "project-db.json");
writeFileSync(out, JSON.stringify(db, null, 2) + "\n");
console.log(`Written ${items.length} items to ${out}`);
