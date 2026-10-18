// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { getDefaultStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PluginThreadListProps } from "@get-bb/plugin-sdk/app";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { makePluginProject, makeSidebarThread } from "../model/fixtures.js";
import {
  resetPreferencesSyncForTest,
  setPreferencesMirrorStorageForTest,
} from "../preferences/preferences-sync.js";
import {
  defaultPreferences,
  type PreferenceValues,
} from "../../shared/preferences.js";
import {
  filterSidebarThreadsState,
  threadSearchQueryAtom,
} from "./thread-search.js";

const app = await loadPluginApp(() => import("../../app"));
const registration = app.threadLists[0];
if (!registration) throw new Error("thread list slot not registered");

const PROJECTS = [
  makePluginProject({ id: "proj_app", name: "App" }),
  makePluginProject({ id: "proj_web", name: "Web" }),
];

const THREADS = [
  makeSidebarThread({
    id: "thr_parent",
    projectId: "proj_app",
    title: "Release checklist",
    updatedAt: 9,
  }),
  makeSidebarThread({
    id: "thr_child",
    projectId: "proj_app",
    title: "Fix login bug",
    parentThreadId: "thr_parent",
    updatedAt: 8,
  }),
  makeSidebarThread({
    id: "thr_web",
    projectId: "proj_web",
    title: "Landing page copy",
    updatedAt: 7,
  }),
];

function props(): PluginThreadListProps {
  return {
    activeThreadId: null,
    activeProjectId: null,
    isCompactViewport: false,
    onNavigate: vi.fn(),
    searchQuery: "",
  };
}

function renderList(preferences: Partial<PreferenceValues> = {}) {
  setPreferencesMirrorStorageForTest(null);
  return renderSlot(registration, props(), {
    sidebarThreads: { projects: PROJECTS, sections: [], threads: THREADS },
    rpc: {
      listPreferences: () => ({
        preferences: { ...defaultPreferences(), ...preferences },
      }),
      setPreference: (input: unknown) => input,
    },
  });
}

function threadIds(): string[] {
  return Array.from(
    document.querySelectorAll("[data-sidebar-thread-id]"),
    (element) => element.getAttribute("data-sidebar-thread-id") ?? "",
  );
}

async function openSearch() {
  fireEvent.click(await screen.findByRole("button", { name: "Search" }));
  return screen.getByRole("searchbox", { name: "Search threads by title" });
}

afterEach(() => {
  cleanup();
  getDefaultStore().set(threadSearchQueryAtom, "");
  resetPreferencesSyncForTest();
  setPreferencesMirrorStorageForTest(undefined);
});

describe("filterSidebarThreadsState", () => {
  const state = { threads: THREADS, projects: PROJECTS };

  it("returns the same state for a blank query", () => {
    expect(filterSidebarThreadsState(state, "  ")).toBe(state);
  });

  it("matches every term case-insensitively and keeps nesting ancestors", () => {
    const filtered = filterSidebarThreadsState(state, "LOGIN fix");
    expect(filtered.threads.map((thread) => thread.id)).toEqual([
      "thr_parent",
      "thr_child",
    ]);
    expect(filtered.projects.map((project) => project.id)).toEqual([
      "proj_app",
    ]);
  });
});

describe("thread search bar", () => {
  it("swaps the Search row for an input that filters by title", async () => {
    renderList();
    await screen.findByText("Landing page copy");
    const input = await openSearch();
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: "landing" } });
    await waitFor(() => expect(threadIds()).toEqual(["thr_web"]));

    fireEvent.keyDown(input, { key: "Escape" });
    await screen.findByRole("button", { name: "Search" });
    await waitFor(() => expect(threadIds()).toHaveLength(3));
  });

  it("expands collapsed groups while searching without saving the change", async () => {
    const { rpcCalls } = renderList({
      organizationMode: "project",
      collapsedProjects: ["proj_web"],
    });
    await screen.findByText("Release checklist");
    expect(threadIds()).not.toContain("thr_web");

    const input = await openSearch();
    fireEvent.change(input, { target: { value: "copy" } });
    await waitFor(() => expect(threadIds()).toEqual(["thr_web"]));

    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(threadIds()).not.toContain("thr_web"));
    expect(rpcCalls.map((call) => call.method)).toEqual(["listPreferences"]);
  });

  it("Include archived writes bb's threadLifecycles preference", async () => {
    const { rpcCalls } = renderList();
    const toggle = await screen.findByRole("button", {
      name: "Include archived",
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    await waitFor(() =>
      expect(rpcCalls).toContainEqual(
        expect.objectContaining({
          method: "setPreference",
          input: { key: "threadLifecycles", value: ["active", "archived"] },
        }),
      ),
    );

    fireEvent.click(toggle);
    await waitFor(() =>
      expect(rpcCalls).toContainEqual(
        expect.objectContaining({
          method: "setPreference",
          input: { key: "threadLifecycles", value: ["active"] },
        }),
      ),
    );
  });
});
