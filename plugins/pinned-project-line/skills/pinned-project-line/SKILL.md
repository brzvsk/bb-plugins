---
name: pinned-project-line
description: Explain or troubleshoot the Pinned Project Line plugin, which shows each pinned thread's project under its title in the BB sidebar.
---
Pinned threads in the sidebar get a second, smaller line with their project name (including any emoji in the name). Rows grow from the sidebar row height by 12px; threads inside project groups are unchanged. Threads without a project show no line.

The plugin reads pinned threads and project names through its server RPC `pinned`, refreshes when a new pinned row appears and every minute for renames, and only adds DOM to existing rows. No settings, network services or credentials.

Enable/disable with `bb plugin enable pinned-project-line` / `bb plugin disable pinned-project-line`; disabling removes every added line. It depends on BB sidebar markup (`a[data-sidebar-thread-id]`, `.bb-thread-title`, `data-sidebar-visibility-group="project:…"`), so a BB layout change can stop it until it is updated.
