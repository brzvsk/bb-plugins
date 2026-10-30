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

function previewLine(p: Preview | null | undefined): string {
  if (!p) return "";
  return p.role === "user" ? `You: ${p.text}` : p.text;
}

function Row({ row, preview, now, onOpen }: { row: BoardRow; preview: Preview | null | undefined; now: number; onOpen: (thread: PluginSidebarThread) => void }) {
  const t = row.thread as PluginSidebarThread;
  const rowStatus = useSidebarThreadRowStatus(t.id);
  const next = formatNextRun(row.nextRunAt, now);
  const second = t.isArchived
    ? [t.archivedAt ? `Done ${formatAgo(t.archivedAt, now)}` : "Done", previewLine(preview)].filter(Boolean).join(" · ")
    : next
      ? `Next run ${next}${row.automationNames.length ? ` · ${row.automationNames.join(", ")}` : ""}`
      : previewLine(preview);
  const meta = [row.children ? `${row.children} child` : null].filter(Boolean).join(" · ");
  return (
    <a
      className="ph-row"
      href={t.href}
      data-ph-working={row.working || undefined}
      data-ph-attention={row.attention || undefined}
      onClick={e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
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
      {row.status && !t.isArchived ? <span className="ph-status">{row.status}</span> : null}
    </a>
  );
}

function Scheduled({ row, now, onOpen }: { row: ScheduledRow; now: number; onOpen: (thread: PluginSidebarThread) => void }) {
  const next = formatNextRun(row.automation.nextRunAt, now);
  const t = row.thread as PluginSidebarThread | null;
  const body = (
    <>
      <span className="ph-glyph"><Icon name="Clock" className="ph-clock" aria-hidden /></span>
      <span className="ph-main">
        <span className="ph-title"><span className="ph-title-text">{row.automation.name}</span></span>
        <span className="ph-second">{t ? <>Runs in <ThreadTitle threadId={t.id} /></> : "Runs in a new thread"}</span>
      </span>
      {next ? <span className="ph-status ph-status-time">{next}</span> : null}
    </>
  );
  if (!t) return <div className="ph-row ph-row-static">{body}</div>;
  return (
    <a
      className="ph-row"
      href={t.href}
      onClick={e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onOpen(t);
      }}
    >
      {body}
    </a>
  );
}

function Group({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
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
    () => (board ? [...board.pinned, ...board.inProgress, ...board.done].map(r => ({ id: r.thread.id, updatedAt: r.thread.updatedAt })) : []),
    [board],
  );
  const previews = usePreviews(sdk.threads, previewTargets);
  const open = (t: PluginSidebarThread) => navigate.toThread(t.id);

  const crumb = topBar && project
    ? createPortal(
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
        </a>,
        topBar,
      )
    : null;

  if (!projectId || !board) return crumb;
  const empty = !board.pinned.length && !board.inProgress.length && !board.scheduled.length && !board.done.length;
  return (
    <div className="ph-board" data-ph-board="">
      {crumb}
      {sidebar.status === "loading" ? <p className="ph-empty">Loading…</p> : null}
      {sidebar.status === "ready" && empty ? <p className="ph-empty">Nothing in progress here yet.</p> : null}
      <Group label="Pinned" count={board.pinned.length}>
        {board.pinned.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} />)}
      </Group>
      <Group label="In progress" count={board.inProgress.length}>
        {board.inProgress.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} />)}
      </Group>
      <Group label="Scheduled" count={board.scheduled.length}>
        {board.scheduled.map(r => <Scheduled key={r.automation.id} row={r} now={now} onOpen={open} />)}
      </Group>
      <Group label="Recently done" count={board.done.length}>
        {board.done.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} />)}
      </Group>
    </div>
  );
}
