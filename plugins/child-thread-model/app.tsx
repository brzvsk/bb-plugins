import { definePluginApp } from '@get-bb/plugin-sdk/app';
import './app.css';
import type { ChildThreadLabel } from './label';
import { childRowThreadIds, decorate, undecorate } from './rows';

const REFRESH_MS = 15_000;
const MAX_THREADS_PER_REQUEST = 100;

interface ChildThreadModelsResponse {
  ok?: boolean;
  result?: { labels?: ChildThreadLabel[] };
}

export default definePluginApp(app => {
  app.contentScripts.register({
    id: 'child-thread-model',
    mount({ pluginId }) {
      const labels = new Map<string, ChildThreadLabel>();
      const checked = new Set<string>();
      let lastLoadAt = 0;
      let frame = 0;
      let inflight: AbortController | null = null;
      let disposed = false;

      const load = async () => {
        if (inflight !== null || disposed) return;
        const wanted = childRowThreadIds(document);
        if (wanted.length === 0) return;

        const controller = new AbortController();
        inflight = controller;
        const asked = wanted.slice(0, MAX_THREADS_PER_REQUEST);
        lastLoadAt = Date.now();
        try {
          const response = await fetch(`/api/v1/plugins/${encodeURIComponent(pluginId)}/rpc/childThreadModels`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ threadIds: asked }),
            signal: controller.signal,
          });
          const data = (await response.json()) as ChildThreadModelsResponse;
          if (!response.ok || data.ok !== true || !Array.isArray(data.result?.labels)) return;

          const found = new Map(data.result.labels.map(label => [label.threadId, label]));
          for (const threadId of asked) {
            const label = found.get(threadId);
            if (label === undefined) labels.delete(threadId);
            else labels.set(threadId, label);
          }
        } catch {
          // Keep the last known labels; the next scan retries.
        } finally {
          for (const threadId of wanted) checked.add(threadId);
          if (inflight === controller) inflight = null;
          if (!disposed) schedule();
        }
      };

      const scan = () => {
        frame = 0;
        if (disposed) return;
        decorate(document, labels);

        const wanted = childRowThreadIds(document);
        const present = new Set(wanted);
        for (const threadId of [...labels.keys()]) if (!present.has(threadId)) labels.delete(threadId);
        for (const threadId of [...checked]) if (!present.has(threadId)) checked.delete(threadId);

        const due = Date.now() - lastLoadAt >= REFRESH_MS;
        const unseen = wanted.some(threadId => !checked.has(threadId));
        if (wanted.length > 0 && (due || unseen)) void load();
      };

      const schedule = () => {
        if (!frame && !disposed) frame = requestAnimationFrame(scan);
      };

      const observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true });
      const timer = window.setInterval(schedule, REFRESH_MS);
      schedule();

      return () => {
        disposed = true;
        observer.disconnect();
        window.clearInterval(timer);
        cancelAnimationFrame(frame);
        inflight?.abort();
        undecorate(document);
      };
    },
  });
});
