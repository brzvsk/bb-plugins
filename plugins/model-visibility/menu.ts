import type { Catalog, HiddenMap, MenuModel, MenuProvider } from './contract';

export const HIDDEN_CLASS = 'model-visibility-hidden';
export const TRIGGER_CLASS = 'model-visibility-more-trigger';
export const PANEL_CLASS = 'model-visibility-more-panel';
export const CLONE_ATTR = 'data-mv-clone';
export const CONFIGURE_ATTR = 'data-mv-configure';
export const TRIGGER_ATTR = 'data-mv-trigger';
export const HIDDEN_ATTR = 'data-mv-hidden';
export const ACTIVE_ATTR = 'data-mv-active';

const COMPACT_QUERY = '(max-width: 767px)';
const ROW_SELECTOR = 'button[id*="-opt-"]';
const NATIVE_TRIGGER_CLASS = 'relative flex w-full cursor-default select-none items-center gap-1 rounded-sm px-2 py-[0.3125rem] text-xs text-muted-foreground outline-none hover:bg-state-hover hover:text-foreground transition-none data-[last-hovered]:bg-state-hover data-[last-hovered]:text-foreground';
const NATIVE_ROW_CLASS = 'relative flex w-full cursor-default select-none items-center justify-between gap-3 rounded-sm px-2 text-xs outline-none hover:bg-state-hover hover:text-foreground transition-none data-[last-hovered]:bg-state-hover data-[last-hovered]:text-foreground py-[0.3125rem] max-md:pointer-coarse:py-2';
const NATIVE_CONTENT_CLASS = 'z-50 rounded-md border bg-popover text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 max-h-[min(20rem,var(--radix-popover-content-available-height),calc(100dvh-0.5rem))] overflow-y-auto overscroll-contain p-1 data-[state=closed]:animate-none w-max min-w-64 max-w-80';
const CHEVRON_RIGHT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" color="currentColor" class="size-3.5 shrink-0" data-icon="ChevronRight" data-icon-root=""><path d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>';
const CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" color="currentColor" class="size-4 shrink-0 max-md:pointer-coarse:size-5 text-subtle-foreground opacity-0" data-icon="Check" data-icon-root=""><path d="M5 14L8.5 17.5L19 6.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>';

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
    .find((button) => !button.hasAttribute(TRIGGER_ATTR) && button.textContent?.trim() === 'More models') ?? null;
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
  button.className = NATIVE_ROW_CLASS;
  button.setAttribute(CONFIGURE_ATTR, '');
  const label = document.createElement('span');
  label.className = 'truncate';
  label.title = 'Configure...';
  label.textContent = 'Configure...';
  const gutter = document.createElement('span');
  gutter.className = 'flex shrink-0 items-center gap-1.5';
  gutter.innerHTML = CHECK_SVG;
  button.append(label, gutter);
  button.addEventListener('click', () => onConfigure());
  return button;
}

export interface PanelPlacement {
  left: number;
  top: number;
  side: 'left' | 'right';
}

/** Match Radix's sideOffset=6, align=start placement and viewport flip. */
export function placePanel({
  trigger,
  panelWidth,
  panelHeight,
  viewportWidth,
  viewportHeight,
}: {
  trigger: { left: number; right: number; top: number };
  panelWidth: number;
  panelHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}): PanelPlacement {
  const gap = 6;
  const margin = 8;
  let side: 'left' | 'right' = 'right';
  let left = trigger.right + gap;
  if (left + panelWidth > viewportWidth - margin) {
    side = 'left';
    left = trigger.left - gap - panelWidth;
  }
  left = Math.max(margin, Math.min(left, viewportWidth - panelWidth - margin));
  const top = Math.max(margin, Math.min(trigger.top, viewportHeight - panelHeight - margin));
  return { left, top, side };
}

function cloneRow(row: HTMLButtonElement, afterClick?: () => void): HTMLButtonElement {
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
    afterClick?.();
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
  private panelCloseTimer = 0;
  private panelPointerMove: ((event: PointerEvent) => void) | null = null;
  private lastPointer = { x: 0, y: 0 };
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
    trigger.className = `${NATIVE_TRIGGER_CLASS} ${TRIGGER_CLASS}`;
    trigger.setAttribute(TRIGGER_ATTR, '');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `<span>More models</span>${CHEVRON_RIGHT_SVG}`;
    trigger.addEventListener('click', () => this.openOwnPanel(trigger));
    trigger.addEventListener('pointerenter', () => this.openOwnPanel(trigger));
    trigger.addEventListener('pointerleave', () => this.scheduleOwnPanelClose());
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar' || event.key === 'ArrowRight') {
        event.preventDefault();
        this.openOwnPanel(trigger, true);
        return;
      }
      if (event.key === 'Escape' || event.key === 'ArrowLeft') {
        event.preventDefault();
        this.closeOwnPanel();
        trigger.focus();
      }
    });
    const container = root.querySelector<HTMLElement>('[role="listbox"]')
      ?? root.querySelector<HTMLElement>('[class*="overflow-y-auto"]')
      ?? root;
    container.append(trigger);
    this.ownTrigger = trigger;
  }

  private openOwnPanel(trigger: HTMLButtonElement, focusFirst = false): void {
    if (this.ownPanel) {
      if (focusFirst) this.ownPanel.querySelector<HTMLButtonElement>('button')?.focus();
      return;
    }
    const panel = document.createElement('div');
    panel.className = `${NATIVE_CONTENT_CLASS} ${PANEL_CLASS}`;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('data-state', 'open');
    panel.setAttribute('data-align', 'start');
    panel.tabIndex = -1;
    panel.append(makeConfigureButton(this.onConfigure));
    for (const row of this.hiddenRows) panel.append(cloneRow(row, () => this.closeOwnPanel()));
    panel.style.position = 'fixed';
    panel.style.pointerEvents = 'auto';
    panel.style.maxHeight = 'min(20rem, calc(100dvh - 0.5rem))';
    panel.style.visibility = 'hidden';
    panel.addEventListener('pointerenter', () => this.cancelOwnPanelClose());
    panel.addEventListener('pointerleave', () => this.scheduleOwnPanelClose());

    const closeOnPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panel.contains(target)) {
        // Keep the native main popover from treating a click in this portal as outside.
        event.stopImmediatePropagation();
        return;
      }
      if (trigger.contains(target)) return;
      this.closeOwnPanel();
    };
    const closeOnFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panel.contains(target)) {
        // Keyboard focus inside the submenu must not dismiss the native main popover.
        event.stopImmediatePropagation();
        return;
      }
      if (trigger.contains(target) || this.root?.contains(target)) return;
      this.closeOwnPanel();
    };
    const keepFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && panel.contains(event.relatedTarget)) {
        event.stopImmediatePropagation();
      }
    };
    const closeOnKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'ArrowLeft') {
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

    this.doc.addEventListener('pointerdown', closeOnPointer, true);
    this.doc.addEventListener('focusin', closeOnFocus, true);
    this.doc.addEventListener('focusout', keepFocusOut, true);
    this.doc.addEventListener('keydown', closeOnKey, true);
    this.panelPointerMove = (event) => {
      this.lastPointer = { x: event.clientX, y: event.clientY };
      if (this.pointerInCorridor(event.clientX, event.clientY)) this.cancelOwnPanelClose();
      else this.scheduleOwnPanelClose();
    };
    this.doc.addEventListener('pointermove', this.panelPointerMove, true);
    this.win.addEventListener('resize', this.closePanelListener);
    this.win.addEventListener('scroll', this.closePanelListener, true);
    this.panelCleanup = () => {
      this.doc.removeEventListener('pointerdown', closeOnPointer, true);
      this.doc.removeEventListener('focusin', closeOnFocus, true);
      this.doc.removeEventListener('focusout', keepFocusOut, true);
      this.doc.removeEventListener('keydown', closeOnKey, true);
      if (this.panelPointerMove) {
        this.doc.removeEventListener('pointermove', this.panelPointerMove, true);
        this.panelPointerMove = null;
      }
      this.win.removeEventListener('resize', this.closePanelListener);
      this.win.removeEventListener('scroll', this.closePanelListener, true);
    };
    this.doc.body.append(panel);
    this.ownPanel = panel;
    this.panelSignature = [...this.hiddenRows].map((row) => row.id).join('|');
    trigger.setAttribute('aria-expanded', 'true');
    this.positionOwnPanel(panel, trigger);
    panel.style.visibility = '';
    if (focusFirst) panel.querySelector<HTMLButtonElement>('button')?.focus();
  }

  private positionOwnPanel(panel: HTMLElement, trigger: HTMLButtonElement): void {
    const rect = trigger.getBoundingClientRect();
    const placement = placePanel({
      trigger: { left: rect.left, right: rect.right, top: rect.top },
      panelWidth: panel.offsetWidth || 256,
      panelHeight: panel.offsetHeight || 0,
      viewportWidth: this.win.innerWidth,
      viewportHeight: this.win.innerHeight,
    });
    panel.style.left = `${placement.left}px`;
    panel.style.top = `${placement.top}px`;
    panel.setAttribute('data-side', placement.side);
  }

  private cancelOwnPanelClose(): void {
    if (this.panelCloseTimer) {
      this.win.clearTimeout(this.panelCloseTimer);
      this.panelCloseTimer = 0;
    }
  }

  private pointerInCorridor(x: number, y: number): boolean {
    if (!this.ownPanel || !this.ownTrigger) return false;
    const trigger = this.ownTrigger.getBoundingClientRect();
    const panel = this.ownPanel.getBoundingClientRect();
    const pad = 14;
    const inside = (rect: DOMRect) => x >= rect.left - pad && x <= rect.right + pad
      && y >= rect.top - pad && y <= rect.bottom + pad;
    if (inside(trigger) || inside(panel)) return true;
    const left = Math.min(trigger.left, panel.left) - pad;
    const right = Math.max(trigger.right, panel.right) + pad;
    const top = Math.min(trigger.top, panel.top) - pad;
    const bottom = Math.max(trigger.bottom, panel.bottom) + pad;
    return x >= left && x <= right && y >= top && y <= bottom;
  }

  private scheduleOwnPanelClose(): void {
    if (!this.ownPanel) return;
    this.cancelOwnPanelClose();
    this.panelCloseTimer = this.win.setTimeout(() => {
      this.panelCloseTimer = 0;
      if (!this.ownPanel) return;
      if (this.pointerInCorridor(this.lastPointer.x, this.lastPointer.y)) return;
      if (this.ownPanel.matches(':hover') || this.ownTrigger?.matches(':hover')) return;
      this.closeOwnPanel();
    }, 180);
  }

  private closePanelListener = (): void => this.closeOwnPanel();

  private closeOwnPanel(): void {
    this.cancelOwnPanelClose();
    if (this.panelPointerMove) {
      this.doc.removeEventListener('pointermove', this.panelPointerMove, true);
      this.panelPointerMove = null;
    }
    this.panelCleanup?.();
    this.panelCleanup = null;
    this.ownPanel?.remove();
    this.ownPanel = null;
    this.panelSignature = '';
    this.ownTrigger?.setAttribute('aria-expanded', 'false');
  }

  private renderOwnPanel(): void {
    if (!this.ownPanel) return;
    if (this.ownTrigger) this.positionOwnPanel(this.ownPanel, this.ownTrigger);
    const signature = [...this.hiddenRows].map((row) => row.id).join('|');
    if (signature === this.panelSignature) return;
    this.panelSignature = signature;
    this.ownPanel.replaceChildren(
      makeConfigureButton(this.onConfigure),
      ...[...this.hiddenRows].map((row) => cloneRow(row, () => this.closeOwnPanel())),
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
