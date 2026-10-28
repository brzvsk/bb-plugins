import { defineRpcContract, type BbPluginApi } from '@get-bb/plugin-sdk';
import { z } from 'zod';
import { childExecutionFromEvent, childLabelFromExecution, type ChildThreadLabel, type ModelCatalog } from './label';

const MAX_THREADS_PER_REQUEST = 100;
const MAX_CONCURRENT_LOOKUPS = 6;
const CATALOG_TTL_MS = 60_000;
const FAILED_CATALOG_TTL_MS = 30_000;

export const rpcContract = defineRpcContract({
  childThreadModels: {
    input: z.object({ threadIds: z.array(z.string().min(1).max(200)).min(1).max(MAX_THREADS_PER_REQUEST) }),
    output: z.object({
      labels: z.array(
        z.object({
          threadId: z.string(),
          model: z.string(),
          modelLabel: z.string(),
          reasoningLevel: z.string().nullable(),
          reasoningLabel: z.string().nullable(),
        }),
      ),
    }),
  },
});

async function mapLimit<T, R>(items: readonly T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

export default function plugin(bb: BbPluginApi) {
  type CatalogResult = Awaited<ReturnType<BbPluginApi['sdk']['providers']['models']>>;
  const catalogs = new Map<string, { expiresAt: number; value: ModelCatalog | null }>();
  const inflightCatalogs = new Map<string, Promise<ModelCatalog | null>>();

  const catalogFor = async (input: { environmentId: string | null; projectId: string; providerId: string }): Promise<ModelCatalog | null> => {
    const scope = input.environmentId === null ? `project:${input.projectId}` : `environment:${input.environmentId}`;
    const key = `${input.providerId}\0${scope}`;
    const cached = catalogs.get(key);
    if (cached !== undefined && cached.expiresAt > Date.now()) return cached.value;

    const pending = inflightCatalogs.get(key);
    if (pending !== undefined) return pending;

    const request = (async (): Promise<ModelCatalog | null> => {
      try {
        const result: CatalogResult =
          input.environmentId === null
            ? await bb.sdk.providers.models({ projectId: input.projectId, providerId: input.providerId })
            : await bb.sdk.providers.models({ environmentId: input.environmentId, providerId: input.providerId });
        return { models: result.models, providers: result.providers };
      } catch (error) {
        bb.log.debug(
          `could not load the ${input.providerId} model catalog: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      } finally {
        inflightCatalogs.delete(key);
      }
    })();

    inflightCatalogs.set(key, request);
    const value = await request;
    catalogs.set(key, {
      value,
      expiresAt: Date.now() + (value === null ? FAILED_CATALOG_TTL_MS : CATALOG_TTL_MS),
    });
    return value;
  };

  bb.onDispose(() => {
    catalogs.clear();
    inflightCatalogs.clear();
  });

  bb.rpc.register(rpcContract, {
    async childThreadModels({ threadIds }) {
      const unique = [...new Set(threadIds)];
      const labels = await mapLimit(unique, MAX_CONCURRENT_LOOKUPS, async (threadId): Promise<ChildThreadLabel | null> => {
        try {
          const [thread, rows] = await Promise.all([
            bb.sdk.threads.get({ threadId }),
            bb.sdk.threads.events.list({
              threadId,
              types: ['client/turn/requested'],
              order: 'desc',
              limit: '1',
            }),
          ]);
          const execution = childExecutionFromEvent(rows[0]);
          if (execution === null) return null;
          const catalog = await catalogFor({
            environmentId: thread.environmentId,
            projectId: thread.projectId,
            providerId: thread.providerId,
          });
          return childLabelFromExecution(threadId, execution, thread.providerId, catalog);
        } catch (error) {
          bb.log.debug(`could not read the last execution of ${threadId}: ${error instanceof Error ? error.message : String(error)}`);
          return null;
        }
      });
      return { labels: labels.filter((label): label is ChildThreadLabel => label !== null) };
    },
  });
}
