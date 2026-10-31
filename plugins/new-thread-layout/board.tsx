import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ThreadTitle,
  experimental_Icon as Icon,
  experimental_ThreadStatusGlyph as StatusGlyph,
  experimental_useRpcMutation,
  experimental_useThreadActions,
  experimental_useRpcQuery,
  experimental_useSidebarThreads,
  useBbNavigate,
  useComposer,
  useSdk,
  useSidebarThreadDraft,
  useSidebarThreadRowStatus,
  type PluginHomepageSectionProps,
  type PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import { automationActionsContract, automationsContract, type Automation } from "./contracts";
import { formatAgo, formatNextRun, formatStamp, readDraft } from "./format";
import { buildBoard, buildOverview, DONE_WINDOW_MS, type BoardRow, type ScheduledRow } from "./model";
import { usePreviews, type Preview } from "./previews";
import { HomeLink, frameOf, useChromeRowPlacement, useComposeTopBar } from "./crumb";
import { attachSwipeBack } from "./swipe";
import { rememberOrigin } from "./origin";
import { ThreadRowActions, actionTarget, useProjectArrangement, useRowActionKeys } from "./actions";
import { projectTabs } from "./projects";

const TOP_TAB_KEY = "new-thread-layout:top-tab";

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
  // Like a messenger: an unsent draft takes the second line, "Draft:" in red.
  const draft = hasUnsubmittedDraft && !t.isArchived ? readDraft(t.projectId, t.id) : null;
  const second = t.isArchived
    ? [t.archivedAt ? `Done ${formatAgo(t.archivedAt, now)}` : "Done", previewText(preview)].filter(Boolean).join(" · ")
    : previewText(preview);
  const meta = row.children ? `${row.children} child` : "";
  return (
    <ThreadRowActions thread={t} keys={actionKeys}>
    <a
      className="ph-row"
      href={t.href}
      data-ph-working={(row.working && !t.isArchived) || undefined}
      data-ph-pinned={(t.isPinned && !t.isArchived) || undefined}
      data-ph-loud={(!t.isArchived && (t.isUnread || t.isPinned || row.attention)) || undefined}
      onClick={e => {
        if (!plainClick(e)) return;
        e.preventDefault();
        onOpen(t);
      }}
    >
      <span className="ph-glyph">
        <StatusGlyph indicator={t.indicator} rowStatus={rowStatus} archived={t.isArchived} hideIdleDraftLabel />
      </span>
      <span className="ph-main">
        <span className="ph-title">
          <span className="ph-title-text">
            {project ? <span className="ph-row-project">{project} · </span> : null}
            <ThreadTitle threadId={t.id} />
          </span>
          {meta ? <span className="ph-meta">{meta}</span> : null}
          <span className="ph-stamp">{formatStamp(t.latestAttentionAt || t.updatedAt, now)}</span>
        </span>
        {draft ? (
          <span className="ph-second ph-second-draft">
            <span className="ph-draft-label">Draft:</span> {draft}
          </span>
        ) : second ? (
          <span className="ph-second" data-ph-kind={preview?.kind}>{second}</span>
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
function TopPanel({ tab, onTab, scheduled, done }: { tab: TopTab; onTab: (tab: TopTab) => void; scheduled: ReactNode[]; done: ReactNode[] }) {
  const tabs = ([
    ["scheduled", "Scheduled", scheduled],
    ["done", "Recently done", done],
  ] as const).filter(([, , rows]) => rows.length > 0);
  if (!tabs.length) return null;
  const active = tabs.find(([id]) => id === tab) ?? tabs[0];
  return (
    <section className="ph-autos ph-group" data-ph-tab={active[0]}>
      <div className="ph-tabs" role="tablist">
        {tabs.map(([id, label, rows]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === active[0]}
            className="ph-group-title ph-tab"
            onClick={() => onTab(id)}
          >
            {label} <span className="ph-count">{rows.length}</span>
          </button>
        ))}
      </div>
      <div className="ph-rows" role="tabpanel">{active[2]}</div>
    </section>
  );
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

function Group({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  if (!count) return null;
  return (
    <section className="ph-group">
      <h3 className="ph-group-title">
        {label} <span className="ph-count">{count}</span>
      </h3>
      <div className="ph-rows">{children}</div>
    </section>
  );
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function useStoredTab(key: string, initial: TopTab): [TopTab, (tab: TopTab) => void] {
  const [value, setValue] = useState<TopTab>(() => {
    try {
      const v = localStorage.getItem(key);
      return v === "done" || v === "scheduled" ? v : initial;
    } catch {
      return initial;
    }
  });
  const set = (tab: TopTab) => {
    setValue(tab);
    try {
      localStorage.setItem(key, tab);
    } catch {
      // storage unavailable; keep in memory
    }
  };
  return [value, set];
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
  const [topTab, setTopTab] = useStoredTab(TOP_TAB_KEY, "scheduled");

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

  const board = useMemo(
    () => (projectId ? buildBoard(sidebar.threads, automations.data ?? [], projectId, now) : null),
    [sidebar.threads, automations.data, projectId, now],
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
  // Swipe right on a project's New thread screen goes back to the home screen.
  useEffect(() => {
    if (atHome || !personal) return;
    return attachSwipeBack(document, {
      area: () => frameOf(topBar),
      onBack: () => void composer.setSelection({ projectId: personal.id }),
    });
  }, [atHome, personal?.id, topBar, composer]);

  // At home the top bar lists the projects, like tabs, in the thread list's order.
  const arrangement = useProjectArrangement();
  const tabs = useMemo(
    () => (atHome ? projectTabs(sidebar.projects, sidebar.threads, arrangement.order, arrangement.hidden) : []),
    [atHome, sidebar.projects, sidebar.threads, arrangement.order, arrangement.hidden],
  );
  // Home overview: what is live across the visible projects, and every project's schedule.
  const allAutomations = experimental_useRpcQuery({
    pluginId: "automations",
    contract: automationsContract,
    method: "automations_overview",
    input: null,
    enabled: atHome,
  });
  const overview = useMemo(
    () =>
      atHome
        ? buildOverview(
            sidebar.threads,
            (allAutomations.data?.automations ?? []).map(e => e.automation),
            tabs.map(t => t.id),
            personal?.id ?? null,
            now,
          )
        : null,
    [atHome, sidebar.threads, allAutomations.data, tabs, personal?.id, now],
  );
  const projectLabel = useMemo(() => {
    const names = new Map(sidebar.projects.map(p => [p.id, p.name] as const));
    return (projectId: string) => (projectId === personal?.id ? undefined : names.get(projectId));
  }, [sidebar.projects, personal?.id]);
  const previewTargets = useMemo(
    () =>
      board
        ? [
            ...(overview ? [...overview.needsYou, ...overview.running, ...overview.recent] : []),
            ...board.pinned,
            ...board.running,
            ...board.inProgress,
            ...(topTab === "done" || !board.scheduled.length ? board.done : []),
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

  const crumb = topBar
    ? createPortal(
        <span className="ph-crumb-row">
          <HomeLink current={atHome} onHome={goHome} />
          {atHome && tabs.length ? (
            <span className="ph-projects" role="navigation" aria-label="Projects">
              {tabs.map(tab => (
                <a
                  key={tab.id}
                  className="ph-project-tab"
                  href={tab.href}
                  data-ph-unread={tab.unread || undefined}
                  data-ph-running={tab.running || undefined}
                  data-ph-attention={tab.attention || undefined}
                  title={[tab.name, tab.attention ? "needs you" : null, tab.running ? "working" : null, tab.unread ? "unread" : null].filter(Boolean).join(" · ")}
                  onClick={e => {
                    if (!plainClick(e)) return;
                    e.preventDefault();
                    navigate.toProject(tab.id);
                  }}
                >
                  {tab.unread ? <span className="ph-project-dot" aria-hidden /> : null}
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
                </a>
              ))}
            </span>
          ) : null}
          {project && !atHome ? (
            <a
              className="ph-crumb ph-crumb-link"
              href={project.href}
              title={`Open ${project.name}`}
              onClick={e => {
                if (!plainClick(e)) return;
                e.preventDefault();
                navigate.toProject(project.id);
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
    !(overview && (overview.needsYou.length || overview.running.length || overview.recent.length || overview.scheduled.length));
  return (
    <div className="ph-board" data-ph-board="">
      {crumb}
      {stripHolder
        ? createPortal(
            <TopPanel
              tab={topTab}
              onTab={setTopTab}
              scheduled={(overview ? overview.scheduled : board.scheduled).map(r => (
                <AutomationLine key={r.automation.id} row={r} now={now} onOpen={open} actions={automationActions} project={overview ? projectLabel(r.automation.projectId) : undefined} />
              ))}
              done={board.done.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} />)}
            />,
            stripHolder,
          )
        : null}
      {sidebar.status === "loading" ? <p className="ph-empty">Loading…</p> : null}
      {sidebar.status === "ready" && empty ? <p className="ph-empty">Nothing in progress here yet.</p> : null}
      {overview ? (
        <>
          <Group label="Waiting for you" count={overview.needsYou.length}>
            {overview.needsYou.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} project={projectLabel(r.thread.projectId)} />)}
          </Group>
          <Group label="Running now" count={overview.running.length}>
            {overview.running.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} project={projectLabel(r.thread.projectId)} />)}
          </Group>
          <Group label="Continue where you left off" count={overview.recent.length}>
            {overview.recent.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} project={projectLabel(r.thread.projectId)} />)}
          </Group>
          <Group label="Without a project" count={board.pinned.length + board.running.length + board.inProgress.length}>
            {[...board.pinned, ...board.running, ...board.inProgress].map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} />)}
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
