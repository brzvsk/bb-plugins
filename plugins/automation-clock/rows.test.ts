// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { CLOCK_CLASS, decorate, undecorate } from './rows';

const indicator = '<span data-sidebar-thread-trailing-indicator=""><svg></svg></span>';
const row = (id: string, glyph = '') => `
  <div class="group/thread-row">
    <a data-sidebar-thread-id="${id}"></a>
    <span data-sidebar-thread-trailing="">
      <span><span class="relative"><span class="bb-sidebar-hover-actions-fade" id="slot-${id}">${glyph}</span>
        <div class="bb-sidebar-hover-actions"></div></span></span>
    </span>
  </div>`;

beforeEach(() => {
  document.body.innerHTML = row('thr_idle') + row('thr_busy', indicator) + row('thr_plain');
});

const trailing = (id: string) =>
  document.querySelector(`a[data-sidebar-thread-id="${id}"]`)!.closest('div')!.querySelector('[data-sidebar-thread-trailing]')!;
const clock = (id: string) => trailing(id).querySelector<HTMLElement>(`.${CLOCK_CLASS}`);

describe('automation clock', () => {
  const labels = new Map([['thr_idle', 'Automation: A'], ['thr_busy', 'Automation: B']]);

  it('takes the empty status slot and fades with hover actions', () => {
    decorate(document, labels);
    expect(clock('thr_idle')?.parentElement?.id).toBe('slot-thr_idle');
    expect(clock('thr_idle')?.classList.contains('bb-sidebar-hover-actions-fade')).toBe(true);
    expect(clock('thr_idle')?.getAttribute('aria-label')).toBe('Automation: A');
    expect(clock('thr_plain')).toBeNull();
  });

  it('sits left of a spinner, dot or draft glyph', () => {
    decorate(document, labels);
    expect(trailing('thr_busy').firstElementChild).toBe(clock('thr_busy'));
    expect(document.getElementById('slot-thr_busy')!.querySelector(`.${CLOCK_CLASS}`)).toBeNull();
  });

  it('moves when the glyph appears or disappears and stays idempotent', () => {
    decorate(document, labels);
    const first = clock('thr_idle');
    document.getElementById('slot-thr_idle')!.insertAdjacentHTML('beforeend', indicator);
    decorate(document, labels);
    decorate(document, labels);
    expect(clock('thr_idle')).toBe(first);
    expect(trailing('thr_idle').firstElementChild).toBe(first);
    document.querySelector('#slot-thr_idle [data-sidebar-thread-trailing-indicator]')!.remove();
    decorate(document, labels);
    expect(clock('thr_idle')?.parentElement?.id).toBe('slot-thr_idle');
    expect(document.querySelectorAll(`.${CLOCK_CLASS}`)).toHaveLength(2);
  });

  it('removes clocks for unbound threads and on unmount', () => {
    decorate(document, labels);
    decorate(document, new Map([['thr_busy', 'Automation: B']]));
    expect(clock('thr_idle')).toBeNull();
    undecorate(document);
    expect(document.querySelector(`.${CLOCK_CLASS}`)).toBeNull();
  });
});
