import { defineRpcContract, type BbPluginApi } from '@get-bb/plugin-sdk';
import { z } from 'zod';

const automationThread = z.object({ threadId: z.string(), unread: z.boolean() });

const archivedThread = z.object({
  threadId: z.string(),
  projectId: z.string(),
  sectionId: z.string().nullable(),
  title: z.string(),
  archivedAt: z.number(),
});

export const rpcContract = defineRpcContract({
  automationThreads: { input: z.null(), output: z.array(automationThread).max(500) },
  recentlyArchived: { input: z.null(), output: z.array(archivedThread).max(200) },
  unarchive: { input: z.object({ threadId: z.string().regex(/^thr_[A-Za-z0-9]+$/) }), output: z.null() },
});

/** How far back Recently archived reaches. */
const RECENT_MS = 48 * 60 * 60 * 1000;

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
      const [{ automations }, threads] = await Promise.all([
        bb.sdk.plugins.callRpc({ pluginId: 'automations', method: 'automations_overview', input: null, outputSchema: overview }),
        bb.sdk.threads.list({ archived: false, includeHidden: false }),
      ]);
      // Same binding as Automation Clock: the target thread, else the latest run thread of a per-run automation.
      const bound = new Set<string>();
      for (const { automation: a } of automations) {
        const threadId = a.execution.targetThreadId ?? a.lastRunThreadId;
        if (a.enabled && threadId) bound.add(threadId);
      }
      return threads
        .filter(t => bound.has(t.id) && t.deletedAt === null && t.archivedAt === null)
        .slice(0, 500)
        .map(t => ({ threadId: t.id, unread: (t.lastReadAt ?? 0) < t.latestAttentionAt }));
    },
    async recentlyArchived() {
      const since = Date.now() - RECENT_MS;
      // Root threads only: archived subagent children would bury the threads you worked in.
      const threads = await bb.sdk.threads.list({ archived: true, hasParent: false, limit: 500 });
      return threads
        .filter(t => t.archivedAt !== null && t.archivedAt >= since && t.deletedAt === null)
        .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0))
        .slice(0, 200)
        .map(t => ({
          threadId: t.id,
          projectId: t.projectId,
          sectionId: t.sectionId ?? null,
          title: t.title ?? t.titleFallback ?? t.id,
          archivedAt: t.archivedAt ?? 0,
        }));
    },
    async unarchive({ threadId }) {
      await bb.sdk.threads.unarchive({ threadId });
      return null;
    },
  });
}
