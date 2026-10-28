import { describe, expect, it } from 'vitest';
import {
  childExecutionFromEvent,
  childLabelFromExecution,
  formatChildThreadLabel,
  humanizeModelId,
  humanizeReasoningLevel,
  type ModelCatalog,
} from './label';

const catalog: ModelCatalog = {
  providers: [
    {
      id: 'opencode-go',
      displayName: 'OpenCode Go',
      reasoningLevels: [{ id: 'high', label: 'High' }],
    },
  ],
  models: [
    {
      id: 'opencode-go/deepseek-v4.1-flash',
      model: 'opencode-go/deepseek-v4.1-flash',
      displayName: 'OpenCode Go/DeepSeek V4.1 Flash',
      supportedReasoningEfforts: [
        { reasoningEffort: 'high', label: 'High' },
        { reasoningEffort: 'xhigh', label: 'Extra high' },
      ],
    },
  ],
};

describe('child execution metadata', () => {
  it('reads the model and reasoning level recorded for a dispatched child turn', () => {
    expect(
      childExecutionFromEvent({
        type: 'client/turn/requested',
        data: { execution: { model: 'gpt-5.6-sol', reasoningLevel: 'high' } },
      }),
    ).toEqual({ model: 'gpt-5.6-sol', reasoningLevel: 'high' });
  });

  it('treats missing or foreign event metadata as unknown instead of inventing a model', () => {
    expect(childExecutionFromEvent(undefined)).toBeNull();
    expect(childExecutionFromEvent({ type: 'turn/started', data: { execution: { model: 'gpt-5.6' } } })).toBeNull();
    expect(childExecutionFromEvent({ type: 'client/turn/requested', data: {} })).toBeNull();
    expect(
      childExecutionFromEvent({
        type: 'client/turn/requested',
        data: { execution: { model: '   ', reasoningLevel: 'high' } },
      }),
    ).toBeNull();
  });

  it('keeps a known model when the provider reports no reasoning level', () => {
    expect(
      childExecutionFromEvent({
        type: 'client/turn/requested',
        data: { execution: { model: 'gpt-5.6-sol', reasoningLevel: null } },
      }),
    ).toEqual({ model: 'gpt-5.6-sol', reasoningLevel: null });
  });
});

describe('child label display', () => {
  it('uses the provider catalog display name and the provider reasoning label', () => {
    const label = childLabelFromExecution(
      'thr_child',
      { model: 'opencode-go/deepseek-v4.1-flash', reasoningLevel: 'xhigh' },
      'opencode-go',
      catalog,
    );
    expect(label).toMatchObject({
      model: 'opencode-go/deepseek-v4.1-flash',
      modelLabel: 'DeepSeek V4.1 Flash',
      reasoningLevel: 'xhigh',
      reasoningLabel: 'Extra high',
    });
    expect(formatChildThreadLabel(label)).toBe('DeepSeek V4.1 Flash · Extra high');
  });

  it('falls back to a conservative readable id when the catalog has no display name', () => {
    expect(humanizeModelId('opencode-go/deepseek-v4.1-flash')).toBe('DeepSeek V4.1 Flash');
    expect(humanizeModelId('gpt-5.6-sol')).toBe('GPT 5.6 Sol');
    expect(humanizeModelId('claude-opus-5-5[1m]')).toBe('Claude Opus 5 5[1m]');
    expect(humanizeReasoningLevel('xhigh')).toBe('Extra High');
    expect(humanizeReasoningLevel('provider_specific')).toBe('Provider Specific');
    expect(
      childLabelFromExecution(
        'thr_child',
        { model: 'opencode-go/deepseek-v4.1-flash', reasoningLevel: 'high' },
        'opencode-go',
        null,
      ),
    ).toMatchObject({ modelLabel: 'DeepSeek V4.1 Flash', reasoningLabel: 'High' });
  });

  it('formats model only when no reasoning level is known', () => {
    expect(
      formatChildThreadLabel({
        model: 'gpt-5.6-sol',
        modelLabel: 'GPT 5.6 Sol',
        reasoningLevel: null,
        reasoningLabel: null,
      }),
    ).toBe('GPT 5.6 Sol');
  });
});
