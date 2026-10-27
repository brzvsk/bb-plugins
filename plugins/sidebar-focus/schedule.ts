import type { AutomationThread } from './sidebar';

export const SCHEDULE_CLASS = 'sidebar-focus-schedule';

const LIST = '[data-bb-plugin="thread-list"]';
const ROW = '[class*="group/thread-row"]';
const TRAILING = '[data-sidebar-thread-trailing]';
const INDICATOR = '[data-sidebar-thread-trailing-indicator]';
// bb's own class: hidden while the row is hovered, focused or has its actions menu open.
const FADE = 'bb-sidebar-hover-actions-fade';
const CLOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Today, 12:00", "Tomorrow, 9:00", "11 Nov, 22:00"; null for no upcoming run. */
export function formatNextRun(at: number | null, now: number): string | null {
  if (at === null || at < now) return null;
  const date = new Date(at);
  const time = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((new Date(at).setHours(0, 0, 0, 0) - today.getTime()) / DAY_MS);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  const month = date.toLocaleString('en-GB', { month: 'short' });
  return `${date.getDate()} ${month}, ${time}`;
}

/**
 * Puts a clock and the next run time on every row of an automation thread,
 * left of bb's status glyph; without a glyph it takes the glyph's place. It
 * fades with bb's own glyph while the row shows its hover actions.
 */
export function decorateSchedule(root: ParentNode, automations: ReadonlyMap<string, AutomationThread>, now: number): void {
  const seen = new Set<Element>();
  for (const anchor of root.querySelectorAll<HTMLElement>(`${LIST} a[data-sidebar-thread-id]`)) {
    const thread = automations.get(anchor.dataset.sidebarThreadId ?? '');
    const trailing = anchor.closest(ROW)?.querySelector<HTMLElement>(TRAILING);
    if (!thread || !trailing) continue;
    let badge = trailing.querySelector<HTMLElement>(`:scope > .${SCHEDULE_CLASS}`);
    if (!badge) {
      badge = document.createElement('span');
      badge.className = `${SCHEDULE_CLASS} ${FADE}`;
      badge.setAttribute('role', 'img');
      const clock = document.createElement('span');
      clock.className = 'sidebar-focus-clock';
      clock.innerHTML = CLOCK_SVG;
      const time = document.createElement('span');
      time.className = 'sidebar-focus-next-run';
      badge.append(clock, time);
    }
    seen.add(badge);
    const next = formatNextRun(thread.nextRunAt, now);
    const time = badge.querySelector('.sidebar-focus-next-run')!;
    if (time.textContent !== (next ?? '')) time.textContent = next ?? '';
    const label = `Automation: ${thread.names.join(', ')}${next ? ` · next run ${next}` : ''}`;
    if (badge.getAttribute('aria-label') !== label) {
      badge.setAttribute('aria-label', label);
      badge.title = label;
    }
    // Alone, it slides into the empty glyph slot; beside a spinner, dot or draft it keeps clear.
    const solo = !trailing.querySelector(INDICATOR);
    if (badge.classList.contains('sidebar-focus-schedule-solo') !== solo) badge.classList.toggle('sidebar-focus-schedule-solo', solo);
    if (trailing.firstElementChild !== badge) trailing.prepend(badge);
  }
  for (const badge of root.querySelectorAll(`.${SCHEDULE_CLASS}`)) {
    if (!seen.has(badge)) badge.remove();
  }
}

export function clearSchedule(root: ParentNode): void {
  for (const badge of root.querySelectorAll(`.${SCHEDULE_CLASS}`)) badge.remove();
}
