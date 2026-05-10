import type { ActivityEntry, Writer } from "../types";
import { formatTime, truncate } from "./text";

// ─── Activity log ────────────────────────────────────────────────────────────

const MAX_LOG_ENTRIES = 12;
let _nextId = 1;

/**
 * Create a new activity entry.
 */
export function createActivityEntry(
  writer: Writer,
  action: string,
  preview = ""
): ActivityEntry {
  return {
    id: _nextId++,
    writer,
    action,
    preview: truncate(preview),
    time: formatTime(new Date()),
  };
}

/**
 * Prepend a new entry to the log, capping at MAX_LOG_ENTRIES.
 */
export function appendToLog(
  log: ActivityEntry[],
  entry: ActivityEntry
): ActivityEntry[] {
  return [entry, ...log].slice(0, MAX_LOG_ENTRIES);
}
