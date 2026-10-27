// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { SCHEDULE_CLASS, clearSchedule, decorateSchedule, formatNextRun } from './schedule';

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const now = at(2026, 11, 10, 8, 30);

describe('next run', () => {
  it('reads as Today, Tomorrow or a date', () => {
    expect(formatNextRun(at(2026, 11, 10, 12), now)).toBe('Today, 12:00');
    expect(formatNextRun(at(2026, 11, 11, 9), now)).toBe('Tomorrow, 9:00');
    expect(formatNextRun(at(2026, 11, 12, 22, 5), now)).toBe('12 Nov, 22:05');
    expect(formatNextRun(at(2026, 11, 10, 8), now)).toBeNull();
    expect(formatNextRun(null, now)).toBeNull();
  });
});

describe('schedule badge', () => {
  const row = (id: string, glyph = false) => `
    <div class="group/thread-row"><a data-sidebar-thread-id="${id}"></a>
      <span data-sidebar-thread-trailing=""><span class="slot">${glyph ? '<span data-sidebar-thread-trailing-indicator=""></span>' : ''}</span></span>
    </div>`;

  it('shows a clock and the next run, fading with the native glyph, and cleans up', () => {
    document.body.innerHTML = `<div data-bb-plugin="thread-list">${row('thr_a')}${row('thr_b', true)}${row('thr_c')}</div>`;
    decorateSchedule(document, new Map([
      ['thr_a', { threadId: 'thr_a', unread: false, names: ['Daily'], nextRunAt: at(2026, 11, 10, 12) }],
      ['thr_b', { threadId: 'thr_b', unread: true, names: ['Weekly'], nextRunAt: null }],
    ]), now);
    const a = document.querySelector<HTMLElement>(`a[data-sidebar-thread-id="thr_a"] ~ [data-sidebar-thread-trailing] > .${SCHEDULE_CLASS}`)!;
    expect(a.textContent).toBe('Today, 12:00');
    expect(a.classList.contains('bb-sidebar-hover-actions-fade')).toBe(true);
    expect(a.classList.contains('sidebar-focus-schedule-solo')).toBe(true);
    expect(a.getAttribute('aria-label')).toBe('Automation: Daily · next run Today, 12:00');
    const b = document.querySelector<HTMLElement>(`a[data-sidebar-thread-id="thr_b"] ~ [data-sidebar-thread-trailing] > .${SCHEDULE_CLASS}`)!;
    expect(b.textContent).toBe('');
    expect(b.classList.contains('sidebar-focus-schedule-solo')).toBe(false);
    expect(document.querySelectorAll(`.${SCHEDULE_CLASS}`)).toHaveLength(2);
    clearSchedule(document);
    expect(document.querySelectorAll(`.${SCHEDULE_CLASS}`)).toHaveLength(0);
  });
});
