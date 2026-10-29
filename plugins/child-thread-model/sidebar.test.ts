// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { delegatedParents, syncActivityTargets, MARKER, type ActivityThread } from './sidebar';

const thread = (id: string, parentThreadId: string | null = null, runtimeStatus: ActivityThread['runtimeStatus'] = 'idle'): ActivityThread => ({
  id, parentThreadId, runtimeStatus, isHidden: false, isArchived: false,
  activity: { workflows: 0, backgroundAgents: 0, backgroundCommands: 0, planMode: 0, goals: 0 },
});
describe('delegated activity', () => {
  it('marks idle parent only; own work wins even when child is active', () => {
    const p = thread('parent'), c = thread('child', 'parent', 'active');
    expect([...delegatedParents([p, c])]).toEqual(['parent']);
    expect([...delegatedParents([{ ...p, runtimeStatus: 'active' }, c])]).toEqual([]);
    expect([...delegatedParents([p, { ...c, runtimeStatus: 'idle' }])]).toEqual([]);
    expect([...delegatedParents([{ ...p, activity: { ...p.activity, backgroundCommands: 1 } }, c])]).toEqual([]);
  });
  it('ignores hidden and archived children and handles nested work without cycles', () => {
    const p = thread('p'), c = thread('c', 'p'), g = thread('g', 'c', 'starting');
    expect([...delegatedParents([p, c, g])].sort()).toEqual(['c', 'p']);
    expect([...delegatedParents([p, { ...g, parentThreadId: 'p', isHidden: true }])]).toEqual([]);
    expect([...delegatedParents([p, { ...g, parentThreadId: 'p', isArchived: true }])]).toEqual([]);
    expect([...delegatedParents([{ ...p, parentThreadId: 'g' }, g])]).toEqual([]);
  });
  it('does not count queued or waiting-for-host as running', () => {
    expect([...delegatedParents([thread('p'), thread('c','p','waiting-for-host')])]).toEqual([]);
  });
});

describe('sidebar decoration', () => {
  it('replaces the loader in its own slot, deduplicates and restores the native DOM', () => {
    document.body.innerHTML = `<div data-sidebar-rename-row><a data-sidebar-thread-id="p"></a><span data-sidebar-thread-trailing><span class="native"><span data-sidebar-thread-trailing-indicator><svg data-icon="Loading"></svg></span></span></span></div>`;
    const native = document.querySelector('.native')!;
    const html = native.outerHTML;
    const loader = native.querySelector('svg')!;
    const loaderHtml = loader.outerHTML;
    const [target] = syncActivityTargets(document, new Set(['p']));
    expect(target?.element.parentElement).toBe(loader.parentElement);
    expect(syncActivityTargets(document, new Set(['p']))[0]?.element).toBe(target?.element);
    expect(document.querySelectorAll(`[${MARKER}]`)).toHaveLength(1);
    expect(loader.outerHTML).toBe(loaderHtml);
    syncActivityTargets(document, new Set());
    expect(document.querySelector(`[${MARKER}]`)).toBeNull();
    expect(native.outerHTML).toBe(html);
  });
  it('leaves attention indicators alone and follows row reuse', () => {
    document.body.innerHTML = `<div data-sidebar-rename-row><a data-sidebar-thread-id="p"></a><span data-sidebar-thread-trailing><span data-sidebar-thread-trailing-indicator><svg data-icon="CircleQuestion"></svg></span></span></div>`;
    expect(syncActivityTargets(document, new Set(['p']))).toEqual([]);
    document.querySelector('svg')!.setAttribute('data-icon','Loading');
    expect(syncActivityTargets(document, new Set(['p']))).toHaveLength(1);
    document.querySelector('a')!.setAttribute('data-sidebar-thread-id','other');
    expect(syncActivityTargets(document, new Set(['p']))).toEqual([]);
    expect(document.querySelector(`[${MARKER}]`)).toBeNull();
  });
});
