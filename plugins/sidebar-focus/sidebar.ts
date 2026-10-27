/** One read-tracked automation thread, as the server RPC returns it. */
export interface AutomationThread {
  threadId: string;
  title: string;
  projectId: string;
  projectName: string;
  sectionId: string | null;
  pinned: boolean;
  unread: boolean;
  updatedAt: number;
}

export interface SidebarState {
  /** Focused block key, or null to show everything. */
  focus: string | null;
  automations: ReadonlyMap<string, AutomationThread>;
  automationsOpen: boolean;
  /** The selected thread keeps the place it had when it was selected, like bb's own held read status. */
  held: { threadId: string; place: Place } | null;
}

export type Place = 'list' | 'block';

export interface Handlers {
  toggleFocus(key: string): void;
  toggleAutomations(): void;
  openThread(threadId: string, href: string, event: MouseEvent): void;
}

const LIST = '[data-bb-plugin="thread-list"]';
const GROUP = '[data-sidebar-visibility-group]';
const SECTION = '[data-sidebar-section-id]';
const LABEL = '[data-sidebar-sticky-tier="label"]';
const ROW = '[class*="group/thread-row"]';
const ANCHOR = 'a[data-sidebar-thread-id]';
const GLYPH = '[data-sidebar-thread-trailing-indicator]';
const MORE = '[data-testid="sidebar-thread-list-more-trigger"]';

export const BUTTON_CLASS = 'sidebar-focus-button';
export const BLOCK_CLASS = 'sidebar-focus-automations';

const HOVER_ACTIONS = 'bb-sidebar-hover-actions';
// bb's own row look; these utility classes already exist in the app stylesheet.
const ROW_CLASS = 'sidebar-focus-row flex w-full items-center gap-2 rounded-md pr-0 text-sm transition-none relative h-[var(--bb-sidebar-row-height)] cursor-pointer text-sidebar-foreground select-none';
const ROW_IDLE_CLASS = 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground bb-sidebar-accent-row';
const ROW_SELECTED_CLASS = 'bg-state-active bb-sidebar-selected-row';
const LABEL_CLASS = 'sidebar-focus-label flex shrink-0 items-center px-1 text-xs font-normal leading-5 text-muted-foreground pl-2 rounded-md pr-0 select-none cursor-pointer h-7';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CROSSHAIR = '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>';
const CHEVRON = '<path d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18"/>';

function quote(value: string): string {
  return `"${value.replace(/["\\]/g, '\\$&')}"`;
}

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
 * The top-level groups of bb's list, each with a stable key: visibility groups
 * (projects, sections, machines, loose Threads) by their own id, and built-in
 * sections outside them (Pinned) as `pinned`.
 */
export function topBlocks(root: ParentNode): { key: string; element: HTMLElement }[] {
  const blocks: { key: string; element: HTMLElement }[] = [];
  for (const element of root.querySelectorAll<HTMLElement>(`${LIST} ${GROUP}`)) {
    if (element.parentElement?.closest(GROUP)) continue;
    blocks.push({ key: element.dataset.sidebarVisibilityGroup ?? '', element });
  }
  for (const element of root.querySelectorAll<HTMLElement>(`${LIST} ${SECTION}`)) {
    if (element.closest(GROUP) || element.parentElement?.closest(SECTION)) continue;
    blocks.push({ key: element.dataset.sidebarSectionId ?? '', element });
  }
  return blocks.filter(block => block.key);
}

function isGroupKey(key: string): boolean {
  return key === 'threads' || /^(project|section|machine):/.test(key);
}

/** CSS that shows only the focused block; empty when nothing is focused. */
export function focusCss(focus: string | null): string {
  if (!focus) return '';
  const groupException = isGroupKey(focus) ? `:not([data-sidebar-visibility-group=${quote(focus)}])` : '';
  const sectionException = isGroupKey(focus) ? '' : `:not([data-sidebar-section-id=${quote(focus)}])`;
  return `${[
    `${LIST} ${GROUP}${groupException}:not(${GROUP} *)`,
    `${LIST} ${SECTION}${sectionException}:not(${GROUP} *):not(${SECTION} *)`,
    `${LIST} ${MORE}`,
    `${LIST} :has(> ${MORE})`,
  ].join(',\n')} { display: none !important; }`;
}

function nativeRow(root: ParentNode, threadId: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`${LIST} ${ANCHOR}[data-sidebar-thread-id=${quote(threadId)}]`)?.closest<HTMLElement>(ROW) ?? null;
}

/**
 * Where an automation thread belongs right now: in the list while bb shows any
 * status for it (unread dot, spinner, question, draft…), else in the block.
 * Without a mounted row (virtualized away) the server's read state decides.
 */
export function placeOf(root: ParentNode, thread: AutomationThread): Place {
  const row = nativeRow(root, thread.threadId);
  if (row) return row.querySelector(GLYPH) ? 'list' : 'block';
  return thread.unread ? 'list' : 'block';
}

/**
 * Hides native rows of automation threads that have nothing to show. The
 * status check lives in the selector, so a row reappears in the same frame bb
 * paints its unread dot. A held selection overrides it either way.
 */
export function automationCss(state: SidebarState): string {
  const ids = [...state.automations.keys()].filter(id => id !== state.held?.threadId);
  const anchors = (list: string[]) => list.map(id => `${ANCHOR}[data-sidebar-thread-id=${quote(id)}]`).join(', ');
  const rules: string[] = [];
  if (ids.length) rules.push(`${LIST} ${ROW}:has(${anchors(ids)}):not(:has(${GLYPH}))`);
  if (state.held?.place === 'block') rules.push(`${LIST} ${ROW}:has(${anchors([state.held.threadId])})`);
  return rules.length ? `${rules.join(',\n')} { display: none !important; }` : '';
}

/** Automation threads for the block, newest first, limited to the focused block. */
export function blockThreads(root: ParentNode, state: SidebarState): AutomationThread[] {
  const focused = state.focus ? topBlocks(root).find(block => block.key === state.focus)?.element ?? null : null;
  return [...state.automations.values()]
    .filter(thread => {
      if (state.held?.threadId === thread.threadId) return state.held.place === 'block';
      return placeOf(root, thread) === 'block';
    })
    .filter(thread => {
      const focus = state.focus;
      if (!focus || !focused) return true;
      if (focus.startsWith('project:')) return focus === `project:${thread.projectId}`;
      if (focus.startsWith('section:')) return focus === `section:${thread.sectionId}`;
      if (focus === 'pinned') return thread.pinned;
      const row = nativeRow(root, thread.threadId);
      return row !== null && focused.contains(row);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** The thread bb marks as selected in its list, else the one in the URL. */
export function selectedThreadId(root: ParentNode, path: string): string | null {
  const anchor = root.querySelector<HTMLElement>(`${LIST} ${ROW}.bb-sidebar-selected-row ${ANCHOR}`);
  return anchor?.dataset.sidebarThreadId ?? path.match(/\/threads\/(thr_[A-Za-z0-9]+)/)?.[1] ?? null;
}

/**
 * Puts one focus button on every top-level header. Unpressed it waits among the
 * header's hover actions, left of New thread; pressed it stays visible so the
 * focus can be left from the same place.
 */
export function placeButtons(root: ParentNode, focus: string | null, handlers: Handlers): void {
  const seen = new Set<Element>();
  for (const { key, element } of topBlocks(root)) {
    const label = element.querySelector<HTMLElement>(LABEL);
    if (!label) continue;
    let button = label.querySelector<HTMLButtonElement>(`.${BUTTON_CLASS}`);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = BUTTON_CLASS;
      button.append(icon(CROSSHAIR, 'sidebar-focus-icon'));
      // The header is a drag handle and a collapse target; keep both away from this button.
      button.addEventListener('pointerdown', event => event.stopPropagation());
      button.addEventListener('keydown', event => event.stopPropagation());
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        handlers.toggleFocus(button!.dataset.focusKey ?? '');
      });
    }
    seen.add(button);
    const pressed = key === focus;
    const name = label.querySelector('[title]')?.getAttribute('title') ?? key;
    const text = pressed ? `Show all groups` : `Focus on ${name}`;
    if (button.dataset.focusKey !== key) button.dataset.focusKey = key;
    if (button.getAttribute('aria-pressed') !== String(pressed)) button.setAttribute('aria-pressed', String(pressed));
    if (button.getAttribute('aria-label') !== text) {
      button.setAttribute('aria-label', text);
      button.title = text;
    }
    const trailing = label.querySelector<HTMLElement>('[data-sidebar-trailing-controls]');
    const controls = label.querySelector<HTMLElement>('[data-sidebar-row-controls]');
    const hoverActions = trailing?.querySelector<HTMLElement>(`.${HOVER_ACTIONS}`) ?? null;
    if (pressed) {
      if (trailing) {
        if (trailing.firstElementChild !== button) trailing.prepend(button);
      } else if (button.parentElement !== label) {
        label.append(button);
      }
      button.classList.remove(HOVER_ACTIONS);
    } else if (controls) {
      if (controls.firstElementChild !== button) controls.prepend(button);
      button.classList.remove(HOVER_ACTIONS);
    } else if (hoverActions) {
      if (hoverActions.firstElementChild !== button) hoverActions.prepend(button);
      button.classList.remove(HOVER_ACTIONS);
    } else {
      if (button.parentElement !== label) label.append(button);
      button.classList.add(HOVER_ACTIONS);
    }
  }
  for (const button of root.querySelectorAll(`.${BUTTON_CLASS}`)) {
    if (!seen.has(button)) button.remove();
  }
}

/** Renders the Automations block below bb's groups, or removes it when it has nothing to hold. */
export function renderBlock(root: ParentNode, state: SidebarState, threads: AutomationThread[], selected: string | null, handlers: Handlers): void {
  let block = root.querySelector<HTMLElement>(`.${BLOCK_CLASS}`);
  const anchor = topBlocks(root)[0]?.element.parentElement ?? null;
  if (!threads.length || !anchor) {
    block?.remove();
    return;
  }
  // Selecting a tucked-away thread opens the block so the selection stays visible.
  const open = state.automationsOpen || threads.some(thread => thread.threadId === selected);
  const projectFocus = state.focus?.startsWith('project:') ?? false;
  const signature = JSON.stringify([open, selected, projectFocus, threads.map(t => [t.threadId, t.title, t.projectName])]);
  if (!block) {
    block = document.createElement('div');
    block.className = BLOCK_CLASS;
  }
  if (anchor.nextElementSibling !== block) anchor.after(block);
  if (block.dataset.signature === signature) return;
  block.dataset.signature = signature;

  const header = document.createElement('div');
  header.className = LABEL_CLASS;
  header.setAttribute('role', 'button');
  header.tabIndex = 0;
  header.setAttribute('aria-expanded', String(open));
  const title = document.createElement('span');
  title.className = 'min-w-0 truncate';
  title.textContent = 'Automations';
  const count = document.createElement('span');
  count.className = 'sidebar-focus-count';
  count.textContent = String(threads.length);
  header.append(title, icon(CHEVRON, `sidebar-focus-chevron${open ? ' sidebar-focus-chevron-open' : ''}`), count);
  header.addEventListener('click', () => handlers.toggleAutomations());
  header.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handlers.toggleAutomations();
  });

  const rows = document.createElement('div');
  rows.className = 'sidebar-focus-rows';
  if (open) {
    for (const thread of threads) {
      const isSelected = thread.threadId === selected;
      const row = document.createElement('div');
      row.className = `${ROW_CLASS} ${isSelected ? ROW_SELECTED_CLASS : ROW_IDLE_CLASS}`;
      row.style.paddingLeft = '8px';
      const href = `/projects/${encodeURIComponent(thread.projectId)}/threads/${encodeURIComponent(thread.threadId)}`;
      const link = document.createElement('a');
      link.href = href;
      link.className = 'absolute inset-0 rounded-md outline-none';
      link.dataset.sidebarFocusThreadId = thread.threadId;
      link.setAttribute('aria-label', `Open ${thread.title}`);
      if (isSelected) link.setAttribute('aria-current', 'page');
      link.addEventListener('click', event => handlers.openThread(thread.threadId, href, event));
      const name = document.createElement('span');
      name.className = 'pointer-events-none relative flex min-w-0 flex-1 items-center';
      const titleText = document.createElement('span');
      titleText.className = 'bb-thread-title';
      titleText.title = thread.title;
      const truncate = document.createElement('span');
      truncate.className = 'truncate whitespace-pre';
      truncate.textContent = thread.title;
      titleText.append(truncate);
      name.append(titleText);
      row.append(link, name);
      if (!projectFocus && thread.projectName) {
        const project = document.createElement('span');
        project.className = 'sidebar-focus-project pointer-events-none';
        project.textContent = thread.projectName;
        row.append(project);
      }
      rows.append(row);
    }
  }
  block.replaceChildren(header, rows);
}

export function clear(root: ParentNode): void {
  for (const node of root.querySelectorAll(`.${BUTTON_CLASS}, .${BLOCK_CLASS}`)) node.remove();
}
