// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { navigateToPluginSettings } from './content';

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

it('navigates to the plugin settings page through a router-compatible history event', () => {
  const listener = vi.fn();
  window.addEventListener('popstate', listener);
  window.history.replaceState({}, '', '/threads/thr_1');
  navigateToPluginSettings('model-visibility');
  expect(location.pathname).toBe('/settings/plugins/model-visibility');
  expect(location.search).toBe('?tab=settings');
  expect(listener).toHaveBeenCalledTimes(1);
  window.removeEventListener('popstate', listener);
});
