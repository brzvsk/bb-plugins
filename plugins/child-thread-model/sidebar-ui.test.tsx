import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('@get-bb/plugin-sdk/app', () => ({
  experimental_useSidebarThreads: () => ({ threads: [] }),
  experimental_Icon: ({ name }: {name: string}) => <i data-icon={name} />,
  experimental_ThreadStatusGlyph: ({ indicator }: {indicator: string}) => <span data-status={indicator} />,
}));
import { ChildActivityGlyph } from './sidebar-ui';
describe('independent unread and delegated work', () => {
  it('keeps unread dot beside the child glyph', () => {
    const html = renderToStaticMarkup(<ChildActivityGlyph unread />);
    expect(html).toContain('data-status="unread-success"');
    expect(html).toContain('data-icon="ChildThread"');
    expect(html).not.toContain('Loading');
  });
  it('reading clears only the dot', () => {
    const html = renderToStaticMarkup(<ChildActivityGlyph unread={false} />);
    expect(html).not.toContain('data-status');
    expect(html).toContain('data-icon="ChildThread"');
  });
});
