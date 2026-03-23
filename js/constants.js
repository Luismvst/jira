/** @typedef {'EPIC'|'TOPIC'|'TASK'|'SUBTASK'} Level */

export const STATUS_COMPLETED = "Completada";
export const DEFAULT_STATUS = "Backlog";

/** @type {Record<string, string>} */
export const LEVEL_PREFIX = {
  EPIC: "EP",
  TOPIC: "TP",
  TASK: "TK",
  SUBTASK: "ST",
};

export const TRACKING_CLEANUP_DAYS = 30;
