import { childThreadLabelTitle, formatChildThreadLabel, type ChildThreadDisplay } from './label';

export const LABEL_CLASS = 'child-thread-model-label';
export const NAME_CLASS = 'child-thread-model-name';
export const SEPARATOR_CLASS = 'child-thread-model-separator';
export const LEVEL_CLASS = 'child-thread-model-level';
export const LABEL_ATTR = 'data-child-thread-model';

const CHILD_BANNER = 'section[aria-label="Child threads"]';
const THREAD_HREF = /\/threads\/([^/?#]+)\/?(?:[?#].*)?$/;

interface ChildRow {
  host: HTMLElement;
  threadId: string;
}

interface LabelParts {
  name: HTMLElement;
  separator: HTMLElement;
  level: HTMLElement;
}

function threadIdFromHref(href: string | null): string | null {
  if (href === null) return null;
  const match = THREAD_HREF.exec(href);
  if (match?.[1] === undefined) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function childRows(root: ParentNode): ChildRow[] {
  const rows: ChildRow[] = [];
  for (const banner of root.querySelectorAll(CHILD_BANNER)) {
    for (const item of banner.querySelectorAll('ul > li')) {
      const host = item.querySelector<HTMLElement>(':scope > a[href], :scope > button[data-child-question-row]');
      if (host === null) continue;
      const threadId = host.dataset.childQuestionRow ?? threadIdFromHref(host.getAttribute('href'));
      if (threadId === null || threadId === '') continue;
      rows.push({ host, threadId });
    }
  }
  return rows;
}

/** Thread ids currently shown as rows in the native active-child banner. */
export function childRowThreadIds(root: ParentNode): string[] {
  return [...new Set(childRows(root).map(row => row.threadId))];
}

function labelOf(host: HTMLElement): HTMLElement | null {
  return host.querySelector<HTMLElement>(`:scope > .${LABEL_CLASS}`);
}

function labelParts(label: HTMLElement): LabelParts {
  let name = label.querySelector<HTMLElement>(`:scope > .${NAME_CLASS}`);
  let separator = label.querySelector<HTMLElement>(`:scope > .${SEPARATOR_CLASS}`);
  let level = label.querySelector<HTMLElement>(`:scope > .${LEVEL_CLASS}`);
  if (name === null) {
    name = document.createElement('span');
    name.className = NAME_CLASS;
    label.append(name);
  }
  if (separator === null) {
    separator = document.createElement('span');
    separator.className = SEPARATOR_CLASS;
    separator.textContent = '·';
    label.append(separator);
  }
  if (level === null) {
    level = document.createElement('span');
    level.className = LEVEL_CLASS;
    label.append(level);
  }
  return { name, separator, level };
}

/** Adds, updates or removes one bounded muted label on every banner child row. */
export function decorate(root: ParentNode, labels: ReadonlyMap<string, ChildThreadDisplay>): void {
  const seen = new Set<Element>();
  for (const row of childRows(root)) {
    const display = labels.get(row.threadId);
    if (display === undefined) continue;
    const text = formatChildThreadLabel(display);
    if (text === '') continue;
    seen.add(row.host);

    let label = labelOf(row.host);
    if (label === null) {
      label = document.createElement('span');
      label.className = LABEL_CLASS;
      label.setAttribute(LABEL_ATTR, '');
      row.host.append(label);
    }
    for (const extra of row.host.querySelectorAll<HTMLElement>(`:scope > .${LABEL_CLASS}`)) {
      if (extra !== label) extra.remove();
    }

    const parts = labelParts(label);
    if (parts.name.textContent !== display.modelLabel) parts.name.textContent = display.modelLabel;
    const level = display.reasoningLabel ?? display.reasoningLevel;
    parts.separator.hidden = level === null;
    parts.level.hidden = level === null;
    if (level !== null && parts.level.textContent !== level) parts.level.textContent = level;
    const title = childThreadLabelTitle(display);
    if (label.title !== title) label.title = title;
  }

  for (const label of root.querySelectorAll(`.${LABEL_CLASS}`)) {
    const host = label.parentElement;
    if (host !== null && seen.has(host)) continue;
    label.remove();
  }
}

/** Removes every label this plugin added, leaving the native rows untouched. */
export function undecorate(root: ParentNode): void {
  for (const label of root.querySelectorAll(`.${LABEL_CLASS}`)) label.remove();
}
