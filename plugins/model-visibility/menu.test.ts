// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Catalog, MenuModel, MenuProvider } from './contract';
import {
  CLONE_ATTR,
  CONFIGURE_ATTR,
  HIDDEN_CLASS,
  ModelVisibilityMenu,
  TRIGGER_ATTR,
  placePanel,
} from './menu';

function model(id: string, displayName = id, routeProviderId?: string): MenuModel {
  return { id, displayName, ...(routeProviderId ? { routeProviderId } : {}) };
}

function provider(overrides: Partial<MenuProvider> = {}): MenuProvider {
  return {
    id: 'provider-a',
    displayName: 'Provider A',
    models: [model('alpha'), model('beta'), model('gamma')],
    more: [],
    ...overrides,
  };
}

function row(index: number, title: string, extra = ''): string {
  return `<button type="button" id=":r1:-opt-${index}" role="option" ${extra}><span class="truncate" title="${title}"><span>${title}</span></span></button>`;
}

function menuMarkup({
  rows = [row(0, 'alpha'), row(1, 'beta'), row(2, 'gamma')],
  tabs = '',
  more = '',
  search = '<input placeholder="Search models" aria-label="Search models" />',
}: {
  rows?: string[];
  tabs?: string;
  more?: string;
  search?: string;
} = {}): string {
  return `<div class="flex min-h-0 flex-col p-0">
    ${tabs}
    ${search}
    <div role="listbox" aria-label="Models">
      <div>Model</div>
      ${rows.join('')}
      ${more}
    </div>
  </div>`;
}

function clickable(title: string): HTMLButtonElement {
  const found = Array.from(document.querySelectorAll<HTMLButtonElement>('button[id*="-opt-"]'))
    .find((button) => button.querySelector<HTMLElement>('[title]')?.getAttribute('title') === title);
  if (!found) throw new Error(`No model row titled ${title}`);
  return found;
}

function activeTitle(): string | null {
  return document.querySelector<HTMLElement>('[data-mv-active] [title]')?.getAttribute('title')
    ?? document.querySelector<HTMLElement>('[data-mv-active]')?.getAttribute('title')
    ?? null;
}

function press(input: HTMLInputElement, key: string): void {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('model visibility menu', () => {
  let current: Catalog | null;
  let controller: ModelVisibilityMenu;
  let onConfigure: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    current = { providers: [provider()], hidden: { 'provider-a': ['beta'] } };
    onConfigure = vi.fn();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    controller?.dispose();
    document.body.innerHTML = '';
  });

  function start(catalog: Catalog | null = current): void {
    current = catalog;
    controller = new ModelVisibilityMenu({
      getData: () => current,
      onConfigure,
      win: window,
      doc: document,
    });
    controller.start();
    controller.refresh();
  }

  it('hides a checked model from the main list but keeps it in the catalog/search', () => {
    document.body.innerHTML = menuMarkup();
    start();

    expect(clickable('beta').classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(clickable('beta').tabIndex).toBe(-1);
    expect(clickable('alpha').classList.contains(HIDDEN_CLASS)).toBe(false);
  });

  it('moves keyboard highlight only across visible rows and clicks the original row callback', () => {
    document.body.innerHTML = menuMarkup();
    const clicked: string[] = [];
    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('button[id*="-opt-"]'))) {
      button.addEventListener('click', () => clicked.push(button.querySelector<HTMLElement>('[title]')?.getAttribute('title') ?? ''));
    }
    start();
    const input = document.querySelector<HTMLInputElement>('input[placeholder="Search models"]')!;

    press(input, 'ArrowDown');
    expect(activeTitle()).toBe('alpha');
    press(input, 'ArrowDown');
    expect(activeTitle()).toBe('gamma');
    press(input, 'Enter');

    expect(clicked).toEqual(['gamma']);
    expect(clicked).not.toContain('beta');
  });

  it('wraps ArrowUp from no highlight to the last visible row, skipping hidden rows', () => {
    document.body.innerHTML = menuMarkup({
      rows: [row(0, 'alpha'), row(1, 'beta')],
      search: '<input placeholder="Search models" />',
    });
    start({ providers: [provider({ models: [model('alpha'), model('beta')] })], hidden: { 'provider-a': ['beta'] } });
    const input = document.querySelector<HTMLInputElement>('input[placeholder="Search models"]')!;

    press(input, 'ArrowUp');
    expect(activeTitle()).toBe('alpha');
  });

  it('restores hidden rows while searching and hides them again when search clears', () => {
    document.body.innerHTML = menuMarkup();
    start();
    const input = document.querySelector<HTMLInputElement>('input[placeholder="Search models"]')!;
    expect(document.querySelector(`[${TRIGGER_ATTR}]`)).not.toBeNull();

    input.value = 'gam';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    controller.refresh();
    expect(clickable('beta').classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(document.querySelector(`[${TRIGGER_ATTR}]`)).toBeNull();

    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    controller.refresh();
    expect(clickable('beta').classList.contains(HIDDEN_CLASS)).toBe(true);
    expect(document.querySelector(`[${TRIGGER_ATTR}]`)).not.toBeNull();
  });

  it('fails open when two provider labels are identical instead of choosing by index', () => {
    const tabs = '<div><button type="button" title="Same" class="border-b-2 border-foreground"></button><button type="button" title="Same" class="border-b-2 border-transparent"></button></div>';
    document.body.innerHTML = menuMarkup({ tabs });
    start({
      providers: [
        provider({ id: 'one', displayName: 'Same' }),
        provider({ id: 'two', displayName: 'Same' }),
      ],
      hidden: { one: ['beta'], two: ['beta'] },
    });
    expect(clickable('beta').classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(document.querySelector(`[${TRIGGER_ATTR}]`)).toBeNull();
  });

  it('fails open when two catalog entries share one displayed label', () => {
    document.body.innerHTML = menuMarkup({ rows: [row(0, 'Same'), row(1, 'Same')] });
    start({
      providers: [provider({ models: [model('one', 'Same'), model('two', 'Same')] })],
      hidden: { 'provider-a': ['one'] },
    });
    expect(document.querySelectorAll(`.${HIDDEN_CLASS}`)).toHaveLength(0);
  });

  it('fails open when an observed row is absent from the provider catalog', () => {
    document.body.innerHTML = menuMarkup({ rows: [row(0, 'alpha'), row(1, 'unknown')] });
    start({
      providers: [provider({ models: [model('alpha'), model('beta')] })],
      hidden: { 'provider-a': ['beta'] },
    });
    expect(document.querySelectorAll(`.${HIDDEN_CLASS}`)).toHaveLength(0);
  });

  it('injects Configure first and only the missing rows into a validated native More popover', () => {
    document.body.innerHTML = menuMarkup({
      more: '<button type="button" aria-haspopup="menu" aria-expanded="false">More models</button>',
    });
    const clicked: string[] = [];
    clickable('beta').addEventListener('click', () => clicked.push('beta'));
    start({ providers: [provider({ more: [model('extra')] })], hidden: { 'provider-a': ['beta'] } });

    const trigger = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="menu"]'))
      .find((button) => button.textContent?.trim() === 'More models')!;
    trigger.setAttribute('aria-expanded', 'true');
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-radix-popper-content-wrapper', '');
    const content = document.createElement('div');
    content.innerHTML = '<button type="button"><span title="extra">extra</span></button>';
    wrapper.append(content);
    document.body.append(wrapper);

    controller.refresh();
    expect(content.firstElementChild?.hasAttribute(CONFIGURE_ATTR)).toBe(true);
    expect(content.querySelectorAll(`[${CLONE_ATTR}]`)).toHaveLength(1);
    expect(Array.from(content.querySelectorAll<HTMLButtonElement>('button'))
      .filter((button) => button.querySelector<HTMLElement>('[title]')?.getAttribute('title') === 'extra')).toHaveLength(1);
    const clone = content.querySelector<HTMLButtonElement>(`[${CLONE_ATTR}]`)!;
    expect(clone.tabIndex).not.toBe(-1);
    clone.focus();
    expect(document.activeElement).toBe(clone);
    clone.click();
    expect(clicked).toEqual(['beta']);
  });

  it('fails open rather than injecting into an unrelated popover', () => {
    document.body.innerHTML = menuMarkup({
      more: '<button type="button" aria-haspopup="menu" aria-expanded="true">More models</button>',
    });
    start({ providers: [provider({ more: [model('extra')] })], hidden: { 'provider-a': ['beta'] } });
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-radix-popper-content-wrapper', '');
    wrapper.innerHTML = '<div><button type="button" title="unrelated">unrelated</button></div>';
    document.body.append(wrapper);

    controller.refresh();
    expect(clickable('beta').classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(document.querySelectorAll(`[${CONFIGURE_ATTR}]`)).toHaveLength(0);
  });

  it('fails open rather than injecting into two unrelated candidate popovers', () => {
    document.body.innerHTML = menuMarkup({
      more: '<button type="button" aria-haspopup="menu" aria-expanded="true">More models</button>',
    });
    start({ providers: [provider({ more: [model('extra')] })], hidden: { 'provider-a': ['beta'] } });
    for (const label of ['extra', 'extra']) {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-radix-popper-content-wrapper', '');
      wrapper.innerHTML = `<div><button type="button"><span title="${label}">${label}</span></button></div>`;
      document.body.append(wrapper);
    }

    controller.refresh();
    expect(clickable('beta').classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(document.querySelectorAll(`[${CONFIGURE_ATTR}]`)).toHaveLength(0);
  });

  it('creates a native-styled More trigger and bounded submenu when the native one is absent', () => {
    document.body.innerHTML = menuMarkup();
    const clicked: string[] = [];
    clickable('beta').addEventListener('click', () => clicked.push('beta'));
    start();

    const trigger = document.querySelector<HTMLButtonElement>(`[${TRIGGER_ATTR}]`)!;
    expect(trigger).not.toBeNull();
    expect(trigger.className).toContain('rounded-sm');
    expect(trigger.className).toContain('gap-1');
    expect(trigger.querySelector('svg[data-icon="ChevronRight"]')).not.toBeNull();
    expect(trigger.textContent?.trim()).toBe('More models');
    trigger.click();
    const panel = document.querySelector<HTMLElement>('.model-visibility-more-panel')!;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('data-state')).toBe('open');
    expect(panel.className).toContain('rounded-md');
    expect(panel.className).toContain('bg-popover');
    expect(panel.className).toContain('shadow-md');
    expect(panel.className).toContain('p-1');
    expect(panel.className).toContain('w-max');
    expect(panel.className).toContain('min-w-64');
    expect(panel.className).toContain('max-w-80');
    expect(panel.firstElementChild?.hasAttribute(CONFIGURE_ATTR)).toBe(true);
    const configure = panel.querySelector<HTMLButtonElement>(`[${CONFIGURE_ATTR}]`)!;
    expect(configure.className).toContain('justify-between');
    expect(configure.querySelector('[title]')?.getAttribute('title')).toBe('Configure...');
    expect(configure.querySelector('svg[data-icon="Check"]')).not.toBeNull();
    expect(panel.querySelectorAll(`[${CLONE_ATTR}]`)).toHaveLength(1);

    configure.click();
    expect(onConfigure).toHaveBeenCalledTimes(1);
    panel.querySelector<HTMLButtonElement>(`[${CLONE_ATTR}]`)!.click();
    expect(clicked).toEqual(['beta']);
    expect(document.querySelector('.model-visibility-more-panel')).toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.model-visibility-more-panel')).toBeNull();
  });

  it('opens the native-style submenu from the keyboard and returns focus on Escape', () => {
    document.body.innerHTML = menuMarkup();
    start();
    const trigger = document.querySelector<HTMLButtonElement>(`[${TRIGGER_ATTR}]`)!;
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    const panel = document.querySelector<HTMLElement>('.model-visibility-more-panel')!;
    expect(panel).not.toBeNull();
    expect(document.activeElement).toBe(panel.querySelector('button'));
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(document.querySelector('.model-visibility-more-panel')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('places the custom submenu on the right, flips left, and clamps vertically', () => {
    expect(placePanel({
      trigger: { left: 100, right: 400, top: 50 },
      panelWidth: 256,
      panelHeight: 200,
      viewportWidth: 800,
      viewportHeight: 600,
    })).toEqual({ left: 406, top: 50, side: 'right' });

    expect(placePanel({
      trigger: { left: 450, right: 590, top: 50 },
      panelWidth: 256,
      panelHeight: 200,
      viewportWidth: 600,
      viewportHeight: 600,
    })).toEqual({ left: 188, top: 50, side: 'left' });

    expect(placePanel({
      trigger: { left: 100, right: 400, top: 500 },
      panelWidth: 256,
      panelHeight: 200,
      viewportWidth: 800,
      viewportHeight: 600,
    })).toEqual({ left: 406, top: 392, side: 'right' });
  });

  it('resolves a handoff provider tab by its normalized title and does not hide other providers', () => {
    const tabs = '<div><button type="button" title="Provider A (current thread)" class="border-b-2 border-foreground"></button><button type="button" title="Provider B" class="border-b-2 border-transparent"></button></div>';
    document.body.innerHTML = menuMarkup({ tabs });
    start({
      providers: [
        provider({ id: 'provider-a', displayName: 'Provider A' }),
        provider({ id: 'provider-b', displayName: 'Provider B', models: [model('beta')] }),
      ],
      hidden: { 'provider-b': ['beta'] },
    });

    expect(clickable('beta').classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(document.querySelector(`[${TRIGGER_ATTR}]`)).toBeNull();
  });

  it('restores every native row, trigger, and panel on dispose', () => {
    document.body.innerHTML = menuMarkup();
    start();
    expect(clickable('beta').classList.contains(HIDDEN_CLASS)).toBe(true);

    controller.dispose();
    expect(clickable('beta').classList.contains(HIDDEN_CLASS)).toBe(false);
    expect(clickable('beta').getAttribute('tabindex')).toBeNull();
    expect(document.querySelector(`[${TRIGGER_ATTR}]`)).toBeNull();
    expect(document.querySelector('.model-visibility-more-panel')).toBeNull();
  });
});
