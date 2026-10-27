import { defineRpcContract, type BbPluginApi } from '@get-bb/plugin-sdk';
import { z } from 'zod';

const automationThread = z.object({
  threadId: z.string(),
  unread: z.boolean(),
  names: z.array(z.string()).max(20),
  /** The soonest next run among the thread's enabled automations, epoch ms. */
  nextRunAt: z.number().nullable(),
});

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
      name: z.string(),
      enabled: z.boolean(),
      nextRunAt: z.number().nullable().optional(),
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
      const bound = new Map<string, { names: string[]; nextRunAt: number | null }>();
      for (const { automation: a } of automations) {
        const threadId = a.execution.targetThreadId ?? a.lastRunThreadId;
        if (!a.enabled || !threadId) continue;
        const entry = bound.get(threadId) ?? { names: [], nextRunAt: null };
        if (entry.names.length < 20) entry.names.push(a.name);
        const next = a.nextRunAt ?? null;
        if (next !== null && (entry.nextRunAt === null || next < entry.nextRunAt)) entry.nextRunAt = next;
        bound.set(threadId, entry);
      }
      return threads
        .filter(t => bound.has(t.id) && t.deletedAt === null && t.archivedAt === null)
        .slice(0, 500)
        .map(t => ({ threadId: t.id, unread: (t.lastReadAt ?? 0) < t.latestAttentionAt, ...bound.get(t.id)! }));
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
