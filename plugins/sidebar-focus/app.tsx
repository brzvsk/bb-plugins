import { definePluginApp } from '@get-bb/plugin-sdk/app';
import './app.css';
import {
  clear, focusCss, placeButtons, placeOf, selectedThreadId, topBlocks, tuck,
  type AutomationThread, type Handlers, type SidebarState,
} from './sidebar';

const REFRESH_MS = 60_000;
const FOCUS_KEY = 'sidebar-focus:focus';
const OPEN_KEY = 'sidebar-focus:automations-open-groups';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function readSet(key: string): Set<string> {
  try {
    const value: unknown = JSON.parse(read(key) ?? '[]');
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}
function write(key: string, value: string | null): void {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* per-window state only */ }
}

export default definePluginApp(app => {
  app.contentScripts.register({
    id: 'sidebar-focus',
    mount({ pluginId }) {
      const state: SidebarState = {
        focus: read(FOCUS_KEY),
        automations: new Map(),
        automationsOpen: readSet(OPEN_KEY),
        held: null,
      };
      const style = document.createElement('style');
      style.dataset.sidebarFocus = '';
      document.head.append(style);
      let frame = 0;
      let inflight: AbortController | null = null;
      let disposed = false;

      const handlers: Handlers = {
        toggleFocus(key) {
          state.focus = state.focus === key ? null : key;
          write(FOCUS_KEY, state.focus);
          scan();
        },
        toggleAutomations(key) {
          const open = new Set(state.automationsOpen);
          if (!open.delete(key)) open.add(key);
          state.automationsOpen = open;
          write(OPEN_KEY, JSON.stringify([...open]));
          scan();
        },
      };

      const scan = () => {
        frame = 0;
        if (disposed) return;
        const selected = selectedThreadId(document, location.pathname);
        if (state.held?.threadId !== selected) {
          const thread = selected ? state.automations.get(selected) : undefined;
          state.held = thread ? { threadId: thread.threadId, place: placeOf(document, thread) } : null;
        }
        // A focus whose group is gone (renamed mode, deleted project) shows everything instead of nothing.
        const focus = state.focus && topBlocks(document).some(block => block.key === state.focus) ? state.focus : null;
        const css = focusCss(focus);
        if (style.textContent !== css) style.textContent = css;
        placeButtons(document, focus, handlers);
        tuck(document, state, handlers);
      };
      const schedule = () => {
        if (!frame && !disposed) frame = requestAnimationFrame(scan);
      };

      const load = async () => {
        if (inflight) return;
        const controller = new AbortController();
        inflight = controller;
        try {
          const response = await fetch(`/api/v1/plugins/${encodeURIComponent(pluginId)}/rpc/automationThreads`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: 'null', signal: controller.signal,
          });
          const data = await response.json() as { ok?: boolean; result?: AutomationThread[] };
          if (response.ok && data.ok && Array.isArray(data.result)) {
            state.automations = new Map(data.result.map(thread => [thread.threadId, thread]));
          }
        } catch {
          // Keep the last known automation threads; the minute refresh retries.
        } finally {
          if (inflight === controller) inflight = null;
        }
        schedule();
      };
      const onFocus = () => void load();
      const onHistory = () => schedule();

      const observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      const timer = window.setInterval(() => void load(), REFRESH_MS);
      window.addEventListener('focus', onFocus);
      window.addEventListener('popstate', onHistory);
      void load();
      schedule();

      return () => {
        disposed = true;
        observer.disconnect();
        window.clearInterval(timer);
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('popstate', onHistory);
        cancelAnimationFrame(frame);
        inflight?.abort();
        style.remove();
        clear(document);
      };
    },
  });
});
