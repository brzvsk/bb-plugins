export interface ChildThreadExecution {
  model: string;
  reasoningLevel: string | null;
}

export interface ChildThreadDisplay {
  model: string;
  modelLabel: string;
  reasoningLevel: string | null;
  reasoningLabel: string | null;
}

export interface ChildThreadLabel extends ChildThreadDisplay {
  threadId: string;
}

export interface ThreadEventLike {
  type: string;
  data: unknown;
}

export interface CatalogModel {
  id: string;
  model: string;
  displayName: string;
  supportedReasoningEfforts: readonly { reasoningEffort: string; label?: string }[];
}

export interface CatalogProvider {
  id: string;
  displayName?: string;
  reasoningLevels?: readonly { id: string; label?: string }[];
}

export interface ModelCatalog {
  models: readonly CatalogModel[];
  providers: readonly CatalogProvider[];
}

const STANDARD_REASONING_LABELS: Record<string, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra High',
  ultracode: 'Ultracode',
  max: 'Max',
  ultra: 'Ultra',
};

const KNOWN_MODEL_WORDS: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  deepseek: 'DeepSeek',
  flash: 'Flash',
  gemini: 'Gemini',
  gpt: 'GPT',
  haiku: 'Haiku',
  kimi: 'Kimi',
  llama: 'Llama',
  max: 'Max',
  mini: 'Mini',
  mistral: 'Mistral',
  nano: 'Nano',
  opus: 'Opus',
  pro: 'Pro',
  qwen: 'Qwen',
  reasoner: 'Reasoner',
  sol: 'Sol',
  sonnet: 'Sonnet',
  thinking: 'Thinking',
};

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function capitalize(word: string): string {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

/** Reads the execution tuple BB recorded for a child's last dispatched turn. */
export function childExecutionFromEvent(event: ThreadEventLike | undefined | null): ChildThreadExecution | null {
  if (event?.type !== 'client/turn/requested') return null;
  const data = event.data;
  if (data === null || typeof data !== 'object') return null;
  const execution = (data as { execution?: unknown }).execution;
  if (execution === null || typeof execution !== 'object') return null;
  const model = nonEmptyString((execution as { model?: unknown }).model);
  if (model === null) return null;
  return {
    model,
    reasoningLevel: nonEmptyString((execution as { reasoningLevel?: unknown }).reasoningLevel),
  };
}

/** A conservative readable fallback for a model id the provider catalog does not name. */
export function humanizeModelId(model: string): string {
  const bare = model.slice(model.lastIndexOf('/') + 1);
  const bracket = /(\[[^\]]*\])$/u.exec(bare);
  const core = bracket === null ? bare : bare.slice(0, -bracket[1]!.length);
  const words = core
    .split(/[\s_-]+/u)
    .filter(word => word !== '')
    .map(word => {
      const known = KNOWN_MODEL_WORDS[word.toLowerCase()];
      if (known !== undefined) return known;
      if (/^v\d+(?:\.\d+)*$/iu.test(word)) return `V${word.slice(1)}`;
      if (/^\d+(?:\.\d+)*$/u.test(word)) return word;
      return capitalize(word);
    });
  return `${words.join(' ')}${bracket?.[1] ?? ''}`;
}

/** BB's standard reasoning labels, then a readable fallback for provider-specific levels. */
export function humanizeReasoningLevel(level: string): string {
  return STANDARD_REASONING_LABELS[level] ?? level.split(/[\s_-]+/u).filter(Boolean).map(capitalize).join(' ');
}

function cleanCatalogDisplayName(
  displayName: string,
  rawModel: string,
  providerDisplayName: string | undefined,
): string {
  let label = displayName.trim();
  const provider = providerDisplayName?.trim();
  if (provider !== undefined && provider !== '') {
    const prefix = `${provider}/`;
    if (label.startsWith(prefix)) label = label.slice(prefix.length).trim();
  }
  if (label === '' || label === rawModel) return humanizeModelId(rawModel);
  if (rawModel.includes('/') && label.includes('/')) label = label.slice(label.lastIndexOf('/') + 1).trim();
  return label === '' ? humanizeModelId(rawModel) : label;
}

function modelMatches(rawModel: string, model: CatalogModel): boolean {
  return model.model === rawModel || model.id === rawModel;
}

function findCatalogModel(catalog: ModelCatalog | null, rawModel: string): CatalogModel | null {
  if (catalog === null) return null;
  const exact = catalog.models.find(model => modelMatches(rawModel, model));
  if (exact !== undefined) return exact;
  const suffix = catalog.models.filter(model => rawModel.endsWith(`/${model.model}`));
  if (suffix.length === 1) return suffix[0]!;
  const prefixed = catalog.models.filter(model => model.model.endsWith(`/${rawModel}`));
  return prefixed.length === 1 ? prefixed[0]! : null;
}

function resolveReasoningLabel(
  level: string,
  providerId: string,
  model: CatalogModel | null,
  catalog: ModelCatalog | null,
): string {
  return (
    model?.supportedReasoningEfforts.find(effort => effort.reasoningEffort === level)?.label?.trim() ||
    catalog?.providers.find(provider => provider.id === providerId)?.reasoningLevels?.find(option => option.id === level)?.label?.trim() ||
    humanizeReasoningLevel(level)
  );
}

/** Combines raw execution facts with provider-catalog labels, never with another thread's model. */
export function childLabelFromExecution(
  threadId: string,
  execution: ChildThreadExecution,
  providerId: string,
  catalog: ModelCatalog | null,
): ChildThreadLabel {
  const model = findCatalogModel(catalog, execution.model);
  const providerDisplayName = catalog?.providers.find(provider => provider.id === providerId)?.displayName;
  const displayName = model?.displayName;
  return {
    threadId,
    model: execution.model,
    modelLabel:
      displayName === undefined
        ? humanizeModelId(execution.model)
        : cleanCatalogDisplayName(displayName, execution.model, providerDisplayName),
    reasoningLevel: execution.reasoningLevel,
    reasoningLabel:
      execution.reasoningLevel === null ? null : resolveReasoningLabel(execution.reasoningLevel, providerId, model, catalog),
  };
}

/** "DeepSeek V4.1 Flash · High" when a level is known, otherwise just the model label. */
export function formatChildThreadLabel(display: ChildThreadDisplay): string {
  return display.reasoningLabel === null ? display.modelLabel : `${display.modelLabel} · ${display.reasoningLabel}`;
}

/** Raw identifiers for the label's tooltip, while the compact text stays readable. */
export function childThreadLabelTitle(display: ChildThreadDisplay): string {
  return display.reasoningLevel === null
    ? `Model: ${display.model}`
    : `Model: ${display.model} · Reasoning: ${display.reasoningLevel}`;
}
