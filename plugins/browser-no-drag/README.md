# Browser No Drag

Workaround for [get-bb/bb#5862](https://github.com/get-bb/bb/issues/5862): in the BB desktop browser, a page element with CSS `-webkit-app-region: drag` drags the whole BB window, and clicks and scrolling never reach the page. Sites that also ship an Electron desktop app use this property for their title bars. On Linear, for example, the issue body cannot be clicked or scrolled.

This plugin adds a style to every top-level page in the BB desktop browser that sets `app-region: no-drag` on all elements. A web page then cannot drag the BB window.

Nothing is added to the toolbar. Turn it off with `bb plugin disable browser-no-drag`. Remove the plugin once BB fixes #5862.

## Limits

- Top-level documents only. Same-origin and cross-origin iframes and shadow roots keep their own styles.
- After a navigation the page can be draggable for up to half a second, until the style is restored.
- Uses the experimental browser page API of the Plugin SDK, so a future BB release may require an update.

No page content is read or sent anywhere.

## Development

Requires BB 0.46.1+ and Plugin SDK 0.6.49.

```sh
npm ci
npm run typecheck
npm run build
```
