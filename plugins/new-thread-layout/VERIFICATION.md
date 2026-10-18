# Verification

Verified on installed BB 0.46.1, Plugin SDK 0.6.49, 2026-10-18.

- `npm run typecheck` and `bb plugin build`: passed; installed plugin reports running.
- Live BB web UI (headless, 1600×1000): New thread composer top moves from 69px to 496px (≈58% of the height); one element matches the layout selector (not the prompt editor).
- 1280×640 viewport: composer top at 287px, controls fully visible.

Desktop native chrome is unchanged. The compact (mobile) home is outside this plugin's selector.
