---
name: plan-tab
description: Explain or troubleshoot the Plan Tab plugin, which adds an Open link next to the plan file path in BB's Plan review banner.
---
In a pending **Plan review** banner (Claude Code plan mode or any provider that sends `planFilePath`), an underlined **Open** link appears right after the plan file path. Clicking it opens the plan file in the thread's preview panel as a tab; the review stays pending, and Approve plan / Keep planning are unchanged.

The plugin resolves the thread's host through its server RPC `host` (thread → environment → host) and opens the file with `experimental_openFilePreview`. It adds a hidden header bridge per thread pane to know which thread a banner belongs to. No settings, network services or credentials.

Enable/disable with `bb plugin enable plan-tab` / `bb plugin disable plan-tab`. It depends on BB banner markup (`[data-testid="plan-review-request"] > p.font-mono`); a BB layout change can stop it until it is updated. Upstream request: https://github.com/get-bb/bb/issues/4379. Without the plugin: `bb thread open <thread-id> <plan path>`.
