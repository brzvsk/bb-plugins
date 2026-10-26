import { catalogSchema, type Catalog } from './contract';
import { ModelVisibilityMenu } from './menu';

export const SETTINGS_CHANGED_EVENT = 'bb-model-visibility:changed';
const REFRESH_MS = 15_000;

/** SPA navigation to the plugin settings page, preserving unsent drafts. */
export function navigateToPluginSettings(pluginId: string): void {
  const url = `/settings/plugins/${encodeURIComponent(pluginId)}?tab=settings`;
  if (`${location.pathname}${location.search}${location.hash}` === url) return;
  history.pushState(history.state, '', url);
  window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
}

export function mountModelVisibility({
  pluginId,
  signal,
}: {
  pluginId: string;
  signal?: AbortSignal;
}): () => void {
  let data: Catalog | null = null;
  let disposed = false;
  let inflight: AbortController | null = null;

  const controller = new ModelVisibilityMenu({
    getData: () => data,
    onConfigure: () => navigateToPluginSettings(pluginId),
  });
  controller.start();

  const load = async () => {
    if (disposed || inflight) return;
    const request = new AbortController();
    inflight = request;
    try {
      const response = await fetch(
        `/api/v1/plugins/${encodeURIComponent(pluginId)}/rpc/catalog`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: 'null',
          signal: request.signal,
        },
      );
      const payload = await response.json() as { ok?: boolean; result?: unknown };
      if (!response.ok || !payload.ok || payload.result === undefined) return;
      data = catalogSchema.parse(payload.result);
      controller.refresh();
    } catch {
      // Keep the last good catalog; the next menu mutation or refresh retries.
    } finally {
      if (inflight === request) inflight = null;
    }
  };

  const changed = () => { void load(); };
  window.addEventListener(SETTINGS_CHANGED_EVENT, changed);
  const timer = window.setInterval(() => { void load(); }, REFRESH_MS);
  void load();

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    inflight?.abort();
    window.clearInterval(timer);
    window.removeEventListener(SETTINGS_CHANGED_EVENT, changed);
    controller.dispose();
  };
  signal?.addEventListener('abort', dispose, { once: true });
  return dispose;
}
