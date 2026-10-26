import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  catalogSchema,
  hiddenMapSchema,
  type Catalog,
  type HiddenMap,
  type MenuModel,
  type MenuProvider,
} from './contract';
import { SETTINGS_CHANGED_EVENT } from './content';
import { clearProvider, hideAllForProvider, providerHidden, withModel } from './settings-model';

const PLUGIN_ID = 'model-visibility';

function modelMatches(provider: MenuProvider, model: MenuModel, query: string): boolean {
  if (query.length === 0) return true;
  return model.id.toLowerCase().includes(query)
    || model.displayName.toLowerCase().includes(query)
    || (model.routeProviderId?.toLowerCase().includes(query) ?? false)
    || provider.displayName.toLowerCase().includes(query);
}

export function ModelVisibilitySettings() {
  const [providers, setProviders] = useState<MenuProvider[]>([]);
  const [hidden, setHidden] = useState<HiddenMap>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/v1/plugins/${PLUGIN_ID}/rpc/catalog`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: 'null',
          signal: controller.signal,
        });
        const payload = await response.json() as { ok?: boolean; result?: unknown; error?: { message?: string } };
        if (!response.ok || !payload.ok || payload.result === undefined) {
          throw new Error(payload.error?.message ?? 'Could not load providers');
        }
        const catalog: Catalog = catalogSchema.parse(payload.result);
        setProviders(catalog.providers);
        setHidden(catalog.hidden);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load providers');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleProviders = useMemo(
    () => providers
      .map((provider) => ({
        provider,
        models: provider.models.filter((model) => modelMatches(provider, model, normalizedQuery)),
      }))
      .filter((entry) => entry.models.length > 0 || (normalizedQuery.length === 0 && entry.provider.models.length === 0)),
    [normalizedQuery, providers],
  );

  const save = async (next: HiddenMap, previous: HiddenMap) => {
    setSaving(true);
    setError(null);
    setHidden(next);
    try {
      const response = await fetch(`/api/v1/plugins/${PLUGIN_ID}/rpc/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hidden: next }),
      });
      const payload = await response.json() as { ok?: boolean; result?: unknown; error?: { message?: string } };
      if (!response.ok || !payload.ok || payload.result === undefined) {
        throw new Error(payload.error?.message ?? 'Could not save hidden models');
      }
      setHidden(hiddenMapSchema.parse(payload.result));
      window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
    } catch (cause) {
      setHidden(previous);
      setError(cause instanceof Error ? cause.message : 'Could not save hidden models');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (providerId: string, modelId: string, checked: boolean) => {
    if (saving) return;
    void save(withModel(hidden, providerId, modelId, checked), hidden);
  };

  const showAll = (providerId: string) => {
    if (saving || !hidden[providerId]?.length) return;
    void save(clearProvider(hidden, providerId), hidden);
  };

  const hideAll = (providerId: string, models: readonly MenuModel[]) => {
    if (saving || models.length === 0) return;
    void save(hideAllForProvider(hidden, providerId, models), hidden);
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs leading-5 text-muted-foreground">
          Checked models leave the main picker. They stay available in <span className="font-medium text-foreground">More models</span> and search.
        </p>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter models"
          aria-label="Filter models"
          className="h-8 w-full text-xs sm:w-56"
        />
      </div>

      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
      {loading ? <p className="text-xs text-muted-foreground">Loading providers...</p> : null}
      {!loading && visibleProviders.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {providers.length === 0 ? 'No enabled providers.' : 'No models match this filter.'}
        </p>
      ) : null}

      {visibleProviders.length > 0 ? (
        <div className="flex flex-col">
          {visibleProviders.map(({ provider, models }, providerIndex) => {
            const hiddenForProvider = providerHidden(hidden, provider.id);
            const allHidden = provider.models.length > 0
              && provider.models.every((model) => hiddenForProvider.has(model.id));
            return (
              <section
                key={provider.id}
                className={providerIndex === 0 ? 'pb-3' : 'border-t border-border py-3'}
              >
                <header className="flex min-h-7 flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <h3 className="truncate text-sm font-medium text-foreground">{provider.displayName}</h3>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {hiddenForProvider.size === 0
                        ? 'All visible'
                        : `${hiddenForProvider.size} hidden`}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
                      onClick={() => hideAll(provider.id, provider.models)}
                      disabled={saving || allHidden || provider.models.length === 0 || provider.error !== undefined}
                    >
                      Hide all
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
                      onClick={() => showAll(provider.id)}
                      disabled={saving || hiddenForProvider.size === 0}
                    >
                      Show all
                    </Button>
                  </div>
                </header>
                {provider.error ? <p className="mt-1 text-xs text-destructive">{provider.error}</p> : null}
                <ul className="mt-1 flex flex-col">
                  {models.map((model, modelIndex) => {
                    const checked = hiddenForProvider.has(model.id);
                    const id = `mv-${providerIndex}-${modelIndex}`;
                    return (
                      <li
                        key={model.id}
                        className="flex items-center justify-between gap-3 rounded-sm px-1 py-1.5 hover:bg-state-hover"
                      >
                        <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                          <Checkbox
                            id={id}
                            checked={checked}
                            disabled={saving}
                            onCheckedChange={(next) => toggle(provider.id, model.id, next === true)}
                          />
                          <span className="truncate text-sm text-foreground">{model.displayName}</span>
                          {model.routeProviderId ? (
                            <span className="shrink-0 text-xs text-muted-foreground">{model.routeProviderId}</span>
                          ) : null}
                        </label>
                        <code
                          className="max-w-[45%] shrink-0 truncate text-right text-xs text-muted-foreground/80"
                          title={model.id}
                        >
                          {model.id}
                        </code>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}

      {saving ? <p className="text-xs text-muted-foreground">Saving...</p> : null}

      <details className="border-t border-border pt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground">
          Advanced: hidden model IDs (JSON)
        </summary>
        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-3 text-xs text-foreground">
          {JSON.stringify(hidden, null, 2)}
        </pre>
      </details>
    </div>
  );
}
