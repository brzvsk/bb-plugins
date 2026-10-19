import { definePluginApp } from '@get-bb/plugin-sdk/app';
import './app.css';
import { candidateIds, decorate, undecorate } from './rows';

const REFRESH_MS = 60_000;

export default definePluginApp(app => {
  app.contentScripts.register({
    id: 'pinned-project-line',
    mount({ pluginId }) {
      let projects = new Map<string, string>();
      const checked = new Set<string>();
      let frame = 0;
      let inflight: AbortController | null = null;
      let disposed = false;

      const load = async () => {
        if (inflight) return;
        const controller = new AbortController();
        inflight = controller;
        const asked = candidateIds(document);
        try {
          const response = await fetch(`/api/v1/plugins/${encodeURIComponent(pluginId)}/rpc/pinned`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: 'null', signal: controller.signal,
          });
          const data = await response.json() as { ok?: boolean; result?: { id: string; project: string }[] };
          if (!response.ok || !data.ok || !Array.isArray(data.result)) return;
          const rows = data.result;
          projects = new Map(rows.map(row => [row.id, row.project]));
        } catch {
          // Keep the last known lines; the minute refresh retries.
        } finally {
          // Mark these rows as asked even on failure so a broken RPC cannot loop every frame.
          for (const id of asked) checked.add(id);
          if (inflight === controller) inflight = null;
        }
        if (!disposed) schedule();
      };

      const scan = () => {
        frame = 0;
        decorate(document, projects);
        if (candidateIds(document).some(id => !checked.has(id))) void load();
      };
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(scan);
      };

      const observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true });
      const timer = window.setInterval(() => { checked.clear(); void load(); }, REFRESH_MS);
      void load();

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
