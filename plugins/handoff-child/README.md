# Handoff Child

BB's **Handoff to new thread** creates a top-level thread that only mentions
its source. This plugin adds two rows to the send menu (the chevron beside
**New thread**):

- **New child thread** — the new thread becomes a child of the source thread;
  the parent is notified of every outcome (`parentNotifications: auto`).
- **New child thread (no notifications)** — same link, the parent is not woken
  (`parentNotifications: off`).

The rows are enabled only while the draft mentions the current thread, which is
how the handoff draft (`Continue from @thread:…`) looks; the SDK exposes no
handoff flag. The server's `message.dispatch` hook links the newly created
thread with `threads.update` and never blocks the send. A plain follow-up in the
source thread or a thread that already has a parent is left alone.
