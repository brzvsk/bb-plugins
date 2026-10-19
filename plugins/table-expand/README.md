# Table Expand (button-only fork)

Fork of [steveafrost/bb-plugin-table-expand](https://github.com/steveafrost/bb-plugin-table-expand)
v0.1.1 (MIT). A markdown table in the timeline opens full width in a dialog only
from the expand button that appears in its top-right corner on hover; clicking
the table itself does nothing, so text in it stays easy to select. Esc, the
close button or the backdrop closes the dialog.

It is a content script keyed on bb's markdown table DOM
(`[data-markdown-preview] div.overflow-x-auto > table`), so it may need updating
after bb releases.

## Develop

```sh
npm install
npm run typecheck && npm test
bb plugin build . && bb plugin install . --yes
```
