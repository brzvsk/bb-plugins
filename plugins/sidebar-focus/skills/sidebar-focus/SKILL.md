---
name: sidebar-focus
description: Explain or troubleshoot the Sidebar Focus plugin, which focuses BB's sidebar on one group and tucks read automation threads into an Automations block.
---
Sidebar Focus changes BB's built-in thread list without replacing it.

Focus: every top-level group header (project, Pinned, Threads, custom section, machine) gets a crosshair button among its hover actions, left of New thread (on a header without actions it fades in on hover). Pressing it hides every other group and the More overflow with CSS; the pressed button stays visible in the header and unfocuses on the next press. The choice is per window in `localStorage` key `sidebar-focus:focus`; a focus whose group no longer exists shows everything.

Automations: the server RPC `automationThreads` reads the built-in `automations` plugin's `automations_overview` (target thread, else `lastRunThreadId`, enabled only) plus thread read state, refreshed every minute and on window focus. A native row of such a thread is hidden by a CSS `:has()` rule while it has no `[data-sidebar-thread-trailing-indicator]`, so it returns the moment BB paints an unread dot, spinner, question, failed send or draft. Hidden threads are listed in an Automations block inserted after the groups container; it is collapsed by default (`sidebar-focus:automations-open`), shows a count, opens itself while its thread is selected, and is absent when empty. The selected thread is held in the place it had when selected. Rows route through the hidden native anchor, so normal and modifier clicks behave like BB's own rows.

Enable or disable with `bb plugin enable sidebar-focus` / `bb plugin disable sidebar-focus`; disabling removes the style, buttons and block. It depends on `[data-bb-plugin="thread-list"]`, `[data-sidebar-visibility-group]`, `[data-sidebar-section-id]`, `[data-sidebar-sticky-tier="label"]`, `[data-sidebar-row-controls]`, `[data-sidebar-trailing-controls]`, `a[data-sidebar-thread-id]`, `.bb-sidebar-selected-row`, `[data-sidebar-thread-trailing-indicator]` and `[data-testid="sidebar-thread-list-more-trigger"]`, so a BB sidebar change can stop it until it is updated.
