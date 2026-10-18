import { definePluginApp, useBbNavigate, type PluginThreadHeaderActionProps } from '@get-bb/plugin-sdk/app';
import { useEffect } from 'react';
import { currentId, mountSwitcher, type Session } from './switcher';
import './app.css';
import { createStatusBridge } from './status-ui';

// One bridge per rendered pane; navigation stays on BB's supported router.
const navigators = new Map<string, ReturnType<typeof useBbNavigate>>();
function NavigationBridge({ threadId }: PluginThreadHeaderActionProps) {
  const navigate = useBbNavigate();
  useEffect(() => { navigators.set(threadId, navigate); return () => { if (navigators.get(threadId) === navigate) navigators.delete(threadId); }; }, [threadId, navigate]);
  return null;
}
function navigate(session: Session) {
  const router = navigators.get(currentId() ?? '');
  if (router) { router.toThread(session.id); return; }
  const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[data-sidebar-thread-id]')).find(el => el.dataset.sidebarThreadId === session.id);
  if (link) { link.click(); return; }
  // Compose/settings have no thread-header bridge. Canonical route fallback.
  location.assign(session.projectId === 'proj_personal' ? `/threads/${encodeURIComponent(session.id)}` : `/projects/${encodeURIComponent(session.projectId)}/threads/${encodeURIComponent(session.id)}`);
}
export default definePluginApp(app => {
  let layout: 'horizontal' | 'vertical' = 'horizontal';
  const statuses = createStatusBridge(next => { layout = next; controller?.setLayout(next); });
  app.slots.experimental_appOverlay({ id: 'session-statuses', component: statuses.Component });
  let controller: ReturnType<typeof mountSwitcher> | null = null;
  app.commands.register({ id: 'cycle', title: 'Switch recent sessions', defaultShortcut: { key: '`', mod: true }, run() { void controller?.open(); } });
  app.slots.experimental_threadHeaderAction({ id: 'navigation', title: 'Sessions navigation', component: NavigationBridge });
  app.contentScripts.register({ id: 'switcher', mount({ pluginId, signal }) {
    const instance = mountSwitcher({ signal, navigate, layout, setStatusTargets: statuses.setTargets, async load(ids) {
      const response = await fetch(`/api/v1/plugins/${encodeURIComponent(pluginId)}/rpc/recent`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }), signal });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error('Could not load sessions');
      return data.result;
    }, async providerIcons() {
      // The built-in Thread list plugin owns this preference; read it through its RPC.
      const response = await fetch('/api/v1/plugins/thread-list/rpc/listPreferences', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'null', signal });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error('Could not read thread list preferences');
      return data.result?.preferences?.showProviderIcons !== false;
    } });
    controller = instance;
    return () => { instance.dispose(); if (controller === instance) controller = null; };
  } });
});
