# Verification

Verified on installed BB 0.48.1, Plugin SDK 0.6.104, 2026-10-30.

- `npm run typecheck`: passed.
- `npm test`: 8 passed. `renderSlot` with `experimental_panelTabs` covers last closable tab closed, Info/Diff only, a thread switch, mount with zero closable tabs, and the remaining-content cases.
- `bb plugin build`: passed; installed plugin reports running.
- Live BB web UI (headless browser against the running server):
  - Open the right panel with Info only -> panel stays open.
  - Open a file preview tab -> panel stays open.
  - Close that last content tab -> panel hides (`aria-hidden=true`, moved offscreen), even with Info still fixed.
  - Reopen Info manually -> panel stays open.
  - Switch to another thread and back with the panel open -> panel stays open.

The watcher mounts as a bare, zero-size thread-composer banner and renders nothing. It reads `experimental_usePanelTabs()` and hides through `experimental_useAppPanel().close()`; no DOM tab counts, tab-strip selectors, or synthetic clicks on the Hide right panel control. Desktop native content is not changed.
