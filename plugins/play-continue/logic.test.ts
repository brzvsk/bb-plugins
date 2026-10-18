// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canStop, composerIdle, doubleEscape, playButton, resumable, stopHint } from './logic';

const idleThread = { status: 'idle', queuedMessageCount: 0 };
const completed = (status: string) => ({ type: 'turn/completed', data: { status } });

describe('resumable', () => {
  it('accepts interrupted, failed and orphaned latest turns', () => {
    expect(resumable(idleThread, completed('interrupted'))).toBe(true);
    expect(resumable({ status: 'error' }, completed('failed'))).toBe(true);
    expect(resumable(idleThread, { type: 'turn/started' })).toBe(true);
  });
  it('rejects completed turns, busy or queued threads and missing history', () => {
    expect(resumable(idleThread, completed('completed'))).toBe(false);
    expect(resumable({ status: 'active' }, completed('interrupted'))).toBe(false);
    expect(resumable({ status: 'stopping' }, { type: 'turn/started' })).toBe(false);
    expect(resumable({ status: 'pending' }, undefined)).toBe(false);
    expect(resumable({ status: 'idle', queuedMessageCount: 1 }, completed('interrupted'))).toBe(false);
    expect(resumable(idleThread, undefined)).toBe(false);
    expect(resumable(null, completed('interrupted'))).toBe(false);
  });
});

describe('composerIdle', () => {
  const base = { scope: { kind: 'thread' }, isRunning: false, isSubmitting: false, isEmpty: true, attachmentCount: 0 };
  it('requires an empty idle thread composer', () => {
    expect(composerIdle(base)).toBe(true);
    expect(composerIdle({ ...base, isEmpty: false })).toBe(false);
    expect(composerIdle({ ...base, attachmentCount: 1 })).toBe(false);
    expect(composerIdle({ ...base, isRunning: true })).toBe(false);
    expect(composerIdle({ ...base, isSubmitting: true })).toBe(false);
    expect(composerIdle({ ...base, scope: { kind: 'queued-message' } })).toBe(false);
  });
});

// jsdom has no layout; treat every attached element as visible.
Element.prototype.getClientRects = function () {
  return (this.isConnected ? [{}] : []) as unknown as DOMRectList;
};

function composerDom(running: boolean, disabled = true) {
  document.body.innerHTML = `
    <div data-promptbox>
      <div contenteditable="true"></div>
      <div data-promptbox-submit-group><div data-promptbox-send-menu>
        ${running
          ? '<button data-promptbox-submit-action aria-label="Stop run" class="stop"><svg></svg></button>'
          : `<button data-promptbox-submit-action aria-label="Submit" class="send" ${disabled ? 'disabled' : ''}><svg></svg></button>`}
      </div></div>
    </div>`;
  return document.querySelector('[data-promptbox]')!;
}

const esc = (init: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, ...init });

describe('doubleEscape', () => {
  let off = () => {};
  afterEach(() => off());

  function setup(allowed = () => true) {
    let time = 0;
    const stop = vi.fn();
    const armed: boolean[] = [];
    off = doubleEscape(window, { canStop: allowed, stop, onArmed: value => armed.push(value), now: () => time });
    return { stop, armed, at: (t: number) => (time = t) };
  }

  it('stops on two presses within 400 ms', () => {
    const { stop, armed, at } = setup();
    window.dispatchEvent(esc());
    at(300);
    const second = esc();
    window.dispatchEvent(second);
    expect(stop).toHaveBeenCalledOnce();
    expect(second.defaultPrevented).toBe(true);
    expect(armed).toEqual([true, false]);
  });
  it('ignores slow presses, repeats, modifiers and other keys', () => {
    const { stop, at } = setup();
    window.dispatchEvent(esc());
    at(500);
    window.dispatchEvent(esc());
    at(600);
    window.dispatchEvent(esc({ repeat: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    at(700);
    window.dispatchEvent(esc({ shiftKey: true }));
    expect(stop).not.toHaveBeenCalled();
  });
  it('does nothing when the composer cannot stop', () => {
    const { stop, armed } = setup(() => false);
    window.dispatchEvent(esc());
    window.dispatchEvent(esc());
    expect(stop).not.toHaveBeenCalled();
    expect(armed).toEqual([]);
  });
});

describe('canStop', () => {
  it('needs a running composer and yields to popups and outside fields', () => {
    expect(canStop(composerDom(false))).toBe(false);
    const root = composerDom(true);
    expect(canStop(root)).toBe(true);
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    expect(canStop(root)).toBe(false);
    input.remove();
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    document.body.append(menu);
    expect(canStop(root)).toBe(false);
  });
  it('requires focus when several composers are visible', () => {
    const root = composerDom(true);
    document.body.append(root.cloneNode(true));
    expect(canStop(root)).toBe(false);
    const editor = root.querySelector<HTMLElement>('[contenteditable]')!;
    editor.focus();
    expect(canStop(root)).toBe(true);
  });
});

describe('stopHint', () => {
  it('swaps the Stop icon for Esc and back', () => {
    const root = composerDom(true);
    const hint = stopHint(() => root);
    hint(true);
    expect(root.querySelector('svg')!.style.display).toBe('none');
    expect(root.querySelector('button')!.textContent).toBe('Esc');
    hint(false);
    expect(root.querySelector('svg')!.style.display).toBe('');
    expect(root.querySelector('button')!.textContent).toBe('');
  });
});

describe('playButton', () => {
  it('replaces only the disabled native Send and restores it', () => {
    const root = composerDom(false);
    const click = vi.fn();
    const play = playButton(click);
    const send = root.querySelector<HTMLButtonElement>('.send')!;
    play.sync(root, true, false);
    const button = root.querySelector<HTMLButtonElement>('[data-play-continue]')!;
    expect(send.style.display).toBe('none');
    expect(button.className).toBe('send');
    expect(button.style.padding).toBe('0px');
    expect(button.style.marginLeft).toBe('0px');
    const menu = root.querySelector<HTMLElement>('[data-promptbox-send-menu]')!;
    expect(menu.style.opacity).toBe('1');
    expect(button.previousElementSibling).toBe(send);
    button.click();
    expect(click).toHaveBeenCalledOnce();
    send.disabled = false; // the user typed
    play.sync(root, true, false);
    expect(root.querySelector('[data-play-continue]')).toBeNull();
    expect(send.style.display).toBe('');
    expect(menu.style.opacity).toBe('');
  });
  it('never hides Stop or shows when ineligible', () => {
    const play = playButton(() => {});
    const running = composerDom(true);
    play.sync(running, true, false);
    expect(running.querySelector('[data-play-continue]')).toBeNull();
    const idle = composerDom(false);
    play.sync(idle, false, false);
    expect(idle.querySelector('[data-play-continue]')).toBeNull();
    play.sync(idle, true, false);
    play.restore();
    expect(idle.querySelector('[data-play-continue]')).toBeNull();
    expect(idle.querySelector<HTMLButtonElement>('.send')!.style.display).toBe('');
  });
});
