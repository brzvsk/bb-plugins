/** One read-tracked automation thread, as the server RPC returns it. */
export interface AutomationThread {
  threadId: string;
  unread: boolean;
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
export const LABEL_CLASS = 'sidebar-focus-automations';
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
 * Puts one focus button on every top-level header, right of its collapse
 * chevron. Unpressed it shows on hover like the chevron; pressed it stays
 * visible so the focus can be left from the same place.
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
    // Right after bb's collapse chevron, in the title span; without one, at the end of the title.
    const chevron = label.querySelector<HTMLElement>('button[aria-expanded]:not([aria-haspopup])');
    const title = chevron?.parentElement ?? label.querySelector<HTMLElement>(':scope > span') ?? label;
    if (chevron ? chevron.nextElementSibling !== button : title.lastElementChild !== button) {
      if (chevron) chevron.after(button);
      else title.append(button);
    }
    // Like the chevron: a hover action until pressed, then always visible.
    button.classList.toggle(HOVER_ACTIONS, !pressed);
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
  for (const wrapper of root.querySelectorAll<HTMLElement>(`${LIST} ${WRAPPER}`)) {
    // The wrapper's first row is its root thread; child rows move with it.
    const anchor = wrapper.querySelector<HTMLElement>(ANCHOR);
    let tucked: boolean;
    if (!anchor) {
      tucked = wrapper.hasAttribute(TUCKED);
    } else {
      const threadId = anchor.dataset.sidebarThreadId ?? '';
      const row = anchor.closest<HTMLElement>(ROW);
      tucked = state.automations.has(threadId) && (state.held?.threadId === threadId
        ? state.held.place === 'block'
        : !row?.querySelector(GLYPH));
    }
    const container = wrapper.parentElement;
    if (!tucked || !container) {
      if (wrapper.hasAttribute(TUCKED)) wrapper.removeAttribute(TUCKED);
      continue;
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
      title.textContent = 'Automations';
      const number = document.createElement('span');
      number.className = 'sidebar-focus-count';
      label.append(title, icon(CHEVRON, 'sidebar-focus-chevron'), number);
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
    if (label.parentElement !== container || container.lastElementChild !== label) container.append(label);
    if (label.dataset.key !== key) label.dataset.key = key;
    if (label.getAttribute('aria-expanded') !== String(open)) label.setAttribute('aria-expanded', String(open));
    const number = label.querySelector('.sidebar-focus-count')!;
    if (number.textContent !== String(count)) number.textContent = String(count);
  }

  for (const label of root.querySelectorAll<HTMLElement>(`.${LABEL_CLASS}`)) {
    if (!containers.has(label.parentElement as HTMLElement)) label.remove();
  }
  for (const container of root.querySelectorAll<HTMLElement>(`.${FLEX_CLASS}`)) {
    if (!containers.has(container)) container.classList.remove(FLEX_CLASS);
  }
}

function blockKeyOf(element: HTMLElement): string {
  const group = element.closest<HTMLElement>(GROUP);
  if (group) return group.dataset.sidebarVisibilityGroup ?? '';
  return element.closest<HTMLElement>(SECTION)?.dataset.sidebarSectionId ?? '';
}

export function clear(root: ParentNode): void {
  for (const node of root.querySelectorAll(`.${BUTTON_CLASS}, .${LABEL_CLASS}`)) node.remove();
  for (const node of root.querySelectorAll(`[${TUCKED}]`)) node.removeAttribute(TUCKED);
  for (const node of root.querySelectorAll(`.${FLEX_CLASS}`)) node.classList.remove(FLEX_CLASS);
}
