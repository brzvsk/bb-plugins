# Sessions’ switcher (like Alt+Tab)

An emoji-free horizontal card switcher for seven recent BB sessions, inspired by [Arc Switcher](https://getbb.app/marketplace/arc-switcher). Independent implementation using BB's native rebindable command API.

Hold **Cmd**, tap **`** to cycle, release Cmd to switch. On Windows/Linux the default modifier is Control. Move the pointer over a row to select it; releasing the held modifier opens that selection. Left/right arrow keys move through the cards (up/down also work); Escape cancels. The command palette also opens the list for click/Enter selection. Status indicators use BB’s own live sidebar state and `experimental_ThreadStatusGlyph`: running spinner, unread success/error, waiting for input, and other sidebar statuses. No emoji is assigned to threads or inserted in the sidebar/header; existing thread titles stay unchanged.

Change the binding in **Settings → Keyboard → Switch recent sessions**. The command ID is `plugin:sessions-switcher/cycle`. Overrides are owned by BB and survive plugin reload. Conflicting defaults remain unbound. A shortcut without a held modifier opens a persistent chooser.

Recently visited sessions take precedence over background updates. History is bounded to 50 IDs in this browser profile's localStorage; only seven visible, unarchived sessions are shown. Before any visits are recorded, recent updates provide initial choices.

## Development

```sh
npm ci --include=dev
npm run typecheck
npm test
bb plugin build .
bb plugin install .
```

Node 25's experimental global Web Storage can conflict with jsdom. On that Node version run `NODE_OPTIONS=--no-experimental-webstorage npm test`.

Live checks: quick Cmd+backtick twice toggles between two sessions; hold/repeat/release cycles; Escape cancels; rebind in Keyboard then verify the new combination; disable/reload leaves no overlay or stale listeners.

Uses the SDK's experimental header slot for router access; compose/settings routes fall back to a sidebar link or canonical URL. Shortcut scope follows BB; embedded terminals and browsers can reserve keys. No global macOS keyboard preferences are changed.

The surface fades/scales in over 120 ms and fades out over 80 ms. Navigation starts immediately on release. The card strip scrolls to keep the selection visible, and reduced-motion preferences disable the animations.

Choose **Horizontal cards** (default) or **Vertical list** in **Settings → Installed plugins → Sessions’ switcher → Layout**. The setting applies immediately and preserves the current selection.

Known desktop limitation: a native embedded Browser surface can cover this overlay. BB's browser-dimming hook is not exposed to plugins in SDK 0.6.49; fixing that requires a host API change.
