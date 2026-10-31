import { useEffect } from "react";

/** bb's prompt box, on the New thread screen and in a thread alike. */
const PROMPTBOX = 'form[class*="group/promptbox"]';

/** A project name's leading emoji, if it has one: "☸️ COCKPIT" → "☸️". */
export function leadingEmoji(name: string | null | undefined): string | null {
  const m = name ? /^(\p{Extended_Pictographic}[\p{Extended_Pictographic}‍️]*)/u.exec(name) : null;
  return m ? m[1] : null;
}

// From the corner outward along the diagonal: large and medium-bright first, then smaller and fainter.
const TRAIL = [
  { size: 24, opacity: 0.45 },
  { size: 17, opacity: 0.3 },
  { size: 12, opacity: 0.18 },
  { size: 8, opacity: 0.1 },
] as const;
const GAP = 4;
/** Room the trail needs on each side of the prompt box; below it the frame stays off. */
const ROOM = 80;

function trail(emoji: string, corner: "start" | "end"): HTMLElement {
  const el = document.createElement("span");
  el.className = "ph-emoji-trail";
  el.dataset.corner = corner;
  el.setAttribute("aria-hidden", "true");
  let d = GAP;
  for (const { size, opacity } of TRAIL) {
    const item = document.createElement("span");
    item.textContent = emoji;
    const offset = `${-(d + size)}px`;
    // Top-left trail grows up and left from the box's corner; bottom-right mirrors it.
    if (corner === "start") Object.assign(item.style, { left: offset, top: offset });
    else Object.assign(item.style, { right: offset, bottom: offset });
    Object.assign(item.style, { fontSize: `${size}px`, opacity: String(opacity) });
    el.append(item);
    // Along the diagonal each step clears the previous glyph without a gap wide enough to break the line.
    d += size * 0.85 + 2;
  }
  return el;
}

/** Room beside the box up to the nearest ancestor that clips it (or the window), the narrower side. */
function sideRoom(box: Element): number {
  const r = box.getBoundingClientRect();
  for (let e = box.parentElement; e; e = e.parentElement) {
    if (getComputedStyle(e).overflowX === "visible") continue;
    const a = e.getBoundingClientRect();
    return Math.min(r.left - a.left, a.right - r.right);
  }
  return Math.min(r.left, window.innerWidth - r.right);
}

/**
 * Frames bb's prompt boxes within `scope` with the project's emoji: a diagonal trail off the
 * top-left and bottom-right corners, so the project in view reads at a glance. bb re-renders the
 * box freely, so the trails are put back whenever they fall out; narrow layouts get none.
 */
export function useEmojiFrame(emoji: string | null, scope: (() => ParentNode | null) | null) {
  useEffect(() => {
    if (!emoji || !scope) return;
    const placed = new Map<Element, HTMLElement[]>();
    const sync = () => {
      const root = scope();
      const boxes = new Set(root ? Array.from(root.querySelectorAll(PROMPTBOX)) : []);
      for (const [box, trails] of placed) {
        if (!boxes.has(box) || !box.isConnected) {
          trails.forEach(t => t.remove());
          placed.delete(box);
        }
      }
      for (const box of boxes) {
        let trails = placed.get(box);
        if (!trails) {
          trails = [trail(emoji, "start"), trail(emoji, "end")];
          placed.set(box, trails);
        }
        for (const t of trails) {
          if (t.parentElement !== box) box.append(t);
          t.hidden = sideRoom(box) < ROOM;
          // Under the composer there is little room before the window edge: a glyph that would be
          // cut is left out rather than shown in half, so the trail just ends sooner.
          if (!t.hidden)
            for (const item of Array.from(t.children) as HTMLElement[]) {
              item.style.visibility = "";
              const r = item.getBoundingClientRect();
              item.style.visibility = r.bottom > window.innerHeight || r.top < 0 ? "hidden" : "";
            }
        }
      }
    };
    sync();
    const mutations = new MutationObserver(sync);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", sync);
    return () => {
      mutations.disconnect();
      window.removeEventListener("resize", sync);
      for (const trails of placed.values()) trails.forEach(t => t.remove());
    };
  }, [emoji, scope]);
}
