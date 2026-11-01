const STORAGE_KEY = "formatra:history";
const MAX_ENTRIES = 30;

/** @typedef {{id:string, toolId:string, toolName:string, fileName:string, timestamp:number}} HistoryEntry */

function safeParse(json) {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @returns {HistoryEntry[]} newest first */
export function getHistory() {
  if (typeof window === "undefined") return [];
  try {
    return safeParse(window.localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    // localStorage can throw in private-browsing / storage-disabled contexts
    return [];
  }
}

/**
 * Record a completed action. Only metadata (tool, file name, timestamp) is
 * stored — never file contents — since Formatra never uploads or retains
 * the files themselves.
 */
export function addHistoryEntry({ toolId, toolName, fileName }) {
  if (typeof window === "undefined") return;
  try {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      toolId,
      toolName,
      fileName,
      timestamp: Date.now(),
    };
    const next = [entry, ...getHistory()].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("formatra:history-changed"));
  } catch {
    // ignore quota/storage errors — history is a non-critical convenience feature
  }
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("formatra:history-changed"));
  } catch {
    // ignore
  }
}

export function removeHistoryEntry(id) {
  if (typeof window === "undefined") return;
  try {
    const next = getHistory().filter((e) => e.id !== id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("formatra:history-changed"));
  } catch {
    // ignore
  }
}

export function formatRelativeTime(timestamp) {
  const diffSec = Math.round((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "baru saja";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return new Date(timestamp).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
