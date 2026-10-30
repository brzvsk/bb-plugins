// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { automationStatus, branchView } from "./format";

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
    expect(automationStatus({ ...base, enabled: true, nextRunAt: 2_000 }, 1_000)).toMatch(/^Next /);
  });
});
