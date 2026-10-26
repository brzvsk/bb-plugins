# Hide Models

Moves chosen model IDs out of BB's main model list and into **More models**. Hidden models stay selectable from **More models** and from the picker search. New models stay visible until you hide them.

Open **Settings → Plugins → Hide Models** (or the plugin's detail page) to choose model IDs per enabled provider. Hidden IDs are stored per provider, so a provider disabled later keeps its choices and restores them when re-enabled.

**More models** starts with **Configure...**, which opens the plugin settings page.

## Behavior

- Hiding is a display partition, not a catalog or provider change. The selected model, reasoning level, and service tier stay untouched.
- The plugin validates the open picker against the live provider catalog. If the active provider, a row label, or the native More popover is ambiguous or unknown, it restores the native menu instead of hiding anything.
- Desktop picker and desktop handoff are supported. The compact/mobile drawer fails open: the native menu is left untouched.
- Existing native extra models are shown once; the plugin does not duplicate them.
- Tests cover hidden-row keyboard exclusion and verify that clone clicks call the original native row.

## Limits

This is a DOM adapter over BB 0.47.1 picker markup. A future BB layout change can disable it until repaired. It never patches BB or uses React internals. If the More menu cannot be validated, it fails open.

## Build and install

```sh
npm ci --include=dev --ignore-scripts
npm run typecheck
npm test
npm run build
bb plugin install . --yes
```

Disable with `bb plugin disable model-visibility`; disabling removes the content script and restores the native menu.
