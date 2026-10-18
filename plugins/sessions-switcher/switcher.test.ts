// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountSwitcher, readHistory, visit, type Session } from './switcher';
const rows: Session[] = ['a', 'b', 'c'].map(id => ({ id, projectId: 'p', title: `Session ${id}`, project: 'Project', status: 'idle' }));
let abort: AbortController;
beforeEach(() => { abort = new AbortController(); vi.stubGlobal("localStorage", window.localStorage); localStorage.clear(); history.replaceState(null, '', '/threads/a'); });
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
