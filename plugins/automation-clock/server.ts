import { defineRpcContract, type BbPluginApi } from '@get-bb/plugin-sdk';
import { z } from 'zod';

const bound = z.object({ threadId: z.string(), names: z.array(z.string()).max(20) });
export type BoundThread = z.infer<typeof bound>;

export const rpcContract = defineRpcContract({
  bound: { input: z.null(), output: z.array(bound).max(500) },
});

// Only the fields we read from the built-in automations plugin; everything else passes through.
const overview = z.object({
  automations: z.array(z.object({
    automation: z.object({
      name: z.string(),
      enabled: z.boolean(),
      lastRunThreadId: z.string().nullable().optional(),
      execution: z.object({ targetThreadId: z.string().optional() }).passthrough(),
    }).passthrough(),
  }).passthrough()),
}).passthrough();

export default function plugin(bb: BbPluginApi) {
  bb.rpc.register(rpcContract, {
    async bound() {
      const { automations } = await bb.sdk.plugins.callRpc({
        pluginId: 'automations', method: 'automations_overview', input: null, outputSchema: overview,
      });
      const threads = new Map<string, BoundThread>();
      for (const { automation: a } of automations) {
        // A bound automation runs in its target thread; one that starts a new thread per run marks its latest.
        const threadId = a.execution.targetThreadId ?? a.lastRunThreadId;
        if (!a.enabled || !threadId) continue;
        const entry = threads.get(threadId) ?? { threadId, names: [] };
        if (entry.names.length < 20) entry.names.push(a.name);
        threads.set(threadId, entry);
      }
      return [...threads.values()].slice(0, 500);
    },
  });
}
