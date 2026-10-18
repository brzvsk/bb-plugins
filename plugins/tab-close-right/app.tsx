import { definePluginApp } from "@get-bb/plugin-sdk/app";

export default definePluginApp(app => {
  app.contentScripts.register({
    id: "tab-close-right",
    mount() {
      const style = document.createElement("style");
      style.dataset.tabCloseRight = "";
      style.textContent = `
[data-testid="secondary-panel-tab-strip"] div:has(> [data-tab-pill-close]) {
  padding-right: 26px !important;
}
[data-testid="secondary-panel-tab-strip"] [data-tab-pill-close] {
  left: auto !important;
  right: 5px !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
[data-testid="secondary-panel-tab-strip"] div:has(> [data-tab-pill-close]) > button[aria-pressed] > span {
  opacity: 1 !important;
}
[data-testid="secondary-panel-tab-strip"] div:has(> button[aria-pressed="true"]) > [data-tab-pill-close],
[data-testid="secondary-panel-tab-strip"] div:hover > [data-tab-pill-close],
[data-testid="secondary-panel-tab-strip"] div:focus-within > [data-tab-pill-close] {
  opacity: 1 !important;
  pointer-events: auto !important;
}
@media (hover: none) {
  [data-testid="secondary-panel-tab-strip"] [data-tab-pill-close] {
    opacity: 1 !important;
    pointer-events: auto !important;
  }
}
@media (pointer: coarse) {
  [data-testid="secondary-panel-tab-strip"] div:has(> [data-tab-pill-close]) {
    padding-right: 42px !important;
  }
}
`;
      document.head.append(style);
      return () => style.remove();
    },
  });
});
