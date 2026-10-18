export type Session = { id: string; projectId: string; title: string; project: string; status: string };
export type StatusTarget = { id: string; element: HTMLElement; providerElement?: HTMLElement };
export type HeldKey = 'Meta' | 'Control' | 'Alt';
const STORE = 'sessions-switcher:recent:v1';
export function readHistory(): string[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(STORE) ?? '[]');
    return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length < 200))].slice(0, 50) : [];
  } catch { return []; }
}
export function visit(id: string) {
  try { localStorage.setItem(STORE, JSON.stringify([id, ...readHistory().filter(x => x !== id)].slice(0, 50))); } catch { /* private storage */ }
}
// Follow the sidebar's Organize → Rows → Provider icons. The built-in Thread
// list plugin mirrors its synced preferences here; missing means its default.
export function showProviderIcons(): boolean {
  try {
    const prefs: unknown = JSON.parse(localStorage.getItem('bb.thread-list.preferences.v1') ?? '{}');
    return (prefs as { showProviderIcons?: unknown })?.showProviderIcons !== false;
  } catch { return true; }
}
export function currentId() { return location.pathname.match(/\/threads\/([^/]+)/)?.[1] ?? null; }
export function heldKey(event: KeyboardEvent | null): HeldKey | null {
  return event?.metaKey ? 'Meta' : event?.ctrlKey ? 'Control' : event?.altKey ? 'Alt' : null;
}
export type Box = { left: number; top: number; right: number; bottom: number };
// Native Browser views paint above all DOM. Pick the largest viewport band that
// no visible Browser tab covers; null keeps the full-viewport overlay.
export function freeArea(view: Box, blocked: readonly Box[], min = { width: 280, height: 260 }): Box | null {
  const boxes = blocked
    .map(b => ({ left: Math.max(b.left, view.left), top: Math.max(b.top, view.top), right: Math.min(b.right, view.right), bottom: Math.min(b.bottom, view.bottom) }))
    .filter(b => b.right > b.left && b.bottom > b.top);
  if (!boxes.length) return null;
  const overlaps = (a: Box) => boxes.some(b => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom);
  const edges = (lo: number, hi: number, keys: ('left' | 'right' | 'top' | 'bottom')[]) =>
    [...new Set([lo, hi, ...boxes.flatMap(b => keys.map(k => b[k]))])].sort((a, b) => a - b);
  const xs = edges(view.left, view.right, ['left', 'right']), ys = edges(view.top, view.bottom, ['top', 'bottom']);
  const candidates: Box[] = [];
  xs.forEach((a, i) => xs.slice(i + 1).forEach(b => candidates.push({ left: a, top: view.top, right: b, bottom: view.bottom })));
  ys.forEach((a, i) => ys.slice(i + 1).forEach(b => candidates.push({ left: view.left, top: a, right: view.right, bottom: b })));
  const area = (b: Box) => (b.right - b.left) * (b.bottom - b.top);
  return candidates
    .filter(b => b.right - b.left >= min.width && b.bottom - b.top >= min.height && !overlaps(b))
    .sort((a, b) => area(b) - area(a))[0] ?? null;
}
function browserBoxes(): Box[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-app-browser]'))
    .filter(el => el.checkVisibility?.() !== false)
    .map(el => el.getBoundingClientRect());
}
function place(root: HTMLElement) {
  const free = freeArea({ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }, browserBoxes());
  root.style.inset = free ? `${free.top}px ${window.innerWidth - free.right}px ${window.innerHeight - free.bottom}px ${free.left}px` : '';
}
export function mountSwitcher(options: {
  signal: AbortSignal;
  layout?: 'horizontal' | 'vertical';
  load(ids: string[]): Promise<Session[]>;
  navigate(session: Session): void;
  setStatusTargets?(targets: readonly StatusTarget[]): void;
}) {
  let layout = options.layout ?? 'horizontal';
  let disposed = false;
  const exiting = new Map<HTMLElement, number>();
  const clearExits = () => { exiting.forEach((timeout, node) => { window.clearTimeout(timeout); node.remove(); }); exiting.clear(); };
  let root: HTMLDivElement | null = null;
  let rows: Session[] = [];
  let index = 0;
  let generation = 0;
  let pending = false;
  let presses = 0;
  let hold: HeldKey | null = null;
  let released = false;
  let previousFocus: HTMLElement | null = null;
  let activeModifier: HeldKey | null = null;
  let lastId: string | null = null;
  const track = () => { const id = currentId(); if (id && id !== lastId) { visit(id); lastId = id; } };
  const timer = window.setInterval(track, 250);
  track();
  function close(animate = true) {
    if (animate && root && rows.length && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      // A non-interactive visual snapshot can fade while navigation starts now.
      const ghost = root.cloneNode(true) as HTMLElement;
      ghost.className = 'sessions-switcher-exit'; ghost.inert = true;
      ghost.setAttribute('aria-hidden', 'true');
      ghost.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      document.body.append(ghost);
      exiting.set(ghost, window.setTimeout(() => { ghost.remove(); exiting.delete(ghost); }, 80));
    }
    options.setStatusTargets?.([]);
    generation++; pending = false; root?.remove(); root = null; rows = []; presses = 0; hold = null;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }
  function commit() {
    const selected = rows[index]; close();
    if (selected) { visit(selected.id); options.navigate(selected); }
  }
  function select(step: number) {
    if (!rows.length) return;
    index = (index + step + rows.length) % rows.length;
    root?.querySelectorAll<HTMLButtonElement>('[role=option]').forEach((el, i) => {
      el.setAttribute('aria-selected', String(i === index));
      if (i === index) el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    });
    root?.querySelector('[role=listbox]')?.setAttribute('aria-activedescendant', `session-choice-${index}`);
  }
  function render(message?: string) {
    if (!root) {
      root = document.createElement('div'); root.className = 'sessions-switcher';
      root.addEventListener('pointerdown', e => { if (e.target === root) close(); });
      document.body.append(root);
    }
    place(root);
    root.dataset.layout = layout;
    const panel = document.createElement('div'); panel.className = 'sessions-switcher-panel';
    panel.setAttribute('role', 'listbox'); panel.setAttribute('aria-orientation', layout); panel.setAttribute('aria-label', 'Recent sessions'); panel.tabIndex = -1;
    if (message) { const text = document.createElement('p'); text.setAttribute('role', 'status'); text.textContent = message; panel.append(text); }
    const cards = document.createElement('div'); cards.className = 'sessions-switcher-cards';
    const statusTargets: StatusTarget[] = [];
    const icons = showProviderIcons();
    rows.forEach((row, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.tabIndex = -1;
      button.id = `session-choice-${i}`; button.setAttribute('role', 'option');
      const provider = document.createElement('span'); provider.className = 'sessions-switcher-provider';
      const title = document.createElement('span'); title.className = 'sessions-switcher-title'; button.title = row.title;
      const name = document.createElement('span'); name.textContent = row.title; title.append(...(icons ? [provider] : []), name);
      const meta = document.createElement('span'); meta.className = 'sessions-switcher-meta';
      const detail = document.createElement('span'); detail.className = 'sessions-switcher-detail'; detail.textContent = row.project;
      const status = document.createElement('span'); status.className = 'sessions-switcher-status'; statusTargets.push({ id: row.id, element: status, providerElement: icons ? provider : undefined });
      meta.append(detail, status); button.append(title, meta);
      // Pointer movement selects without navigating. A stationary cursor must
      // not steal the keyboard selection when the overlay first appears.
      button.addEventListener('pointermove', event => {
        if (event.pointerType !== 'touch' && index !== i) select(i - index);
      });
      button.addEventListener('click', () => { index = i; commit(); }); cards.append(button);
    });
    const footer = document.createElement('div'); footer.className = 'sessions-switcher-footer';
    const arrows = layout === 'vertical' ? '↑↓' : '←→';
    footer.textContent = hold ? `Release ${hold === 'Meta' ? '⌘' : hold} to open · ${arrows} move · Esc cancel` : `${arrows} move · Enter open · Esc close`;
    panel.append(cards, footer); root.replaceChildren(panel); options.setStatusTargets?.(statusTargets); select(0); panel.focus({ preventScroll: true });
  }
  async function open(persistent = false) {
    if (disposed || options.signal.aborted) return;
    if (root && rows.length) { select(1); return; }
    clearExits();
    presses++;
    if (pending) return;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    hold = persistent ? null : activeModifier; released = false;
    pending = true; const request = ++generation; track();
    render('Loading sessions…');
    try {
      const result = await options.load(readHistory());
      if (request !== generation || options.signal.aborted) return;
      pending = false; rows = result;
      const first = rows.length > 1 && rows[0]?.id === currentId() ? 1 : 0;
      index = rows.length ? (first + presses - 1) % rows.length : 0;
      render(rows.length ? undefined : 'No recent sessions');
      if (hold && released) commit();
    } catch {
      if (request !== generation || options.signal.aborted) return;
      pending = false; hold = null; render('Could not load sessions. Press Escape and try again.');
    }
  }
  const consume = (e: KeyboardEvent) => { e.preventDefault(); e.stopImmediatePropagation(); };
  const down = (e: KeyboardEvent) => {
    // Track physical modifier state, not the lifetime of one event dispatch.
    // BB may invoke its command after a microtask checkpoint.
    activeModifier = heldKey(e);
    if (!root) return;
    if (e.key === 'Escape') { consume(e); close(); }
    else if (e.key === 'Enter' && rows.length) { consume(e); commit(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab') {
      consume(e); select(e.key === 'ArrowUp' || e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1);
    }
  };
  const up = (e: KeyboardEvent) => {
    activeModifier = heldKey(e);
    if (e.key === hold) { released = true; if (!pending && rows.length) commit(); }
  };
  const blur = () => { activeModifier = null; close(); };
  const resize = () => { if (root) place(root); };
  window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true); window.addEventListener('blur', blur); window.addEventListener('resize', resize);
  function dispose() {
    if (disposed) return; disposed = true;
    window.clearInterval(timer); window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); window.removeEventListener('blur', blur); window.removeEventListener('resize', resize); close(false); clearExits();
  }
  options.signal.addEventListener('abort', dispose, { once: true });
  function setLayout(next: 'horizontal' | 'vertical') {
    layout = next;
    if (!root) return;
    root.dataset.layout = layout;
    root.querySelector('[role=listbox]')?.setAttribute('aria-orientation', layout);
    const footer = root.querySelector('.sessions-switcher-footer');
    if (footer) footer.textContent = footer.textContent?.replace(/←→|↑↓/, layout === 'vertical' ? '↑↓' : '←→') ?? '';
    select(0);
  }
  return { open, dispose, setLayout };
}
