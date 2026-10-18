import { useEffect } from "react";
import { definePluginApp, type ExperimentalPluginBrowserToolbarActionProps } from "@get-bb/plugin-sdk/app";
import { cleanupScript, installScript } from "./page-script";

function Gestures({ experimental_page: page }: ExperimentalPluginBrowserToolbarActionProps) {
  useEffect(() => {
    if (!page) return;
    let disposed = false;
    let pending = false;
    const refresh = async () => {
      if (pending || disposed) return;
      pending = true;
      try {
        await page.evaluate(installScript());
      } catch {
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
  }, [page]);
  return null;
}

export default definePluginApp(app => {
  app.slots.experimental_browserToolbarAction({ id: "gestures", title: "Browser gestures", component: Gestures });
});
