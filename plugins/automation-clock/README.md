# Automation Clock

Shows a small clock on BB sidebar threads that an enabled automation runs in (its target thread), so you can see at a glance which threads are on a schedule. With no status glyph the clock takes the glyph's slot; with a spinner, unread dot or draft it sits left of it. On hover the row shows its usual actions and the clock hides.

Automations that create a new thread on every run, and paused automations, get no clock. No settings, network services or credentials. Disabling the plugin removes every clock.

Requires BB 0.46.1+. Uses BB sidebar DOM markup and the built-in automations RPC; future changes may require an update.

Build: `npm ci --include=dev --ignore-scripts`, `npm run typecheck`, `npm test`, `npm run build`. Install: `bb plugin install . --yes`.
