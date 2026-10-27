import { definePluginApp } from '@get-bb/plugin-sdk/app';
import './app.css';
import { decorate, undecorate } from './rows';

const REFRESH_MS = 60_000;

export default definePluginApp(app => {
  app.contentScripts.register({
    id: 'automation-clock',
    mount({ pluginId }) {
      let labels = new Map<string, string>();
      let frame = 0;
      let inflight: AbortController | null = null;
      let disposed = false;

      const load = async () => {
        if (inflight) return;
        const controller = new AbortController();
        inflight = controller;
        try {
          const response = await fetch(`/api/v1/plugins/${encodeURIComponent(pluginId)}/rpc/bound`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: 'null', signal: controller.signal,
          });
          const data = await response.json() as { ok?: boolean; result?: { threadId: string; names: string[] }[] };
          if (!response.ok || !data.ok || !Array.isArray(data.result)) return;
          labels = new Map(data.result.map(row => [row.threadId, `Automation: ${row.names.join(', ')}`]));
        } catch {
          // Keep the last known clocks; the minute refresh retries.
        } finally {
          if (inflight === controller) inflight = null;
        }
        if (!disposed) schedule();
      };

      const scan = () => {
        frame = 0;
        decorate(document, labels);
      };
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(scan);
      };
      const onFocus = () => void load();

      const observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true });
      const timer = window.setInterval(() => void load(), REFRESH_MS);
      window.addEventListener('focus', onFocus);
      void load();

      return () => {
        disposed = true;
        observer.disconnect();
        window.clearInterval(timer);
        window.removeEventListener('focus', onFocus);
        cancelAnimationFrame(frame);
        inflight?.abort();
        undecorate(document);
      };
    },
  });
});
