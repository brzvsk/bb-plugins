import { definePluginApp } from '@get-bb/plugin-sdk/app';
import './app.css';
import {
  automationCss, blockThreads, clear, focusCss, placeButtons, placeOf, renderBlock, selectedThreadId, topBlocks,
  type AutomationThread, type Handlers, type SidebarState,
} from './sidebar';

const REFRESH_MS = 60_000;
const FOCUS_KEY = 'sidebar-focus:focus';
const OPEN_KEY = 'sidebar-focus:automations-open';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
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
        automationsOpen: read(OPEN_KEY) === 'true',
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
        toggleAutomations() {
          state.automationsOpen = !state.automationsOpen;
          write(OPEN_KEY, String(state.automationsOpen));
          scan();
        },
        openThread(threadId, href, event) {
          if (event.button !== 0) return;
          event.preventDefault();
          // The hidden native row still routes like a visible one, including modifier clicks.
          const native = document.querySelector<HTMLElement>(`a[data-sidebar-thread-id="${threadId}"]`);
          if (native) {
            native.dispatchEvent(new MouseEvent('click', {
              bubbles: true, cancelable: true, button: 0,
              metaKey: event.metaKey, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey,
            }));
            return;
          }
          history.pushState(history.state, '', href);
          window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
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
        const css = [focusCss(focus), automationCss(state)].filter(Boolean).join('\n');
        if (style.textContent !== css) style.textContent = css;
        placeButtons(document, focus, handlers);
        renderBlock(document, { ...state, focus }, blockThreads(document, { ...state, focus }), selected, handlers);
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
