import type { Automation } from "./contracts";

/** The subset of bb's sidebar thread this board reads; keeps the model testable without the SDK. */
export interface BoardThread {
  id: string;
  projectId: string;
  href: string;
  displayTitle: string;
  parentThreadId: string | null;
  status: string;
  runtimeStatus: string;
  indicator: string;
  hasPendingInteraction: boolean;
  isUnread: boolean;
  isPinned: boolean;
  isArchived: boolean;
  archivedAt: number | null;
  isHidden: boolean;
  updatedAt: number;
}

export interface BoardRow {
  thread: BoardThread;
  /** Short status text drawn beside bb's glyph; empty when the thread is quietly idle. */
  status: string;
  /** Accented status: the thread needs the author. */
  attention: boolean;
  /** Live work is going on in the thread. */
  working: boolean;
  /** Child threads under this root. */
  children: number;
  /** Next run of an automation bound to this thread, epoch ms. */
  nextRunAt: number | null;
  automationNames: string[];
}

export interface ScheduledRow {
  automation: Automation;
  /** The bound thread when it is listed in the project, for navigation. */
  thread: BoardThread | null;
}

export interface Board {
  pinned: BoardRow[];
  inProgress: BoardRow[];
  scheduled: ScheduledRow[];
  done: BoardRow[];
}

/** How far back Recently done reaches. */
export const DONE_WINDOW_MS = 48 * 60 * 60 * 1000;

const WORKING = new Set(["active", "starting", "stopping", "provisioning", "waiting-for-host"]);

export function statusOf(t: BoardThread): Pick<BoardRow, "status" | "attention" | "working"> {
  const working = WORKING.has(t.runtimeStatus);
  if (t.hasPendingInteraction || t.indicator === "waiting-for-input") return { status: "Needs you", attention: true, working };
  if (working) return { status: t.runtimeStatus === "provisioning" || t.runtimeStatus === "waiting-for-host" ? "Starting" : "Working", attention: false, working };
  if (t.status === "error" || t.indicator === "unread-error") return { status: "Failed", attention: true, working: false };
  if (t.indicator === "queued-failed") return { status: "Queue failed", attention: true, working: false };
  if (t.indicator === "queued-waiting") return { status: "Queued", attention: false, working: false };
  if (t.isUnread) return { status: "Unread", attention: false, working: false };
  if (t.indicator === "plan-mode") return { status: "Plan", attention: false, working: false };
  if (t.indicator === "draft" || t.indicator === "working-draft") return { status: "Draft", attention: false, working: false };
  return { status: "", attention: false, working: false };
}

/** Automation thread binding: the target thread, else the latest run thread of a per-run automation. */
export function boundThreadId(a: Automation): string | null {
  return a.execution?.targetThreadId ?? a.lastRunThreadId ?? null;
}

export function buildBoard(threads: readonly BoardThread[], automations: readonly Automation[], projectId: string, now: number): Board {
  const mine = threads.filter(t => t.projectId === projectId && !t.isHidden);
  const children = new Map<string, number>();
  for (const t of mine) {
    if (t.parentThreadId && !t.isArchived) children.set(t.parentThreadId, (children.get(t.parentThreadId) ?? 0) + 1);
  }
  const bound = new Map<string, { names: string[]; nextRunAt: number | null }>();
  for (const a of automations) {
    const id = boundThreadId(a);
    if (!a.enabled || !id) continue;
    const entry = bound.get(id) ?? { names: [], nextRunAt: null };
    entry.names.push(a.name);
    const next = a.nextRunAt ?? null;
    if (next !== null && (entry.nextRunAt === null || next < entry.nextRunAt)) entry.nextRunAt = next;
    bound.set(id, entry);
  }
  const row = (thread: BoardThread): BoardRow => {
    const b = bound.get(thread.id);
    return { thread, ...statusOf(thread), children: children.get(thread.id) ?? 0, nextRunAt: b?.nextRunAt ?? null, automationNames: b?.names ?? [] };
  };
  const roots = mine.filter(t => t.parentThreadId === null);
  const byId = new Map(mine.map(t => [t.id, t] as const));

  const pinned = roots.filter(t => t.isPinned && !t.isArchived).map(row);

  // A read, idle automation thread lives under Scheduled with its automation; it comes back here when it needs attention.
  const inProgress = roots
    .filter(t => !t.isArchived && !t.isPinned)
    .map(row)
    .filter(r => !(bound.has(r.thread.id) && !r.working && !r.attention && !r.thread.isUnread))
    .sort((a, b) => Number(b.working) - Number(a.working) || Number(b.attention) - Number(a.attention) || b.thread.updatedAt - a.thread.updatedAt);

  const scheduled: ScheduledRow[] = automations
    .filter(a => a.enabled !== false && a.nextRunAt != null && a.nextRunAt >= now)
    .sort((a, b) => (a.nextRunAt ?? 0) - (b.nextRunAt ?? 0))
    .map(a => ({ automation: a, thread: byId.get(boundThreadId(a) ?? "") ?? null }));

  const done = roots
    .filter(t => t.isArchived && t.archivedAt !== null && t.archivedAt >= now - DONE_WINDOW_MS)
    .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0))
    .map(row);

  return { pinned, inProgress, scheduled, done };
}
