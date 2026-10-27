---
name: automation-clock
description: Explain or troubleshoot the Automation Clock plugin, which shows a clock on sidebar threads that an enabled automation runs in.
---
A sidebar thread that is the target thread (`execution.targetThreadId`) of an enabled BB automation shows a small clock at the right edge of its row. With no status glyph the clock takes the glyph's slot; with a spinner, unread dot or draft it sits left of that glyph. While the row is hovered, focused or has its menu open, the clock hides together with bb's own status glyph and the usual hover actions show.

Automations that start a new thread on every run are not bound to a thread and get no clock; paused automations get none either. The plugin's server RPC `bound` reads the built-in `automations` plugin's `automations_overview` RPC, refreshes every minute and on window focus, and only adds DOM to existing rows. No settings, network services or credentials.

Enable/disable with `bb plugin enable automation-clock` / `bb plugin disable automation-clock`; disabling removes every clock. It depends on BB sidebar markup (`a[data-sidebar-thread-id]`, `[data-sidebar-thread-trailing]`, `[data-sidebar-thread-trailing-indicator]`, `.bb-sidebar-hover-actions-fade`) and the automations RPC shape, so a BB change can stop it until it is updated.
