import { useEffect, useState } from "react";
import { definePluginApp, type ExperimentalPluginBrowserToolbarActionProps } from "@get-bb/plugin-sdk/app";
import { cleanupScript, installScript } from "./page-script";

function Gestures({ experimental_page: page }: ExperimentalPluginBrowserToolbarActionProps) {
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState("Starting gestures");
  useEffect(() => {
    if (!page || !enabled) return;
    let disposed = false;
    let pending = false;
    const refresh = async () => {
      if (pending || disposed) return;
      pending = true;
      try {
        const diagnostic = await page.evaluate(installScript());
        if (!disposed) setStatus("Gestures on: " + String(diagnostic));
      } catch (error) {
        if (!disposed) setStatus(error instanceof Error ? error.message : "Page API unavailable");
      } finally {
        pending = false;
        if (disposed) void page.evaluate(cleanupScript).catch(() => {});
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 250);
    return () => {
      disposed = true;
      clearInterval(timer);
      void page.evaluate(cleanupScript).catch(() => {});
    };
  }, [page, enabled]);
  if (!page) return <span title="Browser page API unavailable" className="text-xs">Gestures unavailable</span>;
  return <button type="button" aria-label="Browser gestures" aria-pressed={enabled}
    title={enabled ? status : "Gestures off"} onClick={() => setEnabled(value => !value)}
    className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
    {enabled ? (status.startsWith("Gestures on") ? "↔" : "↔ !") : "↔ off"}
  </button>;
}

export default definePluginApp(app => {
  app.slots.experimental_browserToolbarAction({ id: "gestures", title: "Browser gestures", component: Gestures });
});
