# BB plugins

Independent BB plugins in one repository. No root npm workspace or shared runtime dependencies.

## Tab Close Right

Source: `plugins/tab-close-right`. See its README for installation and compatibility.

From the repository root:

```sh
bb plugin install . --plugin tab-close-right
```

Each plugin has its own package manifest, lockfile and version. The `.bb/plugins.json` file is an installation index, not a marketplace submission.

## Future release layout

Use independent immutable tags such as `tab-close-right/v0.1.0`. A separate BB Community entry for each plugin points to the shared public repository with `subdir: "plugins/tab-close-right"`, `tagPrefix: "tab-close-right/"` and `range: "^0.1.0"`. Adding a folder alone does not add a marketplace listing.

No remote repository or release has been created as part of this preparation.
