import {
  definePluginApp,
  experimental_THREAD_INFO_ROW_GROUPS,
  experimental_THREAD_INFO_SECTION_GROUPS,
  experimental_ThreadContextCardRow as CardRow,
  experimental_useRpcKeyedQuery,
  experimental_useRpcQuery,
  useBbNavigate,
  type ExperimentalThreadContextCardProps,
} from "@get-bb/plugin-sdk/app";
import { automationsContract, gitContract } from "./contracts";
import { automationStatus, branchView } from "./format";

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
  const navigate = useBbNavigate();
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
          onClick={() => navigate.toPluginPanel("automations", { subPath: `${a.projectId}/${a.id}` })}
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
