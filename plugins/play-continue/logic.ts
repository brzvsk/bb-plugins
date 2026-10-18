export const PROMPT =
  'Continue the unfinished task from where it stopped. Check the current state before repeating any action whose outcome is uncertain.';
export const WINDOW_MS = 400;

const ROOT = '[data-promptbox]';
const SUBMIT = '[data-promptbox-submit-group] button[data-promptbox-submit-action]';
const STOP = `${SUBMIT}[aria-label="Stop run"]`;
const POPUPS = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [aria-modal="true"]';

export interface ThreadState {
  status: string;
  queuedMessageCount?: number;
}
export interface TurnBoundary {
  type: string;
  data?: unknown;
}
export interface ComposerState {
  scope: { kind: string };
  isRunning: boolean;
  isSubmitting: boolean;
  isEmpty: boolean;
  attachmentCount: number;
}

// Only the latest turn boundary counts: never revive an older interrupted turn.
// An open turn on an idle thread was orphaned by a crash or restart.
export function resumable(thread: ThreadState | null, last: TurnBoundary | undefined): boolean {
  if (!thread || (thread.status !== 'idle' && thread.status !== 'error')) return false;
  if (thread.queuedMessageCount) return false;
  if (!last) return false;
  if (last.type === 'turn/started') return true;
  if (last.type !== 'turn/completed') return false;
  const status = (last.data as { status?: unknown } | undefined)?.status;
  return status === 'interrupted' || status === 'failed';
}

export function composerIdle(composer: ComposerState): boolean {
  return composer.scope.kind === 'thread' && !composer.isRunning && !composer.isSubmitting &&
    composer.isEmpty && composer.attachmentCount === 0;
}

const visible = (node: Element) => node.getClientRects().length > 0;

export function stopButton(root: Element | null): HTMLButtonElement | null {
  const button = root?.querySelector<HTMLButtonElement>(STOP);
  return button && !button.disabled && visible(button) ? button : null;
}

// The composer to stop: the one holding focus, or the only one on screen.
// Yields to menus, dialogs and editable fields outside the composer.
export function canStop(root: Element | null): boolean {
  if (!root || !visible(root) || !stopButton(root)) return false;
  const doc = root.ownerDocument;
  if ([...doc.querySelectorAll(POPUPS)].some(visible)) return false;
  const focused = doc.activeElement;
  if (focused?.closest('input, textarea, select, [contenteditable="true"]') && !root.contains(focused)) return false;
  if (focused && focused !== doc.body && focused.closest(ROOT) === root) return true;
  return [...doc.querySelectorAll(ROOT)].filter(visible).length === 1;
}

export function doubleEscape(
  win: Window,
  { canStop, stop, onArmed = () => {}, now = () => win.performance.now() }: {
    canStop: () => boolean;
    stop: () => void;
    onArmed?: (armed: boolean) => void;
    now?: () => number;
  },
): () => void {
  let last: number | null = null;
  let timer: number | undefined;
  const reset = () => {
    if (last === null) return;
    last = null;
    win.clearTimeout(timer);
    onArmed(false);
  };
  const key = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return reset();
    if (event.repeat) return;
    if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || !canStop()) return reset();
    const time = now();
    if (last === null || time - last > WINDOW_MS) {
      reset();
      last = time;
      onArmed(true);
      timer = win.setTimeout(reset, WINDOW_MS);
      return;
    }
    reset();
    event.preventDefault();
    stop();
  };
  // Capture: see the press before the editor turns Escape into a blur.
  win.addEventListener('keydown', key, true);
  win.addEventListener('blur', reset);
  return () => {
    reset();
    win.removeEventListener('keydown', key, true);
    win.removeEventListener('blur', reset);
  };
}

// While armed, the native Stop icon shows "Esc".
export function stopHint(root: () => Element | null): (armed: boolean) => void {
  let icon: SVGElement | null = null;
  let label: HTMLSpanElement | null = null;
  return armed => {
    if (icon) icon.style.display = '';
    label?.remove();
    icon = label = null;
    if (!armed) return;
    const button = stopButton(root());
    const svg = button?.querySelector('svg');
    if (!button || !svg) return;
    icon = svg;
    svg.style.display = 'none';
    label = button.ownerDocument.createElement('span');
    label.textContent = 'Esc';
    label.style.cssText = 'font-size:11px;font-weight:500;line-height:16px;';
    label.setAttribute('aria-hidden', 'true');
    button.append(label);
  };
}

const PLAY_ICON =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M5 3.3c0-.6.7-1 1.2-.7l6.5 4.7c.5.3.5 1.1 0 1.4l-6.5 4.7c-.5.3-1.2-.1-1.2-.7z"/></svg>';

// Send has no replacement slot: hide only the disabled native button and put
// an identically styled Play button in its place. Anything else restores it.
export function playButton(onClick: () => void): {
  sync: (root: Element | null, show: boolean, busy: boolean) => void;
  restore: () => void;
} {
  let play: HTMLButtonElement | null = null;
  let native: HTMLButtonElement | null = null;
  let menu: HTMLElement | null = null;
  const restore = () => {
    play?.remove();
    if (native) native.style.display = '';
    if (menu) menu.style.opacity = '';
    native = menu = null;
  };
  const sync = (root: Element | null, show: boolean, busy: boolean) => {
    const target = root?.querySelector<HTMLButtonElement>(`${SUBMIT}:not([data-play-continue])`);
    if (!show || !target || !target.disabled || target.matches(STOP)) return restore();
    if (native !== target) {
      restore();
      native = target;
      // The send-menu pill dims itself while Send is disabled.
      menu = target.closest<HTMLElement>('[data-promptbox-send-menu]');
    }
    if (target.style.display !== 'none') target.style.display = 'none';
    if (menu && menu.style.opacity !== '1') menu.style.opacity = '1';
    if (!play) {
      play = target.ownerDocument.createElement('button');
      play.type = 'button';
      play.dataset.playContinue = '';
      play.innerHTML = PLAY_ICON;
      play.title = 'Continue the interrupted turn';
      play.setAttribute('aria-label', 'Continue');
      // The pill drops Send's margin by its data attribute, which Play lacks;
      // keep Play square at Send's size.
      play.style.cssText = 'margin-left:0;aspect-ratio:1/1;padding:0;justify-content:center;';
      play.addEventListener('click', onClick);
    }
    if (play.className !== target.className) play.className = target.className;
    play.disabled = busy;
    if (play.previousElementSibling !== target) target.after(play);
  };
  return { sync, restore };
}

export const rootOf = (node: Element | null) => node?.closest(ROOT) ?? null;
