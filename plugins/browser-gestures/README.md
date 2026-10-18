# Browser Gestures

Two-finger trackpad swipes go back and forward in the BB desktop browser, like Chrome on macOS.

- Swipe right to go back, left to go forward.
- A dark arrow slides in from the edge as you swipe. Navigation happens when you lift your fingers with the arrow fully out; pull back to cancel.
- Horizontal scrollers keep the swipe while they can still scroll in that direction. At their edge, a new swipe navigates.
- Vertical scrolling, swipes with modifier keys and swipes with no history in that direction are ignored.

Nothing is added to the toolbar. Turn gestures off with `bb plugin disable browser-gestures`.

## Limits

- BB desktop browser only, top-level documents only. Cross-origin iframes do not receive the gesture.
- The page cannot see when fingers leave the trackpad. A finger held completely still at the end commits after about 0.6 seconds; a slow release without momentum commits after the same delay.
- Uses the experimental browser page API of the Plugin SDK, so a future BB release may require an update.

No page content is read or sent anywhere. No external services or accounts.

## Development

Requires BB 0.46.1+ and Plugin SDK 0.6.49.

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Tests replay recorded MacBook trackpad sessions from `fixtures/trackpad-trace.json` and need Node 22.18+ for TypeScript stripping.
