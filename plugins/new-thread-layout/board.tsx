import { createPortal } from "react-dom";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  useSidebarThreadRowStatus,
  type PluginHomepageSectionProps,
  type PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import { automationActionsContract, automationsContract, type Automation } from "./contracts";
import { formatAgo, formatNextRun } from "./format";
import { buildBoard, DONE_WINDOW_MS, type BoardRow, type ScheduledRow } from "./model";
import { usePreviews, type Preview } from "./previews";
import { useChromeRowPlacement, useComposeTopBar } from "./crumb";
import { ThreadRowActions, actionTarget, useRowActionKeys } from "./actions";

const TOP_TAB_KEY = "new-thread-layout:top-tab";

function previewLine(p: Preview | null | undefined): string {
  if (!p) return "";
  return p.text;
}

type Open = (thread: PluginSidebarThread) => void;

function plainClick(e: React.MouseEvent): boolean {
  return !(e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0);
}

function Row({ row, preview, now, onOpen, actionKeys }: { row: BoardRow; preview: Preview | null | undefined; now: number; onOpen: Open; actionKeys: readonly string[] }) {
  const t = row.thread as PluginSidebarThread;
  const rowStatus = useSidebarThreadRowStatus(t.id);
  const second = t.isArchived
    ? [t.archivedAt ? `Done ${formatAgo(t.archivedAt, now)}` : "Done", previewLine(preview)].filter(Boolean).join(" · ")
    : previewLine(preview);
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
          <span className="ph-title-text"><ThreadTitle threadId={t.id} /></span>
          {meta ? <span className="ph-meta">{meta}</span> : null}
        </span>
        {second ? <span className="ph-second">{second}</span> : null}
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
function AutomationLine({ row, now, onOpen, actions }: { row: ScheduledRow; now: number; onOpen: Open; actions: AutomationActions }) {
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
        <span className="ph-auto-name">{a.name}</span>
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
    topBar.after(el);
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
  const previewTargets = useMemo(
    () => (board ? [...board.pinned, ...board.running, ...board.inProgress, ...(topTab === "done" || !board.scheduled.length ? board.done : [])].map(r => ({ id: r.thread.id, updatedAt: r.thread.updatedAt })) : []),
    [board, topTab],
  );
  const previews = usePreviews(sdk.threads, previewTargets);
  const open: Open = t => navigate.toThread(t.id);

  const crumb = topBar && project
    ? createPortal(
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
        </a>,
        topBar,
      )
    : null;

  if (!projectId || !board) return crumb;
  const empty = !board.pinned.length && !board.running.length && !board.inProgress.length && !board.scheduled.length && !board.done.length;
  return (
    <div className="ph-board" data-ph-board="">
      {crumb}
      {stripHolder
        ? createPortal(
            <TopPanel
              tab={topTab}
              onTab={setTopTab}
              scheduled={board.scheduled.map(r => <AutomationLine key={r.automation.id} row={r} now={now} onOpen={open} actions={automationActions} />)}
              done={board.done.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} />)}
            />,
            stripHolder,
          )
        : null}
      {sidebar.status === "loading" ? <p className="ph-empty">Loading…</p> : null}
      {sidebar.status === "ready" && empty ? <p className="ph-empty">Nothing in progress here yet.</p> : null}
      <Group label="Pinned" count={board.pinned.length}>
        {board.pinned.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} />)}
      </Group>
      <Group label="Running" count={board.running.length}>
        {board.running.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} />)}
      </Group>
      <Group label="Idle" count={board.inProgress.length}>
        {board.inProgress.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} />)}
      </Group>
    </div>
  );
}
