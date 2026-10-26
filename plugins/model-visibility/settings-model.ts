import type { HiddenMap, MenuModel } from './contract';

export function providerHidden(hidden: HiddenMap, providerId: string): Set<string> {
  return new Set(hidden[providerId] ?? []);
}

export function withModel(
  hidden: HiddenMap,
  providerId: string,
  modelId: string,
  checked: boolean,
): HiddenMap {
  const ids = providerHidden(hidden, providerId);
  if (checked) ids.add(modelId);
  else ids.delete(modelId);
  const next: HiddenMap = { ...hidden };
  if (ids.size === 0) delete next[providerId];
  else next[providerId] = [...ids];
  return next;
}

/** Hide every currently listed model for one provider, preserving unrelated mappings. */
export function hideAllForProvider(
  hidden: HiddenMap,
  providerId: string,
  models: readonly MenuModel[],
): HiddenMap {
  const ids = providerHidden(hidden, providerId);
  for (const model of models) ids.add(model.id);
  const next: HiddenMap = { ...hidden };
  if (ids.size === 0) delete next[providerId];
  else next[providerId] = [...ids];
  return next;
}

export function clearProvider(hidden: HiddenMap, providerId: string): HiddenMap {
  if (hidden[providerId] === undefined) return hidden;
  const next = { ...hidden };
  delete next[providerId];
  return next;
}
