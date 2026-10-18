import { definePluginApp } from "@get-bb/plugin-sdk/app";

export default definePluginApp(app => {
  app.contentScripts.register({
    id: "auto-hide-panel",
    mount() {
      const selector = '[data-testid="thread-secondary-panel-top-chrome"]';
      let previous: { strip: Element; count: number; url: string } | null = null;
      let frame = 0;
      const scan = () => {
        frame = 0;
        const strips = Array.from(document.querySelectorAll(selector)).filter(
          strip => strip.getClientRects().length > 0,
        );
        if (strips.length !== 1) {
          previous = null;
          return;
        }
        const strip = strips[0]!;
        const count = strip.querySelectorAll("[data-tab-pill-close]").length;
        const url = location.href;
        const shouldHide = previous?.strip === strip && previous.url === url
          && previous.count > 0 && count === 0;
        previous = { strip, count, url };
        if (!shouldHide) return;
        const toggles = Array.from(document.querySelectorAll<HTMLButtonElement>(
          'button[aria-label^="Hide right panel"]',
        )).filter(button => button.getClientRects().length > 0 && !button.disabled);
        if (toggles.length === 1) toggles[0]!.click();
      };
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(scan);
      };
      const observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true });
      window.addEventListener("popstate", schedule);
      scan();
      return () => {
        observer.disconnect();
        window.removeEventListener("popstate", schedule);
        cancelAnimationFrame(frame);
      };
    },
  });
});
