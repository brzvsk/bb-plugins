# Verification

2026-10-18, BB 0.46.1, plugin SDK 0.6.49.

- `npm test` (11 jsdom tests: eligibility, double-Escape timing/repeats/modifiers,
  popup and focus yielding, Esc hint, Send replacement and restoration),
  `npm run typecheck`, `bb plugin build .` pass.
- Live headless BB web UI, running thread: one Escape swaps the Stop icon for
  `Esc`, restored after 400 ms; the hidden composer action slot is `display: none`;
  one composer, no popups detected.
- Live desktop: the author stopped a running thread and pressed Play; the thread
  log shows `system/thread/interrupted` (manual-stop), `turn/completed`
  (interrupted), then a new turn whose user message is the continuation prompt.
