import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { installScript, cleanupScript } from './page-script.ts';

function fixture({ canGoBack = true, canGoForward = true, start = 10000 } = {}) {
  let now = start;
  const listeners = new Set();
  const intervals = new Set();
  const moves = [];
  class Element { scrollWidth = 100; clientWidth = 100; scrollLeft = 0; overflowX = 'visible'; }
  const node = () => ({ style: {}, firstChild: { style: {} }, isConnected: true, setAttribute() {}, remove() { this.isConnected = false; } });
  const appended = [];
  const context = vm.createContext({
    history: { go: direction => moves.push(direction) }, Element, Date: { now: () => now }, Math, String,
    navigation: { canGoBack, canGoForward },
    getComputedStyle: el => ({ overflowX: el.overflowX }),
    document: {
      documentElement: { setAttribute() {}, removeAttribute() {}, appendChild: el => appended.push(el) },
      body: { appendChild: el => appended.push(el) },
      createElement: node,
      addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn),
    },
    setInterval: fn => { intervals.add(fn); return fn; }, clearInterval: fn => intervals.delete(fn),
    setTimeout: () => 0, clearTimeout: () => {},
  });
  const run = source => vm.runInContext(`(${source}\n)`, context);
  run(installScript());
  let renewing = true;
  let renewedAt = now;
  const advance = ms => {
    const until = now + ms;
    while (now + 50 <= until) {
      now += 50;
      if (renewing && listeners.size && now - renewedAt >= 250) { renewedAt = now; run(installScript()); }
      for (const fn of [...intervals]) fn();
    }
    now = until;
  };
  const wheel = (changes = {}, path = []) => {
    const event = { deltaX: -40, deltaY: 0, deltaMode: 0, cancelable: false,
      composedPath: () => path, preventDefault() {}, ...changes };
    for (const fn of listeners) fn(event);
    advance(16);
  };
  const swipe = (deltaX, steps, changes = {}, path) => {
    for (let i = 0; i < steps; i++) wheel({ deltaX, deltaY: i % 2 ? 1 : -1, cancelable: i === 0, ...changes }, path);
  };
  const lift = () => advance(700);
  return { stopRenewing: () => { renewing = false; }, run, wheel, swipe, lift, advance, moves, listeners, intervals, appended, Element, at: t => { now = t; } };
}

test('a new touch starts a gesture right away, even within momentum of the previous one', () => {
  const f = fixture();
  for (const d of [-60, -55, -50, -45]) f.wheel({ deltaX: d, deltaY: 0 });
  assert.deepEqual(f.moves, []);
  f.swipe(-20, 12); f.lift();
  assert.deepEqual(f.moves, [-1]);
  assert.equal(f.appended.length, 1);
});

test('threshold and direction', () => {
  const f = fixture();
  f.swipe(-20, 6); f.lift(); assert.deepEqual(f.moves, []);
  f.swipe(-20, 20); f.lift(); assert.deepEqual(f.moves, [-1]);
  f.swipe(25, 10); f.lift();
  assert.deepEqual(f.moves, [-1, 1]);
});

test('holding at full with small jittery deltas does not navigate until lift; pulling back cancels', () => {
  const f = fixture();
  f.swipe(-40, 6);
  for (let i = 0; i < 60; i++) f.wheel({ deltaX: -(1 + (i % 3)), deltaY: i % 2 ? -1 : 0 });
  f.advance(130);
  for (let i = 0; i < 10; i++) f.wheel({ deltaX: -1, deltaY: 0 });
  f.advance(450);
  assert.deepEqual(f.moves, []);
  f.lift();
  assert.deepEqual(f.moves, [-1]);
  const back = fixture();
  back.swipe(-40, 6); back.swipe(30, 4, { cancelable: false }); back.lift();
  assert.deepEqual(back.moves, []);
});

test('smooth momentum after release navigates without waiting for it to end', () => {
  const f = fixture();
  f.swipe(-60, 4);
  for (const d of [-67, -64, -59, -55, -51, -47]) f.wheel({ deltaX: d, deltaY: 0 });
  assert.deepEqual(f.moves, [-1]);
});

test('vertical starts keep the whole gesture as scroll', () => {
  const f = fixture();
  f.wheel({ deltaX: 0, deltaY: 30, cancelable: true });
  f.swipe(-40, 10, { cancelable: false }); f.lift();
  assert.deepEqual(f.moves, []);
});

test('a horizontal scroller that can still move wins; at its edge the swipe navigates', () => {
  const f = fixture(); const scroller = new f.Element();
  Object.assign(scroller, { scrollWidth: 500, clientWidth: 100, overflowX: 'auto', scrollLeft: 50 });
  f.swipe(-40, 10, {}, [scroller]); f.lift();
  assert.deepEqual(f.moves, []);
  scroller.scrollLeft = 0;
  f.swipe(-40, 10, {}, [scroller]); f.lift();
  assert.deepEqual(f.moves, [-1]);
});

test('modifiers, non-pixel wheels and missing history are ignored', () => {
  for (const changes of [{ ctrlKey: true }, { shiftKey: true }, { deltaMode: 1 }]) {
    const f = fixture(); f.swipe(-40, 10, changes); f.lift(); assert.deepEqual(f.moves, []);
  }
  const noBack = fixture({ canGoBack: false }); noBack.swipe(-40, 10); noBack.lift(); assert.deepEqual(noBack.moves, []);
});

test('renewal does not duplicate listeners and disposal and expired leases remove them', () => {
  const f = fixture(); f.run(installScript()); assert.equal(f.listeners.size, 1);
  f.run(cleanupScript); assert.equal(f.listeners.size, 0); assert.equal(f.intervals.size, 0);
  f.run(installScript()); f.stopRenewing(); f.advance(3000); f.wheel(); assert.equal(f.listeners.size, 0);
});

test('recorded MacBook trackpad sessions: every full swipe navigates once, momentum tails never start one, holds wait for lift', () => {
  const pages = JSON.parse(fs.readFileSync(new URL('./fixtures/trackpad-trace.json', import.meta.url)));
  const touches = [];
  for (const events of pages) {
    let current;
    for (const event of events) {
      if (event[3] === 1 || !current) { current = []; touches.push(current); }
      current.push(event);
    }
  }
  const outcomes = touches.map(events => {
    const f = fixture({ start: events[0][0] - 500 });
    let navigatedAt = null;
    events.forEach(([t, dx, dy, c], index) => {
      if (navigatedAt !== null) return;
      f.advance(Math.max(0, t - (events[index - 1]?.[0] ?? t) - 16));
      f.wheel({ deltaX: dx, deltaY: dy, cancelable: c === 1 });
      if (f.moves.length) navigatedAt = index;
    });
    if (navigatedAt === null) f.lift();
    return { moves: f.moves, navigatedAt, touch: events[0][3] === 1, total: events.reduce((sum, e) => sum + e[1], 0), length: events.length };
  });
  for (const outcome of outcomes) {
    if (outcome.touch && Math.abs(outcome.total) >= 160) assert.deepEqual(outcome.moves, [Math.sign(outcome.total)]);
    else assert.deepEqual(outcome.moves, []);
  }
  const holds = outcomes.filter(o => o.length > 60);
  assert.ok(holds.length >= 2);
  for (const hold of holds) assert.equal(hold.navigatedAt, null);
});
