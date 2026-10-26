---
name: model-visibility
description: Explain or troubleshoot the Model Visibility plugin, which moves chosen model IDs out of BB's main model list into More models.
---
Model Visibility adds a settings page under **Settings → Plugins → Model Visibility**. Each enabled provider lists its live catalog; checked model IDs are hidden from the main picker list.

Hidden models remain in **More models** and in picker search. A **Configure...** row at the top of More models opens the settings page. New models are visible by default because only explicitly checked IDs are hidden.

Settings are stored as a provider-id to model-id JSON map in plugin settings. Entries for providers that are disabled stay stored and apply again when the provider is re-enabled.

The frontend is a content script over the desktop picker DOM. It resolves the active provider from the active top tab (never by provider index), maps only uniquely labeled rows, and fails open when the provider label, a row label, or the native More popover is ambiguous. It owns ArrowUp/ArrowDown/Enter while hidden main rows exist, restores hidden rows in search mode, and clicks the original native row from More clones so selection callbacks stay native.

Compact/mobile viewports fail open. Desktop picker and desktop handoff are supported. A future BB picker layout change may require an update; the plugin never patches BB or uses React internals.

Useful commands:

```sh
bb plugin config model-visibility
bb plugin config model-visibility set hiddenModels '{"provider-id":["model-id"]}'
bb plugin disable model-visibility
bb plugin enable model-visibility
```
