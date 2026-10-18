---
name: archived-toggle
description: Explain or troubleshoot the Archived Threads Toggle button in the BB sidebar footer.
---
The archive icon in the sidebar footer flips bb's Thread list preference `threadLifecycles` between `["active"]` and `["active","archived"]`. It is the same setting as Organize → Show in the list, or:

```sh
bb thread-list prefs set threadLifecycles '["active","archived"]'
bb thread-list prefs set threadLifecycles '["active"]'
```

The plugin has no server and stores nothing. It calls the built-in `thread-list` plugin's RPC, so that plugin must be enabled; otherwise the button shows an error toast.
