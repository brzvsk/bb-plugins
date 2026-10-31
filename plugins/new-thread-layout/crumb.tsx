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

const CHROME_CONTROLS = 'button[data-sidebar][aria-label^="Toggle sidebar"], button[aria-label="Go back"], button[aria-label="Go forward"]';

/**
 * In the desktop app's framed layout the window's own row (traffic lights, back, forward, sidebar
 * toggle) sits above the content card, and bb lifts a thread's header into that row. On the New
 * thread screen there is no such header, so put the project name there ourselves: right of the
 * last window control and centered on it. Wherever those controls are not above the card (the
 * web app, an expanded sidebar beside the card), the name stays in the card's top row.
 */
export function useChromeRowPlacement(topBar: HTMLElement | null): void {
  useEffect(() => {
    const frame = topBar?.parentElement;
    if (!topBar || !frame) return;
    let placed = false;
    const place = () => {
      const card = frame.getBoundingClientRect();
      const controls = Array.from(document.querySelectorAll<HTMLElement>(CHROME_CONTROLS))
        .map(b => b.getBoundingClientRect())
        .filter(r => r.width > 0 && r.bottom <= card.top + 1 && r.left < card.right);
      if (!controls.length) {
        if (placed) {
          topBar.removeAttribute("style");
          frame.removeAttribute("data-ph-chrome");
          placed = false;
        }
        return;
      }
      const right = Math.max(...controls.map(r => r.right));
      const mid = controls.reduce((sum, r) => sum + r.top + r.height / 2, 0) / controls.length;
      const left = Math.max(right + 12, card.left + 12);
      topBar.style.position = "fixed";
      topBar.style.left = `${left}px`;
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
