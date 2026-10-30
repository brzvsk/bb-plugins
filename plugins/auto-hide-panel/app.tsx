import {
  definePluginApp,
  experimental_useAppPanel,
  experimental_usePanelTabs,
  useBbContext,
} from "@get-bb/plugin-sdk/app";
import { useEffect, useRef } from "react";

type PanelSnapshot = {
  threadId: string | null;
  open: boolean;
  closable: number;
};

type AutoHidePanelProps = {
  /** Test seam; the composer banner leaves it undefined and uses BbContext. */
  threadId?: string | null;
};

export function AutoHidePanel({ threadId }: AutoHidePanelProps) {
  const context = useBbContext();
  const panel = experimental_useAppPanel();
  const { open, tabs } = experimental_usePanelTabs();
  const currentThreadId = threadId === undefined ? context.threadId : threadId;
  const closable = tabs.filter(tab => tab.closable).length;
  const previous = useRef<PanelSnapshot | null>(null);

  useEffect(() => {
    const current: PanelSnapshot = { threadId: currentThreadId, open, closable };
    const last = previous.current;
    previous.current = current;
    if (!last || last.threadId !== current.threadId) return;
    if (!last.open || !current.open) return;
    if (last.closable > 0 && current.closable === 0) panel.close();
  }, [panel, currentThreadId, open, closable]);

  return null;
}

export default definePluginApp(app => {
  app.composer.customize({
    id: "auto-hide-panel",
    scopes: ["thread"],
    banners: [{ id: "auto-hide-panel", chrome: "bare", component: AutoHidePanel }],
  });
});
