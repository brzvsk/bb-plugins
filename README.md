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
