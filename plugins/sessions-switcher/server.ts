import { defineRpcContract, type BbPluginApi } from '@get-bb/plugin-sdk';
import { z } from 'zod';

export const rpcContract = defineRpcContract({
  recent: {
    input: z.object({ ids: z.array(z.string().max(200)).max(50) }),
    output: z.array(z.object({ id: z.string(), projectId: z.string(), title: z.string(), project: z.string(), status: z.string() })).max(7),
  },
});
export default function plugin(bb: BbPluginApi) {
  bb.rpc.register(rpcContract, {
    async recent({ ids }) {
      const [threads, projects] = await Promise.all([
        bb.sdk.threads.list({ archived: false, includeHidden: false }),
        bb.sdk.projects.list(),
      ]);
      const names = new Map(projects.map(p => [p.id, p.name]));
      const rank = new Map([...new Set(ids)].map((id, i) => [id, i]));
      return threads.filter(t => t.visibility === 'visible' && t.archivedAt === null && t.deletedAt === null)
        .sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || b.updatedAt - a.updatedAt)
        .slice(0, 7).map(t => ({ id: t.id, projectId: t.projectId,
          title: t.title ?? t.titleFallback ?? 'Untitled session',
          project: names.get(t.projectId) ?? 'Personal', status: t.status }));
    },
  });
}
