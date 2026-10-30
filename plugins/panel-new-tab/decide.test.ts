import type { ExperimentalPanelTab } from "@get-bb/plugin-sdk/app";
import { describe, expect, it } from "vitest";
import { shouldOpenNewTab, snapshot } from "./decide";

const info: ExperimentalPanelTab = { key: "info", title: "Info", status: null, closable: false, detail: { kind: "info" } };
const diff: ExperimentalPanelTab = { key: "diff", title: "Diff", status: null, closable: false, detail: { kind: "plugin", pluginId: "bb--git", tab: { id: "diff", context: { kind: "thread" }, availability: "fixed" }, params: null } };
const file: ExperimentalPanelTab = { key: "f", title: "a.ts", status: null, closable: true, detail: { kind: "file", path: "/a.ts" } };

describe("shouldOpenNewTab", () => {
  it("opens a new tab when the panel opens on Info with no content tabs", () => {
    expect(shouldOpenNewTab(snapshot("t", false, "info", [info, diff]), snapshot("t", true, "info", [info, diff]))).toBe(true);
    expect(shouldOpenNewTab(snapshot("t", false, null, []), snapshot("t", true, null, []))).toBe(true);
  });
  it("leaves Diff opened from the context card alone", () => {
    expect(shouldOpenNewTab(snapshot("t", false, "info", [info, diff]), snapshot("t", true, "diff", [info, diff]))).toBe(false);
  });
  it("leaves the panel alone when it has content tabs", () => {
    expect(shouldOpenNewTab(snapshot("t", false, "info", [info, file]), snapshot("t", true, "info", [info, file]))).toBe(false);
  });
  it("does nothing on first load, thread switch, or while already open", () => {
    expect(shouldOpenNewTab(null, snapshot("t", true, "info", [info]))).toBe(false);
    expect(shouldOpenNewTab(snapshot("a", false, "info", [info]), snapshot("b", true, "info", [info]))).toBe(false);
    expect(shouldOpenNewTab(snapshot("t", true, "info", [info]), snapshot("t", true, "info", [info]))).toBe(false);
  });
});
