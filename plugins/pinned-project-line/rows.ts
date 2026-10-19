export const LINE_CLASS = 'pinned-project-line';
export const ROW_ATTR = 'data-pinned-project-line';

const ROW = '[class*="group/thread-row"]';
const PROJECT_GROUP = '[data-sidebar-visibility-group^="project:"]';

/** Thread ids of sidebar rows outside project groups, where pinned threads live. */
export function candidateIds(root: ParentNode): string[] {
  return [...root.querySelectorAll<HTMLElement>('a[data-sidebar-thread-id]')]
    .filter(a => !a.closest(PROJECT_GROUP))
    .map(a => a.dataset.sidebarThreadId!)
    .filter(Boolean);
}

/** Adds, updates or removes the project line on every row; `projects` holds pinned threads only. */
export function decorate(root: ParentNode, projects: ReadonlyMap<string, string>): void {
  const seen = new Set<Element>();
  for (const a of root.querySelectorAll<HTMLElement>('a[data-sidebar-thread-id]')) {
    const row = a.closest(ROW);
    const title = row?.querySelector('.bb-thread-title');
    const project = projects.get(a.dataset.sidebarThreadId ?? '');
    if (!row || !title || !project || a.closest(PROJECT_GROUP)) continue;
    seen.add(row);
    row.setAttribute(ROW_ATTR, '');
    let line = title.querySelector<HTMLElement>(`:scope > .${LINE_CLASS}`);
    if (!line) {
      line = document.createElement('span');
      line.className = LINE_CLASS;
      title.append(line);
    }
    if (line.textContent !== project) line.textContent = project;
  }
  for (const row of root.querySelectorAll(`[${ROW_ATTR}]`)) {
    if (seen.has(row)) continue;
    row.removeAttribute(ROW_ATTR);
    row.querySelectorAll(`.${LINE_CLASS}`).forEach(line => line.remove());
  }
}

export function undecorate(root: ParentNode): void {
  decorate(root, new Map());
}
