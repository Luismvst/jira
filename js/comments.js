/**
 * @typedef {import('./workItem.js').WorkItem} WorkItem
 */
import { addLogEntry } from "./activityLog.js";

/**
 * @param {WorkItem} item
 * @param {{ author: string, text: string }} c
 * @returns {{ id: string }|null}
 */
export function addComment(item, c) {
  const text = String(c.text || "").trim();
  if (!text) return null;
  if (!Array.isArray(item.comments)) item.comments = [];
  const id = `CMT-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const author = String(c.author || "").trim() || "Usuario";
  const createdAt = new Date().toISOString();
  item.comments.push({ id, author, text, createdAt });
  addLogEntry(item, {
    action: "comment_added",
    user: author,
    detail: text.length > 120 ? `${text.slice(0, 117)}…` : text,
  });
  return { id };
}
