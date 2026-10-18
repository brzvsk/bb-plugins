export type Lifecycle = 'active' | 'archived';

// bb's built-in Thread list plugin owns the list and its preferences; this
// plugin only flips its existing threadLifecycles preference.
const THREAD_LIST_RPC = '/api/v1/plugins/thread-list/rpc';

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

async function call(fetcher: Fetch, method: string, input: unknown): Promise<unknown> {
  const response = await fetcher(`${THREAD_LIST_RPC}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = (await response.json().catch(() => null)) as { ok?: boolean; result?: unknown; error?: { message?: string } } | null;
  if (!response.ok || !data?.ok) throw new Error(data?.error?.message ?? `Thread list ${method} failed (${response.status})`);
  return data.result;
}

export function nextLifecycles(current: readonly Lifecycle[]): Lifecycle[] {
  return current.includes('archived') ? ['active'] : ['active', 'archived'];
}

/** Toggles archived threads in bb's list and returns whether they are now shown. */
export async function toggleArchived(fetcher: Fetch = fetch): Promise<boolean> {
  const listed = (await call(fetcher, 'listPreferences', null)) as { preferences: { threadLifecycles: Lifecycle[] } };
  const next = nextLifecycles(listed.preferences.threadLifecycles);
  await call(fetcher, 'setPreference', { key: 'threadLifecycles', value: next });
  return next.includes('archived');
}
