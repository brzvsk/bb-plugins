// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ARCHIVED_CLASS, clearArchived, groupArchived, menuSlots, renderArchived, type ArchivedHandlers, type ArchivedThread } from './archived';

const header = (name: string, expanded = true) => `
  <div data-sidebar-sticky-tier="label"><span><span title="${name}">${name}</span>
    <button aria-expanded="${expanded}"></button></span></div>`;
const row = (id: string) => `<div data-sidebar-windowed-item=""><div class="group/thread-row"><a data-sidebar-thread-id="${id}"></a></div></div>`;

function sidebar(p1Expanded = true) {
  document.body.innerHTML = `
    <div data-bb-plugin="thread-list">
      <div data-sidebar-visibility-group="project:p1">${header('One', p1Expanded)}<div id="p1-rows">${row('thr_active')}</div></div>
      <div data-sidebar-visibility-group="project:p2">${header('Two')}</div>
      <div data-sidebar-visibility-group="threads">${header('Threads')}<div id="loose-rows">${row('thr_loose')}</div></div>
    </div>`;
}

const thread = (threadId: string, projectId: string, extra: Partial<ArchivedThread> = {}): ArchivedThread => ({
  threadId, projectId, sectionId: null, title: threadId, archivedAt: 1, ...extra,
});
const archived = [thread('thr_a1', 'p1'), thread('thr_a2', 'p1'), thread('thr_b', 'p2'), thread('thr_personal', 'personal')];
const handlers = (): ArchivedHandlers => ({ toggle: vi.fn(), open: vi.fn(), unarchive: vi.fn() });

beforeEach(() => sidebar());

describe('recently archived', () => {
  it('groups by project, else the loose Threads group', () => {
    const groups = groupArchived(document, archived);
    expect(groups.get('project:p1')?.map(t => t.threadId)).toEqual(['thr_a1', 'thr_a2']);
    expect(groups.get('threads')?.map(t => t.threadId)).toEqual(['thr_personal']);
  });

  it('adds a collapsed line at the end of each group, inside its row list when it has one', () => {
    renderArchived(document, archived, new Set(), null, handlers());
    const p1 = document.querySelector('#p1-rows > .sidebar-focus-archived')!;
    expect(p1.textContent).toBe('Done2');
    expect(p1.querySelector('[aria-expanded]')?.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('#p1-rows')!.classList.contains('sidebar-focus-list')).toBe(true);
    expect(document.querySelector('[data-sidebar-visibility-group="project:p2"] > .sidebar-focus-empty-list > .sidebar-focus-archived')).not.toBeNull();
    expect(document.querySelectorAll(`.${ARCHIVED_CLASS}`)).toHaveLength(3);
  });

  it('opens per group, opens for the selected thread, and wires the row actions', () => {
    const h = handlers();
    renderArchived(document, archived, new Set(['archived:project:p1']), null, h);
    const links = document.querySelectorAll<HTMLAnchorElement>('#p1-rows a[data-sidebar-focus-archived-id]');
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBe('/projects/p1/threads/thr_a1');
    links[0].click();
    expect(h.open).toHaveBeenCalledWith('/projects/p1/threads/thr_a1', expect.any(MouseEvent));
    document.querySelector<HTMLButtonElement>('#p1-rows [aria-label="Unarchive"]')!.click();
    expect(h.unarchive).toHaveBeenCalledWith('thr_a1');
    document.querySelector<HTMLElement>('#p1-rows .sidebar-focus-disclosure')!.click();
    expect(h.toggle).toHaveBeenCalledWith('archived:project:p1');

    renderArchived(document, archived, new Set(), 'thr_b', h);
    expect(document.querySelector('[aria-current="page"]')?.getAttribute('data-sidebar-focus-archived-id')).toBe('thr_b');
  });

  it('stays out of collapsed groups and out of the way when bb shows archived threads itself', () => {
    sidebar(false);
    renderArchived(document, archived, new Set(), null, handlers());
    expect(document.querySelector('#p1-rows .sidebar-focus-archived')).toBeNull();
    renderArchived(document, [...archived, thread('thr_active', 'p1')], new Set(), null, handlers());
    expect(document.querySelectorAll(`.${ARCHIVED_CLASS}`)).toHaveLength(0);
  });

  it('offers a slot for bb\'s thread menu on every drawn row', () => {
    renderArchived(document, archived, new Set(['archived:project:p1']), null, handlers());
    const slots = menuSlots(document, archived);
    expect(slots.map(slot => slot.thread.id)).toEqual(['thr_a1', 'thr_a2']);
    expect(slots[0].thread).toMatchObject({ projectId: 'p1', archivedAt: 1, status: 'idle', pinnedAt: null });
    expect(slots[0].element.previousElementSibling?.getAttribute('aria-label')).toBe('Unarchive');
  });

  it('cleans up', () => {
    renderArchived(document, archived, new Set(), null, handlers());
    clearArchived(document);
    expect(document.querySelectorAll(`.${ARCHIVED_CLASS}`)).toHaveLength(0);
  });
});
