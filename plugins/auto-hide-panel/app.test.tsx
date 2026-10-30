// @vitest-environment jsdom
import type { ExperimentalPanelTab } from "@get-bb/plugin-sdk/app";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { describe, expect, it, vi } from "vitest";
import { AutoHidePanel } from "./app";

type PanelTabs = {
  open: boolean;
  selectedKey: string | null;
  tabs: ExperimentalPanelTab[];
};

const fileTab = (name: string): ExperimentalPanelTab => ({
  key: name,
  title: name,
  status: null,
  closable: true,
  detail: { kind: "file", path: `/${name}` },
});

const infoTab: ExperimentalPanelTab = {
  key: "info",
  title: "Info",
  status: null,
  closable: false,
  detail: { kind: "info" },
};

const diffTab: ExperimentalPanelTab = {
  key: "diff",
  title: "Diff",
  status: null,
  closable: false,
  detail: {
    kind: "plugin",
    pluginId: "core",
    tab: { id: "diff", context: { kind: "thread" }, availability: "fixed" },
    params: null,
  },
};

function panelTabs(tabs: ExperimentalPanelTab[], open = true): PanelTabs {
  return { open, selectedKey: tabs[0]?.key ?? null, tabs };
}

function mount(tabs: ExperimentalPanelTab[], threadId = "thr_a", open = true) {
  const close = vi.fn(() => true);
  const state = panelTabs(tabs, open);
  const result = renderSlot({ component: AutoHidePanel }, { threadId }, {
    context: { threadId },
    experimental_panelTabs: state,
    experimental_panel: { close },
  });
  const rerender = (next: ExperimentalPanelTab[], nextThreadId = threadId, open = true) => {
    state.open = open;
    state.selectedKey = next[0]?.key ?? null;
    state.tabs = next;
    result.lifecycle.rerender(<AutoHidePanel threadId={nextThreadId} />);
  };
  return { close, result, rerender, state };
}

describe("auto-hide panel", () => {
  it("registers one bare thread-composer banner", async () => {
    const app = await loadPluginApp(() => import("./app"));
    expect(app.composerCustomizations.map(customization => customization.id)).toEqual(["auto-hide-panel"]);
    expect(app.composerCustomizations[0]).toMatchObject({
      scopes: ["thread"],
      banners: [{ id: "auto-hide-panel", chrome: "bare", component: AutoHidePanel }],
    });
    expect(app.appOverlays).toEqual([]);
    expect(app.threadContextSegments).toEqual([]);
    expect(app.contentScripts).toEqual([]);
  });

  it("closes the panel when the last closable tab goes away", () => {
    const { close, result, rerender } = mount([fileTab("README.md")]);
    expect(close).not.toHaveBeenCalled();

    rerender([]);

    expect(close).toHaveBeenCalledTimes(1);
    expect(result.inspection.experimental_panelCalls).toEqual([{ method: "close" }]);
  });

  it("closes when the last content tab goes while Info remains", () => {
    const { close, rerender } = mount([fileTab("README.md"), infoTab]);
    expect(close).not.toHaveBeenCalled();

    rerender([infoTab]);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps the panel open while another closable tab remains", () => {
    const { close, rerender } = mount([fileTab("a.md"), fileTab("b.md")]);
    rerender([fileTab("b.md")]);
    expect(close).not.toHaveBeenCalled();

    rerender([]);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("does not hide when the panel only ever held Info and Diff", () => {
    const { close, rerender } = mount([], "thr_a", false);
    expect(close).not.toHaveBeenCalled();

    rerender([infoTab, diffTab]);

    expect(close).not.toHaveBeenCalled();
  });

  it("does not hide on plugin load with zero closable tabs", () => {
    const { close } = mount([infoTab, diffTab]);
    expect(close).not.toHaveBeenCalled();
  });

  it("does not hide on a thread switch", () => {
    const { close, rerender } = mount([fileTab("README.md")], "thr_a");

    rerender([], "thr_b");

    expect(close).not.toHaveBeenCalled();
  });

  it("hides again after a thread switch once a new content tab closes", () => {
    const { close, rerender } = mount([fileTab("a.md")], "thr_a");

    rerender([fileTab("b.md")], "thr_b");
    expect(close).not.toHaveBeenCalled();

    rerender([], "thr_b");
    expect(close).toHaveBeenCalledTimes(1);
  });
});
