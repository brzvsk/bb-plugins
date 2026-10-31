/**
 * Where a thread was opened from, so a swipe back returns there: the home screen or its project's
 * home. Kept per window in sessionStorage; a thread with no record goes back to its project.
 */
export type Origin = "home" | "project";

const KEY = "new-thread-layout:thread-origins";
const MAX = 200;

function read(): Record<string, Origin> {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, Origin>) : {};
  } catch {
    return {};
  }
}

export function rememberOrigin(threadId: string, origin: Origin): void {
  try {
    const all = read();
    delete all[threadId];
    all[threadId] = origin;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX))) delete all[k];
    sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable: back goes to the project.
  }
}

export function originOf(threadId: string): Origin {
  return read()[threadId] ?? "project";
}
