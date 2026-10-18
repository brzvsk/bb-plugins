import { definePluginApp } from "@get-bb/plugin-sdk/app";

// Wide New thread layout only; the compact (mobile) home has its own structure.
const scroll = '[data-panel-id="root-compose-main-panel"] .relative > [class~="@container/page"].overflow-y-auto';

const css = `
${scroll} > div::before {
  content: "";
  flex: 0 0 max(2rem, calc(58vh - 140px));
}
`;

export default definePluginApp(app => {
  app.contentScripts.register({
    id: "new-thread-layout",
    mount() {
      const style = document.createElement("style");
      style.dataset.bbPlugin = "new-thread-layout";
      style.textContent = css;
      document.head.append(style);
      return () => style.remove();
    },
  });
});
