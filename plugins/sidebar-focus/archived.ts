import { FLEX_CLASS, topBlocks } from './sidebar';

/** One thread archived recently, as the server RPC returns it. */
export interface ArchivedThread {
  threadId: string;
  projectId: string;
  sectionId: string | null;
  title: string;
  archivedAt: number;
}

export interface ArchivedHandlers {
  toggle(key: string): void;
  open(href: string, event: MouseEvent): void;
  unarchive(threadId: string): void;
}

export const ARCHIVED_CLASS = 'sidebar-focus-archived';
export const ARCHIVED_PREFIX = 'archived:';
export const MENU_SLOT_CLASS = 'sidebar-focus-menu-slot';
// bb's own sidebar row button look (ghost icon button), from its stylesheet.
const ROW_BUTTON_CLASS = 'inline-flex items-center justify-center h-7 w-7 text-subtle-foreground hover:text-muted-foreground hover:bg-state-hover active:bg-state-active relative m-0 shrink-0 cursor-pointer rounded-md p-0 outline-none';
const LIST = '[data-bb-plugin="thread-list"]';
const ANCHOR = 'a[data-sidebar-thread-id]';
const WRAPPER = '[data-sidebar-windowed-item]';
const LABEL = '[data-sidebar-sticky-tier="label"]';
const SVG_NS = 'http://www.w3.org/2000/svg';
const CHEVRON = '<path d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18"/>';
// bb's archive-restore glyph outline: a box with an up arrow.
const RESTORE = '<path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M2 4h20v4H2z"/><path d="M12 18v-6M9.5 14.5 12 12l2.5 2.5"/>';
// bb's own row look; these utility classes already exist in the app stylesheet.
const ROW_CLASS = 'sidebar-focus-archived-row bb-sidebar-hover-actions-row flex w-full items-center gap-2 rounded-md pr-0 text-sm relative h-[var(--bb-sidebar-row-height)] cursor-pointer select-none';
const ROW_IDLE_CLASS = 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bb-sidebar-accent-row';
const ROW_SELECTED_CLASS = 'text-sidebar-foreground bg-state-active bb-sidebar-selected-row';

function icon(paths: string, className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  svg.innerHTML = paths;
  return svg;
}

/**
 * The group each archived thread would sit in: its project or section when bb
 * shows one, else the loose Threads group (the personal project). Threads whose
 * group isn't in the list are left out.
 */
export function groupArchived(root: ParentNode, threads: readonly ArchivedThread[]): Map<string, ArchivedThread[]> {
  const keys = new Set(topBlocks(root).map(block => block.key));
  const groups = new Map<string, ArchivedThread[]>();
  for (const thread of threads) {
    const key = [`project:${thread.projectId}`, thread.sectionId ? `section:${thread.sectionId}` : '', 'threads']
      .find(candidate => candidate && keys.has(candidate));
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(thread);
    groups.set(key, list);
  }
  return groups;
}

/** True when bb itself lists archived threads (Archived shown), so a second copy would only repeat them. */
export function nativeShowsArchived(root: ParentNode, threads: readonly ArchivedThread[]): boolean {
  return threads.some(thread => root.querySelector(`${LIST} ${ANCHOR}[data-sidebar-thread-id="${thread.threadId}"]`));
}

function isCollapsed(group: HTMLElement): boolean {
  return group.querySelector(`${LABEL} button[aria-expanded]:not([aria-haspopup])`)?.getAttribute('aria-expanded') === 'false';
}

/**
 * Puts a collapsed "Recently archived" disclosure at the end of every group
 * that has recently archived threads, below its Automations line.
 */
export function renderArchived(
  root: ParentNode,
  threads: readonly ArchivedThread[],
  open: ReadonlySet<string>,
  selected: string | null,
  handlers: ArchivedHandlers,
): void {
  const groups = nativeShowsArchived(root, threads) ? new Map<string, ArchivedThread[]>() : groupArchived(root, threads);
  const seen = new Set<Element>();
  for (const { key, element } of topBlocks(root)) {
    const list = groups.get(key);
    if (!list?.length || isCollapsed(element)) continue;
    // Inside the group's row list when it has one, so it orders after tucked automations; else after the header.
    const container = element.querySelector(WRAPPER)?.parentElement ?? element;
    let block = container.querySelector<HTMLElement>(`:scope > .${ARCHIVED_CLASS}`);
    if (!block) {
      block = document.createElement('div');
      block.className = ARCHIVED_CLASS;
    }
    if (block.parentElement !== container) container.append(block);
    if (container !== element && !container.classList.contains(FLEX_CLASS)) container.classList.add(FLEX_CLASS);
    seen.add(block);
    const isOpen = open.has(ARCHIVED_PREFIX + key) || list.some(thread => thread.threadId === selected);
    const signature = JSON.stringify([key, isOpen, selected, list.map(thread => [thread.threadId, thread.title])]);
    if (block.dataset.signature === signature) continue;
    block.dataset.signature = signature;
    block.replaceChildren(label(key, list.length, isOpen, handlers), ...(isOpen ? list.map(thread => row(thread, thread.threadId === selected, handlers)) : []));
  }
  for (const block of root.querySelectorAll(`.${ARCHIVED_CLASS}`)) {
    if (!seen.has(block)) block.remove();
  }
}

function label(key: string, count: number, open: boolean, handlers: ArchivedHandlers): HTMLElement {
  const element = document.createElement('div');
  element.className = 'sidebar-focus-disclosure';
  element.setAttribute('role', 'button');
  element.tabIndex = 0;
  element.setAttribute('aria-expanded', String(open));
  const title = document.createElement('span');
  title.textContent = 'Recently archived';
  const number = document.createElement('span');
  number.className = 'sidebar-focus-count';
  number.textContent = String(count);
  element.append(title, number, icon(CHEVRON, 'sidebar-focus-chevron'));
  const toggle = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    handlers.toggle(ARCHIVED_PREFIX + key);
  };
  element.addEventListener('pointerdown', event => event.stopPropagation());
  element.addEventListener('click', toggle);
  element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') toggle(event);
  });
  return element;
}

function row(thread: ArchivedThread, selected: boolean, handlers: ArchivedHandlers): HTMLElement {
  const element = document.createElement('div');
  element.className = `${ROW_CLASS} ${selected ? ROW_SELECTED_CLASS : ROW_IDLE_CLASS}`;
  element.style.paddingLeft = '8px';
  const href = `/projects/${encodeURIComponent(thread.projectId)}/threads/${encodeURIComponent(thread.threadId)}`;
  const link = document.createElement('a');
  link.href = href;
  link.className = 'absolute inset-0 rounded-md outline-none';
  link.dataset.sidebarFocusArchivedId = thread.threadId;
  link.setAttribute('aria-label', `Open ${thread.title}`);
  if (selected) link.setAttribute('aria-current', 'page');
  link.addEventListener('click', event => handlers.open(href, event));
  const name = document.createElement('span');
  name.className = 'pointer-events-none relative flex min-w-0 flex-1 items-center';
  const title = document.createElement('span');
  title.className = 'bb-thread-title';
  title.title = thread.title;
  const text = document.createElement('span');
  text.className = 'truncate whitespace-pre';
  text.textContent = thread.title;
  title.append(text);
  name.append(title);
  // Quick unarchive, then bb's own thread menu (portaled in by the menu bridge), like a native row's actions.
  const actions = document.createElement('span');
  actions.className = 'sidebar-focus-row-actions bb-sidebar-hover-actions';
  const restore = document.createElement('button');
  restore.type = 'button';
  restore.className = `sidebar-focus-restore ${ROW_BUTTON_CLASS}`;
  restore.setAttribute('aria-label', 'Unarchive');
  restore.title = 'Unarchive';
  restore.append(icon(RESTORE, 'sidebar-focus-icon'));
  restore.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    handlers.unarchive(thread.threadId);
  });
  const menu = document.createElement('span');
  menu.className = MENU_SLOT_CLASS;
  menu.dataset.threadId = thread.threadId;
  actions.append(restore, menu);
  element.append(link, name, actions);
  return element;
}

export function clearArchived(root: ParentNode): void {
  for (const block of root.querySelectorAll(`.${ARCHIVED_CLASS}`)) block.remove();
}

/** Where bb's thread menu goes on each drawn row, with the thread it acts on. */
export function menuSlots(root: ParentNode, threads: readonly ArchivedThread[]) {
  const byId = new Map(threads.map(thread => [thread.threadId, thread]));
  return [...root.querySelectorAll<HTMLElement>(`.${MENU_SLOT_CLASS}`)].flatMap(element => {
    const thread = byId.get(element.dataset.threadId ?? '');
    if (!thread) return [];
    return [{
      element,
      thread: {
        id: thread.threadId,
        projectId: thread.projectId,
        parentThreadId: null,
        archivedAt: thread.archivedAt,
        pinnedAt: null,
        sectionId: thread.sectionId,
        isUnread: false,
        status: 'idle' as const,
        environment: null,
      },
    }];
  });
}
