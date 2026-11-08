// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { automationStatus, branchView, runTime, sortAutomations } from "./format";

describe("branchView", () => {
  it("shows the branch and how far it is from its merge base", () => {
    expect(branchView({ outcome: "available", workspace: { branch: { currentBranch: "feat/x" }, mergeBase: { mergeBaseBranch: "main", aheadCount: 4, behindCount: 0 } } }))
      .toEqual({ name: "feat/x", detail: "4 ahead of main" });
  });
  it("has no detail when even with its base, and falls back to a short sha when detached", () => {
    expect(branchView({ outcome: "available", workspace: { branch: { currentBranch: "main" }, mergeBase: { mergeBaseBranch: "main", aheadCount: 0, behindCount: 0 } } }))
      .toEqual({ name: "main", detail: null });
    expect(branchView({ outcome: "available", workspace: { branch: { currentBranch: null }, checkout: { kind: "detached", headSha: "7cec64b50830" } } })?.name).toBe("7cec64b");
  });
  it("shows nothing for an unavailable workspace", () => {
    expect(branchView({ outcome: "unavailable" })).toBeNull();
    expect(branchView(undefined)).toBeNull();
  });
});

describe("automationStatus", () => {
  const base = { id: "a", projectId: "p", name: "Daily" };
  it("mirrors the Automations list states", () => {
    expect(automationStatus({ ...base, enabled: false, nextRunAt: 1 })).toBe("Paused");
    expect(automationStatus({ ...base, enabled: true, nextRunAt: null })).toBe("Not scheduled");
    expect(automationStatus({ ...base, enabled: true, lastRunStatus: "running", nextRunAt: 5 })).toBe("Running");
    expect(automationStatus({ ...base, problem: "missing-agent-prompt" })).toBe("Needs attention");
    expect(automationStatus({ ...base, enabled: true, nextRunAt: 2_000 }, 1_000)).not.toMatch(/Next/);
  });
});

describe("sortAutomations", () => {
  it("lists the soonest run first and keeps paused ones at the bottom in order", () => {
    const a = (id: string, rest: object) => ({ id, projectId: "p", name: id, ...rest });
    const sorted = sortAutomations([
      a("tue", { enabled: true, nextRunAt: 300 }),
      a("paused1", { enabled: false, nextRunAt: 50 }),
      a("unscheduled", { enabled: true, nextRunAt: null }),
      a("sun", { enabled: true, nextRunAt: 100 }),
      a("paused2", { enabled: false, nextRunAt: 10 }),
      a("running", { enabled: true, lastRunStatus: "running", nextRunAt: 900 }),
    ]);
    expect(sorted.map(x => x.id)).toEqual(["running", "sun", "tue", "unscheduled", "paused1", "paused2"]);
  });
});

describe("runTime", () => {
  it("names today and tomorrow, and dates further runs", () => {
    const now = new Date(2026, 10, 8, 12, 0).getTime();
    expect(runTime(new Date(2026, 10, 8, 16, 45).getTime(), now)).toMatch(/^Today, /);
    expect(runTime(new Date(2026, 10, 9, 8, 15).getTime(), now)).toMatch(/^Tomorrow, /);
    expect(runTime(new Date(2026, 10, 10, 19, 30).getTime(), now)).not.toMatch(/^(Today|Tomorrow)/);
  });
});
