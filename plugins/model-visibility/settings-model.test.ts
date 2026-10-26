import { expect, it } from 'vitest';
import { clearProvider, hideAllForProvider, withModel } from './settings-model';

const models = [{ id: 'alpha', displayName: 'Alpha' }, { id: 'beta', displayName: 'Beta' }];

it('hides the full provider catalog while retaining other and disabled-provider mappings', () => {
  const hidden = {
    'provider-a': ['legacy-id'],
    codex: ['gpt-old'],
  };
  const next = hideAllForProvider(hidden, 'provider-a', models);
  expect(next).toEqual({
    'provider-a': ['legacy-id', 'alpha', 'beta'],
    codex: ['gpt-old'],
  });
  expect(hidden['provider-a']).toEqual(['legacy-id']);
});

it('hide all is a no-op for an empty catalog', () => {
  const hidden = { 'provider-a': ['legacy-id'] };
  expect(hideAllForProvider(hidden, 'provider-a', [])).toEqual(hidden);
});

it('show all clears only that provider and a checked model round-trips', () => {
  const hidden = { 'provider-a': ['alpha'], codex: ['gpt-old'] };
  expect(clearProvider(hidden, 'provider-a')).toEqual({ codex: ['gpt-old'] });
  expect(withModel(hidden, 'provider-a', 'beta', true)).toEqual({
    'provider-a': ['alpha', 'beta'],
    codex: ['gpt-old'],
  });
  expect(withModel(hidden, 'provider-a', 'alpha', false)).toEqual({ codex: ['gpt-old'] });
});
