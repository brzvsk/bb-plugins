import { definePluginApp, useBbNavigate, type PluginThreadHeaderActionProps } from '@get-bb/plugin-sdk/app';
import { useEffect } from 'react';
import './app.css';
import { BRIDGE_ATTR, decorate, threadFor, undecorate } from './banner';

// One navigator per rendered thread pane; the hidden span ties the pane's DOM to its thread.
const navigators = new Map<string, ReturnType<typeof useBbNavigate>>();
function PaneBridge({ threadId }: PluginThreadHeaderActionProps) {
  const navigate = useBbNavigate();
  useEffect(() => {
    navigators.set(threadId, navigate);
    return () => { if (navigators.get(threadId) === navigate) navigators.delete(threadId); };
  }, [threadId, navigate]);
  return <span hidden {...{ [BRIDGE_ATTR]: threadId }} />;
}

export default definePluginApp(app => {
  app.slots.experimental_threadHeaderAction({ id: 'pane-bridge', title: 'Plan tab bridge', component: PaneBridge });
  app.contentScripts.register({
    id: 'plan-tab',
    mount({ pluginId, signal }) {
      const hosts = new Map<string, string | null>();
      const hostFor = async (threadId: string) => {
        if (hosts.has(threadId)) return hosts.get(threadId)!;
        const response = await fetch(`/api/v1/plugins/${encodeURIComponent(pluginId)}/rpc/host`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ threadId }), signal,
        });
        const data = await response.json() as { ok?: boolean; result?: { hostId: string | null } };
        const hostId = response.ok && data.ok ? data.result?.hostId ?? null : null;
        hosts.set(threadId, hostId);
        return hostId;
      };
      const open = async (path: string, row: Element) => {
        const threadId = threadFor(row) ?? (navigators.size === 1 ? [...navigators.keys()][0]! : null);
        const navigate = threadId ? navigators.get(threadId) : undefined;
        const hostId = threadId ? await hostFor(threadId).catch(() => null) : null;
        if (!navigate || !hostId) return;
        navigate.experimental_openFilePreview({ target: { kind: 'host', hostId, path }, location: null });
      };

      let frame = 0;
      const scan = () => { frame = 0; decorate(document, (path, row) => void open(path, row)); };
      const schedule = () => { if (!frame) frame = requestAnimationFrame(scan); };
      const observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true });
      scan();
      return () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
        undecorate(document);
      };
    },
  });
});
