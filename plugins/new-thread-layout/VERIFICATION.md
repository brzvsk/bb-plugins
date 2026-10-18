# Verification

Verified on installed BB 0.46.1, Plugin SDK 0.6.49, 2026-10-18 (0.2.0).

- `npm run typecheck` and `bb plugin build`: passed; installed plugin reports running.
- Live BB web UI, headless 1600×1000: heading "Sunday evening. Week ahead / Working on cockpit"; heading top 376px, composer top 488px. The layout selector matches one element (not the prompt editor).
- Clicking the project label opens BB's Project popover at the label's left edge, 4px below it. Choosing `cockpit` updates the label and the native chip; the native trigger's transform/opacity are cleared. Escape also closes and clears them.
- No project selected: "Working without a project".
- 1280×640: heading top 167px, composer 279–447px, fully visible.
- `bb plugin disable`: heading and style removed (0/0); re-enabled afterwards.

Desktop native chrome is unchanged. The compact (mobile) home is outside this plugin's selector.
