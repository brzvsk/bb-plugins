# Panel New Tab

Private. When you open the right panel and it has no content tabs (only Info and Diff) and shows Info, it opens on a new tab instead. Opening Diff from the thread context card, loading a thread with the panel already open, and switching threads are left alone.

Watches the panel through BB 0.48.1's `experimental_usePanelTabs()`. The SDK's `openTab` only opens a plugin's own tabs, so the new tab is opened by pressing the panel's own "+" (`[data-panel-new-tab]`); a BB markup change would make it do nothing.
