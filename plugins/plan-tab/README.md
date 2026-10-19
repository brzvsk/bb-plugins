# Plan Tab

Adds an underlined **Open** link right after the plan file path in BB's Plan review banner. It opens the plan in the thread's preview panel as a tab, so a long plan can be read comfortably before choosing Approve plan or Keep planning. The review stays pending.

Stopgap for https://github.com/get-bb/bb/issues/4379. No settings, network services or credentials. Disabling the plugin removes the links.

Requires BB 0.46.1+. Uses BB banner DOM markup and the experimental `openFilePreview` API; future BB changes may require an update.

Build: `npm ci --include=dev --ignore-scripts`, `npm run typecheck`, `npm test`, `npm run build`. Install: `bb plugin install . --yes`.
