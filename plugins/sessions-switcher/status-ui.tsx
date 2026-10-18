import {
  experimental_ThreadStatusGlyph as ThreadStatusGlyph,
  experimental_useSidebarThreads as useSidebarThreads,
  useSidebarThreadDraft,
  useSidebarThreadRowStatus,
  type PluginSidebarThreadIndicator,
} from '@get-bb/plugin-sdk/app';
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { StatusTarget } from './switcher';

// The host already resolves unread, runtime, pending input and queued work.
// Only composer drafts are client-local and need the same overlay as the sidebar.
export function withDraft(indicator: PluginSidebarThreadIndicator, draft: boolean): PluginSidebarThreadIndicator {
  if (!draft) return indicator;
  if (['runtime', 'workflow', 'background-agent', 'background-command', 'plan-mode', 'goal'].includes(indicator)) return 'working-draft';
  return indicator === 'none' ? 'draft' : indicator;
}
function Status({ id, indicator }: { id: string; indicator: PluginSidebarThreadIndicator }) {
  const { hasUnsubmittedDraft } = useSidebarThreadDraft(id);
  const rowStatus = useSidebarThreadRowStatus(id);
  return <ThreadStatusGlyph indicator={withDraft(indicator, hasUnsubmittedDraft)} rowStatus={rowStatus} />;
}
function LiveStatuses({ targets }: { targets: readonly StatusTarget[] }) {
  const { threads } = useSidebarThreads();
  const byId = new Map(threads.map(thread => [thread.id, thread]));
  return <>{targets.map(({ id, element }) => createPortal(
    <Status id={id} indicator={byId.get(id)?.indicator ?? 'none'} />, element, id,
  ))}</>;
}
export function createStatusBridge() {
  let targets: readonly StatusTarget[] = [];
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
  const snapshot = () => targets;
  return {
    setTargets(next: readonly StatusTarget[]) { targets = next; listeners.forEach(listener => listener()); },
    Component() {
      const current = useSyncExternalStore(subscribe, snapshot);
      return current.length ? <LiveStatuses targets={current} /> : null;
    },
  };
}
