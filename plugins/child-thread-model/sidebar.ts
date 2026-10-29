import type { PluginSidebarThread } from '@get-bb/plugin-sdk/app';

export type ActivityThread = Pick<PluginSidebarThread,
  'id' | 'parentThreadId' | 'runtimeStatus' | 'activity' | 'isHidden' | 'isArchived'>;
const RUNNING = new Set(['active', 'starting', 'stopping', 'provisioning']);

export function ownsWork(thread: ActivityThread): boolean {
  return RUNNING.has(thread.runtimeStatus) || Object.values(thread.activity).some(count => count > 0);
}

/** Only parents whose spinner can be attributed entirely to visible descendants. */
export function delegatedParents(threads: readonly ActivityThread[]): Set<string> {
  const visible = threads.filter(t => !t.isHidden && !t.isArchived);
  const byId = new Map(visible.map(t => [t.id, t]));
  const parents = new Set<string>();
  for (const thread of visible) {
    if (!ownsWork(thread)) continue;
    const visited = new Set([thread.id]);
    let id = thread.parentThreadId;
    while (id && !visited.has(id)) {
      visited.add(id);
      const parent = byId.get(id);
      if (!parent) break;
      if (!ownsWork(parent)) parents.add(id);
      id = parent.parentThreadId;
    }
  }
  return parents;
}

export const MARKER = 'data-child-thread-activity';
export interface ActivityTarget { id: string; element: HTMLElement }

export function syncActivityTargets(root: ParentNode, eligible: ReadonlySet<string>): ActivityTarget[] {
  const targets: ActivityTarget[] = [];
  const keep = new Set<Element>();
  for (const link of root.querySelectorAll<HTMLElement>('a[data-sidebar-thread-id]')) {
    const id = link.dataset.sidebarThreadId!;
    if (!eligible.has(id)) continue;
    const row = link.closest('[data-sidebar-rename-row]');
    const trailing = row?.querySelector<HTMLElement>('[data-sidebar-thread-trailing]');
    const loader = trailing?.querySelector('[data-sidebar-thread-trailing-indicator] [data-icon="Loading"]');
    if (!trailing || !loader) continue;
    const indicator = loader.parentElement!;
    let marker = indicator.querySelector<HTMLElement>(`:scope > [${MARKER}]`);
    if (!marker) {
      marker = trailing.ownerDocument.createElement('span');
      marker.setAttribute(MARKER, id);
      marker.className = 'child-thread-activity';
      marker.title = 'Child thread working; parent is idle';
      indicator.append(marker);
    }
    keep.add(marker);
    targets.push({ id, element: marker });
  }
  for (const marker of root.querySelectorAll(`[${MARKER}]`)) {
    if (!keep.has(marker)) marker.remove();
  }
  return targets;
}
