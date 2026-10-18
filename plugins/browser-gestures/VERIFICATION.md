# Verification, 2026-10-18

- Typecheck and plugin build passed; installed plugin reports running.
- Four tests execute the actual injected script: thresholds/directions/one action per burst; scrollable ancestor priority for the entire burst; ignored inputs; renewal, cooldown, cleanup and lease expiry.
- Actual BB desktop browser test page: synthetic negative horizontal wheel over the plain region followed by observed history transition from step 2 to step 1. Positive wheel over a scrollable child left step 1 unchanged.
- Physical trackpad input, native wheel default scrolling, forward navigation, and same-URL reload recovery still need live confirmation. Synthetic dispatch is not equivalent to OS input.
- Test page at http://127.0.0.1:18767/ has three history links, a horizontal scroller and a plain gesture area. The temporary local server must be running to use it.

## Correction after user trackpad report

The previous apparent synthetic history transition was insufficient evidence: the user reported that physical swipes did nothing. Navigation and cleanup were submitted as statement lists, but the SDK wraps an expression; both produced SyntaxError. Fixed them to parenthesized comma expressions and added a test at that API boundary. The separate automation tab currently has no installed handler marker; desktop toolbar availability/mounting is still being diagnosed. Do not treat native gesture behavior as verified.

## Approach change, 2026-10-18

Root-cause hypothesis for "swipes do nothing": Chromium makes only the first wheel event of a trackpad scroll sequence cancelable. The old handler called preventDefault only after 12px and treated `cancelable=false` as a reason to block the burst, so real swipes were always rejected; synthetic tests dispatched every event as cancelable and missed it.

New model: decide once at gesture start (vertical, modifier, horizontal scroller that can still move in that direction, missing history via `navigation.canGo*`, cooldown), then track progress regardless of cancelability, show a Chrome-like edge arrow, and navigate at 160px. Six tests cover the non-cancelable sequence. Physical trackpad confirmation still pending.

## Trace-driven rewrite, 2026-10-18

Recorded 506 real trackpad wheel events from the BB desktop browser (`fixtures/trackpad-trace.json`). Findings: every new touch starts with the only `cancelable=true` event of its sequence; while fingers rest on the pad, 1–3px events keep arriving every ~16ms (max observed gap 132ms); post-lift momentum arrives with `deltaY === 0` and large smooth steps. The 1.2s post-navigation cooldown swallowed quick repeat swipes, and the deceleration-based momentum guess fired while the user was still holding.

Now: a gesture starts only on a cancelable (touch-begin) event, so leftover momentum on a freshly loaded page cannot start one; release = new touch, 220ms of silence, or 5 smooth `deltaY === 0` steps of at least 6px. The recorded session replays as a test: every touch past 160px navigates exactly once and both 1.2–1.4s holds wait for lift. Cooldown plumbing removed; injection poll 250ms.

Second session (user: "much more stable"): a finger that comes to a complete stop sends no wheel events, which is indistinguishable in the page from a lift without momentum. Quiet release now waits 600ms when the arrow is full (220ms otherwise). The second recording is appended to the fixture; segments that begin without a touch-begin event (momentum carried across navigation) must not navigate.
