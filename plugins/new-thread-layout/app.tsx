import { definePluginApp } from "@get-bb/plugin-sdk/app";
import "./app.css";
import { ProjectBoard } from "./board";
import { ThreadProjectCrumb } from "./crumb";

// Wide New thread layout only; the compact (mobile) home has its own structure.
const panel = '[data-panel-id="root-compose-main-panel"]';
const content = `${panel} .relative > [class~="@container/page"].overflow-y-auto > div`;
const trigger = "[data-promptbox-project-control]";

const folderIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9' +
  'A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>';

export default definePluginApp(app => {
  app.slots.homepageSection({ id: "board", title: "Project home", component: ProjectBoard });
  app.slots.experimental_appOverlay({ id: "thread-crumb", component: ThreadProjectCrumb });

  app.contentScripts.register({
    id: "new-thread-layout",
    mount() {
      const heading = document.createElement("header");
      heading.className = "ntl-heading";
      const sub = document.createElement("h1");
      sub.className = "ntl-line ntl-sub";
      const project = document.createElement("button");
      project.type = "button";
      project.className = "ntl-project";
      project.innerHTML = folderIcon;
      const projectName = document.createElement("span");
      project.append(projectName);
      const lead = document.createTextNode("");
      sub.append(lead, project);
      heading.append(sub);

      let target: HTMLButtonElement | null = null;
      let restore: (() => void) | null = null;
      let frame = 0;

      // BB's project popover anchors to its trigger's bounding rect. While it
      // is open from the heading, report the heading label's rect instead;
      // the native chip itself stays visible and untouched.
      const open = () => {
        if (!target || target.disabled || restore) return;
        const native = target;
        native.getBoundingClientRect = () => {
          const to = project.getBoundingClientRect();
          return new DOMRect(to.left, to.top, to.width, to.height);
        };
        const watcher = new MutationObserver(() => {
          if (native.getAttribute("data-state") !== "open") restore?.();
        });
        restore = () => {
          watcher.disconnect();
          delete (native as { getBoundingClientRect?: unknown }).getBoundingClientRect;
          restore = null;
        };
        watcher.observe(native, { attributes: true, attributeFilter: ["data-state"] });
        native.click();
        if (native.getAttribute("data-state") !== "open") {
          requestAnimationFrame(() => {
            if (native.getAttribute("data-state") !== "open") restore?.();
          });
        }
      };
      project.addEventListener("click", open);

      const sync = () => {
        frame = 0;
        const host = document.querySelector(content);
        if (!host) {
          heading.remove();
          target = null;
          return;
        }
        if (host.firstElementChild !== heading) host.prepend(heading);
        target = document.querySelector<HTMLButtonElement>(`${panel} ${trigger}`);
        const native = target?.querySelector("[data-promptbox-full-label]")?.textContent?.trim();
        const none = !native || native === "No project";
        const label = none ? "without a project" : native;
        const leadText = none ? "Working " : "Working on ";
        if (projectName.textContent !== label) projectName.textContent = label;
        if (lead.data !== leadText) lead.data = leadText;
        project.disabled = !target || target.disabled;
      };
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(sync);
      };
      const observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      sync();

      return () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
        restore?.();
        project.removeEventListener("click", open);
        heading.remove();
      };
    },
  });
});
