export const CLOCK_CLASS = 'automation-clock';

const ROW = '[class*="group/thread-row"]';
const TRAILING = '[data-sidebar-thread-trailing]';
const INDICATOR = '[data-sidebar-thread-trailing-indicator]';
// bb's own class: hidden while the row is hovered, focused or has its actions menu open.
const FADE = 'bb-sidebar-hover-actions-fade';

const CLOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';

/**
 * Puts one clock on every row in `labels` (thread id → accessible label) and removes the rest.
 * Without a status glyph the clock takes the glyph's slot; with a spinner, dot or draft it sits left of it.
 */
export function decorate(root: ParentNode, labels: ReadonlyMap<string, string>): void {
  const seen = new Set<Element>();
  for (const a of root.querySelectorAll<HTMLElement>('a[data-sidebar-thread-id]')) {
    const label = labels.get(a.dataset.sidebarThreadId ?? '');
    const trailing = a.closest(ROW)?.querySelector<HTMLElement>(TRAILING);
    if (!label || !trailing) continue;
    let clock = trailing.querySelector<HTMLElement>(`.${CLOCK_CLASS}`);
    if (!clock) {
      clock = document.createElement('span');
      clock.className = `${CLOCK_CLASS} ${FADE}`;
      clock.setAttribute('role', 'img');
      clock.innerHTML = CLOCK_SVG;
    }
    seen.add(clock);
    if (clock.getAttribute('aria-label') !== label) clock.setAttribute('aria-label', label);
    const slot = trailing.querySelector<HTMLElement>(`.${FADE}:not(.${CLOCK_CLASS})`);
    if (slot && !slot.querySelector(INDICATOR)) {
      if (clock.parentElement !== slot) slot.append(clock);
    } else if (trailing.firstElementChild !== clock) {
      trailing.prepend(clock);
    }
  }
  for (const clock of root.querySelectorAll(`.${CLOCK_CLASS}`)) {
    if (!seen.has(clock)) clock.remove();
  }
}

export function undecorate(root: ParentNode): void {
  decorate(root, new Map());
}
