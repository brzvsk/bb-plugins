import type { Catalog, HiddenMap, MenuModel, MenuProvider } from './contract';

export const HIDDEN_CLASS = 'model-visibility-hidden';
export const ROW_CLASS = 'model-visibility-menu-row';
export const TRIGGER_CLASS = 'model-visibility-more-trigger';
export const PANEL_CLASS = 'model-visibility-more-panel';
export const CLONE_ATTR = 'data-mv-clone';
export const CONFIGURE_ATTR = 'data-mv-configure';
export const TRIGGER_ATTR = 'data-mv-trigger';
export const HIDDEN_ATTR = 'data-mv-hidden';
export const ACTIVE_ATTR = 'data-mv-active';

const COMPACT_QUERY = '(max-width: 767px)';
const ROW_SELECTOR = 'button[id*="-opt-"]';

type RowMeta = {
  tabIndex: string | null;
  ariaHidden: string | null;
};

const rowMeta = new WeakMap<HTMLButtonElement, RowMeta>();

function stripBrandPrefix(label: string, brandPrefix: string | undefined): string {
  if (!brandPrefix) return label;
  return label.toLowerCase().startsWith(brandPrefix.toLowerCase())
    ? label.slice(brandPrefix.length).trimStart()
    : label;
}

/** The title the host puts on a model row for this catalog entry. */
export function modelLabel(model: MenuModel, brandPrefix?: string): string {
  const base = stripBrandPrefix(model.displayName || model.id, brandPrefix);
  return model.routeProviderId ? `${base} · ${model.routeProviderId}` : base;
}

function normalizeTabTitle(title: string): string {
  return title.replace(/\s*\(current thread\)$/u, '').trim();
}

/** The open model menu root, or null when no menu is open. */
export function findOpenMenu(doc: Document = document): HTMLElement | null {
  const inputs = Array.from(doc.querySelectorAll<HTMLInputElement>('input[placeholder="Search models"]'));
  for (const input of inputs) {
    const root = input.closest<HTMLElement>('[class*="min-h-0"][class*="flex-col"]');
    if (root) return root;
  }
  const roots = Array.from(doc.querySelectorAll<HTMLElement>('[class*="min-h-0"][class*="flex-col"][class*="p-0"]'));
  return roots.find((root) => root.querySelector(ROW_SELECTOR)) ?? null;
}

/** The label lives on the inner truncate span, not on the outer option button. */
export function rowTitle(row: Element): string {
  return row.querySelector<HTMLElement>('[title]')?.getAttribute('title')
    ?? row.getAttribute('title')
    ?? '';
}

/** Main model rows in host order. Native More rows live in another portal and are excluded by id. */
export function mainRows(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>(ROW_SELECTOR))
    .filter((row) => rowTitle(row).length > 0);
}

export function searchInput(root: HTMLElement): HTMLInputElement | null {
  return root.querySelector<HTMLInputElement>('input[placeholder="Search models"]');
}

export function isSearching(root: HTMLElement): boolean {
  return (searchInput(root)?.value.trim().length ?? 0) > 0;
}

/**
 * Resolve the provider from the active tab. Duplicate or unreadable labels are
 * ambiguous, so this returns null instead of guessing by provider index.
 */
export function resolveActiveProvider(
  root: HTMLElement,
  providers: readonly MenuProvider[],
): MenuProvider | null {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('button[title][class*="border-b-2"]'));
  if (tabs.length > 0) {
    const active = tabs.find((tab) => tab.classList.contains('border-foreground'));
    if (!active) return null;
    const title = normalizeTabTitle(active.title);
    const matches = providers.filter((provider) => provider.displayName === title);
    return matches.length === 1 ? matches[0]! : null;
  }
  return providers.length === 1 ? providers[0]! : null;
}

/** Map each observed row to one exact model ID, or null when anything is ambiguous. */
export function mapRows(
  provider: MenuProvider,
  rows: readonly HTMLButtonElement[],
): Map<HTMLButtonElement, string> | null {
  const byLabel = new Map<string, Set<string>>();
  for (const model of [...provider.models, ...provider.more]) {
    const label = modelLabel(model, provider.brandPrefix);
    const ids = byLabel.get(label) ?? new Set<string>();
    ids.add(model.id);
    byLabel.set(label, ids);
  }
  const mapped = new Map<HTMLButtonElement, string>();
  const used = new Set<string>();
  for (const row of rows) {
    const ids = byLabel.get(rowTitle(row));
    if (!ids || ids.size !== 1) return null;
    const id = [...ids][0]!;
    if (used.has(id)) return null;
    used.add(id);
    mapped.set(row, id);
  }
  return mapped;
}

export function hiddenIdsFor(hidden: HiddenMap, providerId: string): Set<string> {
  return new Set(hidden[providerId] ?? []);
}

export function isCompactViewport(win: Window = window): boolean {
  return typeof win.matchMedia === 'function' && win.matchMedia(COMPACT_QUERY).matches;
}

function hideRow(row: HTMLButtonElement): void {
  if (row.getAttribute(HIDDEN_ATTR) === 'true') return;
  rowMeta.set(row, {
    tabIndex: row.getAttribute('tabindex'),
    ariaHidden: row.getAttribute('aria-hidden'),
  });
  row.setAttribute(HIDDEN_ATTR, 'true');
  row.setAttribute('aria-hidden', 'true');
  row.tabIndex = -1;
  row.classList.add(HIDDEN_CLASS);
}

function showRow(row: HTMLButtonElement): void {
  if (row.getAttribute(HIDDEN_ATTR) !== 'true') return;
  row.removeAttribute(HIDDEN_ATTR);
  row.classList.remove(HIDDEN_CLASS);
  const meta = rowMeta.get(row);
  if (meta) {
    if (meta.tabIndex === null) row.removeAttribute('tabindex');
    else row.setAttribute('tabindex', meta.tabIndex);
    if (meta.ariaHidden === null) row.removeAttribute('aria-hidden');
    else row.setAttribute('aria-hidden', meta.ariaHidden);
  }
  rowMeta.delete(row);
}

function findNativeMoreTrigger(root: HTMLElement): HTMLButtonElement | null {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="menu"]'))
    .find((button) => button.textContent?.trim() === 'More models') ?? null;
}

function findOpenSubmenu(
  root: HTMLElement,
  provider: MenuProvider,
  trigger: HTMLButtonElement,
  doc: Document,
): HTMLElement | null {
  const extraLabels = new Set(provider.more.map((model) => modelLabel(model, provider.brandPrefix)));
  if (extraLabels.size === 0) return null;

  const controlledId = trigger.getAttribute('aria-controls');
  if (controlledId) {
    const controlled = doc.getElementById(controlledId);
    if (controlled instanceof HTMLElement && !controlled.contains(root)) return controlled;
  }

  const candidates = Array.from(doc.querySelectorAll<HTMLElement>('[data-radix-popper-content-wrapper]'))
    .filter((wrapper) => !wrapper.contains(root))
    .map((wrapper) => wrapper.firstElementChild)
    .filter((content): content is HTMLElement => content instanceof HTMLElement)
    .filter((content) => {
      const titles = Array.from(content.querySelectorAll<HTMLButtonElement>('button'))
        .filter((button) => !button.hasAttribute(CLONE_ATTR) && !button.hasAttribute(CONFIGURE_ATTR))
        .map((button) => rowTitle(button))
        .filter((title) => title.length > 0);
      return titles.length > 0 && titles.every((title) => extraLabels.has(title));
    });
  return candidates.length === 1 ? candidates[0]! : null;
}

function makeConfigureButton(onConfigure: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = ROW_CLASS;
  button.setAttribute(CONFIGURE_ATTR, '');
  button.textContent = 'Configure...';
  button.addEventListener('click', () => onConfigure());
  return button;
}

function cloneRow(row: HTMLButtonElement): HTMLButtonElement {
  const clone = row.cloneNode(true) as HTMLButtonElement;
  clone.removeAttribute('id');
  clone.removeAttribute('role');
  clone.removeAttribute('aria-selected');
  clone.removeAttribute('aria-hidden');
  clone.removeAttribute('tabindex');
  clone.removeAttribute(HIDDEN_ATTR);
  clone.removeAttribute(ACTIVE_ATTR);
  clone.classList.remove(HIDDEN_CLASS);
  clone.classList.remove('bg-state-active');
  clone.style.display = '';
  clone.setAttribute(CLONE_ATTR, '');
  clone.addEventListener('click', (event) => {
    event.preventDefault();
    row.click();
  });
  return clone;
}

export interface ModelVisibilityMenuOptions {
  getData: () => Catalog | null;
  onConfigure: () => void;
  win?: Window;
  doc?: Document;
}

/**
 * DOM adapter around the native picker. It never changes model state: hidden
 * rows keep their native onClick, and clones click the original row.
 */
export class ModelVisibilityMenu {
  private readonly win: Window;
  private readonly doc: Document;
  private readonly onConfigure: () => void;
  private readonly getData: () => Catalog | null;

  private root: HTMLElement | null = null;
  private provider: MenuProvider | null = null;
  private input: HTMLInputElement | null = null;
  private hiddenRows = new Set<HTMLButtonElement>();
  private activeRow: HTMLButtonElement | null = null;
  private nativeContent: HTMLElement | null = null;
  private ownTrigger: HTMLButtonElement | null = null;
  private ownPanel: HTMLElement | null = null;
  private panelSignature = '';
  private observer: MutationObserver | null = null;
  private frame = 0;
  private started = false;
  private panelCleanup: (() => void) | null = null;

  constructor(options: ModelVisibilityMenuOptions) {
    this.getData = options.getData;
    this.onConfigure = options.onConfigure;
    this.win = options.win ?? window;
    this.doc = options.doc ?? document;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(this.doc.body, { childList: true, subtree: true });
    this.doc.addEventListener('keydown', this.handleKeyDown, true);
    this.doc.addEventListener('input', this.handleInput, true);
    this.sync();
  }

  dispose(): void {
    if (!this.started) return;
    this.started = false;
    this.observer?.disconnect();
    this.observer = null;
    this.doc.removeEventListener('keydown', this.handleKeyDown, true);
    this.doc.removeEventListener('input', this.handleInput, true);
    if (this.frame) {
      if (typeof this.win.cancelAnimationFrame === 'function') this.win.cancelAnimationFrame(this.frame);
      else this.win.clearTimeout(this.frame);
      this.frame = 0;
    }
    this.restore();
  }

  /** Re-read the menu now (also used by tests). */
  refresh(): void {
    this.sync();
  }

  private schedule(): void {
    if (this.frame) return;
    const run = () => {
      this.frame = 0;
      this.sync();
    };
    this.frame = typeof this.win.requestAnimationFrame === 'function'
      ? this.win.requestAnimationFrame(run)
      : this.win.setTimeout(run, 0);
  }

  private sync(): void {
    const data = this.getData();
    if (!data || isCompactViewport(this.win)) {
      this.restore();
      return;
    }
    const root = findOpenMenu(this.doc);
    if (!root) {
      this.restore();
      return;
    }
    if (root !== this.root) this.restore();
    this.root = root;
    this.input = searchInput(root);

    const provider = resolveActiveProvider(root, data.providers);
    const rows = mainRows(root);
    const mapped = provider ? mapRows(provider, rows) : null;
    if (!provider || !mapped) {
      this.restore();
      return;
    }
    this.provider = provider;
    const hiddenIds = hiddenIdsFor(data.hidden, provider.id);
    const nextHidden = new Set(
      rows.filter((row) => hiddenIds.has(mapped.get(row) ?? '')),
    );
    if (nextHidden.size === 0) {
      this.restore();
      return;
    }

    if (isSearching(root)) {
      this.restore();
      return;
    }

    for (const row of this.hiddenRows) {
      if (!nextHidden.has(row)) showRow(row);
    }
    if (this.activeRow && !nextHidden.has(this.activeRow) && !this.visibleRows().includes(this.activeRow)) {
      this.clearActive();
    }
    this.hiddenRows = nextHidden;
    const nativeTrigger = findNativeMoreTrigger(root);
    if (nativeTrigger) {
      this.removeOwnTrigger();
      if (nativeTrigger.getAttribute('aria-expanded') === 'true') {
        const content = findOpenSubmenu(root, provider, nativeTrigger, this.doc);
        if (!content) {
          this.showAllRows();
          this.hiddenRows.clear();
          this.removeInjected();
          return;
        }
        this.hideRows();
        this.injectNative(content);
      } else {
        this.removeInjected();
        this.hideRows();
      }
      return;
    }

    const mappedIds = new Set(mapped.values());
    const unshownMore = provider.more.filter((model) => !mappedIds.has(model.id));
    if (unshownMore.length > 0) {
      this.restore();
      return;
    }

    this.hideRows();
    this.ensureOwnTrigger(root);
    if (this.ownPanel) this.renderOwnPanel();
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.root || !this.input || event.target !== this.input) return;
    if (this.hiddenRows.size === 0 || isSearching(this.root)) return;
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return;
    const rows = this.visibleRows();
    if (rows.length === 0) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (event.key === 'Enter') {
      if (this.activeRow && rows.includes(this.activeRow) && !this.activeRow.disabled) {
        this.activeRow.click();
      }
      return;
    }

    const current = this.activeRow ? rows.indexOf(this.activeRow) : -1;
    const next = event.key === 'ArrowDown'
      ? (current < 0 ? 0 : (current + 1) % rows.length)
      : (current < 0 ? rows.length - 1 : (current - 1 + rows.length) % rows.length);
    this.setActive(rows[next]!);
  };

  private handleInput = (event: Event): void => {
    if (!this.input || event.target !== this.input) return;
    this.clearActive();
    this.schedule();
  };

  private visibleRows(): HTMLButtonElement[] {
    if (!this.root) return [];
    return mainRows(this.root).filter((row) => !this.hiddenRows.has(row));
  }

  private setActive(row: HTMLButtonElement): void {
    this.clearActive();
    this.activeRow = row;
    row.setAttribute(ACTIVE_ATTR, 'true');
    row.classList.add('bg-state-active');
    this.input?.setAttribute('aria-activedescendant', row.id);
    row.scrollIntoView?.({ block: 'nearest' });
  }

  private clearActive(): void {
    if (this.activeRow) {
      this.activeRow.removeAttribute(ACTIVE_ATTR);
      this.activeRow.classList.remove('bg-state-active');
    }
    this.activeRow = null;
    this.input?.removeAttribute('aria-activedescendant');
  }

  private hideRows(): void {
    for (const row of this.hiddenRows) hideRow(row);
  }

  private showAllRows(): void {
    for (const row of this.hiddenRows) showRow(row);
  }

  private removeInjected(): void {
    this.nativeContent
      ?.querySelectorAll<HTMLElement>(`[${CONFIGURE_ATTR}], [${CLONE_ATTR}]`)
      .forEach((node) => node.remove());
    this.nativeContent = null;
  }

  private injectNative(content: HTMLElement): void {
    this.nativeContent = content;
    if (!content.querySelector(`[${CONFIGURE_ATTR}]`)) {
      content.prepend(makeConfigureButton(this.onConfigure));
    }
    const titles = new Set(
      Array.from(content.querySelectorAll<HTMLButtonElement>('button')).map((button) => rowTitle(button)),
    );
    for (const row of this.hiddenRows) {
      const title = rowTitle(row);
      if (titles.has(title)) continue;
      const clone = cloneRow(row);
      content.append(clone);
      titles.add(title);
    }
  }

  private ensureOwnTrigger(root: HTMLElement): void {
    if (this.ownTrigger?.isConnected) return;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = `${TRIGGER_CLASS} ${ROW_CLASS}`;
    trigger.setAttribute(TRIGGER_ATTR, '');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = '<span>More models</span><span aria-hidden="true">›</span>';
    trigger.addEventListener('click', () => this.toggleOwnPanel(trigger));
    const container = root.querySelector<HTMLElement>('[role="listbox"]')
      ?? root.querySelector<HTMLElement>('[class*="overflow-y-auto"]')
      ?? root;
    container.append(trigger);
    this.ownTrigger = trigger;
  }

  private toggleOwnPanel(trigger: HTMLButtonElement): void {
    if (this.ownPanel) {
      this.closeOwnPanel();
      return;
    }
    const panel = document.createElement('div');
    panel.className = PANEL_CLASS;
    panel.setAttribute('role', 'menu');
    panel.append(makeConfigureButton(this.onConfigure));
    for (const row of this.hiddenRows) panel.append(cloneRow(row));

    const rect = trigger.getBoundingClientRect();
    panel.style.position = 'fixed';
    panel.style.top = `${rect.top}px`;
    panel.style.left = `${Math.min(rect.right + 6, this.win.innerWidth - 320)}px`;

    const closeOnPointer = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panel.contains(target) || trigger.contains(target)) return;
      this.closeOwnPanel();
    };
    const closeOnKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeOwnPanel();
        trigger.focus();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>('button'));
      const index = buttons.indexOf(this.doc.activeElement as HTMLButtonElement);
      const next = event.key === 'ArrowDown'
        ? (index + 1) % buttons.length
        : (index <= 0 ? buttons.length - 1 : index - 1);
      buttons[next]?.focus();
    };

    this.doc.addEventListener('mousedown', closeOnPointer, true);
    this.doc.addEventListener('keydown', closeOnKey, true);
    this.win.addEventListener('resize', this.closePanelListener);
    this.win.addEventListener('scroll', this.closePanelListener, true);
    this.panelCleanup = () => {
      this.doc.removeEventListener('mousedown', closeOnPointer, true);
      this.doc.removeEventListener('keydown', closeOnKey, true);
      this.win.removeEventListener('resize', this.closePanelListener);
      this.win.removeEventListener('scroll', this.closePanelListener, true);
    };
    this.doc.body.append(panel);
    this.ownPanel = panel;
    this.panelSignature = [...this.hiddenRows].map((row) => row.id).join('|');
    trigger.setAttribute('aria-expanded', 'true');
    panel.querySelector<HTMLButtonElement>('button')?.focus();
  }

  private closePanelListener = (): void => this.closeOwnPanel();

  private closeOwnPanel(): void {
    this.panelCleanup?.();
    this.panelCleanup = null;
    this.ownPanel?.remove();
    this.ownPanel = null;
    this.panelSignature = '';
    this.ownTrigger?.setAttribute('aria-expanded', 'false');
  }

  private renderOwnPanel(): void {
    if (!this.ownPanel) return;
    const position = this.ownTrigger?.getBoundingClientRect();
    if (position) {
      this.ownPanel.style.top = `${position.top}px`;
      this.ownPanel.style.left = `${Math.min(position.right + 6, this.win.innerWidth - 320)}px`;
    }
    const signature = [...this.hiddenRows].map((row) => row.id).join('|');
    if (signature === this.panelSignature) return;
    this.panelSignature = signature;
    this.ownPanel.replaceChildren(
      makeConfigureButton(this.onConfigure),
      ...[...this.hiddenRows].map(cloneRow),
    );
  }

  private removeOwnTrigger(): void {
    this.closeOwnPanel();
    this.ownTrigger?.remove();
    this.ownTrigger = null;
  }

  private restore(): void {
    this.clearActive();
    this.showAllRows();
    this.removeInjected();
    this.removeOwnTrigger();
    this.hiddenRows.clear();
    this.root = null;
    this.provider = null;
    this.input = null;
  }
}
