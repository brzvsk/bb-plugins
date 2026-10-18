import { useEffect, useRef, useState } from 'react';
import { definePluginApp, useComposer, useSdk } from '@get-bb/plugin-sdk/app';
import { toast } from 'sonner';
import { PROMPT, canStop, composerIdle, doubleEscape, playButton, resumable, rootOf, stopButton, stopHint } from './logic';

const PLUGIN_ID = 'play-continue';
const css = `[data-plugin-composer-action-plugin="${PLUGIN_ID}"] { display: none !important; }`;

// A hidden composer action: it only gives the plugin a mount per thread
// composer, with that composer's handle. The UI is the native Stop and Send.
function PlayContinue() {
  const composer = useComposer();
  const sdk = useSdk();
  const ref = useRef<HTMLSpanElement>(null);
  const [eligible, setEligible] = useState(false);
  const [busy, setBusy] = useState(false);
  const threadId = composer.scope.kind === 'thread' ? composer.scope.threadId : null;
  const idle = composerIdle(composer);
  const root = () => rootOf(ref.current);

  const check = async (signal?: AbortSignal) => {
    if (!threadId) return false;
    const [thread, events] = await Promise.all([
      sdk.threads.get({ threadId, signal }),
      sdk.threads.events.list({ threadId, signal, order: 'desc', limit: '1', types: ['turn/started', 'turn/completed'] }),
    ]);
    return resumable(thread, events[0]);
  };

  const play = useRef<ReturnType<typeof playButton>>(null);
  play.current ??= playButton(() => void resume.current());
  const resume = useRef(async () => {});
  resume.current = async () => {
    if (busy || !composerIdle(composer)) return;
    setBusy(true);
    try {
      // Recheck right before waking the agent; reject stale clicks.
      if (!(await check())) {
        setEligible(false);
        return;
      }
      composer.replace({ text: PROMPT, mentions: [] });
      await composer.submit({ experimental_data: { continuation: true } });
      setEligible(false);
    } catch (error) {
      if (composer.text === PROMPT) composer.replace({ text: '', mentions: [] });
      toast.error(error instanceof Error ? error.message : 'Could not continue the turn');
    } finally {
      setBusy(false);
    }
  };

  // Eligibility comes from the thread, not the composer: poll while idle.
  useEffect(() => {
    if (!threadId || composer.isRunning || composer.isSubmitting) {
      setEligible(false);
      return;
    }
    const controller = new AbortController();
    const refresh = () =>
      check(controller.signal).then(
        value => !controller.signal.aborted && setEligible(value),
        () => !controller.signal.aborted && setEligible(false),
      );
    void refresh();
    const timer = window.setInterval(refresh, 10_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [threadId, composer.isRunning, composer.isSubmitting]);

  useEffect(() => {
    const node = root();
    const sync = () => play.current!.sync(root(), eligible && idle, busy);
    sync();
    if (!node) return;
    const observer = new MutationObserver(sync);
    observer.observe(node, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [eligible, idle, busy]);
  useEffect(() => () => play.current!.restore(), []);

  useEffect(() => {
    if (!threadId) return;
    return doubleEscape(window, {
      canStop: () => canStop(root()),
      stop: () => stopButton(root())?.click(),
      onArmed: stopHint(root),
    });
  }, [threadId]);

  return <span ref={ref} hidden />;
}

export default definePluginApp(app => {
  app.contentScripts.register({
    id: 'hide-action-slot',
    mount() {
      const style = document.createElement('style');
      style.dataset.bbPlugin = PLUGIN_ID;
      style.textContent = css;
      document.head.append(style);
      return () => style.remove();
    },
  });
  app.composer.customize({
    id: 'play-continue',
    scopes: ['thread'],
    actions: [{ id: 'play-continue', component: PlayContinue }],
  });
});
