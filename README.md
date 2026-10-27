# BB plugins

Independent BB plugins in one repository. No root npm workspace or shared runtime dependencies.

## Tab Close Right

Source: `plugins/tab-close-right`. See its README for installation and compatibility.

From the repository root:

```sh
bb plugin install . --plugin tab-close-right
```

Each plugin has its own package manifest, lockfile and version. The `.bb/plugins.json` file is an installation index, not a marketplace submission.

## Browser Gestures

Source: `plugins/browser-gestures`. Two-finger trackpad swipes go back and forward in the BB desktop browser. See its README for limits.

```sh
bb plugin install . --plugin browser-gestures
```

## Release layout

Use independent immutable tags such as `tab-close-right/v0.1.0`. A separate BB Community entry for each plugin points to the shared public repository with `subdir: "plugins/tab-close-right"`, `tagPrefix: "tab-close-right/"` and `range: "^0.1.0"`. Adding a folder alone does not add a marketplace listing.

## Auto-hide Panel

`plugins/auto-hide-panel` hides the right panel after its last content tab closes. Independent of Tab Close Right. Released with tags such as `auto-hide-panel/v0.1.0`.

## New Thread Layout

`plugins/new-thread-layout` moves the New thread composer to the lower middle of the screen under a "Working on <project>" picker. Local only; not published to the marketplace.

## Play Continue

`plugins/play-continue` ports the DSH Play Continue plugin: double Escape stops the running thread, and a Play button in the Send position continues a stopped or failed turn. Local only; not published to the marketplace.

## Pinned Project Line

`plugins/pinned-project-line` adds a smaller, muted second line with the project name (including its emoji) under each pinned thread in the sidebar. Local only; not published to the marketplace.

## Automation Clock

`plugins/automation-clock` shows a small clock on sidebar threads that an enabled automation runs in (its target thread, or the latest run thread of one that starts a new thread per run): in the empty status slot, or left of a spinner, unread dot or draft. It hides on hover like bb's own status glyph, so hover actions show as usual. Released as `automation-clock/vX.Y.Z` tags for the Community marketplace.

## Plan Tab

`plugins/plan-tab` makes the plan file path in BB's Plan review banner clickable and adds an underlined **Open** link after it; both open the plan as a panel tab while the review stays pending. Stopgap for get-bb/bb#4379. Local only; not published to the marketplace.

## Browser No Drag

`plugins/browser-no-drag` stops pages in the BB desktop browser from dragging the BB window through their `-webkit-app-region: drag` CSS, which makes Linear issue pages unclickable. Workaround for get-bb/bb#5862; remove it once BB ships a fix. Local only; not published to the marketplace.

## Burn

`plugins/burn` shows what each thread costs: a chip under the prompt box, per-prompt and per-model breakdowns, budgets, and a spend page. Fork of
[kalindudc/burn](https://github.com/kalindudc/burn) by Kalindu De Costa, maintained here; it adds OpenCode usage from opencode's own database, DeepSeek peak-hour pricing, and token counts. MIT; see its [README](plugins/burn/README.md) and [credits](plugins/burn/README.md#credits).

```sh
bb plugin install . --plugin burn
```

## Model Visibility

`plugins/model-visibility` moves chosen model IDs out of BB's main model list into **More models**, where they stay selectable alongside search. Each enabled provider has its own hidden-ID list in the plugin settings page, and **Configure...** at the top of More models opens that page. New models stay visible until hidden. Desktop picker and handoff are supported; compact viewports fail open. Local only; not published to the marketplace.

```sh
bb plugin install . --plugin model-visibility
```
