# Verification

2026-10-18, BB 0.46.1, plugin SDK 0.6.49; Play Continue 0.1.1.

- `npm test` (11 jsdom tests: eligibility, double-Escape timing/repeats/modifiers,
  popup and focus yielding, Esc hint, Send replacement and restoration),
  `npm run typecheck`, `bb plugin build .` pass.
- Live headless BB web UI, running thread: one Escape swaps the Stop icon for
  `Esc`, restored after 400 ms; the hidden composer action slot is `display: none`;
  one composer, no popups detected.
- Live desktop: the author stopped a running thread and pressed Play; the thread
  log shows `system/thread/interrupted` (manual-stop), `turn/completed`
  (interrupted), then a new turn whose user message is the continuation prompt.
- Live headless, scratch thread (archived after): Escape-Escape stopped the
  run (`manual-stop`, `interrupted`), Play appeared and a click started a new
  turn. In 0.1.1 Play measures 32×32 like Send, inside a full-opacity send pill
  (0.1.0 inherited the pill's `ml-1` and disabled `opacity-50`: 36 px and dim).
