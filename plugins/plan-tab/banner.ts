export const LINK_CLASS = 'plan-tab-link';
export const PATH_CLASS = 'plan-tab-path';
export const ROW_ATTR = 'data-plan-tab-row';
export const BRIDGE_ATTR = 'data-plan-tab-thread';

const PATH = '[data-testid="plan-review-request"] > p.font-mono';

/** The plan file path, when the row holds exactly one absolute path. */
export function planPath(row: Element): string | null {
  const wrapped = row.querySelector(`:scope > .${PATH_CLASS}`);
  const text = (wrapped ? wrapped.textContent ?? '' : [...row.childNodes]
    .filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent ?? '').join('')).trim();
  return text.startsWith('/') && !text.includes('\n') ? text : null;
}

/** The thread owning a banner: the nearest ancestor that contains a header bridge. */
export function threadFor(element: Element): string | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const bridges = node.querySelectorAll<HTMLElement>(`[${BRIDGE_ATTR}]`);
    if (bridges.length === 1) return bridges[0]!.getAttribute(BRIDGE_ATTR);
    if (bridges.length > 1) return null;
  }
  return null;
}

/**
 * Wraps the path so it can truncate on its own and adds an Open link after it,
 * keeping the link visible in a narrow banner.
 */
export function decorate(root: ParentNode, open: (path: string, row: Element) => void): void {
  for (const row of root.querySelectorAll(PATH)) {
    if (row.querySelector(`:scope > .${LINK_CLASS}`)) continue;
    const path = planPath(row);
    if (!path) continue;
    const wrapper = document.createElement('span');
    wrapper.className = PATH_CLASS;
    wrapper.append(...[...row.childNodes].filter(node => node.nodeType === Node.TEXT_NODE));
    const link = document.createElement('button');
    link.type = 'button';
    link.className = LINK_CLASS;
    link.textContent = 'Open';
    link.title = 'Open the plan in a panel tab';
    const onClick = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      open(path, row);
    };
    // The path itself opens the plan too.
    wrapper.title = link.title;
    wrapper.addEventListener('click', onClick);
    link.addEventListener('click', onClick);
    row.setAttribute(ROW_ATTR, '');
    row.append(wrapper, link);
  }
}

export function undecorate(root: ParentNode): void {
  for (const row of root.querySelectorAll(`[${ROW_ATTR}]`)) {
    row.querySelector(`:scope > .${LINK_CLASS}`)?.remove();
    const wrapper = row.querySelector(`:scope > .${PATH_CLASS}`);
    if (wrapper) wrapper.replaceWith(...wrapper.childNodes);
    row.removeAttribute(ROW_ATTR);
  }
}
