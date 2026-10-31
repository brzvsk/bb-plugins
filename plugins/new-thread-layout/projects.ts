import type { BoardThread } from "./model";

export interface ProjectTab {
  id: string;
  name: string;
  href: string;
  /** Something unread in the project. */
  unread: boolean;
  /** An agent is working somewhere in the project. */
  running: boolean;
  /** A thread in the project waits for the author. */
  attention: boolean;
}

const WORKING = new Set(["active", "starting", "stopping", "provisioning", "waiting-for-host"]);

/**
 * The projects for the home screen's tabs: the thread list's visible projects in its order (the
 * personal project, i.e. home itself, left out), projects it has not placed yet after them by
 * name, each with what is going on in its live threads.
 */
export function projectTabs(
  projects: readonly { id: string; name: string; href: string; isPersonal: boolean }[],
  threads: readonly BoardThread[],
  order: readonly string[],
  hidden: readonly string[],
): ProjectTab[] {
  const hiddenIds = new Set(hidden.filter(g => g.startsWith("project:")).map(g => g.slice(8)));
  const rank = new Map(order.filter(g => g.startsWith("project:")).map((g, i) => [g.slice(8), i] as const));
  const live = threads.filter(t => !t.isArchived && !t.isHidden);
  return projects
    .filter(p => !p.isPersonal && !hiddenIds.has(p.id))
    .sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || a.name.localeCompare(b.name))
    .map(p => {
      const mine = live.filter(t => t.projectId === p.id);
      return {
        id: p.id,
        name: p.name,
        href: p.href,
        unread: mine.some(t => t.isUnread),
        running: mine.some(t => WORKING.has(t.runtimeStatus)),
        attention: mine.some(t => t.hasPendingInteraction || t.indicator === "waiting-for-input"),
      };
    });
}
