# Verification

Verified on installed BB 0.46.1, Plugin SDK 0.6.49, 2026-10-18 (0.3.0).

- `npm run typecheck` and `bb plugin build`: passed; installed plugin reports running.
- Live BB web UI, headless 1600×1000: 1.5rem heading "Working without a project", composer below it in the lower middle. The layout selector matches one element (not the prompt editor).
- Heading click: BB's Project popover opens at the label's left edge, 4px below it; the native chip keeps opacity 1, no transform, its own position.
- Escape: closed, rect override removed.
- Native chip click: popover opens under the chip as in stock BB.
- Choosing `cockpit` from the heading popover: heading "Working on cockpit", native chip "cockpit", override removed.
- Earlier 0.2.0 checks still apply: `bb plugin disable` removes heading and style.

Desktop native chrome is unchanged. The compact (mobile) home is outside this plugin's selector.
