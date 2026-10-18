export const cleanupScript = `(globalThis.__bbBrowserGestures?.dispose(), true)`;

export function installScript(): string {
  return `(() => {
    const key = '__bbBrowserGestures';
    const old = globalThis[key];
    if (old) { return old.renew(); }
    const THRESHOLD = 160;
    const GAP = 220;
    const HOLD_GAP = 600;
    const DECIDE = 8;
    let lease = Date.now() + 2500;
    let last = 0;
    let x = 0;
    let y = 0;
    let mode = "idle";
    let direction = 0;
    let diagnostic = "waiting for wheel input";
    let indicator = null;
    let hideTimer = 0;
    let glide = 0;
    let prev = 0;
    const GLIDE_MIN = 6;
    const GLIDE_RUN = 5;
    const canGo = dir => {
      const nav = globalThis.navigation;
      if (!nav || typeof nav.canGoBack !== "boolean") return true;
      return dir < 0 ? nav.canGoBack : nav.canGoForward;
    };
    const canScroll = (event, dir) => event.composedPath().some(node => {
      if (!(node instanceof Element)) return false;
      if (node.scrollWidth <= node.clientWidth + 1) return false;
      const isRoot = node === document.scrollingElement || node === document.documentElement || node === document.body;
      if (!isRoot && !/auto|scroll|overlay/.test(getComputedStyle(node).overflowX)) return false;
      const max = node.scrollWidth - node.clientWidth;
      return dir < 0 ? node.scrollLeft > 1 : node.scrollLeft < max - 1;
    });
    const SIZE = 150;
    const ensureIndicator = () => {
      if (indicator && indicator.isConnected) return indicator;
      const el = document.createElement("div");
      el.setAttribute("data-bb-browser-gestures-indicator", "");
      el.style.cssText = "position:fixed;top:50%;z-index:2147483647;pointer-events:none;box-sizing:border-box;width:" + SIZE + "px;height:" + SIZE + "px;margin-top:-" + SIZE / 2 + "px;border-radius:50%;display:flex;align-items:center;color:#fff;transition:opacity .15s,background-color .12s;opacity:0;";
      el.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H5M11 5l-7 7 7 7"/></svg>';
      (document.body || document.documentElement).appendChild(el);
      indicator = el;
      return el;
    };
    const show = (dir, progress) => {
      clearTimeout(hideTimer);
      const el = ensureIndicator();
      const p = Math.max(0, Math.min(1, progress));
      const offset = -SIZE + p * (SIZE / 2) + "px";
      el.style.left = dir < 0 ? offset : "";
      el.style.right = dir < 0 ? "" : offset;
      el.style.justifyContent = dir < 0 ? "flex-end" : "flex-start";
      el.style.padding = dir < 0 ? "0 14px 0 0" : "0 0 0 14px";
      el.firstChild.style.transform = dir < 0 ? "" : "scaleX(-1)";
      el.style.opacity = String(Math.min(1, p * 2));
      el.style.backgroundColor = p >= 1 ? "rgba(24,24,24,.92)" : "rgba(60,60,60,.55)";
    };
    const hide = delay => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { if (indicator) indicator.style.opacity = "0"; }, delay);
    };
    const commit = reason => {
      mode = "done";
      diagnostic = "navigated " + (direction < 0 ? "back" : "forward") + " on " + reason;
      hide(200);
      history.go(direction);
    };
    const release = reason => {
      if (mode !== "gesture") return;
      if ((x * direction) / THRESHOLD >= 1) { commit(reason); return; }
      mode = "idle";
      diagnostic = "cancelled on " + reason;
      hide(0);
    };
    const onWheel = event => {
      const now = Date.now();
      if (now > lease) { dispose(); return; }
      last = now;
      if (event.cancelable) {
        if (mode === "gesture") release("new touch");
        x = 0; y = 0; mode = "deciding"; direction = 0; glide = 0; prev = 0;
      }
      if (mode !== "deciding" && mode !== "gesture") return;
      x += event.deltaX;
      y += event.deltaY;
      if (mode === "deciding") {
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.deltaMode !== 0) {
          mode = "ignored"; diagnostic = "ignored: modifier or non-pixel wheel"; return;
        }
        if (Math.abs(x) + Math.abs(y) < DECIDE) return;
        if (Math.abs(y) >= Math.abs(x)) { mode = "ignored"; diagnostic = "ignored: vertical"; return; }
        direction = x < 0 ? -1 : 1;
        if (canScroll(event, direction)) { mode = "ignored"; diagnostic = "ignored: horizontal scroller"; return; }
        if (!canGo(direction)) { mode = "ignored"; diagnostic = "ignored: no history " + (direction < 0 ? "back" : "forward"); return; }
        mode = "gesture";
        diagnostic = "gesture " + (direction < 0 ? "back" : "forward");
      }
      const step = Math.abs(event.deltaX);
      glide = event.deltaY === 0 && step >= GLIDE_MIN && step <= prev * 1.1 + 1 ? glide + 1 : 0;
      prev = step;
      const progress = (x * direction) / THRESHOLD;
      show(direction, progress);
      if (progress >= 1 && glide >= GLIDE_RUN) release("momentum");
    };
    const timer = setInterval(() => {
      if (Date.now() > lease) { dispose(); return; }
      if (mode === "gesture" && Date.now() - last > ((x * direction) / THRESHOLD >= 1 ? HOLD_GAP : GAP)) release("quiet");
    }, 50);
    const dispose = () => {
      document.removeEventListener('wheel', onWheel, { capture: true });
      clearInterval(timer);
      clearTimeout(hideTimer);
      if (indicator) indicator.remove();
      document.documentElement.removeAttribute("data-bb-browser-gestures");
      delete globalThis[key];
    };
    globalThis[key] = { dispose, renew() { lease = Date.now() + 2500; return diagnostic; } };
    document.documentElement.setAttribute("data-bb-browser-gestures", "active");
    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return diagnostic;
  })()`;
}
