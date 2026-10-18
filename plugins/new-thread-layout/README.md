# New Thread Layout

Moves the New thread composer from the top of the screen to the lower middle, with room above it. Homepage sections from other plugins stay below the composer. The compact (mobile) home is unchanged.

CSS only: one `<style>` element, removed when the plugin is disabled. No network calls, settings, or storage.

Requires BB 0.46.1+. Targets BB's `root-compose-main-panel` layout; future BB layout changes may require an update.

Build: `npm ci --include=dev --ignore-scripts`, `npm run typecheck`, `npm run build`. Install from the repository root: `bb plugin install . --plugin new-thread-layout`.
