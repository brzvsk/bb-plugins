# Thread list with search

bb's sidebar thread list plus a title search row under New thread and an Include archived toggle. See [the skill](skills/thread-list-search/SKILL.md) for behavior.

## Source layout

This is a patched copy of bb's bundled `plugins/thread-list` and `packages/shared-ui/src` (under `vendor/`) from the `get-bb/bb` tag `desktop-v0.46.1`. The unmodified snapshot is commit `56fc086`; `git diff 56fc086 -- plugins/thread-list-search` is the whole patch:

- `app/search/` — search state, title filter, and the search bar (new).
- `app/model/use-sidebar-data.ts` — feeds the filtered thread view to the list.
- `app/preferences/atoms.ts` — folds read as empty while a search is active.
- `app.tsx` — own slot id, renders the bar, leaves Move to bb's plugin.
- `server.ts` — forwards preference RPC to bb's `thread-list` plugin instead of storing its own.

## License

The vendored bb sources keep bb's MIT license and copyright ([LICENSE](LICENSE)).

## Updating to a newer bb

The bundled list changes with bb releases; this copy does not. To follow a new tag, re-extract both upstream trees over a fresh branch from `56fc086`, commit that as the new snapshot, and re-apply the patch above (cherry-pick or merge), then run the checks below.

## Checks

```sh
npm install
npm run typecheck
npm test
bb plugin build .
bb plugin install /Users/brzvsk/projects/bb-plugins/plugins/thread-list-search
```
