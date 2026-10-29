# Child Thread Model

Shows the model and reasoning level of each active child thread in BB's native **Active child threads** banner. A compact muted label sits at the right of each child row, for example `DeepSeek V4.1 Flash · High`. Provider catalogue display names are used when available; the raw model id and reasoning level stay in the label's tooltip.

The label comes from the execution tuple BB recorded for that child's latest dispatched turn, so it is child-specific. The model part truncates on narrow panes while the reasoning level stays visible. When the metadata is unknown or the child has not dispatched a turn, no label is shown. Labels update on a short refresh and on DOM changes, and are removed when the child row or its metadata goes away.

Works through BB's child-banner markup and the public `threads.events` SDK area. A banner or row DOM change can break the decoration until this plugin is updated. No settings, network services or credentials.

Build: `npm ci --include=dev --ignore-scripts`, `npm run typecheck`, `npm test`, `npm run build`. Install: `bb plugin install . --yes`.

The sidebar replaces a parent’s loader with BB’s shimmering ChildThread icon when only a visible descendant is working. If the parent has its own running turn or background work, only its native indicator remains. Live state comes from the SDK sidebar hook; no polling or new threads. The icon follows row changes and is removed on plugin unload.
