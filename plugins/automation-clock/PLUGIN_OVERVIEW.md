## What you get

- A small clock on every sidebar thread that an enabled automation works in, so scheduled threads stand out from one-off work.
- An automation that always runs in the same thread marks that thread. One that starts a new thread on every run marks its latest run thread, and the clock moves on with each run.
- With no status glyph, the clock takes the glyph's slot at the right edge of the row. With a spinner, unread dot or draft, it sits just left of that glyph.
- The clock uses the same muted tone as BB's working spinner.

## How it works

The plugin reads the automation list from BB's built-in Automations plugin once a minute and when the window regains focus. It only adds the clock to rows of BB's own sidebar; it does not change automations, threads or the row layout.

Hovering a row, focusing it or opening its menu hides the clock together with BB's own status glyph, so the row's usual hover actions show exactly as before.

## Requirements and limits

Requires the built-in Automations plugin. Paused automations get no clock, and an automation that starts a new thread per run shows no clock before its first run. Archived threads are hidden in the sidebar by default, so their clocks show only when archived threads are shown.

The clock is placed through BB's sidebar markup, so a future sidebar layout change can hide it until the plugin is updated. No settings, external service, account or API key.
