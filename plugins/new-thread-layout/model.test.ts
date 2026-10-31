import { describe, expect, it } from "vitest";
import { buildBoard, buildOverview, statusOf, type BoardThread } from "./model";
import { formatAgo, formatDay, formatNextRun, formatStamp, firstLine, readDraft } from "./format";
import { latestActivity } from "./previews";

const NOW = Date.parse("2026-10-30T12:00:00+03:00");
const H = 60 * 60 * 1000;

function thread(over: Partial<BoardThread> & { id: string }): BoardThread {
  return {
    projectId: "p1",
    href: `/projects/p1/threads/${over.id}`,
    displayTitle: over.id,
    parentThreadId: null,
    status: "idle",
    runtimeStatus: "idle",
    indicator: "none",
    hasPendingInteraction: false,
    isUnread: false,
    isPinned: false,
    isArchived: false,
    archivedAt: null,
    isHidden: false,
    updatedAt: NOW - H,
    ...over,
  };
}

describe("buildBoard", () => {
  it("splits a project's root threads into pinned, in progress and recently done", () => {
    const threads = [
      thread({ id: "pin", isPinned: true }),
      thread({ id: "work", runtimeStatus: "active", status: "active", updatedAt: NOW - 5 * H }),
      thread({ id: "idle", updatedAt: NOW - H }),
      thread({ id: "child", parentThreadId: "idle" }),
      thread({ id: "done", isArchived: true, archivedAt: NOW - 3 * H }),
      thread({ id: "old", isArchived: true, archivedAt: NOW - 8 * 24 * H }),
      thread({ id: "other", projectId: "p2" }),
      thread({ id: "hidden", isHidden: true }),
    ];
    const b = buildBoard(threads, [], "p1", NOW);
    expect(b.pinned.map(r => r.thread.id)).toEqual(["pin"]);
    expect(b.running.map(r => r.thread.id)).toEqual(["work"]);
    expect(b.inProgress.map(r => r.thread.id)).toEqual(["idle"]);
    expect(b.inProgress[0].children).toBe(1);
    expect(b.done.map(r => r.thread.id)).toEqual(["done"]);
    expect(b.scheduled).toEqual([]);
  });

  it("lists every upcoming automation under Scheduled; read idle bound threads leave In progress, unread or pinned ones stay", () => {
    const threads = [
      thread({ id: "daily", updatedAt: NOW - H }),
      thread({ id: "loud", isUnread: true }),
      thread({ id: "manager", isPinned: true }),
    ];
    const automations = [
      { id: "a1", projectId: "p1", name: "Daily", enabled: true, nextRunAt: NOW + 2 * H, execution: { targetThreadId: "daily" } },
      { id: "a2", projectId: "p1", name: "Loud", enabled: true, nextRunAt: NOW + 3 * H, execution: { targetThreadId: "loud" } },
      { id: "a3", projectId: "p1", name: "Manager", enabled: true, nextRunAt: NOW + H, execution: { targetThreadId: "manager" } },
      { id: "a4", projectId: "p1", name: "Fresh", enabled: true, nextRunAt: NOW + 4 * H },
      { id: "a5", projectId: "p1", name: "Paused", enabled: false, nextRunAt: NOW + 4 * H },
    ];
    const b = buildBoard(threads, automations, "p1", NOW);
    expect(b.inProgress.map(r => r.thread.id)).toEqual(["loud"]);
    expect(b.pinned[0].nextRunAt).toBe(NOW + H);
    expect(b.pinned[0].automationNames).toEqual(["Manager"]);
    expect(b.scheduled.map(r => [r.automation.name, r.thread?.id ?? null])).toEqual([
      ["Manager", "manager"],
      ["Daily", "daily"],
      ["Loud", "loud"],
      ["Fresh", null],
      ["Paused", null],
    ]);
  });

  it("separates running threads from idle ones, attention first, then recency", () => {
    const threads = [
      thread({ id: "recent", updatedAt: NOW }),
      thread({ id: "ask", hasPendingInteraction: true, updatedAt: NOW - 9 * H }),
      thread({ id: "busy", runtimeStatus: "active", updatedAt: NOW - 9 * H }),
    ];
    const b = buildBoard(threads, [], "p1", NOW);
    expect(b.running.map(r => r.thread.id)).toEqual(["busy"]);
    expect(b.inProgress.map(r => r.thread.id)).toEqual(["ask", "recent"]);
  });

  it("counts a root as running while any descendant or background work runs", () => {
    const threads = [
      thread({ id: "lead" }),
      thread({ id: "child", parentThreadId: "lead" }),
      thread({ id: "grandchild", parentThreadId: "child", runtimeStatus: "active" }),
      thread({ id: "bg", activity: { workflows: 0, backgroundAgents: 1, backgroundCommands: 0 } }),
      thread({ id: "quiet" }),
      thread({ id: "finished-kid", parentThreadId: "quiet", runtimeStatus: "active", isArchived: true, archivedAt: NOW }),
    ];
    const b = buildBoard(threads, [], "p1", NOW);
    expect(b.running.map(r => r.thread.id).sort()).toEqual(["bg", "lead"]);
    expect(b.inProgress.map(r => r.thread.id)).toEqual(["quiet"]);
  });
});

describe("statusOf", () => {
  it("names the states bb's thread list distinguishes", () => {
    expect(statusOf(thread({ id: "a", runtimeStatus: "active" })).status).toBe("Working");
    expect(statusOf(thread({ id: "a", runtimeStatus: "provisioning" })).status).toBe("Starting");
    expect(statusOf(thread({ id: "a", hasPendingInteraction: true }))).toMatchObject({ status: "Needs you", attention: true });
    expect(statusOf(thread({ id: "a", status: "error" }))).toMatchObject({ status: "Failed", attention: true });
    expect(statusOf(thread({ id: "a", isUnread: true })).status).toBe("Unread");
    expect(statusOf(thread({ id: "a", indicator: "queued-waiting" })).status).toBe("Queued");
    expect(statusOf(thread({ id: "a" })).status).toBe("");
  });
});

describe("format", () => {
  it("formats next runs relative to today", () => {
    expect(formatNextRun(NOW + 2 * H, NOW)).toMatch(/^Today, 14:00$/);
    expect(formatNextRun(NOW + 24 * H, NOW)).toMatch(/^Tomorrow, 12:00$/);
    expect(formatNextRun(NOW + 3 * 24 * H, NOW)).toMatch(/^Monday, 12:00$/);
    expect(formatNextRun(NOW + 6 * 24 * H, NOW)).toMatch(/^Thursday, 12:00$/);
    expect(formatNextRun(NOW + 7 * 24 * H, NOW)).toMatch(/^6 Nov, 12:00$/);
    expect(formatNextRun(NOW - 1, NOW)).toBeNull();
    expect(formatNextRun(null, NOW)).toBeNull();
  });
  it("stamps the last message like a messenger", () => {
    expect(formatStamp(NOW - 2 * H, NOW)).toBe("10:00");
    expect(formatStamp(NOW - 24 * H, NOW)).toBe("Thu");
    expect(formatStamp(NOW - 6 * 24 * H, NOW)).toBe("Sat");
    expect(formatStamp(NOW - 7 * 24 * H, NOW)).toBe("23 Oct");
  });
  it("names days for grouped lists", () => {
    expect(formatDay(NOW - H, NOW)).toBe("Today");
    expect(formatDay(NOW - 24 * H, NOW)).toBe("Yesterday");
    expect(formatDay(NOW - 3 * 24 * H, NOW)).toBe("Tuesday");
    expect(formatDay(NOW - 8 * 24 * H, NOW)).toBe("22 Oct");
  });
  it("formats how long ago", () => {
    expect(formatAgo(NOW - 20_000, NOW)).toBe("just now");
    expect(formatAgo(NOW - 5 * 60_000, NOW)).toBe("5 min ago");
    expect(formatAgo(NOW - 3 * H, NOW)).toBe("3 h ago");
    expect(formatAgo(NOW - 26 * H, NOW)).toBe("yesterday");
    expect(formatAgo(NOW - 4 * 24 * H, NOW)).toBe("4 days ago");
  });
  it("takes the first non-empty line of a preview", () => {
    expect(firstLine("\n\n  Hello   world\nmore")).toBe("Hello world");
    expect(firstLine("**Пилот закончен.** Ни `uv`")).toBe("Пилот закончен. Ни uv");
    expect(firstLine("## Title")).toBe("Title");
  });
});

describe("latestActivity", () => {
  const turn = (text: string, extra: Record<string, unknown> = {}) => ({ type: "client/turn/requested", data: { initiator: "user", systemMessageKind: "unlabeled", input: [{ type: "text", text }], ...extra } });
  const done = (item: Record<string, unknown>) => ({ type: "item/completed", data: { item } });
  const delta = (type: string, itemId: string, text: string) => ({ type, data: { itemId, delta: text } });

  it("takes the newest of author turns, agent messages and thoughts, skipping tool steps", () => {
    expect(latestActivity([done({ type: "agentMessage", id: "a", text: "**Готово.** Всё проверил" }), turn("сделай")])).toEqual({ kind: "agent", text: "Готово. Всё проверил" });
    expect(latestActivity([turn("сделай"), done({ type: "agentMessage", id: "a", text: "x" })])).toEqual({ kind: "user", text: "сделай" });
    expect(latestActivity([done({ type: "commandExecution", id: "c", presentation: { title: "npm test" } }), done({ type: "reasoning", id: "r", summary: [], content: ["Checking the header\n\nmore"] })])).toEqual({ kind: "thinking", text: "Checking the header" });
  });

  it("pieces a streaming thought or reply together and falls back while it has no text", () => {
    const streaming = [delta("item/reasoning/textDelta", "r2", " the header"), delta("item/reasoning/textDelta", "r2", "Checking"), done({ type: "agentMessage", id: "a1", text: "раньше" })];
    expect(latestActivity(streaming)).toEqual({ kind: "thinking", text: "Checking the header" });
    expect(latestActivity([delta("item/agentMessage/delta", "a2", "Почти"), done({ type: "agentMessage", id: "a1", text: "раньше" })])).toEqual({ kind: "agent", text: "Почти" });
    expect(latestActivity([delta("item/reasoning/textDelta", "r3", "  "), done({ type: "agentMessage", id: "a1", text: "раньше" })])).toEqual({ kind: "agent", text: "раньше" });
    expect(latestActivity([done({ type: "reasoning", id: "r4", content: ["Целиком"] }), delta("item/reasoning/textDelta", "r4", "Цел")])).toEqual({ kind: "thinking", text: "Целиком" });
  });

  it("skips bb notices, non-author turns and empty items", () => {
    expect(latestActivity([turn("[bb system] @thread:thr_x completed"), turn("сам", { initiator: "agent" }), done({ type: "agentMessage", id: "e", text: "" }), turn("ок")])).toEqual({ kind: "user", text: "ок" });
    expect(latestActivity([])).toBeNull();
  });
});

describe("readDraft", () => {
  const store = (entries: Record<string, string>) => {
    const keys = Object.keys(entries);
    return { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => entries[k] ?? null };
  };
  it("reads a thread's unsent draft from bb's promptbox storage", () => {
    const s = store({ "bb.promptbox.contents-p1-thr_a-3": JSON.stringify({ text: "\n  дописать   тесты\nещё", attachments: [] }), "bb.promptbox.contents-p1-thr_b-3": JSON.stringify({ text: "другой" }) });
    expect(readDraft("p1", "thr_a", s)).toBe("дописать тесты");
    expect(readDraft("p1", "thr_c", s)).toBeNull();
    expect(readDraft("p1", "thr_a", store({ "bb.promptbox.contents-p1-thr_a-3": "{oops" }))).toBeNull();
  });
});

import { projectTabs } from "./projects";

describe("projectTabs", () => {
  const p = (id: string, name: string, isPersonal = false) => ({ id, name, href: `/projects/${id}`, isPersonal });
  it("follows the thread list's order and hiding, leaves home out, and reports what is going on", () => {
    const projects = [p("home", "Personal", true), p("a", "Alpha"), p("b", "Beta"), p("c", "Gamma"), p("z", "Zeta")];
    const threads = [
      thread({ id: "1", projectId: "b", isUnread: true }),
      thread({ id: "2", projectId: "a", runtimeStatus: "active" }),
      thread({ id: "3", projectId: "a", hasPendingInteraction: true }),
      thread({ id: "4", projectId: "z", isUnread: true, isArchived: true, archivedAt: NOW }),
    ];
    const tabs = projectTabs(projects, threads, ["pinned", "project:b", "project:a", "threads"], ["project:c"]);
    expect(tabs.map(t => t.id)).toEqual(["b", "a", "z"]);
    expect(tabs.map(t => [t.unread, t.running, t.attention])).toEqual([[true, false, false], [false, true, true], [false, false, false]]);
  });
});

describe("buildOverview", () => {
  it("collects live and waiting threads from the projects, and every project's next runs", () => {
    const threads = [
      thread({ id: "run", projectId: "a", runtimeStatus: "active" }),
      thread({ id: "kidrun", projectId: "b" }),
      thread({ id: "kid", projectId: "b", parentThreadId: "kidrun", runtimeStatus: "active" }),
      thread({ id: "unread", projectId: "a", isUnread: true, latestAttentionAt: NOW - H }),
      thread({ id: "asks", projectId: "b", hasPendingInteraction: true, latestAttentionAt: NOW - 5 * H }),
      thread({ id: "quiet", projectId: "a", latestAttentionAt: NOW - 5 * H }),
      thread({ id: "fresh", projectId: "b", latestAttentionAt: NOW - H / 2 }),
      thread({ id: "fresher", projectId: "a", latestAttentionAt: NOW - 600_000 }),
      thread({ id: "gone", projectId: "a", latestAttentionAt: NOW - 600_000, isArchived: true, archivedAt: NOW }),
      thread({ id: "mine", projectId: "home", isUnread: true }),
      thread({ id: "hiddenproj", projectId: "c", isUnread: true }),
    ];
    const automations = [
      { id: "x", projectId: "a", name: "Later", enabled: true, nextRunAt: NOW + 5 * H },
      { id: "y", projectId: "home", name: "Soon", enabled: true, nextRunAt: NOW + H },
      { id: "z", projectId: "a", name: "Paused elsewhere", enabled: false },
      { id: "w", projectId: "home", name: "Paused at home", enabled: false },
      { id: "v", projectId: "c", name: "Hidden project", enabled: true, nextRunAt: NOW + 2 * H },
    ];
    const o = buildOverview(threads, automations, ["a", "b"], "home", NOW);
    expect(o.needsYou.map(r => r.thread.id)).toEqual(["asks", "unread"]);
    expect(o.running.map(r => r.thread.id).sort()).toEqual(["kidrun", "run"]);
    expect(o.recent.map(r => r.thread.id)).toEqual(["fresher", "fresh"]);
    expect(o.scheduled.map(r => r.automation.name)).toEqual(["Soon", "Later", "Paused at home"]);
    expect(o.done.map(r => r.thread.id)).toEqual(["gone"]);
  });
});
