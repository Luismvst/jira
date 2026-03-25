import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = {
  version: 3,
  catalogs: {
    owners: ["Juan Luis", "Guillermo", "Diego", "Luis", "Alejandro"],
    statuses: ["BACKLOG", "PENDING", "IN_PROGRESS", "BLOCKED", "CERTIFICATION", "DONE"],
    priorities: ["Alta", "Media", "Baja"],
    levels: ["EPIC", "TOPIC", "TASK", "SUBTASK"],
    epics: [
      "LM Core",
      "Taxonomía",
      "Fix",
      "Release/Despliegues",
      "Scripts de datos",
      "Base de datos",
      "Traducciones",
    ],
  },
};

function item(o) {
  return {
    order: 0,
    summary: "",
    releaseTarget: "",
    preVersion: "",
    proVersion: "",
    targetDate: "",
    startDate: "",
    completedAt: "",
    blocked: false,
    dependencies: "",
    notes: "",
    rlse: "",
    ...o,
  };
}

const T0 = "2025-01-15T10:00:00.000Z";
const items = [];

let st = 1;
function nextSt() {
  return `ST-${String(st++).padStart(3, "0")}`;
}

items.push(
  item({
    id: "EP-001",
    parentId: null,
    level: "EPIC",
    title: "LM Core",
    epic: "LM Core",
    owner: "Luis",
    priority: "Alta",
    status: "Backlog",
    inTracking: false,
    definitionOk: true,
    createdAt: T0,
  })
);

items.push(
  item({
    id: "EP-002",
    parentId: null,
    level: "EPIC",
    title: "Fix",
    epic: "Fix",
    owner: "Guillermo",
    priority: "Alta",
    status: "Backlog",
    inTracking: false,
    definitionOk: true,
    createdAt: T0,
  })
);

items.push(
  item({
    id: "EP-003",
    parentId: null,
    level: "EPIC",
    title: "Release/Despliegues",
    epic: "Release/Despliegues",
    owner: "Luis",
    priority: "Alta",
    status: "Backlog",
    inTracking: false,
    definitionOk: true,
    createdAt: T0,
  })
);

items.push(
  item({
    id: "EP-004",
    parentId: null,
    level: "EPIC",
    title: "Scripts de datos",
    epic: "Scripts de datos",
    owner: "Diego",
    priority: "Media",
    status: "Backlog",
    inTracking: false,
    definitionOk: true,
    createdAt: T0,
  })
);

items.push(
  item({
    id: "EP-005",
    parentId: null,
    level: "EPIC",
    title: "Base de datos",
    epic: "Base de datos",
    owner: "Alejandro",
    priority: "Media",
    status: "Backlog",
    inTracking: false,
    definitionOk: true,
    createdAt: T0,
  })
);

items.push(
  item({
    id: "EP-006",
    parentId: null,
    level: "EPIC",
    title: "Traducciones",
    epic: "Traducciones",
    owner: "Luis",
    priority: "Media",
    status: "Backlog",
    inTracking: false,
    definitionOk: true,
    createdAt: T0,
  })
);

const tp = (id, parent, title, epicName, order) =>
  item({
    id,
    parentId: parent,
    level: "TOPIC",
    order,
    title,
    epic: epicName,
    topic: title,
    owner: "Luis",
    priority: "Media",
    status: "Backlog",
    inTracking: false,
    definitionOk: true,
    createdAt: T0,
  });

items.push(tp("TP-001", "EP-001", "Aplicación internal Sancorep 2", "LM Core", 0));
items.push(tp("TP-002", "EP-001", "Ajustes por ingesta masiva", "LM Core", 1));
items.push(tp("TP-003", "EP-001", "Validaciones", "LM Core", 2));
items.push(tp("TP-004", "EP-001", "Ingestas", "LM Core", 3));
items.push(tp("TP-005", "EP-001", "Migraciones", "LM Core", 4));
items.push(tp("TP-006", "EP-002", "Copiado de módulos", "Fix", 0));
items.push(tp("TP-007", "EP-002", "Correctivos de queries", "Fix", 1));
items.push(
  tp("TP-008", "EP-003", "Plan de pruebas release 23/24 marzo a PRE", "Release/Despliegues", 0)
);
items.push(tp("TP-009", "EP-004", "Scripts prioritarios 30 marzo", "Scripts de datos", 0));
items.push(tp("TP-010", "EP-005", "Vista estructura de informes", "Base de datos", 0));
items.push(tp("TP-011", "EP-005", "Vista ajustes regulatorios", "Base de datos", 1));
items.push(tp("TP-012", "EP-006", "Traducciones", "Traducciones", 0));

function sub(
  parentId,
  epicName,
  topicName,
  title,
  status,
  owner,
  notes,
  completedAt,
  definitionOk,
  inTracking
) {
  const id = nextSt();
  return item({
    id,
    parentId,
    level: "SUBTASK",
    title,
    epic: epicName,
    topic: topicName,
    subtask: title,
    owner: owner || "Luis",
    priority: "Media",
    status,
    inTracking: inTracking ?? false,
    definitionOk: definitionOk ?? true,
    notes: notes || "",
    completedAt: completedAt || "",
    createdAt: T0,
  });
}

const sancorep = [
  "Probar que el exportador funciona correctamente en PRE",
  "Probar que el exportador funciona correctamente en PRO",
  "Validar que los datos son iguales para internal sancorep1 y 2",
  "Chequear nombre del fichero: corep_interno_variable_tex_taxonomic_code_20_variable_period_timestamp.txt",
];
sancorep.forEach((t) =>
  items.push(sub("TP-001", "LM Core", "Aplicación internal Sancorep 2", t, "Backlog"))
);

const ajustesTitles = [
  "Ingestar un fichero de ajustes masivo a un módulo",
  "Probar que se puede ingestar parcial o total",
  "Probar si hay más informes de los que se pueden ingestar en ajustes (no cargados en módulo), se indica correctamente",
  "Ver que el modal de ajustes y descarga funciona correctamente",
  "Aplicar a las queries de los exportadores la tabla de ajustes (modelo nuevo) — definición abierta",
  "Hacer pruebas con el visor: comparar visualizado vs descargado y ajustes",
];
const ajustesStatus = [
  "Backlog",
  "Completada",
  "Backlog",
  "Completada",
  "En progreso",
  "Backlog",
];
const ajustesCompleted = ["", "2025-02-10", "", "2025-02-08", "", ""];
ajustesTitles.forEach((t, i) =>
  items.push(
    sub(
      "TP-002",
      "LM Core",
      "Ajustes por ingesta masiva",
      t,
      ajustesStatus[i],
      "Luis",
      "",
      ajustesCompleted[i],
      true,
      false
    )
  )
);

["Esconder por defecto columna estatus en el modal de validaciones",
 "No se ordenan bien restrictivas y luego informativas",
 "Poner el botón de validar primero y luego el de visualizar"].forEach((t) =>
  items.push(
    sub("TP-003", "LM Core", "Validaciones", t, "Completada", "Luis", "", "2025-03-01", true, false)
  )
);

items.push(
  sub(
    "TP-004",
    "LM Core",
    "Ingestas",
    "Borrado de módulos: no se borran las ingestas al borrar módulo",
    "Backlog"
  )
);
items.push(
  sub(
    "TP-004",
    "LM Core",
    "Ingestas",
    'Proteger redirección de ingesta con alerta: "Este módulo ya no se encuentra disponible"',
    "Backlog"
  )
);

items.push(
  sub(
    "TP-006",
    "Fix",
    "Copiado de módulos",
    "Copiado de solvencia 3: periodo start de jurisdicción vs regulador — revisar",
    "Backlog",
    "Guillermo",
    "Incidencia Alberto",
    "",
    true,
    false
  )
);

items.push(
  item({
    id: "TK-001",
    parentId: "TP-005",
    level: "TASK",
    order: 0,
    title: "Migración a Node 22",
    epic: "LM Core",
    topic: "Migraciones",
    task: "Migración a Node 22",
    owner: "Luis",
    priority: "Alta",
    status: "Backlog",
    inTracking: false,
    definitionOk: true,
    createdAt: T0,
  })
);

items.push(
  item({
    id: "TK-002",
    parentId: "TP-005",
    level: "TASK",
    order: 1,
    title: "Migración a Angular 19",
    epic: "LM Core",
    topic: "Migraciones",
    task: "Migración a Angular 19",
    owner: "Luis",
    priority: "Alta",
    status: "Backlog",
    inTracking: false,
    definitionOk: true,
    createdAt: T0,
  })
);

items.push(
  sub(
    "TP-010",
    "Base de datos",
    "Vista estructura de informes",
    "Comentar agregación tipo text: max, listagg o first",
    "Backlog",
    "Alejandro"
  )
);

["Certificar que los datos están correctos",
 "Creación de la vista",
 "Mandar GoPortal a tres entornos y certificar datos"].forEach((t) =>
  items.push(sub("TP-011", "Base de datos", "Vista ajustes regulatorios", t, "Backlog", "Alejandro"))
);

items.push(
  sub(
    "TP-012",
    "Traducciones",
    "Traducciones",
    'Fix inserción null / "null" / vacío / espacio en formulario BD',
    "Backlog",
    "Luis"
  )
);
items.push(
  sub(
    "TP-012",
    "Traducciones",
    "Traducciones",
    "Propuesta: validaciones vista global con cruce fila-columna (traducciones dobles)",
    "Backlog",
    "Luis",
    "No prioritaria; pertenece a Luis"
  )
);

["Script traducciones no incluido en release anterior — 30 marzo",
 "Script borrado reporting más taxonomías — incluir en script del 30",
 "Hacer la release pendiente"].forEach((t) =>
  items.push(sub("TP-009", "Scripts de datos", "Scripts prioritarios 30 marzo", t, "Backlog", "Diego"))
);

items.push(sub("TP-007", "Fix", "Correctivos de queries", "FC201 con Custom View", "Backlog"));
items.push(
  sub("TP-007", "Fix", "Correctivos de queries", "Internal sync corep — resolver query Corep", "Backlog")
);

items.push(
  sub(
    "TP-008",
    "Release/Despliegues",
    "Plan de pruebas release 23/24 marzo a PRE",
    "Probar la release en PRE",
    "Backlog",
    "Luis",
    "Pertenece a Luis"
  )
);

const out = {
  ...base,
  items,
  testPlans: [],
  ui: {
    viewMode: "tree",
    treeExpandedIds: [],
    columnVisibility: {},
    sortKey: null,
    sortDir: "asc",
  },
  meta: {},
};
const dest = path.join(__dirname, "..", "data", "project-db.json");
fs.writeFileSync(dest, JSON.stringify(out, null, 2), "utf8");
console.log("Wrote", dest, "items:", items.length);
