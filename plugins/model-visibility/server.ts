import type { BbPluginApi } from '@get-bb/plugin-sdk';
import {
  rpcContract,
  type Catalog,
  type HiddenMap,
  type MenuProvider,
} from './contract';

const KV_KEY = 'hiddenModels';
const MAX_PROVIDER_IDS = 100;
const MAX_MODEL_IDS = 500;
const MODEL_CACHE_TTL_MS = 30_000;

function sanitizeHidden(value: unknown): HiddenMap {
  if (typeof value === 'string') {
    try {
      return sanitizeHidden(JSON.parse(value));
    } catch {
      return {};
    }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const out: HiddenMap = {};
  for (const [rawProviderId, rawIds] of Object.entries(value).slice(0, MAX_PROVIDER_IDS)) {
    const providerId = rawProviderId.trim();
    if (!providerId || providerId.length > 100 || !Array.isArray(rawIds)) continue;
    const ids = [...new Set(
      rawIds
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter((id) => id.length > 0 && id.length <= 300),
    )].slice(0, MAX_MODEL_IDS);
    if (ids.length > 0) out[providerId] = ids;
  }
  return out;
}


export function mergeModelIds(
  models: readonly { model: string; displayName: string; routeProviderId?: string }[],
) {
  return models.map((model) => ({
    id: model.model,
    displayName: model.displayName || model.model,
    ...(model.routeProviderId ? { routeProviderId: model.routeProviderId } : {}),
  }));
}

export default function plugin(bb: BbPluginApi) {
  const modelCache = new Map<string, { at: number; value: Pick<MenuProvider, 'models' | 'more' | 'error'> }>();

  async function readHidden(): Promise<HiddenMap> {
    return sanitizeHidden(await bb.storage.kv.get<unknown>(KV_KEY));
  }

  async function modelsFor(providerId: string): Promise<Pick<MenuProvider, 'models' | 'more' | 'error'>> {
    const cached = modelCache.get(providerId);
    if (cached && Date.now() - cached.at < MODEL_CACHE_TTL_MS) return cached.value;
    let value: Pick<MenuProvider, 'models' | 'more' | 'error'>;
    try {
      const options = await bb.sdk.providers.models({ providerId });
      value = {
        models: mergeModelIds(options.models),
        more: mergeModelIds(options.selectedOnlyModels),
        ...(options.modelLoadError
          ? { error: options.modelLoadError.detail ?? options.modelLoadError.code }
          : {}),
      };
    } catch (error) {
      value = {
        models: [],
        more: [],
        error: error instanceof Error ? error.message : 'Could not load models',
      };
    }
    modelCache.set(providerId, { at: Date.now(), value });
    return value;
  }

  async function providerCatalog(): Promise<MenuProvider[]> {
    // The roster changes when the user toggles a provider, so never cache it.
    const catalog = await bb.sdk.providers.catalog();
    const enabled = catalog.filter((provider) => provider.enabled && provider.pluginEnabled);
    return Promise.all(enabled.map(async (provider): Promise<MenuProvider> => {
      const base = {
        id: provider.id,
        displayName: provider.displayName,
        ...(provider.info?.strings?.brandPrefix
          ? { brandPrefix: provider.info.strings.brandPrefix }
          : {}),
      };
      return { ...base, ...(await modelsFor(provider.id)) };
    }));
  }

  bb.rpc.register(rpcContract, {
    async catalog() {
      const [providers, hidden] = await Promise.all([providerCatalog(), readHidden()]);
      const result: Catalog = { providers, hidden };
      return result;
    },
    async save({ hidden }) {
      const clean = sanitizeHidden(hidden);
      await bb.storage.kv.set(KV_KEY, clean);
      return clean;
    },
  });
}
