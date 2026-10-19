// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { candidateIds, decorate, LINE_CLASS, ROW_ATTR, undecorate } from './rows';

const row = (id: string, title: string) => `
  <div class="group/thread-row h-[var(--bb-sidebar-row-height)]">
    <span><a data-sidebar-thread-id="${id}"></a>
      <span><span class="bb-thread-title"><span class="truncate">${title}</span></span></span>
    </span>
  </div>`;

beforeEach(() => {
  document.body.innerHTML = `
    <div id="pinned">${row('thr_pin', 'Pinned')}${row('thr_loose', 'Loose')}</div>
    <div data-sidebar-visibility-group="project:proj_a">${row('thr_grouped', 'Grouped')}</div>`;
});

const line = (id: string) =>
  document.querySelector(`a[data-sidebar-thread-id="${id}"]`)!.closest('div')!.querySelector(`.${LINE_CLASS}`);

describe('pinned project line', () => {
  it('lists only rows outside project groups', () => {
    expect(candidateIds(document)).toEqual(['thr_pin', 'thr_loose']);
  });

  it('adds one line to pinned rows only and keeps it idempotent', () => {
    const projects = new Map([['thr_pin', '🎬 creators_crm'], ['thr_grouped', '🛩️ cockpit']]);
    decorate(document, projects);
    decorate(document, projects);
    expect(line('thr_pin')?.textContent).toBe('🎬 creators_crm');
    expect(document.querySelectorAll(`.${LINE_CLASS}`)).toHaveLength(1);
    expect(line('thr_loose')).toBeNull();
    expect(line('thr_grouped')).toBeNull();
  });

  it('updates a renamed project and removes lines when a thread is unpinned', () => {
    decorate(document, new Map([['thr_pin', 'old']]));
    decorate(document, new Map([['thr_pin', 'new']]));
    expect(line('thr_pin')?.textContent).toBe('new');
    decorate(document, new Map());
    expect(line('thr_pin')).toBeNull();
    expect(document.querySelector(`[${ROW_ATTR}]`)).toBeNull();
  });

  it('cleans up on unmount', () => {
    decorate(document, new Map([['thr_pin', 'p']]));
    undecorate(document);
    expect(document.querySelector(`.${LINE_CLASS}`)).toBeNull();
  });
});
