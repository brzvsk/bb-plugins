import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { attachSwipeBack } from "./swipe";
import {
  ThreadTitle,
  experimental_Icon as Icon,
  experimental_ThreadActionsMenu as ThreadMenu,
  experimental_useSidebarThreads,
  useBbContext,
  useBbNavigate,
} from "@get-bb/plugin-sdk/app";
import { actionTarget } from "./actions";

const COMPOSE_PANEL = '[data-panel-id="root-compose-main-panel"]';
const COMPOSE_FRAME = `${COMPOSE_PANEL} [data-split-pane-id] > .relative.flex.h-full`;
const THREAD_TIMELINE = '[data-panel-id="thread-detail-timeline-panel"]';
const PANEL_TABS = '[data-testid="thread-secondary-panel-top-chrome"] [role="toolbar"]';
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

const findPanelTabStrips = () => Array.from(document.querySelectorAll(PANEL_TABS));
const placePanelNav = (host: Element) => {
  const holder = document.createElement("span");
  holder.className = "ph-maxnav-holder";
  holder.hidden = true;
  host.prepend(holder);
  return holder;
};

/**
 * The project name before the thread title in every thread header; a click opens the project.
 * With the right panel maximized bb hides the thread header, so the same navigation (project /
 * thread ⋯) leads the panel's tab strip there, followed by a separator.
 */
export function ThreadProjectCrumb() {
  const { projectId } = useBbContext();
  const { projects, threads } = experimental_useSidebarThreads();
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
  const maxHolders = useHolders(findPanelTabStrips, placePanelNav);
  // The nav shows only while the panel is maximized, i.e. the thread's timeline is collapsed.
  useEffect(() => {
    if (!maxHolders.length) return;
    const sync = () => {
      for (const holder of maxHolders) {
        const pane = holder.closest("[data-split-pane-id]") ?? document;
        const timeline = pane.querySelector(THREAD_TIMELINE) ?? document.querySelector(THREAD_TIMELINE);
        const collapsed = !timeline || timeline.getBoundingClientRect().width < 40;
        if (holder.hidden === collapsed) holder.hidden = !collapsed;
      }
    };
    sync();
    const timer = setInterval(sync, 200);
    return () => clearInterval(timer);
  }, [maxHolders]);
  const thread = threadId ? threads.find(t => t.id === threadId) ?? null : null;
  if (!project) return null;
  return (
    <>
      {thread
        ? maxHolders.map((holder, i) =>
            createPortal(
              <span className="ph-maxnav">
                <HomeLink current={false} />
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
                </a>
                <span className="ph-maxnav-title">
                  <ThreadTitle threadId={thread.id} />
                </span>
                <ThreadMenu
                  thread={actionTarget(thread)}
                  align="start"
                  trigger={props => (
                    <button {...props} type="button" className="ph-maxnav-menu" aria-label="Thread actions" title="Thread actions">
                      <Icon name="MoreHorizontal" className="ph-action-icon" aria-hidden />
                    </button>
                  )}
                />
                <span className="ph-maxnav-sep" aria-hidden />
              </span>,
              holder,
              `max-${i}`,
            ),
          )
        : null}
      {holders.map((holder, i) =>
        createPortal(
          <span className="ph-crumb-row">
          <HomeLink current={false} />
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
          </a>
          </span>,
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
 * The desktop app on macOS lifts every page header into the window's own row (traffic lights,
 * back, forward, sidebar toggle), centered on the traffic lights; bb publishes that center as
 * --bb-macos-traffic-light-center-y, which the web app does not set. The New thread screen has
 * no such header, so put the project name there ourselves, where a thread's header puts its
 * title: after the window controls when they lie over the card (collapsed sidebar), else at the
 * card's left inset. Without that variable the name stays in the card's top row.
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
      const mid = cssPx(frame, "--bb-macos-traffic-light-center-y") ?? cssPx(document.documentElement, "--bb-macos-traffic-light-center-y");
      if (mid === null) {
        reset();
        return;
      }
      const card = frame.getBoundingClientRect();
      const controls = windowRowControls(card, frame);
      const after = controls.length ? Math.max(...controls.map(r => r.right)) + 12 : 0;
      topBar.style.position = "fixed";
      topBar.style.left = `${Math.max(after, card.left + 16)}px`;
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

/**
 * The home of all projects: the New thread screen with bb's personal project ("No project").
 * Sits left of the project name in the top bar; on the home screen itself it is the current page.
 */
export function HomeLink({ current, onHome }: { current: boolean; onHome?: () => void }) {
  const { projects } = experimental_useSidebarThreads();
  const navigate = useBbNavigate();
  const personal = projects.find(p => p.isPersonal) ?? null;
  return (
    <a
      className="ph-home"
      href={personal?.href ?? "/"}
      title="All projects"
      aria-label="All projects"
      aria-current={current ? "page" : undefined}
      onClick={e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        if (onHome) onHome();
        else navigate.toCompose(personal ? { projectId: personal.id } : undefined);
      }}
    >
      <Icon name="Home" className="ph-home-icon" aria-hidden />
    </a>
  );
}
