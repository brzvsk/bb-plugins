import type { ExperimentalPanelTab } from "@get-bb/plugin-sdk/app";

export type PanelSnapshot = {
  threadId: string | null;
  open: boolean;
  closable: number;
  selected: ExperimentalPanelTab["detail"]["kind"] | null;
};

export function snapshot(threadId: string | null, open: boolean, selectedKey: string | null, tabs: readonly ExperimentalPanelTab[]): PanelSnapshot {
  const selected = tabs.find(tab => tab.key === selectedKey)?.detail.kind ?? null;
  return { threadId, open, closable: tabs.filter(tab => tab.closable).length, selected };
}

/**
 * Open a new tab only when, in the same thread, the panel has just opened with
 * no content tabs and shows Info (or nothing). Opening Diff from the context
 * card, loading a thread with the panel already open, or switching threads
 * never triggers it.
 */
export function shouldOpenNewTab(last: PanelSnapshot | null, current: PanelSnapshot): boolean {
  if (!last || last.threadId !== current.threadId) return false;
  if (last.open || !current.open) return false;
  if (current.closable > 0) return false;
  return current.selected === null || current.selected === "info";
}
