// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BRIDGE_ATTR, decorate, LINK_CLASS, planPath, threadFor, undecorate } from './banner';

const pane = (thread: string, path: string) => `
  <section><header><span hidden ${BRIDGE_ATTR}="${thread}"></span></header>
    <div data-testid="plan-review-request"><div>plan</div><p class="truncate font-mono">${path}</p></div>
  </section>`;

beforeEach(() => {
  document.body.innerHTML = `<main>${pane('thr_a', '/Users/me/.claude/plans/a.md')}${pane('thr_b', '/Users/me/.claude/plans/b.md')}</main>`;
});

describe('plan tab', () => {
  it('adds one Open link per plan path and opens that path', () => {
    const open = vi.fn();
    decorate(document, open);
    decorate(document, open);
    const links = document.querySelectorAll<HTMLButtonElement>(`.${LINK_CLASS}`);
    expect(links).toHaveLength(2);
    links[1]!.click();
    expect(open).toHaveBeenCalledWith('/Users/me/.claude/plans/b.md', links[1]!.parentElement);
  });

  it('opens the plan when the path itself is clicked', () => {
    const open = vi.fn();
    decorate(document, open);
    document.querySelector<HTMLElement>('.plan-tab-path')!.click();
    expect(open).toHaveBeenCalledWith('/Users/me/.claude/plans/a.md', document.querySelector('p'));
  });

  it('reads the path without the added link text', () => {
    decorate(document, () => {});
    expect(planPath(document.querySelector('p')!)).toBe('/Users/me/.claude/plans/a.md');
  });

  it('skips non-absolute paths', () => {
    document.querySelector('p')!.textContent = 'plan.md';
    decorate(document, () => {});
    expect(document.querySelectorAll(`.${LINK_CLASS}`)).toHaveLength(1);
  });

  it('finds the thread of the pane that holds the banner', () => {
    const rows = document.querySelectorAll('p');
    expect(threadFor(rows[0]!)).toBe('thr_a');
    expect(threadFor(rows[1]!)).toBe('thr_b');
  });

  it('restores the original path text on unmount', () => {
    decorate(document, () => {});
    undecorate(document);
    expect(document.querySelector(`.${LINK_CLASS}`)).toBeNull();
    const row = document.querySelector('p')!;
    expect(row.childNodes).toHaveLength(1);
    expect(row.textContent).toBe('/Users/me/.claude/plans/a.md');
  });

  it('re-adds the link when the host resets the row text', () => {
    decorate(document, () => {});
    const row = document.querySelector('p')!;
    row.textContent = '/Users/me/.claude/plans/a2.md';
    const open = vi.fn();
    decorate(document, open);
    row.querySelector<HTMLButtonElement>(`.${LINK_CLASS}`)!.click();
    expect(open).toHaveBeenCalledWith('/Users/me/.claude/plans/a2.md', row);
  });
});
