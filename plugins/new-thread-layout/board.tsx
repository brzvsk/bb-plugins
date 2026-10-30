import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import {
  ThreadTitle,
  experimental_Icon as Icon,
  experimental_ThreadStatusGlyph as StatusGlyph,
  experimental_useRpcQuery,
  experimental_useSidebarThreads,
  useBbNavigate,
  useComposer,
  useSdk,
  useSidebarThreadRowStatus,
  type PluginHomepageSectionProps,
  type PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import { automationsContract } from "./contracts";
import { formatAgo, formatNextRun } from "./format";
import { buildBoard, DONE_WINDOW_MS, type BoardRow, type ScheduledRow } from "./model";
import { usePreviews, type Preview } from "./previews";
import { useComposeTopBar } from "./crumb";
import { ThreadRowActions, useRowActionKeys } from "./actions";

const DONE_OPEN_KEY = "new-thread-layout:done-open";

function previewLine(p: Preview | null | undefined): string {
  if (!p) return "";
  return p.role === "user" ? `You: ${p.text}` : p.text;
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
      data-ph-working={row.working || undefined}
      data-ph-attention={row.attention || undefined}
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

/** One automation as a single line: name, the thread it runs in, and the next run. */
function AutomationLine({ row, now, onOpen }: { row: ScheduledRow; now: number; onOpen: Open }) {
  const next = formatNextRun(row.automation.nextRunAt, now);
  const t = row.thread as PluginSidebarThread | null;
  const where = t ? t.displayTitle : "new thread";
  // Quiet unless its thread has something unread; then bb's own unread dot replaces the clock.
  const unread = !!t?.isUnread;
  const body = (
    <>
      <span className="ph-glyph">
        {unread ? (
          <StatusGlyph indicator={t!.indicator === "unread-error" ? "unread-error" : "unread-success"} />
        ) : (
          <Icon name="Clock" className="ph-clock" aria-hidden />
        )}
      </span>
      <span className="ph-auto-text">
        <span className="ph-auto-name">{row.automation.name}</span>
        {where !== row.automation.name ? <span className="ph-auto-where">{where}</span> : null}
      </span>
      {next ? <span className="ph-status ph-status-time">{next}</span> : null}
    </>
  );
  const title = `${row.automation.name} · runs in ${t ? t.displayTitle : "a new thread"}`;
  if (!t) return <div className="ph-row ph-auto-row" title={title}>{body}</div>;
  return (
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
  );
}

function AutomationStrip({ rows, now, onOpen }: { rows: ScheduledRow[]; now: number; onOpen: Open }) {
  if (!rows.length) return null;
  return (
    <section className="ph-autos ph-group" aria-label="Scheduled">
      <h3 className="ph-group-title">Scheduled <span className="ph-count">{rows.length}</span></h3>
      <div className="ph-rows">
        {rows.map(r => <AutomationLine key={r.automation.id} row={r} now={now} onOpen={onOpen} />)}
      </div>
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

function Group({ label, count, open, onToggle, children }: { label: string; count: number; open?: boolean; onToggle?: () => void; children: React.ReactNode }) {
  if (!count) return null;
  const collapsible = !!onToggle;
  const title = (
    <>
      {label} <span className="ph-count">{count}</span>
      {collapsible ? <Icon name="ChevronRight" className="ph-chevron" aria-hidden /> : null}
    </>
  );
  return (
    <section className="ph-group" data-ph-open={!collapsible || open ? "" : undefined}>
      {collapsible ? (
        <button type="button" className="ph-group-title ph-group-toggle" aria-expanded={!!open} onClick={onToggle}>{title}</button>
      ) : (
        <h3 className="ph-group-title">{title}</h3>
      )}
      {!collapsible || open ? <div className="ph-rows">{children}</div> : null}
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

function useStoredFlag(key: string, initial: boolean): [boolean, () => void] {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? initial : v === "1";
    } catch {
      return initial;
    }
  });
  const toggle = () =>
    setValue(v => {
      try {
        localStorage.setItem(key, v ? "0" : "1");
      } catch {
        // storage unavailable; keep in memory
      }
      return !v;
    });
  return [value, toggle];
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
  const stripHolder = useStripHolder(topBar);
  const actionKeys = useRowActionKeys();
  const [doneOpen, toggleDone] = useStoredFlag(DONE_OPEN_KEY, false);

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
    () => (board ? [...board.pinned, ...board.inProgress, ...(doneOpen ? board.done : [])].map(r => ({ id: r.thread.id, updatedAt: r.thread.updatedAt })) : []),
    [board, doneOpen],
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
  const empty = !board.pinned.length && !board.inProgress.length && !board.scheduled.length && !board.done.length;
  return (
    <div className="ph-board" data-ph-board="">
      {crumb}
      {stripHolder ? createPortal(<AutomationStrip rows={board.scheduled} now={now} onOpen={open} />, stripHolder) : null}
      {sidebar.status === "loading" ? <p className="ph-empty">Loading…</p> : null}
      {sidebar.status === "ready" && empty ? <p className="ph-empty">Nothing in progress here yet.</p> : null}
      <Group label="Pinned" count={board.pinned.length}>
        {board.pinned.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} />)}
      </Group>
      <Group label="In progress" count={board.inProgress.length}>
        {board.inProgress.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} />)}
      </Group>
      <Group label="Recently done" count={board.done.length} open={doneOpen} onToggle={toggleDone}>
        {board.done.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} actionKeys={actionKeys} />)}
      </Group>
    </div>
  );
}
