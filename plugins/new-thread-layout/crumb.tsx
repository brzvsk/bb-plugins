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
