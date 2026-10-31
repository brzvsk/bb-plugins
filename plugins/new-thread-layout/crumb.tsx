import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { attachSwipeBack } from "./swipe";
import { experimental_useSidebarThreads, useBbContext, useBbNavigate } from "@get-bb/plugin-sdk/app";

const COMPOSE_PANEL = '[data-panel-id="root-compose-main-panel"]';
const COMPOSE_FRAME = `${COMPOSE_PANEL} [data-split-pane-id] > .relative.flex.h-full`;
const THREAD_TIMELINE = '[data-panel-id="thread-detail-timeline-panel"]';
const THREAD_HEADER_ROW = '[data-panel-id="thread-detail-timeline-panel"] [data-testid="app-page-header-content-row"]';

/**
 * Watches the document and returns the current set of host elements `find`
 * yields; `place` creates the plugin's holder inside one of them. Holders are
 * removed when they fall out of the result or on unmount.
 */
function useHolders(find: () => Element[], place: (host: Element) => HTMLElement): HTMLElement[] {
  const [holders, setHolders] = useState<HTMLElement[]>([]);
  useEffect(() => {
    const byHost = new Map<Element, HTMLElement>();
    let frame = 0;
    const sync = () => {
      frame = 0;
      const hosts = find();
      let changed = false;
      for (const [host, holder] of byHost) {
        if (!hosts.includes(host) || !holder.isConnected) {
          holder.remove();
          byHost.delete(host);
          changed = true;
        }
      }
      for (const host of hosts) {
        if (!byHost.has(host)) {
          byHost.set(host, place(host));
          changed = true;
        }
      }
      if (changed) setHolders([...byHost.values()]);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      for (const holder of byHost.values()) holder.remove();
    };
  }, [find, place]);
  return holders;
}

const findComposeFrames = () => Array.from(document.querySelectorAll(COMPOSE_FRAME));
const placeComposeBar = (host: Element) => {
  const bar = document.createElement("div");
  bar.className = "ph-topbar";
  bar.dataset.phTopbar = "";
  host.prepend(bar);
  return bar;
};

/** A row at the top of the New thread screen, in the place a thread's header row takes; null until the screen is on. */
export function useComposeTopBar(): HTMLElement | null {
  const bars = useHolders(findComposeFrames, placeComposeBar);
  return bars[0] ?? null;
}

const findThreadHeaderRows = () =>
  Array.from(document.querySelectorAll(THREAD_HEADER_ROW))
    .map(row => row.querySelector(":scope > div > div.pointer-events-auto"))
    .filter((el): el is Element => !!el);
const placeThreadCrumb = (host: Element) => {
  const holder = document.createElement("span");
  holder.className = "ph-crumb-holder";
  host.prepend(holder);
  return holder;
};

/** The project name before the thread title in every thread header; a click opens the project. */
export function ThreadProjectCrumb() {
  const { projectId } = useBbContext();
  const { projects } = experimental_useSidebarThreads();
  const navigate = useBbNavigate();
  const holders = useHolders(findThreadHeaderRows, placeThreadCrumb);
  const project = projectId ? projects.find(p => p.id === projectId) ?? null : null;
  const { threadId } = useBbContext();
  // Swipe right on a thread's timeline to go back to its project's home.
  useEffect(() => {
    if (!threadId || !projectId) return;
    return attachSwipeBack(document, {
      area: () => document.querySelector(THREAD_TIMELINE),
      onBack: () => navigate.toProject(projectId),
    });
  }, [threadId, projectId, navigate]);
  if (!project) return null;
  return (
    <>
      {holders.map((holder, i) =>
        createPortal(
          <a
            className="ph-crumb ph-crumb-link"
            href={project.href}
            title={`Open ${project.name}`}
            onClick={e => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              navigate.toProject(project.id);
            }}
          >
            <span className="ph-crumb-name">{project.name}</span>
            <span className="ph-crumb-sep" aria-hidden>/</span>
          </a>,
          holder,
          `${i}`,
        ),
      )}
    </>
  );
}

/** Pixels from a CSS length custom property on `el`, or null when unset or not a plain px/number. */
function cssPx(el: Element, name: string): number | null {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/** How close to the window's top edge the window's own row sits. */
const WINDOW_ROW_MAX_MID = 48;

/**
 * Buttons of the window's own row lying over the card: bb's controls (back, forward, sidebar
 * toggle) near the window's top edge whose span reaches into the card's left half. With an
 * expanded sidebar they sit over the sidebar instead and do not count.
 */
function windowRowControls(card: DOMRect, frame: Element): DOMRect[] {
  return Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]'))
    .filter(b => !frame.contains(b))
    .map(b => b.getBoundingClientRect())
    .filter(r => r.width > 0 && r.height > 0 && r.top >= 0 && r.top + r.height / 2 <= WINDOW_ROW_MAX_MID)
    .filter(r => r.right > card.left + 2 && r.left < card.left + card.width / 2);
}

/**
 * In the desktop app's framed layout the window's own row (traffic lights, back, forward, sidebar
 * toggle) sits above the content card, and bb lifts a thread's header into that row. On the New
 * thread screen there is no such header, so put the project name there ourselves: after the
 * window controls, centered on them. bb publishes that geometry as CSS variables
 * (--bb-window-title-bar-controls-end, --bb-macos-traffic-light-center-y); without them the
 * buttons above the card stand in. Wherever no window row runs above the card (the web app),
 * the name stays in the card's top row.
 */
export function useChromeRowPlacement(topBar: HTMLElement | null): void {
  useEffect(() => {
    const frame = topBar?.parentElement;
    if (!topBar || !frame) return;
    let placed = false;
    const reset = () => {
      if (!placed) return;
      topBar.removeAttribute("style");
      frame.removeAttribute("data-ph-chrome");
      placed = false;
    };
    const place = () => {
      const card = frame.getBoundingClientRect();
      const controls = windowRowControls(card, frame);
      const root = document.documentElement;
      const varEnd = cssPx(frame, "--bb-window-title-bar-controls-end") ?? cssPx(root, "--bb-window-title-bar-controls-end");
      const varMid = cssPx(frame, "--bb-macos-traffic-light-center-y") ?? cssPx(root, "--bb-macos-traffic-light-center-y");
      const domEnd = controls.length ? Math.max(...controls.map(r => r.right)) : null;
      const domMid = controls.length ? controls.reduce((sum, r) => sum + r.top + r.height / 2, 0) / controls.length : null;
      const mid = domMid ?? varMid;
      const end = Math.max(domEnd ?? 0, varEnd ?? 0) || null;
      // Follow the window row when its controls lie over the card (above it, or overlaying its top).
      if (mid === null || end === null || !controls.length) {
        reset();
        return;
      }
      topBar.style.position = "fixed";
      topBar.style.left = `${Math.max(end + 12, card.left + 12)}px`;
      topBar.style.top = `${mid}px`;
      topBar.style.height = "auto";
      topBar.style.padding = "0";
      topBar.style.transform = "translateY(-50%)";
      topBar.style.zIndex = "60";
      frame.setAttribute("data-ph-chrome", "");
      placed = true;
    };
    place();
    const timer = setInterval(place, 250);
    window.addEventListener("resize", place);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", place);
      topBar.removeAttribute("style");
      frame.removeAttribute("data-ph-chrome");
    };
  }, [topBar]);
}
