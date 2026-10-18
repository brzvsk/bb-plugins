# Verification

Verified on installed BB 0.46.1, Plugin SDK 0.6.49, 2026-10-18.

- `npm run typecheck`: passed.
- `bb plugin build`: passed; installed plugin reports running.
- Live BB web UI: open New tab, close it -> Show right panel control appears (panel hidden).
- Reopen Info manually -> Info stays open.
- Open README.md plus New tab; close New tab -> README.md and panel remain open.
- Close remaining README.md -> panel hides.
- Tab Close Right remains enabled alongside this plugin.

The live check used the actual installed BB web UI in a separate headless browser session. Desktop native content is not changed by this plugin. Split layouts are outside this verification; ambiguous layouts are deliberately left unchanged.
