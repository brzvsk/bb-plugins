import type { Automation, GitStatusRow } from "./contracts";

export interface BranchView {
  name: string;
  /** e.g. "4 ahead of main", or null when even with its merge base. */
  detail: string | null;
}

export function branchView(row: GitStatusRow | undefined): BranchView | null {
  if (!row || row.outcome !== "available" || !row.workspace) return null;
  const { branch, checkout, mergeBase } = row.workspace;
  const name = branch?.currentBranch ?? checkout?.branchName ?? (checkout?.headSha ? checkout.headSha.slice(0, 7) : null);
  if (!name) return null;
  const ahead = mergeBase?.aheadCount ?? 0;
  const behind = mergeBase?.behindCount ?? 0;
  const base = mergeBase?.mergeBaseBranch;
  const parts = [ahead ? `${ahead} ahead` : null, behind ? `${behind} behind` : null].filter(Boolean);
  const detail = parts.length && base && base !== name ? `${parts.join(", ")} of ${base}` : parts.length ? parts.join(", ") : null;
  return { name, detail };
}

const nextRun = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** The trailing status bb's own Automations list shows, in short form. */
export function automationStatus(a: Automation, now = Date.now()): string {
  if (a.problem) return "Needs attention";
  if (a.lastRunStatus === "running") return "Running";
  if (a.enabled === false) return "Paused";
  if (a.nextRunAt == null) return "Not scheduled";
  return a.nextRunAt < now ? "Due" : `Next ${nextRun.format(new Date(a.nextRunAt))}`;
}

/**
 * Soonest first: what needs attention or is running, then upcoming runs by time,
 * then unscheduled; paused ones stay at the bottom in their original order.
 */
export function sortAutomations<T extends Automation>(items: readonly T[]): T[] {
  const rank = (a: Automation) =>
    a.problem || a.lastRunStatus === "running" ? -Infinity
    : a.enabled === false ? Infinity
    : a.nextRunAt ?? Number.MAX_SAFE_INTEGER;
  return [...items].sort((a, b) => rank(a) - rank(b));
}

export type ParentNotifications = "auto" | "stuck" | "off";

/** Labels follow bb's own CLI help for --parent-notifications. */
export const NOTIFY_OPTIONS: readonly { value: ParentNotifications; label: string }[] = [
  { value: "auto", label: "Every outcome" },
  { value: "stuck", label: "Only when stuck" },
  { value: "off", label: "Off" },
];
