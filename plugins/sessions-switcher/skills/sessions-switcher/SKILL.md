---
name: sessions-switcher
description: Configure the Sessions’ switcher shortcut or explain recent-session switching in BB.
---
Hold Command and tap backtick (Control on non-Mac platforms), then release to open the selected session. Arrow keys move the selection; Escape cancels. The command palette opens the switcher for mouse/Enter selection. Seven sessions are shown; visited sessions precede recently updated fallback candidates. Visit history is local to this browser profile; archived/hidden/deleted threads are excluded. No thread emoji markers are added.

Change the shortcut in Settings → Keyboard → Switch recent sessions, or:

```sh
bb settings keyboard set plugin:sessions-switcher/cycle 'Mod+J'
bb settings keyboard reset plugin:sessions-switcher/cycle
```

BB resolves shortcut conflicts. A modifier-free binding stays open until Enter/click. Terminal or embedded-browser focus may reserve keys for its own surface. Disable/reload removes the switcher and pending navigation.
