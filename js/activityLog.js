/**
 * @typedef {import('./workItem.js').WorkItem} WorkItem
 */

/**
 * @param {WorkItem} item
 * @param {{
 *   action: string,
 *   field?: string,
 *   from?: string,
 *   to?: string,
 *   user?: string,
 *   detail?: string,
 * }} entry
 */
export function addLogEntry(item, entry) {
  if (!Array.isArray(item.activityLog)) item.activityLog = [];
  item.activityLog.push({
    ts: new Date().toISOString(),
    action: entry.action,
    field: entry.field ?? "",
    from: entry.from != null ? String(entry.from) : "",
    to: entry.to != null ? String(entry.to) : "",
    user: entry.user ?? "",
    detail: entry.detail ?? "",
  });
}

/**
 * @param {WorkItem} item
 * @param {string} field
 * @param {string} fromVal
 * @param {string} toVal
 */
export function logFieldChange(item, field, fromVal, toVal) {
  if (String(fromVal) === String(toVal)) return;
  addLogEntry(item, {
    action: "field_changed",
    field,
    from: fromVal,
    to: toVal,
  });
}
