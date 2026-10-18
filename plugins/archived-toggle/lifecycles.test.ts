import { describe, expect, it } from 'vitest';
import { nextLifecycles, toggleArchived } from './lifecycles';

function fakeThreadList(initial: string[]) {
  let lifecycles = initial;
  const calls: Array<{ url: string; body: unknown }> = [];
  const fetcher = async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ url, body });
    if (url.endsWith('/listPreferences')) return Response.json({ ok: true, result: { preferences: { threadLifecycles: lifecycles } } });
    lifecycles = body.value;
    return Response.json({ ok: true, result: body });
  };
  return { fetcher, calls, current: () => lifecycles };
}

describe('archived toggle', () => {
  it('adds archived to active and drops it again', () => {
    expect(nextLifecycles(['active'])).toEqual(['active', 'archived']);
    expect(nextLifecycles(['active', 'archived'])).toEqual(['active']);
    expect(nextLifecycles(['archived'])).toEqual(['active']);
  });

  it("writes bb's thread-list threadLifecycles preference", async () => {
    const list = fakeThreadList(['active']);
    expect(await toggleArchived(list.fetcher)).toBe(true);
    expect(list.current()).toEqual(['active', 'archived']);
    expect(list.calls.map(call => call.url)).toEqual([
      '/api/v1/plugins/thread-list/rpc/listPreferences',
      '/api/v1/plugins/thread-list/rpc/setPreference',
    ]);
    expect(await toggleArchived(list.fetcher)).toBe(false);
    expect(list.current()).toEqual(['active']);
  });

  it('surfaces a thread-list error', async () => {
    const fetcher = async () => Response.json({ ok: false, error: { message: 'Plugin thread-list is disabled' } }, { status: 409 });
    await expect(toggleArchived(fetcher)).rejects.toThrow('Plugin thread-list is disabled');
  });
});
