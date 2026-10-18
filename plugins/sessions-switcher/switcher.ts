export type Session = { id: string; projectId: string; title: string; project: string; status: string };
export type StatusTarget = { id: string; element: HTMLElement };
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
export function currentId() { return location.pathname.match(/\/threads\/([^/]+)/)?.[1] ?? null; }
export function heldKey(event: KeyboardEvent | null): HeldKey | null {
  return event?.metaKey ? 'Meta' : event?.ctrlKey ? 'Control' : event?.altKey ? 'Alt' : null;
}
export function mountSwitcher(options: {
  signal: AbortSignal;
  load(ids: string[]): Promise<Session[]>;
  navigate(session: Session): void;
  setStatusTargets?(targets: readonly StatusTarget[]): void;
}) {
  let disposed = false;
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
  function close() {
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
      if (i === index) el.scrollIntoView?.({ block: 'nearest' });
    });
    root?.querySelector('[role=listbox]')?.setAttribute('aria-activedescendant', `session-choice-${index}`);
  }
  function render(message?: string) {
    root?.remove();
    root = document.createElement('div'); root.className = 'sessions-switcher';
    root.addEventListener('pointerdown', e => { if (e.target === root) close(); });
    const panel = document.createElement('div'); panel.className = 'sessions-switcher-panel';
    panel.setAttribute('role', 'listbox'); panel.setAttribute('aria-label', 'Recent sessions'); panel.tabIndex = -1;
    const heading = document.createElement('div'); heading.className = 'sessions-switcher-heading'; heading.textContent = 'Recent sessions';
    panel.append(heading);
    if (message) { const text = document.createElement('p'); text.setAttribute('role', 'status'); text.textContent = message; panel.append(text); }
    const statusTargets: StatusTarget[] = [];
    rows.forEach((row, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.tabIndex = -1;
      button.id = `session-choice-${i}`; button.setAttribute('role', 'option');
      const number = document.createElement('span'); number.className = 'sessions-switcher-number'; number.textContent = String(i + 1);
      const copy = document.createElement('span'); copy.className = 'sessions-switcher-copy';
      const title = document.createElement('span'); title.className = 'sessions-switcher-title'; title.textContent = row.title;
      const detail = document.createElement('span'); detail.className = 'sessions-switcher-detail'; detail.textContent = row.project;
      const status = document.createElement('span'); status.className = 'sessions-switcher-status'; statusTargets.push({ id: row.id, element: status });
      copy.append(title, detail); button.append(number, copy, status);
      // Pointer movement selects without navigating. A stationary cursor must
      // not steal the keyboard selection when the overlay first appears.
      button.addEventListener('pointermove', event => {
        if (event.pointerType !== 'touch' && index !== i) select(i - index);
      });
      button.addEventListener('click', () => { index = i; commit(); }); panel.append(button);
    });
    const footer = document.createElement('div'); footer.className = 'sessions-switcher-footer';
    footer.textContent = hold ? `Release ${hold === 'Meta' ? '⌘' : hold} to open · ↑↓ move · Esc cancel` : '↑↓ move · Enter open · Esc close';
    panel.append(footer); root.append(panel); document.body.append(root); options.setStatusTargets?.(statusTargets); select(0); panel.focus({ preventScroll: true });
  }
  async function open(persistent = false) {
    if (disposed || options.signal.aborted) return;
    if (root && rows.length) { select(1); return; }
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
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Tab') {
      consume(e); select(e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1);
    }
  };
  const up = (e: KeyboardEvent) => {
    activeModifier = heldKey(e);
    if (e.key === hold) { released = true; if (!pending && rows.length) commit(); }
  };
  const blur = () => { activeModifier = null; close(); };
  window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true); window.addEventListener('blur', blur);
  function dispose() {
    if (disposed) return; disposed = true;
    window.clearInterval(timer); window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); window.removeEventListener('blur', blur); close();
  }
  options.signal.addEventListener('abort', dispose, { once: true });
  return { open, dispose };
}
