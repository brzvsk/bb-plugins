/**
 * Two-finger trackpad swipe right → back, ported from browser-gestures for the
 * app shell: a dark arrow slides in from the left edge of `area`; lifting with
 * the arrow fully out calls `onBack`, pulling back cancels. Wheel events are the
 * only signal (a page cannot see fingers lift): the first event of a touch is
 * cancelable, momentum shows as a run of shrinking steps, and silence ends it.
 */
export interface SwipeBackOptions {
  /** The element the swipe must start in; null while the screen has none. */
  area(): Element | null;
  onBack(): void;
  now?: () => number;
}

const THRESHOLD = 160;
const GAP = 220;
/** A pause this long between wheel events starts a new touch, whatever the events' flags say. */
const NEW_TOUCH_GAP = 120;
/**
 * A cancelable event starts a new touch only after at least this pause. On a real trackpad only
 * the first event of a touch is cancelable; some input paths mark every event cancelable, and a
 * swipe streaming events every few milliseconds must not restart on each of them.
 */
const CANCELABLE_GAP = 45;
const HOLD_GAP = 600;
const DECIDE = 8;
const GLIDE_MIN = 6;
const GLIDE_RUN = 5;
const SIZE = 150;

function canScrollLeft(event: Event): boolean {
  return event.composedPath().some(node => {
    if (!(node instanceof Element)) return false;
    if (node.scrollWidth <= node.clientWidth + 1) return false;
    if (!/auto|scroll|overlay/.test(getComputedStyle(node).overflowX)) return false;
    return node.scrollLeft > 1;
  });
}

export function attachSwipeBack(doc: Document, opts: SwipeBackOptions): () => void {
  const now = opts.now ?? (() => Date.now());
  let last = 0;
  let x = 0;
  let y = 0;
  let mode: "idle" | "deciding" | "gesture" | "ignored" | "done" = "idle";
  let indicator: HTMLDivElement | null = null;
  let clip: HTMLDivElement | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let glide = 0;
  let prev = 0;
  let rect: DOMRect | null = null;

  // The arrow lives in a box over the swipe area that clips it at the area's left edge,
  // the way a browser window's edge hides half of Chrome's arrow.
  const ensureIndicator = () => {
    if (indicator?.isConnected && clip?.isConnected) return indicator;
    clip = doc.createElement("div");
    clip.setAttribute("data-ph-swipe-clip", "");
    clip.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;overflow:hidden;";
    const el = doc.createElement("div");
    el.setAttribute("data-ph-swipe-indicator", "");
    el.style.cssText =
      "position:absolute;top:50%;box-sizing:border-box;" +
      `width:${SIZE}px;height:${SIZE}px;margin-top:-${SIZE / 2}px;border-radius:50%;display:flex;` +
      "align-items:center;justify-content:flex-end;padding:0 14px 0 0;color:#fff;" +
      "transition:opacity .15s,background-color .12s;opacity:0;";
    el.innerHTML =
      '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H5M11 5l-7 7 7 7"/></svg>';
    clip.appendChild(el);
    doc.body.appendChild(clip);
    indicator = el;
    return el;
  };
  const show = (progress: number) => {
    clearTimeout(hideTimer);
    const el = ensureIndicator();
    if (clip && rect) {
      clip.style.left = `${rect.left}px`;
      clip.style.top = `${rect.top}px`;
      clip.style.width = `${rect.width}px`;
      clip.style.height = `${rect.height}px`;
    }
    const p = Math.max(0, Math.min(1, progress));
    el.style.left = `${-SIZE + p * (SIZE / 2)}px`;
    el.style.opacity = String(Math.min(1, p * 2));
    el.style.backgroundColor = p >= 1 ? "rgba(24,24,24,.92)" : "rgba(60,60,60,.55)";
  };
  const hide = (delay: number) => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (indicator) indicator.style.opacity = "0";
    }, delay);
  };
  const release = () => {
    if (mode !== "gesture") return;
    if (-x / THRESHOLD >= 1) {
      mode = "done";
      hide(200);
      opts.onBack();
      return;
    }
    mode = "idle";
    hide(0);
  };
  const onWheel = (event: WheelEvent) => {
    const t = now();
    const gap = t - last;
    const fresh = gap > NEW_TOUCH_GAP || (event.cancelable && gap > CANCELABLE_GAP);
    last = t;
    if (fresh) {
      if (mode === "gesture") release();
      x = 0;
      y = 0;
      mode = "deciding";
      glide = 0;
      prev = 0;
    }
    if (mode !== "deciding" && mode !== "gesture") return;
    x += event.deltaX;
    y += event.deltaY;
    if (mode === "deciding") {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.deltaMode !== 0) {
        mode = "ignored";
        return;
      }
      if (Math.abs(x) + Math.abs(y) < DECIDE) return;
      // Only a swipe right (back), not vertical scrolling or a swipe left.
      if (Math.abs(y) >= Math.abs(x) || x > 0) {
        mode = "ignored";
        return;
      }
      const area = opts.area();
      const target = event.target instanceof Node ? event.target : null;
      if (!area || !target || !area.contains(target) || canScrollLeft(event)) {
        mode = "ignored";
        return;
      }
      rect = area.getBoundingClientRect();
      mode = "gesture";
    }
    const step = Math.abs(event.deltaX);
    glide = event.deltaY === 0 && step >= GLIDE_MIN && step <= prev * 1.1 + 1 ? glide + 1 : 0;
    prev = step;
    const progress = -x / THRESHOLD;
    show(progress);
    if (progress >= 1 && glide >= GLIDE_RUN) release();
  };
  const timer = setInterval(() => {
    if (mode === "gesture" && now() - last > (-x / THRESHOLD >= 1 ? HOLD_GAP : GAP)) release();
  }, 50);
  // Not passive, as in browser-gestures: with only passive listeners Chromium may mark no wheel
  // event cancelable, and that flag is the main sign of a new touch. preventDefault is never called.
  doc.addEventListener("wheel", onWheel, { passive: false, capture: true });
  return () => {
    doc.removeEventListener("wheel", onWheel, { capture: true });
    clearInterval(timer);
    clearTimeout(hideTimer);
    clip?.remove();
  };
}
