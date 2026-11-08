import {
  definePluginApp,
  experimental_THREAD_INFO_ROW_GROUPS,
  experimental_THREAD_INFO_SECTION_GROUPS,
  experimental_ThreadContextCardRow as CardRow,
  experimental_useRpcKeyedQuery,
  experimental_useRpcQuery,
  useSdk,
  type ExperimentalThreadContextCardProps,
} from "@get-bb/plugin-sdk/app";
import { useCallback, useEffect, useState } from "react";
import { automationsContract, gitContract } from "./contracts";
import { automationStatus, branchView, sortAutomations, NOTIFY_OPTIONS, type ParentNotifications } from "./format";

/**
 * Open an automation in the bundled Automations plugin. BbNavigate only reaches
 * this plugin's own panels, so this pushes the app route BB's router listens to
 * (the same URL the Automations page uses for its breadcrumbs).
 */
export function openAutomation(projectId: string, automationId: string): void {
  const path = `/plugins/automations/automations/${encodeURIComponent(projectId)}/${encodeURIComponent(automationId)}`;
  window.history.pushState(window.history.state, "", path);
  window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
}

export function BranchRow({ environment }: ExperimentalThreadContextCardProps) {
  const id = environment?.id ?? null;
  const status = experimental_useRpcKeyedQuery({
    pluginId: "bb--git",
    contract: gitContract,
    method: "status",
    keys: id ? [id] : [],
    enabled: !!id,
  });
  const view = id ? branchView(status.data?.[id]) : null;
  if (!view) return null;
  return (
    <CardRow
      icon="GitBranch"
      label={view.name}
      title={view.detail ? `${view.name} · ${view.detail}` : view.name}
      trailing={view.detail ?? undefined}
    />
  );
}

export function AutomationsSection({ threadId }: ExperimentalThreadContextCardProps) {
  const list = experimental_useRpcQuery({
    pluginId: "automations",
    contract: automationsContract,
    method: "automations_list",
    input: { targetThreadId: threadId },
  });
  const items = sortAutomations(list.data ?? []);
  if (!items.length) return null;
  return (
    <>
      {items.map(a => (
        <CardRow
          key={a.id}
          icon={a.problem ? "AlertCircle" : a.enabled === false ? "Pause" : "Repeat"}
          label={a.name}
          title={a.name}
          trailing={automationStatus(a)}
          onClick={() => openAutomation(a.projectId, a.id)}
        />
      ))}
    </>
  );
}

/** The Info tab's "Notify parent" choice, for child threads only. */
export function NotifyParentRow({ threadId }: ExperimentalThreadContextCardProps) {
  const sdk = useSdk();
  const [state, setState] = useState<{ parent: string | null; value: ParentNotifications } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    sdk.threads.get({ threadId }).then(
      r => {
        const t = "thread" in r ? (r as { thread: typeof r }).thread : r;
        if (live) setState({ parent: t.parentThreadId ?? null, value: t.parentNotifications ?? "auto" });
      },
      () => { if (live) setState(null); },
    );
    return () => { live = false; };
  }, [sdk, threadId]);

  const change = useCallback((value: ParentNotifications) => {
    setSaving(true);
    setState(s => (s ? { ...s, value } : s));
    sdk.threads.update({ threadId, parentNotifications: value }).catch(() => {}).finally(() => setSaving(false));
  }, [sdk, threadId]);

  if (!state?.parent) return null;
  return (
    <CardRow
      icon="Bell"
      label="Notify parent"
      title="Which turn outcomes wake the parent thread"
      trailing={
        <select
          aria-label="Notify parent"
          value={state.value}
          disabled={saving}
          onChange={e => change(e.currentTarget.value as ParentNotifications)}
          onClick={e => e.stopPropagation()}
          className="cursor-pointer appearance-none bg-transparent text-right text-xs text-muted-foreground outline-none hover:text-foreground"
        >
          {NOTIFY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      }
    />
  );
}

export default definePluginApp(app => {
  app.slots.experimental_threadContextCardRow({
    id: "notify-parent",
    group: experimental_THREAD_INFO_ROW_GROUPS.thread,
    order: 50,
    component: NotifyParentRow,
  });
  app.slots.experimental_threadContextCardRow({
    id: "branch",
    group: experimental_THREAD_INFO_ROW_GROUPS.git,
    order: 0,
    component: BranchRow,
  });
  app.slots.experimental_threadContextCardSection({
    id: "automations",
    title: "Automations",
    group: experimental_THREAD_INFO_SECTION_GROUPS.related,
    order: 10,
    component: AutomationsSection,
  });
});
