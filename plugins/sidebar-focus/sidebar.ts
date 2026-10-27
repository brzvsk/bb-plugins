/** One read-tracked automation thread, as the server RPC returns it. */
export interface AutomationThread {
  threadId: string;
  unread: boolean;
  names: string[];
  nextRunAt: number | null;
}

export interface SidebarState {
  /** Focused block key, or null to show everything. */
  focus: string | null;
  automations: ReadonlyMap<string, AutomationThread>;
  /** Block keys whose Automations disclosure is open. */
  automationsOpen: ReadonlySet<string>;
  /** The selected thread keeps the place it had when it was selected, like bb's own held read status. */
  held: { threadId: string; place: Place } | null;
}

export type Place = 'list' | 'block';

export interface Handlers {
  toggleFocus(key: string): void;
  toggleAutomations(key: string): void;
  newTask(group: HTMLElement | null): void;
}

const LIST = '[data-bb-plugin="thread-list"]';
const GROUP = '[data-sidebar-visibility-group]';
const SECTION = '[data-sidebar-section-id]';
const LABEL = '[data-sidebar-sticky-tier="label"]';
const ROW = '[class*="group/thread-row"]';
const ANCHOR = 'a[data-sidebar-thread-id]';
const GLYPH = '[data-sidebar-thread-trailing-indicator]';
const MORE = '[data-testid="sidebar-thread-list-more-trigger"]';
/** The list of top-level groups, and a built-in section drawn bare in it (Pinned). */
const GROUP_LIST = `${LIST} :has(> ${GROUP})`;
const BARE_SECTION = `${GROUP_LIST} > [data-sidebar-sticky-group]:not(${GROUP})`;

export const BUTTON_CLASS = 'sidebar-focus-button';
export const LABEL_CLASS = 'sidebar-focus-automations';
export const PROGRESS_CLASS = 'sidebar-focus-progress';
export const NEW_TASK_CLASS = 'sidebar-focus-new-task';
export const EMPTY_LIST_CLASS = 'sidebar-focus-empty-list';
/** Flex order of the Scheduled line; its sorted rows follow it. */
const SCHEDULED_ORDER = 1000;
export const FLEX_CLASS = 'sidebar-focus-list';
export const TUCKED = 'data-sidebar-focus-tucked';
const WRAPPER = '[data-sidebar-windowed-item]';

const HOVER_ACTIONS = 'bb-sidebar-hover-actions';
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
  // bb renders Pinned as a bare sticky group beside the visibility groups, with no id of its own.
  for (const element of root.querySelectorAll<HTMLElement>(`${BARE_SECTION}`)) {
    if (!blocks.some(block => block.element === element)) blocks.push({ key: 'pinned', element });
  }
  return blocks.filter(block => block.key);
}

function isGroupKey(key: string): boolean {
  return key === 'threads' || /^(project|section|machine):/.test(key);
}

/** CSS that shows only the focused block, without the divider above it; empty when nothing is focused. */
export function focusCss(focus: string | null): string {
  if (!focus) return '';
  const group = isGroupKey(focus);
  const groupException = group ? `:not([data-sidebar-visibility-group=${quote(focus)}])` : '';
  const sectionException = group ? '' : `:not([data-sidebar-section-id=${quote(focus)}])`;
  const hidden = [
    `${LIST} ${GROUP}${groupException}:not(${GROUP} *)`,
    `${LIST} ${SECTION}${sectionException}:not(${GROUP} *):not(${SECTION} *)`,
    `${LIST} ${MORE}`,
    `${LIST} :has(> ${MORE})`,
  ];
  // Pinned has no id; it stays only while it is the focus.
  if (focus !== 'pinned') hidden.push(BARE_SECTION);
  return `${hidden.join(',\n')} { display: none !important; }
${GROUP_LIST} > * { padding-top: 0 !important; }
${GROUP_LIST} > *::before { display: none !important; }`;
}

function nativeRow(root: ParentNode, threadId: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`${LIST} ${ANCHOR}[data-sidebar-thread-id=${quote(threadId)}]`)?.closest<HTMLElement>(ROW) ?? null;
}

/**
 * Where an automation thread belongs right now: in the list while bb shows any
 * status for it (unread dot, spinner, question, draft…), else tucked away.
 * Without a mounted row (virtualized away) the server's read state decides.
 */
export function placeOf(root: ParentNode, thread: AutomationThread): Place {
  const row = nativeRow(root, thread.threadId);
  if (row) return row.querySelector(GLYPH) ? 'list' : 'block';
  return thread.unread ? 'list' : 'block';
}

/** The thread bb marks as selected in its list, else the one in the URL. */
export function selectedThreadId(root: ParentNode, path: string): string | null {
  const anchor = root.querySelector<HTMLElement>(`${LIST} ${ROW}.bb-sidebar-selected-row ${ANCHOR}`);
  return anchor?.dataset.sidebarThreadId ?? path.match(/\/threads\/(thr_[A-Za-z0-9]+)/)?.[1] ?? null;
}

/**
 * Expands or collapses a top-level block through bb's own collapse chevron, so
 * bb keeps owning the state. Returns whether it had to change anything.
 */
export function setExpanded(root: ParentNode, key: string, expanded: boolean): boolean {
  const element = topBlocks(root).find(block => block.key === key)?.element;
  const chevron = element?.querySelector<HTMLElement>(`${LABEL} button[aria-expanded]:not([aria-haspopup])`);
  if (!chevron || chevron.getAttribute('aria-expanded') === String(expanded)) return false;
  chevron.click();
  return true;
}

/**
 * Puts one focus button on every top-level header. Unpressed it sits among the
 * header's hover actions, right of New thread; pressed it moves to the
 * header's right edge and stays visible, so the focus is left from there.
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
    if (pressed) {
      // On: the header's very right edge, after bb's own actions (they keep their room even while hidden),
      // always visible as the mode's indicator.
      const trailing = label.querySelector<HTMLElement>('[data-sidebar-trailing-controls]') ?? label;
      if (trailing.lastElementChild !== button) trailing.append(button);
    } else {
      // Off: among bb's hover actions, right after New thread; a header without them gets it at its end.
      const newThread = label.querySelector<HTMLElement>('[data-sidebar-row-controls] button[aria-label^="New thread in"]');
      if (newThread ? newThread.nextElementSibling !== button : label.lastElementChild !== button) {
        if (newThread) newThread.after(button);
        else label.append(button);
      }
    }
    // bb's hover actions already show on hover; on its own the button fades in like them.
    button.classList.toggle(HOVER_ACTIONS, !pressed && !button.closest(`.${HOVER_ACTIONS}`));
  }
  for (const button of root.querySelectorAll(`.${BUTTON_CLASS}`)) {
    if (!seen.has(button)) button.remove();
  }
}

/**
 * Moves automation threads with nothing to show to the end of their own list,
 * under a small Automations disclosure. The rows stay bb's own: only their
 * wrapper gets an order (and, while collapsed, zero height), so the list keeps
 * its sort, statuses and row actions. A wrapper virtualized away keeps its last
 * mark until it mounts again.
 */
export function tuck(root: ParentNode, state: SidebarState, handlers: Handlers): void {
  const containers = new Set<HTMLElement>();
  // Scheduled runs soonest first; threads without an upcoming run go last.
  const ranks = new Map([...state.automations.values()]
    .sort((a, b) => (a.nextRunAt ?? Infinity) - (b.nextRunAt ?? Infinity))
    .map((thread, index) => [thread.threadId, index]));
  for (const wrapper of root.querySelectorAll<HTMLElement>(`${LIST} ${WRAPPER}`)) {
    // The wrapper's first row is its root thread; child rows move with it.
    const anchor = wrapper.querySelector<HTMLElement>(ANCHOR);
    let tucked: boolean;
    let rank: number | undefined;
    if (!anchor) {
      tucked = wrapper.hasAttribute(TUCKED);
    } else {
      const threadId = anchor.dataset.sidebarThreadId ?? '';
      rank = ranks.get(threadId);
      const row = anchor.closest<HTMLElement>(ROW);
      tucked = state.automations.has(threadId) && (state.held?.threadId === threadId
        ? state.held.place === 'block'
        : !row?.querySelector(GLYPH));
    }
    const container = wrapper.parentElement;
    if (!tucked || !container) {
      if (wrapper.hasAttribute(TUCKED)) wrapper.removeAttribute(TUCKED);
      if (wrapper.style.order) wrapper.style.removeProperty('order');
      continue;
    }
    if (rank !== undefined && wrapper.style.order !== String(SCHEDULED_ORDER + 1 + rank)) {
      wrapper.style.setProperty('order', String(SCHEDULED_ORDER + 1 + rank));
    }
    containers.add(container);
    const key = blockKeyOf(container);
    // The selected thread stays visible even in a collapsed group.
    const selected = wrapper.querySelector(`${ROW}.bb-sidebar-selected-row`) !== null;
    const value = selected || state.automationsOpen.has(key) ? 'open' : 'closed';
    if (wrapper.getAttribute(TUCKED) !== value) wrapper.setAttribute(TUCKED, value);
  }

  for (const container of containers) {
    const key = blockKeyOf(container);
    const open = state.automationsOpen.has(key);
    const count = container.querySelectorAll(`:scope > [${TUCKED}]`).length;
    if (!container.classList.contains(FLEX_CLASS)) container.classList.add(FLEX_CLASS);
    let label = container.querySelector<HTMLElement>(`:scope > .${LABEL_CLASS}`);
    if (!label) {
      label = document.createElement('div');
      label.className = LABEL_CLASS;
      label.setAttribute('role', 'button');
      label.tabIndex = 0;
      const title = document.createElement('span');
      title.className = 'sidebar-focus-label-title';
      title.textContent = 'Scheduled';
      const number = document.createElement('span');
      number.className = 'sidebar-focus-count';
      label.append(title, number, icon(CHEVRON, 'sidebar-focus-chevron'));
      label.addEventListener('pointerdown', event => event.stopPropagation());
      label.addEventListener('click', event => {
        event.stopPropagation();
        handlers.toggleAutomations(label!.dataset.key ?? '');
      });
      label.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        handlers.toggleAutomations(label!.dataset.key ?? '');
      });
    }
    // The flex order places it; checking for last place would fight Recently archived over the same slot.
    if (label.parentElement !== container) container.append(label);
    if (label.dataset.key !== key) label.dataset.key = key;
    if (label.getAttribute('aria-expanded') !== String(open)) label.setAttribute('aria-expanded', String(open));
    const number = label.querySelector('.sidebar-focus-count')!;
    if (number.textContent !== String(count)) number.textContent = String(count);
  }

  for (const label of root.querySelectorAll<HTMLElement>(`.${LABEL_CLASS}`)) {
    if (!containers.has(label.parentElement as HTMLElement)) label.remove();
  }
  for (const container of root.querySelectorAll<HTMLElement>(`.${FLEX_CLASS}`)) {
    // In progress and Done share the ordering; they own the class while they are there.
    if (!containers.has(container) && !container.querySelector(`:scope > .sidebar-focus-archived, :scope > .${PROGRESS_CLASS}`)) container.classList.remove(FLEX_CLASS);
  }
}

/**
 * Heads every project or section list with "In progress N" for the threads
 * left in it, and offers a New Task row there when none are left. A group with
 * no rows at all gets its own small list after the header for these lines.
 */
export function progress(root: ParentNode, handlers: Handlers): void {
  const seen = new Set<Element>();
  for (const { key, element } of topBlocks(root)) {
    if (key === 'pinned' || isCollapsed(element)) continue;
    const container = primaryList(element);
    if (!container.classList.contains(FLEX_CLASS)) container.classList.add(FLEX_CLASS);
    let label = container.querySelector<HTMLElement>(`:scope > .${PROGRESS_CLASS}`);
    if (!label) {
      label = document.createElement('div');
      label.className = PROGRESS_CLASS;
      const title = document.createElement('span');
      title.textContent = 'In progress';
      const number = document.createElement('span');
      number.className = 'sidebar-focus-count';
      label.append(title, number);
    }
    if (label.parentElement !== container) container.append(label);
    seen.add(label);
    const count = container.querySelectorAll(`:scope > ${WRAPPER}:not([${TUCKED}])`).length;
    const number = label.querySelector('.sidebar-focus-count')!;
    if (number.textContent !== String(count)) number.textContent = String(count);
    // An empty list shows only its New Task row.
    if (label.hidden !== (count === 0)) label.hidden = count === 0;

    let task = container.querySelector<HTMLElement>(`:scope > .${NEW_TASK_CLASS}`);
    if (count > 0) {
      task?.remove();
      continue;
    }
    if (!task) {
      task = document.createElement('div');
      task.className = NEW_TASK_CLASS;
      task.setAttribute('role', 'button');
      task.tabIndex = 0;
      // Reads like the Scheduled and Done lines, with a plus where their chevron is.
      const text = document.createElement('span');
      text.textContent = 'New Task';
      task.append(text, icon('<path d="M12 5v14M5 12h14"/>', 'sidebar-focus-chevron'));
      const start = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        handlers.newTask(task!.closest<HTMLElement>(GROUP) ?? task!.closest<HTMLElement>(SECTION));
      };
      task.addEventListener('pointerdown', event => event.stopPropagation());
      task.addEventListener('click', start);
      task.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') start(event);
      });
    }
    if (task.parentElement !== container) container.append(task);
    seen.add(task);
  }
  for (const node of root.querySelectorAll(`.${PROGRESS_CLASS}, .${NEW_TASK_CLASS}`)) {
    if (!seen.has(node)) node.remove();
  }
  for (const list of root.querySelectorAll(`.${EMPTY_LIST_CLASS}`)) {
    if (!list.querySelector(`.${PROGRESS_CLASS}`) && !list.querySelector('.sidebar-focus-archived')) list.remove();
  }
}

/** The list holding a group's own rows, or a plugin list after its header when it has none. */
export function primaryList(group: HTMLElement): HTMLElement {
  for (const wrapper of group.querySelectorAll<HTMLElement>(WRAPPER)) {
    if (!wrapper.parentElement?.closest(WRAPPER)) return wrapper.parentElement!;
  }
  let list = group.querySelector<HTMLElement>(`.${EMPTY_LIST_CLASS}`);
  if (!list) {
    list = document.createElement('div');
    list.className = EMPTY_LIST_CLASS;
    group.append(list);
  }
  return list;
}

/** Starts a new thread in a group through bb's own New thread button in its header. */
export function startNewTask(group: HTMLElement | null): boolean {
  const button = group?.querySelector<HTMLElement>(`${LABEL} button[aria-label^="New thread in"]`);
  button?.click();
  return Boolean(button);
}

function isCollapsed(group: HTMLElement): boolean {
  return group.querySelector(`${LABEL} button[aria-expanded]:not([aria-haspopup])`)?.getAttribute('aria-expanded') === 'false';
}

function blockKeyOf(element: HTMLElement): string {
  const group = element.closest<HTMLElement>(GROUP);
  if (group) return group.dataset.sidebarVisibilityGroup ?? '';
  return element.closest<HTMLElement>(SECTION)?.dataset.sidebarSectionId ?? '';
}

export function clear(root: ParentNode): void {
  for (const node of root.querySelectorAll(`.${BUTTON_CLASS}, .${LABEL_CLASS}, .${PROGRESS_CLASS}, .${NEW_TASK_CLASS}, .${EMPTY_LIST_CLASS}`)) node.remove();
  for (const node of root.querySelectorAll<HTMLElement>(`[${TUCKED}]`)) {
    node.removeAttribute(TUCKED);
    node.style.removeProperty('order');
  }
  for (const node of root.querySelectorAll(`.${FLEX_CLASS}`)) node.classList.remove(FLEX_CLASS);
}
