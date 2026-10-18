import { definePluginApp } from "@get-bb/plugin-sdk/app";

// Wide New thread layout only; the compact (mobile) home has its own structure.
const panel = '[data-panel-id="root-compose-main-panel"]';
const content = `${panel} .relative > [class~="@container/page"].overflow-y-auto > div`;
const trigger = "[data-promptbox-project-control]";

const css = `
.ntl-heading {
  margin: max(2rem, calc(58vh - 140px - 7.5rem)) 0 2rem;
  padding: 0 0.25rem;
  font-size: 2rem;
  line-height: 1.25;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--foreground);
}
.ntl-line { margin: 0; font: inherit; overflow-wrap: anywhere; }
.ntl-sub { color: var(--muted-foreground); }
.ntl-project {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3em;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--foreground);
  cursor: pointer;
  text-decoration: underline dotted;
  text-decoration-thickness: 2px;
  text-underline-offset: 0.18em;
  text-decoration-color: var(--muted-foreground);
}
.ntl-project:hover { text-decoration-color: var(--foreground); }
.ntl-project:disabled { cursor: default; }
.ntl-project svg { width: 0.8em; height: 0.8em; align-self: center; flex: none; }
`;

const folderIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9' +
  'A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>';

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function greeting(now: Date): string {
  const day = now.getDay();
  const name = days[day]!;
  const hour = now.getHours();
  const weekend = day === 0 || day === 6;
  if (hour < 5) return weekend ? `Late ${name} night` : "Burning the midnight oil";
  if (hour < 12) {
    if (day === 1) return "Good morning. Fresh week";
    if (day === 5) return "Good morning. It's Friday";
    return weekend ? `Slow ${name} morning` : "Good morning";
  }
  if (hour < 17) {
    if (day === 5 || weekend) return `${name} afternoon`;
    return "Good afternoon";
  }
  if (hour < 22) {
    if (day === 5) return "Friday evening";
    if (day === 0) return "Sunday evening. Week ahead";
    return weekend ? `${name} evening` : "Good evening";
  }
  return weekend ? `Late ${name} night` : "Working late";
}

export default definePluginApp(app => {
  app.contentScripts.register({
    id: "new-thread-layout",
    mount() {
      const style = document.createElement("style");
      style.dataset.bbPlugin = "new-thread-layout";
      style.textContent = css;
      document.head.append(style);

      const heading = document.createElement("header");
      heading.className = "ntl-heading";
      const title = document.createElement("h1");
      title.className = "ntl-line";
      const sub = document.createElement("p");
      sub.className = "ntl-line ntl-sub";
      const project = document.createElement("button");
      project.type = "button";
      project.className = "ntl-project";
      project.innerHTML = folderIcon;
      const projectName = document.createElement("span");
      project.append(projectName);
      const lead = document.createTextNode("");
      sub.append(lead, project);
      heading.append(title, sub);

      let target: HTMLButtonElement | null = null;
      let restore: (() => void) | null = null;
      let frame = 0;

      // Shift the hidden native trigger onto the heading label so BB's own
      // project popover anchors under the heading, then put it back on close.
      const open = () => {
        if (!target || target.disabled || restore) return;
        const native = target;
        const from = native.getBoundingClientRect();
        const to = project.getBoundingClientRect();
        const dx = to.left - from.left;
        const dy = to.bottom - from.bottom;
        native.style.transform = `translate(${dx}px, ${dy}px)`;
        native.style.opacity = "0";
        const watcher = new MutationObserver(() => {
          if (native.getAttribute("data-state") !== "open") restore?.();
        });
        restore = () => {
          watcher.disconnect();
          native.style.transform = "";
          native.style.opacity = "";
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
        const text = greeting(new Date());
        if (title.textContent !== text) title.textContent = text;
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
      const clock = setInterval(schedule, 60_000);
      sync();

      return () => {
        observer.disconnect();
        clearInterval(clock);
        cancelAnimationFrame(frame);
        restore?.();
        project.removeEventListener("click", open);
        heading.remove();
        style.remove();
      };
    },
  });
});
