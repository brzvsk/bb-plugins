## What you get

- Close the last file or other content tab in the right panel, and the panel hides itself, so the thread gets its full width back.
- Info and Diff do not count as content tabs. Info you open yourself stays open.
- Loading the plugin or switching threads never hides the panel by itself.

## How it works

The plugin watches BB's experimental panel-tabs API. When the last closable tab of the current panel disappears, it asks the panel controller to close the panel. Tab closing is unchanged. It makes no network calls and stores nothing.

## Limits

It follows BB's reported panel tabs and can only hide the panel through the controller. The API is experimental, so a future BB release may need a plugin update.
