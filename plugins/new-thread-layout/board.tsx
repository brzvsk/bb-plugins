import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ThreadTitle,
  experimental_Icon as Icon,
  experimental_ProviderIcon as ProviderIcon,
  experimental_useProviders,
  experimental_ThreadStatusGlyph as StatusGlyph,
  experimental_useRpcMutation,
  experimental_useThreadActions,
  experimental_useRpcQuery,
  experimental_useSidebarThreads,
  useBbNavigate,
  useComposer,
  useSdk,
  useSidebarThreadDraft,
  useSidebarThreadDraftIds,
  useSidebarThreadRowStatus,
  type PluginHomepageSectionProps,
  type PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import { automationActionsContract, automationsContract, type Automation } from "./contracts";
import { formatArchivedDay, formatNextRun, formatStamp, formatTime, readDraft } from "./format";
import { buildBoard, buildOverview, boundThreadId, CONTINUE_WINDOW_MS, DONE_WINDOW_MS, type BoardRow, type ScheduledRow } from "./model";
import { useAuthorTouched, usePreviews, type Preview } from "./previews";
import { HomeLink, frameOf, useChromeRowPlacement, useComposeTopBar } from "./crumb";
import { attachSwipeBack } from "./swipe";
import { rememberOrigin } from "./origin";
import { leadingEmoji, useEmojiFrame } from "./frame";
import { PinToggle, ThreadRowActions, actionTarget, useProjectArrangement, useRowActionKeys } from "./actions";
import { hiddenProjects, projectTabs } from "./projects";


function previewText(p: Preview | null | undefined): string {
  if (!p) return "";
  if (p.kind === "user") return `You: ${p.text}`;
  return p.text;
}

type Open = (thread: PluginSidebarThread) => void;

function plainClick(e: React.MouseEvent): boolean {
  return !(e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0);
}

function Row({ row, preview, now, onOpen, actionKeys, project }: { row: BoardRow; preview: Preview | null | undefined; now: number; onOpen: Open; actionKeys: readonly string[]; project?: string }) {
  const t = row.thread as PluginSidebarThread;
  const rowStatus = useSidebarThreadRowStatus(t.id);
  const { hasUnsubmittedDraft } = useSidebarThreadDraft(t.id);
  const hasStatus = t.isArchived || t.indicator !== "none" || !!rowStatus || hasUnsubmittedDraft;
  // Left slot priority: bb's status, then a pinned row's pin, then the clock of an upcoming run.
  const nextRun = !t.isArchived && !t.isPinned ? formatNextRun(row.nextRunAt, now) : null;
  // Like a messenger: an unsent draft takes the second line, "Draft:" in red.
  const draft = hasUnsubmittedDraft && !t.isArchived ? readDraft(t.projectId, t.id) : null;
  const second = previewText(preview);
  const meta = row.children ? `${row.children} child` : "";
  return (
    <ThreadRowActions thread={t} keys={actionKeys}>
    <a
      className="ph-row"
      href={t.href}
      data-ph-working={(row.working && !t.isArchived) || undefined}
      data-ph-pinned={(t.isPinned && !t.isArchived) || undefined}
      data-ph-background={row.background || undefined}
      data-ph-loud={(!t.isArchived && (t.isPinned || row.attention || (t.isUnread && !row.background))) || undefined}
      onClick={e => {
        if (!plainClick(e)) return;
        e.preventDefault();
        onOpen(t);
      }}
    >
      <span className="ph-glyph" data-ph-status={hasStatus || !!nextRun || undefined}>
        <span className="ph-glyph-status">
          {row.background ? (
            // bb's own glyph for a background command: the reply is in, something external still runs.
            <StatusGlyph indicator="background-command" rowStatus={rowStatus} hideIdleDraftLabel />
          ) : hasStatus || !nextRun ? (
            <StatusGlyph indicator={t.indicator} rowStatus={rowStatus} archived={t.isArchived} hideIdleDraftLabel />
          ) : (
            // Lowest-priority status: an automation will run in this thread next.
            <span className="ph-next-run" title={`Next run ${nextRun}${row.automationNames.length ? ` · ${row.automationNames.join(", ")}` : ""}`}>
              <Icon name="Clock" className="ph-clock" aria-hidden />
            </span>
          )}
        </span>
        {!t.isArchived ? <PinToggle thread={t} /> : null}
      </span>
      <span className="ph-main">
        <span className="ph-title">
          <span className="ph-title-text">
            {project ? <span className="ph-row-project">{project} · </span> : null}
            <ThreadTitle threadId={t.id} />
          </span>
          {meta ? <span className="ph-meta">{meta}</span> : null}
          {/* Archived rows sit under a day heading, so they show the time they were archived. */}
          <span className="ph-stamp" title={t.isArchived ? "Archived" : undefined}>
            {t.isArchived && t.archivedAt ? formatTime(t.archivedAt) : formatStamp(t.latestAttentionAt || t.updatedAt, now)}
          </span>
        </span>
        {draft ? (
          <span className="ph-second ph-second-draft">
            <span className="ph-draft-label">Draft:</span> {draft}
          </span>
        ) : second ? (
          <span className="ph-second" data-ph-kind={preview?.kind}>
            {/* The agent speaking (its reply or its thought), in its provider's mark, monochrome. */}
            {preview?.kind === "agent" || preview?.kind === "thinking" ? (
              <AgentMark providerId={t.providerId} />
            ) : null}
            {second}
          </span>
        ) : null}
      </span>
    </a>
    </ThreadRowActions>
  );
}

/**
 * Open an automation in the bundled Automations plugin. BbNavigate only reaches
 * this plugin's own panels, so this pushes the app route BB's router listens to.
 */
function openAutomation(projectId: string, automationId: string): void {
  const path = `/plugins/automations/automations/${encodeURIComponent(projectId)}/${encodeURIComponent(automationId)}`;
  window.history.pushState(window.history.state, "", path);
  window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
}

interface AutomationActions {
  pause(a: Automation): Promise<void>;
  resume(a: Automation): Promise<void>;
  pending: ReadonlySet<string>;
}

function useAutomationActions(refetch: () => Promise<void>): AutomationActions {
  const pause = experimental_useRpcMutation({ pluginId: "automations", contract: automationActionsContract, method: "automations_pause" });
  const resume = experimental_useRpcMutation({ pluginId: "automations", contract: automationActionsContract, method: "automations_resume" });
  const pending = new Set([...pause.pendingInputs, ...resume.pendingInputs].map(i => i.automationId));
  const call = (m: typeof pause) => async (a: Automation) => {
    try {
      await m.mutate({ projectId: a.projectId, automationId: a.id });
    } finally {
      await refetch();
    }
  };
  return { pause: call(pause), resume: call(resume), pending };
}

function stopEvent(e: React.SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
}

function ActionButton({ icon, label, disabled, onClick }: { icon: string; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="ph-action"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={e => {
        stopEvent(e);
        onClick();
      }}
    >
      <Icon name={icon} className="ph-action-icon" aria-hidden />
    </button>
  );
}

/** The bound thread's read/unread and pin/unpin, as on thread rows: pinning brings it into attention. */
const SCHEDULE_THREAD_ACTIONS = ["bb--core/read", "bb--core/pin"] as const;
function ScheduleThreadActions({ thread }: { thread: PluginSidebarThread }) {
  const entries = experimental_useThreadActions(actionTarget(thread), { keys: SCHEDULE_THREAD_ACTIONS });
  return (
    <>
      {entries
        .filter(e => !e.action.choices)
        .map(e => (
          <ActionButton key={e.key} icon={e.action.icon} label={e.action.label} disabled={e.action.disabled} onClick={() => void e.action.run()} />
        ))}
    </>
  );
}

/** Archived rows grouped under day headings, newest day first. */
function byDay(rows: readonly BoardRow[], now: number): [string, BoardRow[]][] {
  const groups = new Map<string, BoardRow[]>();
  for (const r of rows) {
    const day = formatArchivedDay(r.thread.archivedAt ?? r.thread.updatedAt, now);
    const list = groups.get(day) ?? [];
    list.push(r);
    groups.set(day, list);
  }
  return [...groups.entries()];
}

/** The thread's agent provider mark (Anthropic, OpenAI, …), drawn monochrome before its words. */
function AgentMark({ providerId }: { providerId: string }) {
  const { providers } = experimental_useProviders();
  const provider = providers.find(p => p.id === providerId) ?? { id: providerId };
  return (
    <span className="ph-agent-mark" title={"displayName" in provider ? String(provider.displayName) : providerId}>
      <ProviderIcon providerKind="agent" provider={provider} className="ph-agent-mark-icon" aria-hidden />
    </span>
  );
}

/** One automation as a single line: name, the thread it runs in, and the next run; actions on hover. */
function AutomationLine({ row, now, onOpen, actions, project }: { row: ScheduledRow; now: number; onOpen: Open; actions: AutomationActions; project?: string }) {
  const a = row.automation;
  const paused = a.enabled === false;
  const running = a.lastRunStatus === "running";
  const next = formatNextRun(a.nextRunAt, now);
  const when = running ? "Running" : paused ? "Paused" : next;
  const t = row.thread as PluginSidebarThread | null;
  const where = t ? t.displayTitle : "new thread";
  // Quiet unless its thread has something unread; then bb's own unread dot replaces the clock.
  const unread = !!t?.isUnread;
  const busy = actions.pending.has(a.id);
  const body = (
    <>
      <span className="ph-glyph">
        {unread ? (
          <StatusGlyph indicator={t!.indicator === "unread-error" ? "unread-error" : "unread-success"} />
        ) : t?.isPinned ? (
          // A pinned thread shows its pin here too, over the clock.
          <Icon name="Pin" className="ph-clock ph-clock-pinned" aria-hidden />
        ) : (
          <Icon name={paused ? "Pause" : "Clock"} className="ph-clock" aria-hidden />
        )}
      </span>
      <span className="ph-auto-text">
        <span className="ph-auto-name">
          {project ? <span className="ph-row-project">{project} · </span> : null}
          {a.name}
        </span>
        {where !== a.name ? <span className="ph-auto-where">{where}</span> : null}
      </span>
      {when ? <span className="ph-status ph-status-time">{when}</span> : null}
    </>
  );
  const title = `${a.name} · runs in ${t ? t.displayTitle : "a new thread"}`;
  return (
    <div className="ph-row-wrap">
      {t ? (
        <a
          className="ph-row ph-auto-row"
          data-ph-unread={unread || undefined}
          href={t.href}
          title={title}
          onClick={e => {
            if (!plainClick(e)) return;
            e.preventDefault();
            onOpen(t);
          }}
        >
          {body}
        </a>
      ) : (
        <div className="ph-row ph-auto-row" title={title}>{body}</div>
      )}
      <span className="ph-actions">
        {t ? <ScheduleThreadActions thread={t} /> : null}
        {paused ? (
          <ActionButton icon="Play" label="Resume" disabled={busy} onClick={() => void actions.resume(a)} />
        ) : (
          <ActionButton icon="Pause" label="Pause" disabled={busy} onClick={() => void actions.pause(a)} />
        )}
        <ActionButton icon="Settings" label="Open automation" onClick={() => openAutomation(a.projectId, a.id)} />
      </span>
    </div>
  );
}

type TopTab = "scheduled" | "done";

/**
 * The fixed zone under the top bar: a switch between the project's schedule and
 * its recently done threads. Only tabs with something in them are offered.
 */
// Lucide calendar-clock and archive; bb's icon set has neither.
const TOP_EMPTY: Record<TopTab, [ReactNode, string]> = {
  scheduled: [
    <>
      <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
      <path d="M16 2v4M8 2v4M3 10h5" />
      <path d="M17.5 17.5 16 16.3V14" />
      <circle cx="16" cy="16" r="6" />
    </>,
    "Nothing is scheduled yet",
  ],
  done: [
    <>
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" />
    </>,
    "Nothing archived this week",
  ],
};

function TopPanel({ tab, onTab, scheduled, done }: { tab: TopTab; onTab: (tab: TopTab) => void; scheduled: ReactNode[]; done: ReactNode[] }) {
  const tabs = [
    ["scheduled", "Scheduled", scheduled],
    ["done", "Last week", done],
  ] as const;
  const rows = tab === "done" ? done : scheduled;
  // Last week covers the lists below as a tall panel for scanning the archive;
  // the active tab again or Escape folds it back to Scheduled.
  const overlay = tab === "done";
  useEffect(() => {
    if (!overlay) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && onTab("scheduled");
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [overlay, onTab]);
  const [icon, emptyText] = TOP_EMPTY[tab];
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tabsEl = tabsRef.current;
    if (!tabsEl) return;
    // On wide screens the tabs share the top bar's row; a long project name would run into them.
    const fit = () => {
      tabsEl.style.marginLeft = "";
      const crumb = document.querySelector<HTMLElement>(".ph-topbar .ph-crumb-row");
      if (!crumb) return;
      const a = crumb.getBoundingClientRect();
      const t = tabsEl.getBoundingClientRect();
      if (a.bottom <= t.top || t.bottom <= a.top) return;
      const shift = a.right + 16 - t.left;
      if (shift > 0) tabsEl.style.marginLeft = `${shift}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(document.body);
    const crumb = document.querySelector(".ph-topbar .ph-crumb-row");
    if (crumb) observer.observe(crumb);
    return () => observer.disconnect();
  });
  return (
    <section className="ph-autos ph-group" data-ph-tab={tab} data-ph-overlay={overlay || undefined}>
      <div className="ph-tabs" role="tablist" ref={tabsRef}>
        {tabs.map(([id, label, list]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === tab}
            className="ph-group-title ph-tab"
            onClick={() => onTab(overlay && id === "done" ? "scheduled" : id)}
          >
            {label}{list.length ? <> <span className="ph-count">{list.length}</span></> : null}
          </button>
        ))}
      </div>
      <div className="ph-rows" role="tabpanel">
        {rows.length ? rows : (
          <div className="ph-tab-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {icon}
            </svg>
            {emptyText}
          </div>
        )}
      </div>
    </section>
  );
}

/** "+" at the end of home's project row: the projects hidden in the thread list, like its "More". */
function MoreProjects({ projects, onOpen }: { projects: { id: string; name: string; href: string }[]; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", close, true);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", close, true);
    };
  }, [open]);
  if (!projects.length) return null;
  return (
    <span className="ph-more" ref={ref}>
      <button type="button" className="ph-project-tab ph-more-button" aria-label="More projects" title="More projects" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Icon name="Plus" className="ph-more-icon" aria-hidden />
      </button>
      {open ? (
        <span className="ph-more-menu" role="menu">
          {projects.map(p => (
            <a
              key={p.id}
              role="menuitem"
              className="ph-more-item"
              href={p.href}
              onClick={e => {
                if (!plainClick(e)) return;
                e.preventDefault();
                setOpen(false);
                onOpen(p.id);
              }}
            >
              {p.name}
            </a>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/** A holder at the top of the sticky composer block of the given New thread frame. */
/**
 * At home the projects take the place of bb's "No project" picker in the row under the composer:
 * a holder right after that picker, which CSS hides while the holder is there. bb re-renders the
 * row freely, so the holder is put back whenever it falls out.
 */
function useComposerFooterHolder(frame: Element | null): HTMLElement | null {
  const [holder, setHolder] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!frame) return;
    const el = document.createElement("div");
    el.className = "ph-projects-holder";
    const place = () => {
      const picker = frame.querySelector('[data-testid="root-compose-compact-composer"] [data-promptbox-project-control]');
      if (picker && picker.nextElementSibling !== el) picker.after(el);
    };
    place();
    setHolder(el);
    const observer = new MutationObserver(place);
    observer.observe(frame, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      el.remove();
      setHolder(null);
    };
  }, [frame]);
  return holder;
}

/** A holder right under the New thread screen's top bar, outside the scrolling list. */
function useStripHolder(topBar: HTMLElement | null): HTMLElement | null {
  const [holder, setHolder] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!topBar) return;
    const el = document.createElement("div");
    el.className = "ph-autos-holder";
    // Right after the bar inside the frame; while the bar sits in <body> (window row), first in the frame.
    const frame = frameOf(topBar);
    if (topBar.parentElement === frame) topBar.after(el);
    else frame?.prepend(el);
    setHolder(el);
    return () => {
      el.remove();
      setHolder(null);
    };
  }, [topBar]);
  return holder;
}

function Group({ label, hint, count, countTone, children }: { label: string; hint?: string; count: number; countTone?: "warn" | "bad"; children: ReactNode }) {
  if (!count) return null;
  return (
    <section className="ph-group">
      <h3 className="ph-group-title">
        {label}
        {hint ? <span className="ph-group-hint"> — {hint}</span> : null} <span className="ph-count" data-ph-tone={countTone}>{count}</span>
      </h3>
      <div className="ph-rows">{children}</div>
    </section>
  );
}

/** The open tab follows you between project homes and back from a thread; a reload starts on Scheduled. */
let openTopTab: TopTab = "scheduled";
function useTopTab(): [TopTab, (tab: TopTab) => void] {
  const [tab, setTab] = useState(openTopTab);
  const set = useCallback((next: TopTab) => {
    openTopTab = next;
    setTab(next);
  }, []);
  return [tab, set];
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function ProjectBoard({ projectId: routeProjectId }: PluginHomepageSectionProps) {
  // The slot's projectId is null on the plain compose route; the composer's selected project is the one in view.
  const composer = useComposer();
  const projectId = routeProjectId ?? composer.selection?.projectId ?? null;
  const sidebar = experimental_useSidebarThreads({ experimental_lifecycles: ["active", "archived"] });
  const sdk = useSdk();
  const navigate = useBbNavigate();
  const now = useNow();
  const automations = experimental_useRpcQuery({
    pluginId: "automations",
    contract: automationsContract,
    method: "automations_list",
    input: { projectId: projectId ?? "" },
    enabled: !!projectId,
  });
  const project = sidebar.projects.find(p => p.id === projectId) ?? null;
  const topBar = useComposeTopBar();
  useChromeRowPlacement(topBar);
  const stripHolder = useStripHolder(topBar);
  const actionKeys = useRowActionKeys();
  const automationActions = useAutomationActions(automations.refetch);
  const [topTab, setTopTab] = useTopTab();

  // Page archived threads back until the Recently done window is covered.
  const archived = sidebar.experimental_archived;
  const oldestArchived = useMemo(() => {
    let oldest = Infinity;
    for (const t of sidebar.threads) if (t.isArchived && t.archivedAt !== null && t.archivedAt < oldest) oldest = t.archivedAt;
    return oldest;
  }, [sidebar.threads]);
  useEffect(() => {
    if (!archived || archived.status !== "ready" || !archived.hasNextPage || archived.isFetchingNextPage || archived.isFetchNextPageError) return;
    if (oldestArchived < now - DONE_WINDOW_MS) return;
    void archived.fetchNextPage();
  }, [archived, oldestArchived, now]);

  // Every automation with its project: home's schedule and which threads automations drive.
  const allAutomations = experimental_useRpcQuery({
    pluginId: "automations",
    contract: automationsContract,
    method: "automations_overview",
    input: null,
  });
  // Automation threads the author is involved in: a draft, or their own message in the last two hours.
  const draftIds = useSidebarThreadDraftIds();
  const allAutomationList = useMemo(
    () => [...(automations.data ?? []), ...(allAutomations.data?.automations.map(e => e.automation) ?? [])],
    [automations.data, allAutomations.data],
  );
  const boundThreads = useMemo(() => {
    const ids = new Set(allAutomationList.map(a => boundThreadId(a)).filter((id): id is string => !!id));
    return sidebar.threads.filter(t => ids.has(t.id) && !t.isArchived).map(t => ({ id: t.id, updatedAt: t.updatedAt }));
  }, [allAutomationList, sidebar.threads]);
  const touched = useAuthorTouched(sdk.threads, boundThreads, now, CONTINUE_WINDOW_MS);
  const involved = useMemo(() => new Set([...draftIds, ...touched]), [draftIds, touched]);
  // Until this project's own list arrives, its automations from the overview fill in, so the schedule
  // does not blink empty when switching projects; a list still held from the previous project is filtered out.
  const projectAutomations = useMemo(
    () =>
      (automations.data ?? allAutomations.data?.automations.map(e => e.automation) ?? []).filter(
        a => a.projectId === projectId,
      ),
    [automations.data, allAutomations.data, projectId],
  );
  const board = useMemo(
    () => (projectId ? buildBoard(sidebar.threads, projectAutomations, projectId, now, { involved }) : null),
    [sidebar.threads, projectAutomations, projectId, now, involved],
  );
  // A swipe back from the thread returns to the screen it was opened from (see origin.ts).
  const atHomeRef = useRef(false);
  const open: Open = t => {
    rememberOrigin(t.id, atHomeRef.current ? "home" : "project");
    navigate.toThread(t.id);
  };

  // "No project" is bb's personal project: the home of all projects.
  const personal = sidebar.projects.find(p => p.isPersonal) ?? null;
  const atHome = !project || project.isPersonal;
  atHomeRef.current = atHome;
  const goHome = () => {
    if (personal) void composer.setSelection({ projectId: personal.id });
  };
  // Home and project homes are one screen adapting to the selected project: switching the composer's
  // project keeps it mounted, where a route change would tear the page down to bb's skeleton.
  const goProject = (id: string) => void composer.setSelection({ projectId: id });
  // Swipe right on a project's New thread screen goes back to the home screen.
  useEffect(() => {
    if (atHome || !personal) return;
    return attachSwipeBack(document, {
      area: () => frameOf(topBar),
      onBack: () => void composer.setSelection({ projectId: personal.id }),
      target: () => ({ home: true }),
    });
  }, [atHome, personal?.id, topBar, composer]);

  // A project's emoji frames the composer, so the project in view reads at a glance; Home has none.
  const frameScope = useMemo(() => (topBar ? () => frameOf(topBar) ?? null : null), [topBar]);
  useEmojiFrame(atHome ? null : leadingEmoji(project?.name), frameScope);

  // At home the top bar lists the projects, like tabs, in the thread list's order.
  const arrangement = useProjectArrangement(projectId);
  const tabs = useMemo(
    () => (atHome ? projectTabs(sidebar.projects, sidebar.threads, arrangement.order, arrangement.hidden) : []),
    [atHome, sidebar.projects, sidebar.threads, arrangement.order, arrangement.hidden],
  );
  // Home overview: what is live across the visible projects, and every project's schedule.
  const overview = useMemo(
    () =>
      atHome
        ? buildOverview(
            sidebar.threads,
            (allAutomations.data?.automations ?? []).map(e => e.automation),
            tabs.map(t => t.id),
            personal?.id ?? null,
            now,
            { involved },
          )
        : null,
    [atHome, sidebar.threads, allAutomations.data, tabs, personal?.id, now, involved],
  );
  const projectLabel = useMemo(() => {
    const names = new Map(sidebar.projects.map(p => [p.id, p.name] as const));
    return (projectId: string) => (projectId === personal?.id ? undefined : names.get(projectId));
  }, [sidebar.projects, personal?.id]);
  const previewTargets = useMemo(
    () =>
      board
        ? [
            ...(overview ? [...overview.pinned, ...overview.needsYou, ...overview.running, ...overview.recent] : []),
            ...board.pinned,
            ...board.running,
            ...board.inProgress,
            ...(topTab === "done" || !board.scheduled.length ? (overview ? overview.done : board.done) : []),
          ].map(r => ({ id: r.thread.id, updatedAt: r.thread.updatedAt, live: r.working }))
        : [],
    [board, topTab, overview],
  );
  const previews = usePreviews(sdk.threads, previewTargets);

  useEffect(() => {
    const frame = frameOf(topBar);
    if (!frame) return;
    if (atHome) frame.setAttribute("data-ph-home", "");
    else frame.removeAttribute("data-ph-home");
    return () => frame.removeAttribute("data-ph-home");
  }, [topBar, atHome]);

  // At home the projects sit right above the composer, within thumb's reach of a new message.
  const tabsHolder = useComposerFooterHolder(atHome ? frameOf(topBar) : null);
  const more = useMemo(
    () => (atHome ? hiddenProjects(sidebar.projects, arrangement.hidden) : []),
    [atHome, sidebar.projects, arrangement.hidden],
  );
  const projectTabsRow =
    atHome && tabs.length && tabsHolder
      ? createPortal(
            <span className="ph-projects" role="navigation" aria-label="Projects">
              <span className="ph-projects-scroll">
              <a className="ph-project-tab" href={personal?.href ?? "/"} aria-current="page" title="Home: every project at once, threads without a project" onClick={e => plainClick(e) && e.preventDefault()}>
                <Icon name="Home" className="ph-project-home" aria-hidden />
                <span className="ph-project-name">Home</span>
              </a>
              {tabs.map(tab => (
                <a
                  key={tab.id}
                  className="ph-project-tab"
                  href={tab.href}
                  data-ph-unread={tab.unread || undefined}
                  data-ph-attention={tab.attention || undefined}
                  title={[tab.name, tab.attention ? "needs you" : null, tab.running ? "working" : null, tab.unread ? "unread" : null].filter(Boolean).join(" · ")}
                  onClick={e => {
                    if (!plainClick(e)) return;
                    e.preventDefault();
                    goProject(tab.id);
                  }}
                >
                  {(() => {
                    // A leading emoji stays out of the shimmer, which would paint it as a grey box.
                    const m = /^(\p{Extended_Pictographic}[\p{Extended_Pictographic}\u200d\ufe0f]*\s*)/u.exec(tab.name);
                    return (
                      <>
                        {m ? <span className="ph-project-emoji">{m[1].trim()}</span> : null}
                        <span className="ph-project-name">{m ? tab.name.slice(m[1].length) : tab.name}</span>
                      </>
                    );
                  })()}
                  {tab.unread ? <span className="ph-project-dot" aria-hidden /> : null}
                </a>
              ))}
              </span>
              <MoreProjects projects={more} onOpen={goProject} />
            </span>,
          tabsHolder,
        )
      : null;

  const crumb = topBar
    ? createPortal(
        <span className="ph-crumb-row">
          <HomeLink current={atHome} onHome={goHome} />

          {project && !atHome ? (
            <a
              className="ph-crumb ph-crumb-link"
              href={project.href}
              title={`Open ${project.name}`}
              onClick={e => {
                if (!plainClick(e)) return;
                e.preventDefault();
                goProject(project.id);
              }}
            >
              <span className="ph-crumb-name">{project.name}</span>
            </a>
          ) : null}
        </span>,
        topBar,
      )
    : null;

  if (!projectId || !board) return crumb;
  const empty =
    !board.pinned.length && !board.running.length && !board.inProgress.length && !board.scheduled.length && !board.done.length &&
    !(overview && (overview.pinned.length || overview.needsYou.length || overview.running.length || overview.recent.length || overview.scheduled.length));
  return (
    <div className="ph-board" data-ph-board="">
      {crumb}
      {projectTabsRow}
      {stripHolder
        ? createPortal(
            <TopPanel
              tab={topTab}
              onTab={setTopTab}
              scheduled={(overview ? overview.scheduled : board.scheduled).map(r => (
                <AutomationLine key={r.automation.id} row={r} now={now} onOpen={open} actions={automationActions} project={overview ? projectLabel(r.automation.projectId) : undefined} />
              ))}
              done={byDay(overview ? overview.done : board.done, now).flatMap(([day, rows]) => [
                <div key={`day-${day}`} className="ph-day">{day}</div>,
                ...rows.map(r => (
                  <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} project={overview ? projectLabel(r.thread.projectId) : undefined} />
                )),
              ])}
            />,
            stripHolder,
          )
        : null}
      {sidebar.status === "loading" ? <p className="ph-empty">Loading…</p> : null}
      {sidebar.status === "ready" && empty ? <p className="ph-empty">Nothing in progress here yet.</p> : null}
      {overview ? (
        <>
          {/* Pins are what you work on right now: a few is focus, many is a warning. */}
          <Group
            label="Pinned"
            hint="focused on now"
            count={overview.pinned.length}
            countTone={overview.pinned.length > 4 ? "bad" : overview.pinned.length >= 3 ? "warn" : undefined}
          >
            {overview.pinned.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} project={projectLabel(r.thread.projectId)} />)}
          </Group>
          <Group label="Waiting for you" count={overview.needsYou.length}>
            {overview.needsYou.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} project={projectLabel(r.thread.projectId)} />)}
          </Group>
          <Group label="Running now" count={overview.running.length}>
            {overview.running.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} project={projectLabel(r.thread.projectId)} />)}
          </Group>
          <Group label="Continue where you left off" count={overview.recent.length}>
            {overview.recent.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} project={projectLabel(r.thread.projectId)} />)}
          </Group>
          <Group label="Without a project" count={board.running.length + board.inProgress.length}>
            {[...board.running, ...board.inProgress].map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} />)}
          </Group>
        </>
      ) : (
        <>
          <Group label="Pinned" count={board.pinned.length}>
            {board.pinned.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} />)}
          </Group>
          <Group label="Running" count={board.running.length}>
            {board.running.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} />)}
          </Group>
          <Group label="Idle" count={board.inProgress.length}>
            {board.inProgress.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} />)}
          </Group>
        </>
      )}
    </div>
  );
}
