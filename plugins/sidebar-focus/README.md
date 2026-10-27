# Sidebar Focus

Two changes to BB's own sidebar thread list, layered on top of it rather than replacing it.

**Focus.** Hovering a group header (a project, Pinned, Threads, or a custom section) shows a crosshair left of New thread. Clicking it shows only that group; the pressed crosshair stays visible and clicking it again shows everything. The focus is remembered per window.

**Automations.** Threads that an enabled automation runs in (its target thread, or the latest run thread of an automation that starts a new one each run) leave their group once there is nothing to look at and appear in a collapsible **Automations** block below the list. As soon as BB shows any status on such a thread (unread dot, spinner, question, failed send, draft) it is back in its group, in BB's usual order. With no such threads there is no block. While focused, the block lists only the focused group's automation threads.

The selected thread stays where it was when you opened it, so opening an unread automation thread doesn't make it jump into the block, and opening one from the block keeps it there, highlighted.

Requires BB 0.47.1+ with the built-in Thread list and Automations plugins. Works through BB's sidebar markup, so a sidebar change can break it until updated. No settings, network services or credentials.

Build: `npm ci --include=dev --ignore-scripts`, `npm run typecheck`, `npm test`, `npm run build`. Install: `bb plugin install . --yes`.
