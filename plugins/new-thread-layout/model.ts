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
  /** When the thread last had something worth reading (a message, a finished turn). */
  latestAttentionAt?: number;
  /** Live background work in the thread (bb's sidebar activity counts). */
  activity?: { workflows: number; backgroundAgents: number; backgroundCommands: number };
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
  /** Root threads where an agent is working, in the thread itself or in any of its descendants. */
  running: BoardRow[];
  /** The other unarchived root threads. */
  inProgress: BoardRow[];
  scheduled: ScheduledRow[];
  done: BoardRow[];
}

/** How far back "Last week" reaches. */
export const DONE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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

function selfWorking(t: BoardThread): boolean {
  if (t.isArchived) return false;
  const a = t.activity;
  return WORKING.has(t.runtimeStatus) || !!(a && (a.workflows || a.backgroundAgents || a.backgroundCommands));
}

export interface BoardOptions {
  /**
   * Automation threads the author is involved in (a draft, or their own message lately): they show
   * in the lists like any thread. Other quiet automation threads live under Scheduled only.
   */
  involved?: ReadonlySet<string>;
}

export function buildBoard(threads: readonly BoardThread[], automations: readonly Automation[], projectId: string, now: number, options: BoardOptions = {}): Board {
  const mine = threads.filter(t => t.projectId === projectId && !t.isHidden);
  const children = new Map<string, number>();
  const kids = new Map<string, BoardThread[]>();
  for (const t of mine) {
    if (!t.parentThreadId || t.isArchived) continue;
    children.set(t.parentThreadId, (children.get(t.parentThreadId) ?? 0) + 1);
    const list = kids.get(t.parentThreadId) ?? [];
    list.push(t);
    kids.set(t.parentThreadId, list);
  }
  // Work anywhere under a thread counts as the thread running.
  const runningMemo = new Map<string, boolean>();
  const runningTree = (t: BoardThread, seen: Set<string> = new Set()): boolean => {
    const known = runningMemo.get(t.id);
    if (known !== undefined) return known;
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    const result = selfWorking(t) || (kids.get(t.id) ?? []).some(k => runningTree(k, seen));
    runningMemo.set(t.id, result);
    return result;
  };
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
    const status = statusOf(thread);
    return {
      thread,
      ...status,
      working: status.working || (!thread.isArchived && runningTree(thread)),
      children: children.get(thread.id) ?? 0,
      nextRunAt: b?.nextRunAt ?? null,
      automationNames: b?.names ?? [],
    };
  };
  const roots = mine.filter(t => t.parentThreadId === null);
  const byId = new Map(mine.map(t => [t.id, t] as const));

  const pinned = roots.filter(t => t.isPinned && !t.isArchived).map(row);

  // An automation thread shows in the lists only when something happens there (working, unread,
  // waiting) or the author is involved (pinned, a draft, their own message lately); quiet runs on
  // schedule live under Scheduled. When it shows, its next run is the clock in the left slot.
  const open = roots
    .filter(t => !t.isArchived && !t.isPinned)
    .map(row)
    .filter(r => !bound.has(r.thread.id) || r.working || r.attention || r.thread.isUnread || !!options.involved?.has(r.thread.id))
    .sort((a, b) => Number(b.attention) - Number(a.attention) || b.thread.updatedAt - a.thread.updatedAt);
  const running = open.filter(r => r.working);
  const inProgress = open.filter(r => !r.working);

  // Upcoming runs by time, then paused automations so they can be resumed from here.
  const upcoming = automations
    .filter(a => a.enabled !== false && a.nextRunAt != null && a.nextRunAt >= now)
    .sort((a, b) => (a.nextRunAt ?? 0) - (b.nextRunAt ?? 0));
  const paused = automations.filter(a => a.enabled === false).sort((a, b) => a.name.localeCompare(b.name));
  const scheduled: ScheduledRow[] = [...upcoming, ...paused].map(a => ({ automation: a, thread: byId.get(boundThreadId(a) ?? "") ?? null }));

  const done = roots
    .filter(t => t.isArchived && t.archivedAt !== null && t.archivedAt >= now - DONE_WINDOW_MS)
    .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0))
    .map(row);

  return { pinned, running, inProgress, scheduled, done };
}

export interface Overview {
  /** Threads from the projects that wait for the author: unread, or an agent asking. */
  needsYou: BoardRow[];
  /** Threads from the projects where an agent works (in the thread or below it). */
  running: BoardRow[];
  /** Other unarchived threads from the projects with activity in the last two hours: where to pick up. */
  recent: BoardRow[];
  /** Upcoming runs across every project, soonest first; paused ones only from home's own project. */
  scheduled: ScheduledRow[];
  /** Threads archived within the last week across the projects and home, newest first. */
  done: BoardRow[];
}

/**
 * The home screen's overview: what is going on across the given projects right now, plus every
 * project's next runs. Quiet idle threads stay in their projects.
 */
/** How far back "Continue" on the home screen reaches. */
export const CONTINUE_WINDOW_MS = 2 * 60 * 60 * 1000;

export function buildOverview(
  threads: readonly BoardThread[],
  automations: readonly Automation[],
  projectIds: readonly string[],
  homeProjectId: string | null,
  now: number,
  options: BoardOptions = {},
): Overview {
  const needsYou: BoardRow[] = [];
  const running: BoardRow[] = [];
  const recentRows: BoardRow[] = [];
  const lastActive = (r: BoardRow) => r.thread.latestAttentionAt || r.thread.updatedAt;
  for (const id of projectIds) {
    // With the project's automations, so rows know their next run (the clock in the left slot).
    const b = buildBoard(threads, automations.filter(a => a.projectId === id), id, now, options);
    for (const r of [...b.pinned, ...b.running, ...b.inProgress]) {
      if (r.working) running.push(r);
      else if (r.attention || r.thread.isUnread) needsYou.push(r);
      else if (lastActive(r) >= now - CONTINUE_WINDOW_MS) recentRows.push(r);
    }
  }
  const recent = (a: BoardRow, b: BoardRow) => lastActive(b) - lastActive(a);
  needsYou.sort((a, b) => Number(b.attention) - Number(a.attention) || recent(a, b));
  running.sort(recent);
  recentRows.sort(recent);
  const byId = new Map(threads.map(t => [t.id, t] as const));
  // Only projects the thread list shows, plus home's own: hidden projects stay out of sight here too.
  const shown = new Set([...projectIds, ...(homeProjectId ? [homeProjectId] : [])]);
  const upcoming = automations
    .filter(a => shown.has(a.projectId))
    .filter(a => a.enabled !== false && a.nextRunAt != null && a.nextRunAt >= now)
    .sort((a, b) => (a.nextRunAt ?? 0) - (b.nextRunAt ?? 0));
  const paused = automations.filter(a => a.enabled === false && a.projectId === homeProjectId);
  const scheduled = [...upcoming, ...paused].map(a => ({ automation: a, thread: byId.get(boundThreadId(a) ?? "") ?? null }));
  const done = [...projectIds, ...(homeProjectId ? [homeProjectId] : [])]
    .flatMap(id => buildBoard(threads, automations.filter(a => a.projectId === id), id, now, options).done)
    .sort((a, b) => (b.thread.archivedAt ?? 0) - (a.thread.archivedAt ?? 0));
  return { needsYou, running, recent: recentRows, scheduled, done };
}
