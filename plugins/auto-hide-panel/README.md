# Auto-hide Panel

Hides BB's right panel when its last closable content tab is removed. Info and Diff do not count as content tabs. Opening Info manually, loading the plugin, or navigating to another thread does not itself hide the panel.

Uses BB's existing Hide right panel control. No network calls, credentials, runtime dependencies, or changes to tab closing handlers. Disabling the plugin removes its observer. Enable/disable with `bb plugin enable auto-hide-panel` and `bb plugin disable auto-hide-panel`.

Requires BB 0.46.1+. Uses DOM attributes from BB; future layout changes may require an update. If multiple tab strips or ambiguous hide controls are visible, it leaves the layout unchanged. This version targets the standard single right panel, not split layouts.

Build: `npm ci --include=dev --ignore-scripts`, `npm run typecheck`, `npm run build`. Install: `bb plugin install . --yes`.
