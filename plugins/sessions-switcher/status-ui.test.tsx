// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
const live = vi.hoisted(() => ({ threads: [{ id: 'a', indicator: 'runtime' }], draft: false, rowStatus: null as object | null }));
vi.mock('@get-bb/plugin-sdk/app', () => ({
 experimental_useSidebarThreads: () => ({ threads: live.threads }),
 experimental_useProviders: () => ({ providers: [] }),
 experimental_ProviderIcon: ({ provider }: any) => <span data-provider={provider.id} />,
 useSidebarThreadDraft: () => ({ hasUnsubmittedDraft: live.draft }),
 useSidebarThreadRowStatus: () => live.rowStatus,
 experimental_ThreadStatusGlyph: ({ indicator, rowStatus }: any) => <span data-host-glyph={indicator} data-row-status={rowStatus?.label} />,
}));
import { createStatusBridge, withDraft } from './status-ui';
it('renders the host glyph from live sidebar indicators and clears portals on close', async () => {
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
 const container = document.createElement('div'); const target = document.createElement('span');
 document.body.append(container, target); const root = createRoot(container); const bridge = createStatusBridge();
 try {
  await act(async () => { root.render(<bridge.Component />); bridge.setTargets([{ id: 'a', element: target }]); });
  expect(target.querySelector('[data-host-glyph]')?.getAttribute('data-host-glyph')).toBe('runtime');
  live.threads = [{ id: 'a', indicator: 'unread-success' }];
  await act(async () => { root.render(<bridge.Component />); });
  expect(target.querySelector('[data-host-glyph]')?.getAttribute('data-host-glyph')).toBe('unread-success');
  live.threads = [{ id: 'a', indicator: 'none' }];
  await act(async () => { root.render(<bridge.Component />); });
  expect(target.querySelector('[data-host-glyph]')?.getAttribute('data-host-glyph')).toBe('none');
  live.rowStatus = { label: 'Working on workflow', icon: 'Workflow', tone: 'running' };
  await act(async () => { root.render(<bridge.Component />); });
  expect(target.querySelector('[data-row-status]')?.getAttribute('data-row-status')).toBe('Working on workflow');
  await act(async () => { bridge.setTargets([]); }); expect(target.childElementCount).toBe(0);
 } finally { await act(async () => root.unmount()); container.remove(); target.remove(); vi.unstubAllGlobals(); }
});
it('keeps attention and unread precedence when a draft exists', () => {
 expect(withDraft('runtime', true)).toBe('working-draft');
 expect(withDraft('unread-error', true)).toBe('unread-error');
 expect(withDraft('waiting-for-input', true)).toBe('waiting-for-input');
 expect(withDraft('unread-success', true)).toBe('unread-success');
 expect(withDraft('none', true)).toBe('draft');
 expect(withDraft('none', false)).toBe('none');
});
