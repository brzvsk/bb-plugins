---
name: handoff-child
description: Explain or troubleshoot the Handoff Child plugin, whose send-menu rows hand a thread off to a new child thread with or without parent notifications.
---

# Handoff Child

In handoff mode (the follow-up model picker's **Handoff to new thread**), the
chevron beside **New thread** offers **New child thread** and **New child
thread (no notifications)**. Either creates the handoff thread, then links it
to the source with `parentThreadId` and `parentNotifications` `auto` or `off`.

Troubleshooting:

- Rows disabled: the draft no longer mentions the source thread
  (`Continue from @thread:…` was removed).
- Thread created but not a child: check `bb plugin logs handoff-child` for
  `could not link`; link manually with
  `bb thread update <new-id> --parent-thread <source-id> --parent-notifications off`.
