# New Thread Layout

Reshapes BB's New thread screen:

- the composer moves from the top to the lower middle of the screen;
- above it, a large greeting that changes with the weekday and time of day (for example "Good morning. Fresh week", "Friday evening", "Working late");
- under the greeting, "Working on 📁 <project>" with a dotted underline. Clicking it opens BB's own project dropdown under the heading, and the label always shows the composer's selected project.

Homepage sections from other plugins stay below the composer. The compact (mobile) home is unchanged.

One `<style>` element and one heading element; both are removed when the plugin is disabled. No network calls, settings, or storage. The project picker is BB's native control: while it is open, its chip in the row below the composer is invisibly moved under the heading so the popover anchors there.

Requires BB 0.46.1+. Uses BB DOM attributes (`root-compose-main-panel`, `@container/page`, `data-promptbox-project-control`); future BB layout changes may require an update.

Build: `npm ci --include=dev --ignore-scripts`, `npm run typecheck`, `npm run build`. Install from the repository root: `bb plugin install . --plugin new-thread-layout`.
