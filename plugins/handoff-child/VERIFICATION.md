# Verification

2026-10-29, BB 0.48.0, plugin SDK 0.6.94; Handoff Child 0.1.0.

- `npm test` (5 tests: handoff detection, submission parsing, adoption guard),
  `npm run typecheck`, `bb plugin build .` pass.
- Live headless BB web UI, scratch thread (archived after): Handoff to new
  thread → Send options lists Save draft…, New child thread, New child thread
  (no notifications), Send later…. Choosing the quiet row created
  `thr_ntcnnib662` with `parentThreadId` = the scratch thread and
  `parentNotifications: off`. The `auto` row shares the same path.
