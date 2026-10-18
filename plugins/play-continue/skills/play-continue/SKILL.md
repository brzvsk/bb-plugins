---
name: play-continue
description: Explain or troubleshoot the Play Continue plugin's double-Escape stop shortcut and the Play button that continues an interrupted BB turn.
---

# Play Continue

- Double Escape (two presses within 400 ms) clicks the native Stop run button of
  the focused thread composer, or of the only visible one. It does nothing while
  a menu, dialog or listbox is open, or while focus is in another text field.
- Play replaces the disabled Send button when the thread is idle or errored, the
  composer is empty, nothing is queued, and the latest turn ended `interrupted`
  or `failed` or never completed. Clicking it submits a fixed continuation
  message through the composer, which starts a new turn.
- No commands, settings or server behavior. Not shown in compact composer layout
  or when the plugin's composer action lands in BB's overflow menu (more than
  three plugins with composer actions).
