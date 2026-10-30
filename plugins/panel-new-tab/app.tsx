import { definePluginApp, experimental_usePanelTabs, useBbContext } from "@get-bb/plugin-sdk/app";
import { useEffect, useRef } from "react";
import { shouldOpenNewTab, snapshot, type PanelSnapshot } from "./decide";

// The SDK's openTab only opens this plugin's own tabs, so bb's new tab is
// opened by pressing the panel's own "+" (marked data-panel-new-tab).
const NEW_TAB = "[data-panel-new-tab]";

function pressNewTab(attempt = 0): void {
  const button = document.querySelector<HTMLButtonElement>(NEW_TAB);
  if (button) {
    button.click();
    return;
  }
  if (attempt < 10) window.requestAnimationFrame(() => pressNewTab(attempt + 1));
}

export function PanelNewTab() {
  const { threadId } = useBbContext();
  const { open, selectedKey, tabs } = experimental_usePanelTabs();
  const previous = useRef<PanelSnapshot | null>(null);

  useEffect(() => {
    const current = snapshot(threadId, open, selectedKey, tabs);
    const last = previous.current;
    previous.current = current;
    if (shouldOpenNewTab(last, current)) pressNewTab();
  }, [threadId, open, selectedKey, tabs]);

  return null;
}

export default definePluginApp(app => {
  app.composer.customize({
    id: "panel-new-tab",
    scopes: ["thread"],
    banners: [{ id: "panel-new-tab", chrome: "bare", component: PanelNewTab }],
  });
});
