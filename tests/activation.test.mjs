import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isKanbanActivatableLevel,
  isBoardVisibleLevel,
  isClassificationLevel,
  isSubtaskLevel,
  canCompleteOrBlock,
  levelLabel,
  getEpicColor,
  DEFAULT_EPIC_COLORS,
} from "../js/constants.js";

import {
  sendToTracking,
  filterBoardTasks,
  completeItem,
  toggleBlocked,
  validateForTracking,
} from "../js/workItem.js";

// ─── Level helpers ───

describe("isKanbanActivatableLevel", () => {
  it("returns true only for TASK", () => {
    assert.equal(isKanbanActivatableLevel("TASK"), true);
    assert.equal(isKanbanActivatableLevel("EPIC"), false);
    assert.equal(isKanbanActivatableLevel("TOPIC"), false);
    assert.equal(isKanbanActivatableLevel("SUBTASK"), false);
    assert.equal(isKanbanActivatableLevel(""), false);
    assert.equal(isKanbanActivatableLevel(undefined), false);
  });
});

describe("isClassificationLevel", () => {
  it("returns true for EPIC and TOPIC", () => {
    assert.equal(isClassificationLevel("EPIC"), true);
    assert.equal(isClassificationLevel("TOPIC"), true);
    assert.equal(isClassificationLevel("TASK"), false);
    assert.equal(isClassificationLevel("SUBTASK"), false);
  });
});

describe("isSubtaskLevel", () => {
  it("returns true only for SUBTASK", () => {
    assert.equal(isSubtaskLevel("SUBTASK"), true);
    assert.equal(isSubtaskLevel("TASK"), false);
    assert.equal(isSubtaskLevel("EPIC"), false);
  });
});

describe("canCompleteOrBlock", () => {
  it("allows TASK and SUBTASK", () => {
    assert.equal(canCompleteOrBlock("TASK"), true);
    assert.equal(canCompleteOrBlock("SUBTASK"), true);
  });
  it("rejects EPIC and TOPIC", () => {
    assert.equal(canCompleteOrBlock("EPIC"), false);
    assert.equal(canCompleteOrBlock("TOPIC"), false);
  });
});

describe("levelLabel", () => {
  it("returns Spanish labels", () => {
    assert.equal(levelLabel("EPIC"), "Épica");
    assert.equal(levelLabel("TOPIC"), "Topic");
    assert.equal(levelLabel("TASK"), "Tarea");
    assert.equal(levelLabel("SUBTASK"), "Subtarea");
  });
});

describe("isBoardVisibleLevel", () => {
  it("only TASK is visible on board", () => {
    assert.equal(isBoardVisibleLevel("TASK"), true);
    assert.equal(isBoardVisibleLevel("EPIC"), false);
    assert.equal(isBoardVisibleLevel("TOPIC"), false);
    assert.equal(isBoardVisibleLevel("SUBTASK"), false);
  });
});

// ─── Epic colors ───

describe("getEpicColor", () => {
  it("returns correct color from defaults", () => {
    assert.equal(getEpicColor("Fixes"), "#ff5630");
    assert.equal(getEpicColor("LMCore"), "#00875a");
    assert.equal(getEpicColor("Otros"), "#8993a4");
  });
  it("returns gray fallback for unknown epic", () => {
    assert.equal(getEpicColor("Unknown"), "#8993a4");
    assert.equal(getEpicColor(""), "#8993a4");
  });
  it("uses custom catalogs epicColors when provided", () => {
    const catalogs = { epicColors: { Fixes: "#000000" } };
    assert.equal(getEpicColor("Fixes", catalogs), "#000000");
  });
});

// ─── Work item operations ───

function makeTask(id, overrides = {}) {
  return {
    id,
    parentId: null,
    level: "TASK",
    title: "Test task with a long title for definition",
    summary: "Summary text that is at least 8 chars",
    epic: "Fixes",
    topic: "Test",
    owner: "Luis",
    priority: "Media",
    status: "BACKLOG",
    type: "task",
    inTracking: false,
    definitionOk: true,
    blocked: false,
    targetDate: "2026-03-31",
    notes: "",
    activityLog: [],
    comments: [],
    ...overrides,
  };
}

describe("sendToTracking", () => {
  it("activates a valid TASK", () => {
    const items = [makeTask("TK-100")];
    const res = sendToTracking(items, "TK-100", false);
    assert.equal(res.updated, 1);
    assert.equal(res.errors.length, 0);
    assert.equal(items[0].inTracking, true);
    assert.equal(items[0].status, "PENDING");
  });

  it("skips EPIC level", () => {
    const items = [makeTask("EP-100", { level: "EPIC" })];
    const res = sendToTracking(items, "EP-100", false);
    assert.equal(res.updated, 0);
    assert.equal(items[0].inTracking, false);
  });

  it("skips TOPIC level", () => {
    const items = [makeTask("TP-100", { level: "TOPIC" })];
    const res = sendToTracking(items, "TP-100", false);
    assert.equal(res.updated, 0);
    assert.equal(items[0].inTracking, false);
  });

  it("skips SUBTASK level", () => {
    const items = [makeTask("ST-100", { level: "SUBTASK" })];
    const res = sendToTracking(items, "ST-100", false);
    assert.equal(res.updated, 0);
    assert.equal(items[0].inTracking, false);
  });

  it("skips completed items", () => {
    const items = [makeTask("TK-100", { status: "DONE" })];
    const res = sendToTracking(items, "TK-100", false);
    assert.equal(res.updated, 0);
  });
});

describe("filterBoardTasks", () => {
  it("returns only TASK items with inTracking", () => {
    const items = [
      makeTask("TK-100", { inTracking: true }),
      makeTask("TK-101", { inTracking: false }),
      makeTask("EP-100", { level: "EPIC", inTracking: true }),
      makeTask("ST-100", { level: "SUBTASK", inTracking: true }),
    ];
    const result = filterBoardTasks(items);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "TK-100");
  });
});

describe("completeItem", () => {
  it("completes a TASK", () => {
    const items = [makeTask("TK-100")];
    assert.equal(completeItem(items, "TK-100"), true);
    assert.equal(items[0].status, "DONE");
  });

  it("completes a SUBTASK", () => {
    const items = [makeTask("ST-100", { level: "SUBTASK" })];
    assert.equal(completeItem(items, "ST-100"), true);
    assert.equal(items[0].status, "DONE");
  });

  it("rejects completing an EPIC", () => {
    const items = [makeTask("EP-100", { level: "EPIC" })];
    assert.equal(completeItem(items, "EP-100"), false);
    assert.notEqual(items[0].status, "DONE");
  });

  it("rejects completing a TOPIC", () => {
    const items = [makeTask("TP-100", { level: "TOPIC" })];
    assert.equal(completeItem(items, "TP-100"), false);
    assert.notEqual(items[0].status, "DONE");
  });
});

describe("toggleBlocked", () => {
  it("blocks a TASK", () => {
    const items = [makeTask("TK-100")];
    assert.equal(toggleBlocked(items, "TK-100"), true);
    assert.equal(items[0].blocked, true);
  });

  it("rejects blocking an EPIC", () => {
    const items = [makeTask("EP-100", { level: "EPIC" })];
    assert.equal(toggleBlocked(items, "EP-100"), false);
    assert.equal(items[0].blocked, false);
  });

  it("rejects blocking a TOPIC", () => {
    const items = [makeTask("TP-100", { level: "TOPIC" })];
    assert.equal(toggleBlocked(items, "TP-100"), false);
    assert.equal(items[0].blocked, false);
  });
});

// ─── Validation coherence ───

describe("validateForTracking", () => {
  it("passes for a well-defined TASK", () => {
    const item = makeTask("TK-100");
    const { ok } = validateForTracking(item);
    assert.equal(ok, true);
  });

  it("fails when owner is missing", () => {
    const item = makeTask("TK-100", { owner: "" });
    const { ok, missing } = validateForTracking(item);
    assert.equal(ok, false);
    assert.ok(missing.some((m) => m.includes("Responsable")));
  });
});
