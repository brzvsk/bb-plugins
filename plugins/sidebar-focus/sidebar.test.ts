// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BLOCK_CLASS, BUTTON_CLASS, automationCss, blockThreads, clear, focusCss, placeButtons, placeOf, renderBlock,
  selectedThreadId, topBlocks, type AutomationThread, type Handlers, type SidebarState,
} from './sidebar';

const row = (id: string, glyph = '', selected = false) => `
  <div class="group/thread-row${selected ? ' bb-sidebar-selected-row' : ''}">
    <a data-sidebar-thread-id="${id}" href="/projects/p/threads/${id}"></a>
    <span data-sidebar-thread-trailing="">${glyph ? `<span data-sidebar-thread-trailing-indicator=""><span aria-label="${glyph}"></span></span>` : ''}</span>
  </div>`;

const header = (name: string, controls = true) => `
  <div data-sidebar-sticky-tier="label">
    <span><span title="${name}">${name}</span></span>
    ${controls ? `<span data-sidebar-trailing-controls=""><span class="bb-sidebar-hover-actions">
      <span data-sidebar-row-controls=""><button aria-label="New thread in ${name}"></button></span>
    </span></span>` : ''}
  </div>`;

function sidebar(selected = '') {
  document.body.innerHTML = `
    <div data-bb-plugin="thread-list"><div id="outer"><div id="groups">
      <div data-sidebar-section-id="pinned">${header('Pinned', false)}${row('thr_pin', '', selected === 'thr_pin')}</div>
      <div data-sidebar-visibility-group="project:p1">${header('One')}
        ${row('thr_auto_read', '', selected === 'thr_auto_read')}${row('thr_auto_unread', 'unread-success')}${row('thr_plain')}
      </div>
      <div data-sidebar-visibility-group="threads">
        <div data-sidebar-section-id="threads">${header('Threads')}${row('thr_loose')}</div>
      </div>
    </div><div id="more"></div></div></div>`;
}

const thread = (threadId: string, extra: Partial<AutomationThread> = {}): AutomationThread => ({
  threadId, title: threadId, projectId: 'p1', projectName: 'One', sectionId: null, pinned: false, unread: false, updatedAt: 1, ...extra,
});

function state(extra: Partial<SidebarState> = {}): SidebarState {
  return {
    focus: null,
    automations: new Map([
      ['thr_auto_read', thread('thr_auto_read', { updatedAt: 2 })],
      ['thr_auto_unread', thread('thr_auto_unread', { unread: true })],
      ['thr_offscreen', thread('thr_offscreen', { projectId: 'p2', projectName: 'Two', updatedAt: 3 })],
    ]),
    automationsOpen: true,
    held: null,
    ...extra,
  };
}

const handlers = (): Handlers => ({ toggleFocus: vi.fn(), toggleAutomations: vi.fn(), openThread: vi.fn() });

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
  it('belong in the list while bb shows a status, else in the block', () => {
    const s = state();
    expect(placeOf(document, s.automations.get('thr_auto_read')!)).toBe('block');
    expect(placeOf(document, s.automations.get('thr_auto_unread')!)).toBe('list');
    expect(placeOf(document, thread('thr_offscreen', { unread: true }))).toBe('list');
    expect(placeOf(document, thread('thr_offscreen'))).toBe('block');
  });

  it('hide rows without a status glyph, except a selection held in the list', () => {
    expect(automationCss(state())).toContain(':not(:has([data-sidebar-thread-trailing-indicator]))');
    const held = automationCss(state({ held: { threadId: 'thr_auto_read', place: 'list' } }));
    expect(held).not.toContain('"thr_auto_read"');
    const tucked = automationCss(state({ held: { threadId: 'thr_auto_unread', place: 'block' } }));
    expect(tucked).toContain(':has(a[data-sidebar-thread-id][data-sidebar-thread-id="thr_auto_unread"]) {');
  });

  it('fill the block newest first and follow focus', () => {
    expect(blockThreads(document, state()).map(t => t.threadId)).toEqual(['thr_offscreen', 'thr_auto_read']);
    expect(blockThreads(document, state({ focus: 'project:p1' })).map(t => t.threadId)).toEqual(['thr_auto_read']);
    expect(blockThreads(document, state({ focus: 'pinned' }))).toEqual([]);
    expect(blockThreads(document, state({ held: { threadId: 'thr_auto_read', place: 'list' } })).map(t => t.threadId)).toEqual(['thr_offscreen']);
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

describe('automations block', () => {
  it('renders after the groups, collapses, and disappears when empty', () => {
    const s = state();
    const h = handlers();
    renderBlock(document, s, blockThreads(document, s), null, h);
    const block = document.querySelector(`.${BLOCK_CLASS}`)!;
    expect(block.previousElementSibling?.id).toBe('groups');
    expect(block.querySelectorAll('a[data-sidebar-focus-thread-id]')).toHaveLength(2);
    expect(block.textContent).toContain('Two');

    const link = block.querySelector<HTMLAnchorElement>('a[data-sidebar-focus-thread-id="thr_auto_read"]')!;
    link.click();
    expect(h.openThread).toHaveBeenCalledWith('thr_auto_read', '/projects/p1/threads/thr_auto_read', expect.any(MouseEvent));

    renderBlock(document, { ...s, automationsOpen: false }, blockThreads(document, s), null, h);
    expect(block.querySelectorAll('a[data-sidebar-focus-thread-id]')).toHaveLength(0);
    expect(block.querySelector('[aria-expanded]')?.getAttribute('aria-expanded')).toBe('false');

    renderBlock(document, { ...s, automationsOpen: false }, blockThreads(document, s), 'thr_auto_read', h);
    expect(block.querySelector('[aria-current="page"]')).not.toBeNull();

    renderBlock(document, s, [], null, h);
    expect(document.querySelector(`.${BLOCK_CLASS}`)).toBeNull();
  });

  it('is cleared with the buttons', () => {
    const s = state();
    placeButtons(document, null, handlers());
    renderBlock(document, s, blockThreads(document, s), null, handlers());
    clear(document);
    expect(document.querySelectorAll(`.${BUTTON_CLASS}, .${BLOCK_CLASS}`)).toHaveLength(0);
  });
});
