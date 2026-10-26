import { describe, expect, it } from 'vitest';
import plugin, { mergeModelIds } from './server';

describe('model visibility settings', () => {
  it('keeps model IDs and display labels from the provider catalog', () => {
    expect(mergeModelIds([
      { model: 'vendor/model', displayName: 'Friendly', routeProviderId: 'route' },
      { model: 'plain', displayName: '' },
    ])).toEqual([
      { id: 'vendor/model', displayName: 'Friendly', routeProviderId: 'route' },
      { id: 'plain', displayName: 'plain' },
    ]);
  });

  it('lists enabled providers, returns hidden IDs, and saves without touching disabled provider entries', async () => {
    let stored: unknown = JSON.stringify({
      'provider-a': ['alpha', 'alpha', '', 42],
      'provider-disabled': ['remembered'],
      empty: [],
    });
    let handlers!: Record<string, (input: never) => Promise<unknown>>;
    const asked: string[] = [];

    plugin({
      storage: {
        kv: {
          get: async () => stored,
          set: async (_key: string, value: unknown) => {
            stored = value;
          },
        },
      },
      rpc: {
        register(_contract: unknown, registered: Record<string, (input: never) => Promise<unknown>>) {
          handlers = registered;
        },
      },
      sdk: {
        providers: {
          catalog: async () => [
            {
              id: 'provider-a',
              displayName: 'Provider A',
              enabled: true,
              info: { strings: { brandPrefix: 'Vendor ' } },
            },
            {
              id: 'provider-disabled',
              displayName: 'Provider B',
              enabled: false,
              info: null,
            },
          ],
          models: async ({ providerId }: { providerId: string }) => {
            asked.push(providerId);
            return {
              models: [{ model: 'alpha', displayName: 'Vendor Alpha', isDefault: true }],
              selectedOnlyModels: [{ model: 'legacy', displayName: 'Legacy' }],
              modelLoadError: null,
            };
          },
        },
      },
    } as never);

    const catalog = await handlers.catalog(null as never) as {
      providers: { id: string; brandPrefix?: string; models: { id: string }[]; more: { id: string }[] }[];
      hidden: Record<string, string[]>;
    };
    expect(asked).toEqual(['provider-a']);
    expect(catalog.providers.map((provider) => provider.id)).toEqual(['provider-a']);
    expect(catalog.providers[0]?.brandPrefix).toBe('Vendor ');
    expect(catalog.providers[0]?.models.map((model) => model.id)).toEqual(['alpha']);
    expect(catalog.providers[0]?.more.map((model) => model.id)).toEqual(['legacy']);
    expect(catalog.hidden).toEqual({
      'provider-a': ['alpha'],
      'provider-disabled': ['remembered'],
    });

    const saved = await handlers.save({
      hidden: {
        'provider-a': ['beta', 'beta'],
        'provider-disabled': ['remembered'],
        empty: [],
      },
    } as never);
    expect(saved).toEqual({
      'provider-a': ['beta'],
      'provider-disabled': ['remembered'],
    });
    expect(stored).toEqual(saved);
  });
});
