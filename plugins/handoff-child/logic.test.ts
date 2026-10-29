import { describe, expect, it } from 'vitest';
import { PLUGIN_ID, handoffSource, readRequest, shouldAdopt } from './logic';

describe('handoffSource', () => {
  const scope = { kind: 'thread', threadId: 'thr_src' };
  it('finds the handoff mention of this thread', () => {
    expect(handoffSource(scope, [{ kind: 'thread', threadId: 'thr_src' }])).toBe('thr_src');
  });
  it('ignores other threads and non-thread scopes', () => {
    expect(handoffSource(scope, [{ kind: 'thread', threadId: 'thr_other' }])).toBeNull();
    expect(handoffSource(scope, [])).toBeNull();
    expect(handoffSource({ kind: 'new-thread' }, [{ kind: 'thread', threadId: 'thr_src' }])).toBeNull();
  });
});

describe('readRequest', () => {
  const data = { kind: 'handoff-child', sourceThreadId: 'thr_src', notifications: 'off' };
  it('accepts its own submission', () => {
    expect(readRequest({ pluginId: PLUGIN_ID, data })).toEqual(data);
  });
  it('rejects other plugins and malformed data', () => {
    expect(readRequest(null)).toBeNull();
    expect(readRequest({ pluginId: 'drafts', data })).toBeNull();
    expect(readRequest({ pluginId: PLUGIN_ID, data: { ...data, notifications: 'stuck' } })).toBeNull();
    expect(readRequest({ pluginId: PLUGIN_ID, data: { ...data, sourceThreadId: '' } })).toBeNull();
  });
});

describe('shouldAdopt', () => {
  const request = { kind: 'handoff-child' as const, sourceThreadId: 'thr_src', notifications: 'auto' as const };
  it('adopts the new top-level thread only', () => {
    expect(shouldAdopt({ id: 'thr_new', parentThreadId: null }, request)).toBe(true);
    expect(shouldAdopt({ id: 'thr_src', parentThreadId: null }, request)).toBe(false);
    expect(shouldAdopt({ id: 'thr_new', parentThreadId: 'thr_x' }, request)).toBe(false);
  });
});
