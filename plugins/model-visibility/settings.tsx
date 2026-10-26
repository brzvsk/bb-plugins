import { useEffect, useMemo, useState } from 'react';
import {
  catalogSchema,
  hiddenMapSchema,
  type Catalog,
  type HiddenMap,
  type MenuProvider,
} from './contract';
import { SETTINGS_CHANGED_EVENT } from './content';

const PLUGIN_ID = 'model-visibility';

function providerHidden(hidden: HiddenMap, providerId: string): Set<string> {
  return new Set(hidden[providerId] ?? []);
}

function withModel(hidden: HiddenMap, providerId: string, modelId: string, checked: boolean): HiddenMap {
  const ids = providerHidden(hidden, providerId);
  if (checked) ids.add(modelId);
  else ids.delete(modelId);
  const next: HiddenMap = { ...hidden };
  if (ids.size === 0) delete next[providerId];
  else next[providerId] = [...ids];
  return next;
}

function modelMatches(provider: MenuProvider, model: MenuProvider['models'][number], query: string): boolean {
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

  const clearProvider = (providerId: string) => {
    if (saving || !hidden[providerId]?.length) return;
    const next = { ...hidden };
    delete next[providerId];
    void save(next, hidden);
  };

  return (
    <div className="mv-settings">
      <div className="mv-settings-intro">
        <p>
          Hidden models leave the main list and stay in <strong>More models</strong> and search.
          New models stay visible until you hide them.
        </p>
        <input
          className="mv-settings-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter providers or models"
          aria-label="Filter providers or models"
        />
      </div>

      {error ? <p className="mv-settings-error" role="alert">{error}</p> : null}
      {loading ? <p className="mv-settings-muted">Loading providers...</p> : null}
      {!loading && visibleProviders.length === 0 ? (
        <p className="mv-settings-muted">
          {providers.length === 0 ? 'No enabled providers.' : 'No models match this filter.'}
        </p>
      ) : null}

      {visibleProviders.map(({ provider, models }) => {
        const hiddenForProvider = providerHidden(hidden, provider.id);
        return (
          <section className="mv-provider" key={provider.id}>
            <header className="mv-provider-header">
              <div>
                <h3>{provider.displayName}</h3>
                <p className="mv-settings-muted">
                  {hiddenForProvider.size === 0
                    ? 'All models visible'
                    : `${hiddenForProvider.size} hidden`}
                </p>
              </div>
              <button
                type="button"
                className="mv-settings-button"
                onClick={() => clearProvider(provider.id)}
                disabled={saving || hiddenForProvider.size === 0}
              >
                Show all
              </button>
            </header>
            {provider.error ? <p className="mv-settings-error">{provider.error}</p> : null}
            <ul className="mv-model-list">
              {models.map((model) => {
                const checked = hiddenForProvider.has(model.id);
                return (
                  <li key={model.id} className="mv-model-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={saving}
                        onChange={(event) => toggle(provider.id, model.id, event.target.checked)}
                      />
                      <span className="mv-model-name">{model.displayName}</span>
                      {model.routeProviderId ? (
                        <span className="mv-model-qualifier">{model.routeProviderId}</span>
                      ) : null}
                    </label>
                    <code>{model.id}</code>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {saving ? <p className="mv-settings-muted">Saving...</p> : null}
    </div>
  );
}
