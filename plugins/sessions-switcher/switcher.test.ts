// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { freeArea, mountSwitcher, readHistory, visit, type Session } from './switcher';
const rows: Session[] = ['a', 'b', 'c'].map(id => ({ id, projectId: 'p', title: `Session ${id}`, project: 'Project', status: 'idle' }));
let abort: AbortController;
// Node's built-in localStorage is undefined without --localstorage-file and shadows jsdom's.
function memoryStorage() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() }; }
beforeEach(() => { abort = new AbortController(); vi.stubGlobal("localStorage", memoryStorage()); localStorage.clear(); history.replaceState(null, '', '/threads/a'); });
afterEach(() => { abort.abort(); document.body.innerHTML = ''; vi.restoreAllMocks(); });
function setup(load = vi.fn(async () => rows)) { const navigate = vi.fn(); return { ...mountSwitcher({ signal: abort.signal, load, navigate }), navigate }; }
function key(type: string, key: string, modifiers = {}) { window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true, ...modifiers })); }
it('holds, cycles, releases; does not add emoji decorations', async () => {
 const c = setup(); key('keydown', '`', { metaKey: true }); await c.open();
 expect(document.querySelector('[aria-selected=true]')?.textContent).toContain('Session b');
 await c.open(); key('keyup', 'Meta'); expect(c.navigate).toHaveBeenCalledWith(rows[2]);
 expect(document.querySelector('.sessions-switcher')).toBeNull();
});
it('quick release during fetch commits when result arrives', async () => {
 let resolve!: (rows: Session[]) => void; const c = setup(vi.fn(() => new Promise<Session[]>(r => { resolve = r; })));
 key('keydown', '`', { metaKey: true }); const opened = c.open(); key('keyup', 'Meta'); resolve(rows); await opened;
 expect(c.navigate).toHaveBeenCalledWith(rows[1]);
});
it.each(['Escape', 'blur', 'dispose'])('cancels in-flight navigation on %s', async how => {
 let resolve!: (rows: Session[]) => void; const c = setup(vi.fn(() => new Promise<Session[]>(r => { resolve = r; })));
 key('keydown', '`', { metaKey: true }); const opened = c.open();
 if (how === 'Escape') key('keydown', 'Escape'); else if (how === 'blur') window.dispatchEvent(new Event('blur')); else abort.abort();
 key('keyup', 'Meta'); resolve(rows); await opened;
 expect(c.navigate).not.toHaveBeenCalled(); expect(document.querySelector('.sessions-switcher')).toBeNull();
});
it('uses the actual rebound modifier and keeps palette opens persistent', async () => {
 const c = setup(); key('keydown', 's', { altKey: true }); await c.open(); key('keyup', 'Meta'); expect(c.navigate).not.toHaveBeenCalled(); key('keyup', 'Alt'); expect(c.navigate).toHaveBeenCalledOnce();
 await c.open(true); key('keyup', 'Alt'); expect(c.navigate).toHaveBeenCalledOnce(); key('keydown', 'Enter'); expect(c.navigate).toHaveBeenCalledTimes(2);
});
it('restores focus on cancellation and removes listeners on disposal', async () => {
 const input = document.createElement('input'); document.body.append(input); input.focus(); const c = setup(); await c.open(true); key('keydown', 'Escape'); expect(document.activeElement).toBe(input);
 c.dispose(); await c.open(true); abort.abort(); expect(document.querySelector('.sessions-switcher')).toBeNull();
});
it('stores bounded deduplicated visit history and tolerates malformed storage', () => {
 localStorage.setItem('sessions-switcher:recent:v1', '{'); expect(readHistory()).toEqual([]);
 visit('b'); visit('a'); visit('b'); expect(readHistory()).toEqual(['b', 'a']);
});

it('hover selects the final row and modifier release opens exactly that session', async () => {
 const c = setup(); key('keydown', '`', { metaKey: true }); await c.open();
 const buttons = document.querySelectorAll('[role=option]');
 buttons[2].dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));
 buttons[0].dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));
 expect(document.querySelector('[aria-selected=true]')?.textContent).toContain('Session a');
 expect(document.querySelector('[role=listbox]')?.getAttribute('aria-activedescendant')).toBe('session-choice-0');
 expect(c.navigate).not.toHaveBeenCalled();
 key('keyup', 'Meta'); expect(c.navigate).toHaveBeenCalledExactlyOnceWith(rows[0]);
});
it('stationary hover does not steal keyboard selection and Escape cancels pointer selection', async () => {
 const c = setup(); key('keydown', '`', { metaKey: true }); await c.open();
 const row = document.querySelectorAll('[role=option]')[2];
 row.dispatchEvent(new MouseEvent('pointerenter'));
 expect(document.querySelector('[aria-selected=true]')?.textContent).toContain('Session b');
 row.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));
 key('keydown', 'Escape'); key('keyup', 'Meta'); expect(c.navigate).not.toHaveBeenCalled();
});
it('retains the held modifier across the host command dispatch microtask', async () => {
 const c = setup();
 key('keydown', 'Meta', { metaKey: true });
 key('keydown', '`', { metaKey: true });
 // Native event dispatch can checkpoint microtasks between listeners.
 await Promise.resolve();
 await c.open();
 document.querySelectorAll('[role=option]')[2].dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));
 key('keyup', 'Meta');
 expect(c.navigate).toHaveBeenCalledExactlyOnceWith(rows[2]);
 expect(document.querySelector('.sessions-switcher')).toBeNull();
});
it('publishes status targets only for displayed rows and releases them on close', async () => {
 const setStatusTargets = vi.fn();
 const c = mountSwitcher({ signal: abort.signal, load: async () => rows, navigate: vi.fn(), setStatusTargets });
 await c.open(true);
 expect(setStatusTargets.mock.lastCall?.[0].map((target: any) => target.id)).toEqual(['a', 'b', 'c']);
 expect(setStatusTargets.mock.lastCall?.[0].every((target: any) => target.element.isConnected)).toBe(true);
 key('keydown', 'Escape'); expect(setStatusTargets).toHaveBeenLastCalledWith([]);
});
it('cycles cards horizontally and navigates immediately while the old surface fades', async () => {
 vi.useFakeTimers();
 try {
  const c = setup(); key('keydown', '`', { metaKey: true }); await c.open();
  key('keydown', 'ArrowRight', { metaKey: true });
  expect(document.querySelector('[aria-selected=true]')?.textContent).toContain('Session c');
  key('keydown', 'ArrowLeft', { metaKey: true });
  key('keyup', 'Meta');
  expect(c.navigate).toHaveBeenCalledExactlyOnceWith(rows[1]);
  expect(document.querySelector('.sessions-switcher')).toBeNull();
  expect(document.querySelector('.sessions-switcher-exit')?.getAttribute('aria-hidden')).toBe('true');
  await vi.advanceTimersByTimeAsync(80);
  expect(document.querySelector('.sessions-switcher-exit')).toBeNull();
 } finally { vi.useRealTimers(); }
});
it('reopening and disposal clear an in-progress exit animation', async () => {
 const c = setup(); await c.open(true); key('keydown', 'Escape');
 expect(document.querySelector('.sessions-switcher-exit')).not.toBeNull();
 await c.open(true); expect(document.querySelector('.sessions-switcher-exit')).toBeNull();
 key('keydown', 'Escape'); c.dispose();
 expect(document.querySelector('.sessions-switcher-exit')).toBeNull();
});

it('changes layout without losing selection or held-modifier commit', async () => {
 const c = setup(); key('keydown', '`', { metaKey: true }); await c.open();
 expect(document.querySelector('[role=listbox]')?.getAttribute('aria-orientation')).toBe('horizontal');
 c.setLayout('vertical');
 expect(document.querySelector('.sessions-switcher')?.getAttribute('data-layout')).toBe('vertical');
 expect(document.querySelector('[role=listbox]')?.getAttribute('aria-orientation')).toBe('vertical');
 expect(document.querySelector('[aria-selected=true]')?.textContent).toContain('Session b');
 key('keydown', 'ArrowDown', { metaKey: true }); key('keyup', 'Meta');
 expect(c.navigate).toHaveBeenCalledExactlyOnceWith(rows[2]);
 expect(document.querySelector('.sessions-switcher-exit')?.getAttribute('data-layout')).toBe('vertical');
});
const view = { left: 0, top: 0, right: 1400, bottom: 900 };
it('keeps the full viewport without a visible Browser tab', () => {
 expect(freeArea(view, [])).toBeNull(); expect(freeArea(view, [{ left: 2000, top: 0, right: 2400, bottom: 900 }])).toBeNull();
});
it('uses the largest band no Browser tab covers, including between two Browser tabs', () => {
 expect(freeArea(view, [{ left: 900, top: 40, right: 1400, bottom: 900 }])).toEqual({ left: 0, top: 0, right: 900, bottom: 900 });
 expect(freeArea(view, [{ left: 0, top: 0, right: 400, bottom: 900 }, { left: 1000, top: 0, right: 1400, bottom: 900 }])).toEqual({ left: 400, top: 0, right: 1000, bottom: 900 });
 expect(freeArea(view, [{ left: 300, top: 500, right: 1400, bottom: 900 }])).toEqual({ left: 0, top: 0, right: 1400, bottom: 500 });
});
it('falls back to the full viewport when no free band is large enough', () => {
 expect(freeArea(view, [{ left: 200, top: 0, right: 1400, bottom: 900 }])).toBeNull();
});
it('positions the overlay beside a visible Browser tab and restores full width without it', async () => {
 const browser = document.createElement('div'); browser.dataset.appBrowser = ''; document.body.append(browser);
 vi.spyOn(browser, 'getBoundingClientRect').mockReturnValue({ left: 700, top: 0, right: window.innerWidth, bottom: window.innerHeight } as DOMRect);
 const c = setup(); await c.open(true);
 expect(document.querySelector<HTMLElement>('.sessions-switcher')?.style.inset).toBe(`0px ${window.innerWidth - 700}px 0px 0px`);
 key('keydown', 'Escape'); browser.remove(); await c.open(true);
 expect(document.querySelector<HTMLElement>('.sessions-switcher')?.style.inset).toBe('');
});
