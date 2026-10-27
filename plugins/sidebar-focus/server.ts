import { defineRpcContract, type BbPluginApi } from '@get-bb/plugin-sdk';
import { z } from 'zod';

const automationThread = z.object({
  threadId: z.string(),
  title: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  sectionId: z.string().nullable(),
  pinned: z.boolean(),
  unread: z.boolean(),
  updatedAt: z.number(),
});

export const rpcContract = defineRpcContract({
  automationThreads: { input: z.null(), output: z.array(automationThread).max(500) },
});

// Only the fields we read from the built-in automations plugin; everything else passes through.
const overview = z.object({
  automations: z.array(z.object({
    automation: z.object({
      enabled: z.boolean(),
      lastRunThreadId: z.string().nullable().optional(),
      execution: z.object({ targetThreadId: z.string().optional() }).passthrough(),
    }).passthrough(),
  }).passthrough()),
}).passthrough();

export default function plugin(bb: BbPluginApi) {
  bb.rpc.register(rpcContract, {
    async automationThreads() {
      const [{ automations }, threads, projects] = await Promise.all([
        bb.sdk.plugins.callRpc({ pluginId: 'automations', method: 'automations_overview', input: null, outputSchema: overview }),
        bb.sdk.threads.list({ archived: false, includeHidden: false }),
        bb.sdk.projects.list(),
      ]);
      // Same binding as Automation Clock: the target thread, else the latest run thread of a per-run automation.
      const bound = new Set<string>();
      for (const { automation: a } of automations) {
        const threadId = a.execution.targetThreadId ?? a.lastRunThreadId;
        if (a.enabled && threadId) bound.add(threadId);
      }
      const names = new Map(projects.map(p => [p.id, p.name]));
      return threads
        .filter(t => bound.has(t.id) && t.deletedAt === null && t.archivedAt === null)
        .slice(0, 500)
        .map(t => ({
          threadId: t.id,
          title: t.title ?? t.titleFallback ?? t.id,
          projectId: t.projectId,
          projectName: names.get(t.projectId) ?? '',
          sectionId: t.sectionId ?? null,
          pinned: t.pinnedAt !== null,
          unread: (t.lastReadAt ?? 0) < t.latestAttentionAt,
          updatedAt: t.updatedAt,
        }));
    },
  });
}
