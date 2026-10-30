import {
  definePluginApp,
  experimental_THREAD_INFO_ROW_GROUPS,
  experimental_THREAD_INFO_SECTION_GROUPS,
  experimental_ThreadContextCardRow as CardRow,
  experimental_useRpcKeyedQuery,
  experimental_useRpcQuery,
  type ExperimentalThreadContextCardProps,
} from "@get-bb/plugin-sdk/app";
import { automationsContract, gitContract } from "./contracts";
import { automationStatus, branchView } from "./format";

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
  const items = list.data ?? [];
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

export default definePluginApp(app => {
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
