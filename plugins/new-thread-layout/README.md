# New Thread Layout

Reshapes BB's New thread screen:

- the composer moves from the top to the lower middle of the screen;
- above it, a large "Working on 📁 <project>" heading with a dotted underline ("Working without a project" when none is selected). Clicking the project opens BB's own project dropdown under the heading; the label always shows the composer's selected project.

BB's project chip under the composer stays visible and works as before. Homepage sections from other plugins stay below the composer. The compact (mobile) home is unchanged.

One `<style>` element and one heading element; both are removed when the plugin is disabled. No network calls, settings, or storage. While the dropdown is open from the heading, the native trigger reports the heading label's position to BB's popover so it anchors there; nothing is moved or hidden.

Requires BB 0.46.1+. Uses BB DOM attributes (`root-compose-main-panel`, `@container/page`, `data-promptbox-project-control`); future BB layout changes may require an update.

Build: `npm ci --include=dev --ignore-scripts`, `npm run typecheck`, `npm run build`. Install from the repository root: `bb plugin install . --plugin new-thread-layout`.
