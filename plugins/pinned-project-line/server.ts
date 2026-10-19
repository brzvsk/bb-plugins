import { defineRpcContract, type BbPluginApi } from '@get-bb/plugin-sdk';
import { z } from 'zod';

export const rpcContract = defineRpcContract({
  pinned: {
    input: z.null(),
    output: z.array(z.object({ id: z.string(), project: z.string() })).max(500),
  },
});

export default function plugin(bb: BbPluginApi) {
  bb.rpc.register(rpcContract, {
    async pinned() {
      const [threads, projects] = await Promise.all([
        bb.sdk.threads.list({ archived: false, includeHidden: false }),
        bb.sdk.projects.list(),
      ]);
      const names = new Map(projects.map(p => [p.id, p.name]));
      return threads
        .filter(t => t.pinnedAt !== null && t.deletedAt === null && names.has(t.projectId))
        .slice(0, 500)
        .map(t => ({ id: t.id, project: names.get(t.projectId)! }));
    },
  });
}
