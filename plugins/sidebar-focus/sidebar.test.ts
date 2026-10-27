// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUTTON_CLASS, FLEX_CLASS, LABEL_CLASS, TUCKED, clear, focusCss, placeButtons, placeOf, selectedThreadId, topBlocks,
  tuck, type Handlers, type SidebarState,
} from './sidebar';

const row = (id: string, glyph = false, selected = false) => `
  <div data-sidebar-windowed-item=""><div data-sidebar-sticky-group="">
    <div class="group/thread-row${selected ? ' bb-sidebar-selected-row' : ''}">
      <a data-sidebar-thread-id="${id}" href="/projects/p/threads/${id}"></a>
      <span data-sidebar-thread-trailing="">${glyph ? '<span data-sidebar-thread-trailing-indicator=""></span>' : ''}</span>
    </div>
  </div></div>`;

const header = (name: string, controls = true) => `
  <div data-sidebar-sticky-tier="label">
    <span><span title="${name}">${name}</span></span>
    ${controls ? `<span data-sidebar-trailing-controls=""><span class="bb-sidebar-hover-actions">
      <span data-sidebar-row-controls=""><button aria-label="New thread in ${name}"></button></span>
    </span></span>` : ''}
  </div>`;

function sidebar(selected = '') {
  document.body.innerHTML = `
    <div data-bb-plugin="thread-list"><div id="groups">
      <div data-sidebar-section-id="pinned">${header('Pinned', false)}<div id="pinned-rows">${row('thr_pin')}</div></div>
      <div data-sidebar-visibility-group="project:p1">${header('One')}<div id="p1-rows">
        ${row('thr_auto_read', false, selected === 'thr_auto_read')}${row('thr_auto_unread', true)}${row('thr_plain')}
      </div></div>
      <div data-sidebar-visibility-group="threads">
        <div data-sidebar-section-id="threads">${header('Threads')}<div id="loose-rows">${row('thr_loose')}</div></div>
      </div>
    </div></div>`;
}

function state(extra: Partial<SidebarState> = {}): SidebarState {
  return {
    focus: null,
    automations: new Map([
      ['thr_auto_read', { threadId: 'thr_auto_read', unread: false }],
      ['thr_auto_unread', { threadId: 'thr_auto_unread', unread: true }],
    ]),
    automationsOpen: new Set(),
    held: null,
    ...extra,
  };
}

const handlers = (): Handlers => ({ toggleFocus: vi.fn(), toggleAutomations: vi.fn() });
const wrapper = (id: string) => document.querySelector(`a[data-sidebar-thread-id="${id}"]`)!.closest('[data-sidebar-windowed-item]')!;

beforeEach(() => sidebar());

describe('top blocks', () => {
  it('finds groups and the pinned section, not sections nested in groups', () => {
    expect(topBlocks(document).map(block => block.key)).toEqual(['project:p1', 'threads', 'pinned']);
  });
});

describe('focus css', () => {
  it('is empty without focus', () => {
    expect(focusCss(null)).toBe('');
  });

  it('keeps the focused group and hides pinned and More', () => {
    const css = focusCss('project:p1');
    expect(css).toContain('[data-sidebar-visibility-group]:not([data-sidebar-visibility-group="project:p1"])');
    expect(css).toContain('[data-sidebar-section-id]:not([data-sidebar-visibility-group] *)');
    expect(css).toContain('sidebar-thread-list-more-trigger');
  });

  it('keeps Pinned and hides every group', () => {
    const css = focusCss('pinned');
    expect(css).toContain('[data-sidebar-visibility-group]:not([data-sidebar-visibility-group] *)');
    expect(css).toContain('[data-sidebar-section-id]:not([data-sidebar-section-id="pinned"])');
  });
});

describe('automation threads', () => {
  it('stay in place while bb shows a status, else get tucked', () => {
    expect(placeOf(document, { threadId: 'thr_auto_read', unread: false })).toBe('block');
    expect(placeOf(document, { threadId: 'thr_auto_unread', unread: true })).toBe('list');
    expect(placeOf(document, { threadId: 'thr_gone', unread: true })).toBe('list');
    expect(placeOf(document, { threadId: 'thr_gone', unread: false })).toBe('block');
  });

  it('tuck read rows at the end of their own list under a collapsed label', () => {
    tuck(document, state(), handlers());
    expect(wrapper('thr_auto_read').getAttribute(TUCKED)).toBe('closed');
    expect(wrapper('thr_auto_unread').hasAttribute(TUCKED)).toBe(false);
    expect(wrapper('thr_plain').hasAttribute(TUCKED)).toBe(false);
    const list = document.getElementById('p1-rows')!;
    expect(list.classList.contains(FLEX_CLASS)).toBe(true);
    const label = list.querySelector(`:scope > .${LABEL_CLASS}`)!;
    expect(label.textContent).toBe('Automations1');
    expect(label.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelectorAll(`.${LABEL_CLASS}`)).toHaveLength(1);
  });

  it('open per group and toggle by group key', () => {
    const h = handlers();
    tuck(document, state({ automationsOpen: new Set(['project:p1']) }), h);
    expect(wrapper('thr_auto_read').getAttribute(TUCKED)).toBe('open');
    document.querySelector<HTMLElement>(`.${LABEL_CLASS}`)!.click();
    expect(h.toggleAutomations).toHaveBeenCalledWith('project:p1');
  });

  it('come back when bb paints a status, and the label goes when empty', () => {
    tuck(document, state(), handlers());
    wrapper('thr_auto_read').querySelector('[data-sidebar-thread-trailing]')!.innerHTML = '<span data-sidebar-thread-trailing-indicator=""></span>';
    tuck(document, state(), handlers());
    expect(wrapper('thr_auto_read').hasAttribute(TUCKED)).toBe(false);
    expect(document.querySelector(`.${LABEL_CLASS}`)).toBeNull();
    expect(document.querySelector(`.${FLEX_CLASS}`)).toBeNull();
  });

  it('follow the held selection and keep it visible in a collapsed group', () => {
    tuck(document, state({ held: { threadId: 'thr_auto_unread', place: 'block' } }), handlers());
    expect(wrapper('thr_auto_unread').getAttribute(TUCKED)).toBe('closed');
    sidebar('thr_auto_read');
    tuck(document, state({ held: { threadId: 'thr_auto_read', place: 'block' } }), handlers());
    expect(wrapper('thr_auto_read').getAttribute(TUCKED)).toBe('open');
    tuck(document, state({ held: { threadId: 'thr_auto_read', place: 'list' } }), handlers());
    expect(wrapper('thr_auto_read').hasAttribute(TUCKED)).toBe(false);
  });

  it('keep the mark of a virtualized-away wrapper', () => {
    tuck(document, state(), handlers());
    wrapper('thr_auto_read').replaceChildren();
    const empty = document.querySelector(`[${TUCKED}]`)!;
    tuck(document, state(), handlers());
    expect(empty.getAttribute(TUCKED)).toBe('closed');
  });

  it('read the selection from bb, else from the URL', () => {
    sidebar('thr_auto_read');
    expect(selectedThreadId(document, '/')).toBe('thr_auto_read');
    sidebar();
    expect(selectedThreadId(document, '/projects/p1/threads/thr_abc')).toBe('thr_abc');
    expect(selectedThreadId(document, '/')).toBeNull();
  });
});

describe('focus buttons', () => {
  it('sit left of New thread, stay visible when pressed and toggle by key', () => {
    const h = handlers();
    placeButtons(document, null, h);
    const button = document.querySelector<HTMLButtonElement>('[data-sidebar-visibility-group="project:p1"] .sidebar-focus-button')!;
    expect(button.parentElement?.hasAttribute('data-sidebar-row-controls')).toBe(true);
    expect(button.nextElementSibling?.getAttribute('aria-label')).toBe('New thread in One');
    expect(button.getAttribute('aria-label')).toBe('Focus on One');

    placeButtons(document, 'project:p1', h);
    expect(button.parentElement?.hasAttribute('data-sidebar-trailing-controls')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    expect(h.toggleFocus).toHaveBeenCalledWith('project:p1');
  });

  it('use the header itself when it has no controls, as a hover action', () => {
    placeButtons(document, null, handlers());
    const pinned = document.querySelector('[data-sidebar-section-id="pinned"] .sidebar-focus-button')!;
    expect(pinned.parentElement?.getAttribute('data-sidebar-sticky-tier')).toBe('label');
    expect(pinned.classList.contains('bb-sidebar-hover-actions')).toBe(true);
    expect(document.querySelectorAll(`.${BUTTON_CLASS}`)).toHaveLength(3);
  });
});

describe('cleanup', () => {
  it('removes buttons, labels and marks', () => {
    placeButtons(document, null, handlers());
    tuck(document, state(), handlers());
    clear(document);
    expect(document.querySelectorAll(`.${BUTTON_CLASS}, .${LABEL_CLASS}, [${TUCKED}], .${FLEX_CLASS}`)).toHaveLength(0);
  });
});
