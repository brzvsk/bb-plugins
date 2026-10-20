import { useEffect } from "react";
import { definePluginApp, type ExperimentalPluginBrowserToolbarActionProps } from "@get-bb/plugin-sdk/app";
import { cleanupScript, installScript } from "./page-script";

// The style is lost whenever the document navigates, so re-check it on a short
// interval while this tab's toolbar is mounted.
const REFRESH_MS = 500;

function NoDrag({ experimental_page: page }: ExperimentalPluginBrowserToolbarActionProps) {
  useEffect(() => {
    if (!page) return;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        await page.evaluate(installScript);
      } catch {
        // The tab may be navigating or gone; the next tick retries.
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      clearInterval(timer);
      void page.evaluate(cleanupScript).catch(() => {});
    };
  }, [page]);
  return null;
}

export default definePluginApp(app => {
  app.slots.experimental_browserToolbarAction({ id: "no-drag", title: "Browser no-drag", component: NoDrag });
});
