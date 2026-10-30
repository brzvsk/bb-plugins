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

const DONE_OPEN_KEY = "new-thread-layout:done-open";
/** Below this main-panel width the schedule card would overlap the column, so it joins the list instead. */
const CARD_MIN_WIDTH = 1060;

function previewLine(p: Preview | null | undefined): string {
  if (!p) return "";
  return p.role === "user" ? `You: ${p.text}` : p.text;
}

type Open = (thread: PluginSidebarThread) => void;

function plainClick(e: React.MouseEvent): boolean {
  return !(e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0);
}

function Row({ row, preview, now, onOpen }: { row: BoardRow; preview: Preview | null | undefined; now: number; onOpen: Open }) {
  const t = row.thread as PluginSidebarThread;
  const rowStatus = useSidebarThreadRowStatus(t.id);
  const next = formatNextRun(row.nextRunAt, now);
  const second = t.isArchived
    ? [t.archivedAt ? `Done ${formatAgo(t.archivedAt, now)}` : "Done", previewLine(preview)].filter(Boolean).join(" · ")
    : next
      ? `Next run ${next}${row.automationNames.length ? ` · ${row.automationNames.join(", ")}` : ""}`
      : previewLine(preview);
  const meta = row.children ? `${row.children} child` : "";
  return (
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
      {row.status && !t.isArchived ? <span className="ph-status">{row.status}</span> : null}
    </a>
  );
}

/** One schedule line: automation name, the next run, and the thread it runs in as the tooltip. */
function ScheduledLine({ row, now, onOpen }: { row: ScheduledRow; now: number; onOpen: Open }) {
  const next = formatNextRun(row.automation.nextRunAt, now);
  const t = row.thread as PluginSidebarThread | null;
  const title = t ? `${row.automation.name} · runs in ${t.displayTitle}` : `${row.automation.name} · runs in a new thread`;
  const body = (
    <>
      <Icon name="Clock" className="ph-card-icon" aria-hidden />
      <span className="ph-card-name">{row.automation.name}</span>
      {next ? <span className="ph-card-value">{next}</span> : null}
    </>
  );
  if (!t) return <div className="ph-card-row" title={title}>{body}</div>;
  return (
    <a
      className="ph-card-row ph-card-link"
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

function ScheduleCard({ rows, now, onOpen }: { rows: ScheduledRow[]; now: number; onOpen: Open }) {
  if (!rows.length) return null;
  return (
    <div className="ph-card" aria-label="Scheduled">
      {rows.map(r => <ScheduledLine key={r.automation.id} row={r} now={now} onOpen={onOpen} />)}
    </div>
  );
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

/** Width of the element's parent (the compose frame), live. */
function useFrameWidth(el: HTMLElement | null): number {
  const [width, setWidth] = useState(() => el?.parentElement?.clientWidth ?? 0);
  useEffect(() => {
    const frame = el?.parentElement;
    if (!frame) return;
    const ro = new ResizeObserver(() => setWidth(frame.clientWidth));
    ro.observe(frame);
    setWidth(frame.clientWidth);
    return () => ro.disconnect();
  }, [el]);
  return width;
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
  const frameWidth = useFrameWidth(topBar);
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

  const cardFits = !!board && board.scheduled.length > 0 && frameWidth >= CARD_MIN_WIDTH;
  // The docked card takes the frame's right edge; the column centers in the rest (see app.css).
  useEffect(() => {
    const frame = topBar?.parentElement;
    if (!frame) return;
    if (cardFits) frame.setAttribute("data-ph-docked", "");
    else frame.removeAttribute("data-ph-docked");
    return () => frame.removeAttribute("data-ph-docked");
  }, [topBar, cardFits]);

  if (!projectId || !board) return crumb;
  const schedule = <ScheduleCard rows={board.scheduled} now={now} onOpen={open} />;
  const empty = !board.pinned.length && !board.inProgress.length && !board.scheduled.length && !board.done.length;
  return (
    <div className="ph-board" data-ph-board="">
      {crumb}
      {cardFits && topBar?.parentElement ? createPortal(<div className="ph-card-dock">{schedule}</div>, topBar.parentElement) : null}
      {sidebar.status === "loading" ? <p className="ph-empty">Loading…</p> : null}
      {sidebar.status === "ready" && empty ? <p className="ph-empty">Nothing in progress here yet.</p> : null}
      {!cardFits ? <div className="ph-card-inline">{schedule}</div> : null}
      <Group label="Pinned" count={board.pinned.length}>
        {board.pinned.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} />)}
      </Group>
      <Group label="In progress" count={board.inProgress.length}>
        {board.inProgress.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} />)}
      </Group>
      <Group label="Recently done" count={board.done.length} open={doneOpen} onToggle={toggleDone}>
        {board.done.map(r => <Row key={r.thread.id} row={r} preview={previews.get(r.thread.id)} now={now} onOpen={open} />)}
      </Group>
    </div>
  );
}
